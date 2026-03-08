import { createClient } from '@supabase/supabase-js';
import { Project, Task, Agent } from './types';
import { markFailed, resumeProject } from './task-queue';
import { Communications } from '../../tools';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Dashboard {
    project_id: string;
    progress_pct: number;
    status: string;
    tasks_count: { pending: number, queued: number, running: number, completed: number, failed: number };
    active_agents: number;
    time_elapsed_ms: number;
    estimated_remaining_ms: number;
}

export interface Bottleneck {
    type: 'task_stuck' | 'agent_failure' | 'project_blocked' | 'tool_error';
    entity_id: string;
    details: string;
}

export function startMonitoring(project_id: string): void {
    // Inicia un bucle de monitoreo cada 10 segundos
    const interval = setInterval(async () => {
        const { data: proj } = await supabase.from('projects').select('status').eq('id', project_id).single();
        if (!proj || proj.status === 'completed' || proj.status === 'failed') {
            clearInterval(interval);
            return;
        }

        const bottlenecks = await detectBottlenecks(project_id);

        for (const b of bottlenecks) {
            if (b.type === 'task_stuck') {
                // Tarea tardó más del doble, asumimos agente muerto -> forzamos fail para retry
                await markFailed(b.entity_id, 'Timeout forzado por Progress Tracker (>2x timeout esperado)');
            }
            if (b.type === 'agent_failure') {
                await handleAgentFailure(b.entity_id, '');
            }
            if (b.type === 'project_blocked') {
                await Communications.sendMessage('telegram', process.env.TELEGRAM_OWNER_ID || '', `⚠️ Alerta: El Proyecto ${project_id} parece bloqueado sin tareas activas y el progreso no es 100%.`);
            }
        }

        // Reporte cada 25% (Aprox)
        const { data: p } = await supabase.from('projects').select('progress_pct').eq('id', project_id).single();
        if (p && p.progress_pct > 0 && p.progress_pct % 25 === 0) {
            await sendProgressUpdate(project_id);
        }

    }, 10000); // Check cada 10s
}

export async function detectBottlenecks(project_id: string): Promise<Bottleneck[]> {
    const issues: Bottleneck[] = [];

    // 1. Tareas Stuck (>2x timeout)
    const { data: runningTasks } = await supabase.from('tasks').select('*').eq('project_id', project_id).eq('status', 'running');
    if (runningTasks) {
        for (const t of runningTasks) {
            const started = new Date(t.started_at).getTime();
            const now = new Date().getTime();
            const elapsed = now - started;
            if (elapsed > (t.timeout_ms * 2)) {
                issues.push({ type: 'task_stuck', entity_id: t.id, details: `Tarea llevaba ${elapsed}ms ejecutando (límite: ${t.timeout_ms})` });
            }
        }
    }

    // 2. Agentes en error
    const { data: activeAgents } = await supabase.from('agents').select('*').eq('status', 'error');
    if (activeAgents && activeAgents.length > 0) {
        for (const a of activeAgents) {
            issues.push({ type: 'agent_failure', entity_id: a.id, details: `El agente ${a.name} reportó un error crítico interno.` });
        }
    }

    // 3. Bloqueo de proyecto
    const { data: allTasks } = await supabase.from('tasks').select('status').eq('project_id', project_id);
    if (allTasks) {
        const hasPending = allTasks.some(t => t.status === 'pending' || t.status === 'queued');
        const hasRunning = allTasks.some(t => t.status === 'running');
        if (hasPending && !hasRunning) {
            // El proyecto tiene tareas pendientes pero ninguna corriendo -> Bloqueo circular o error de cola
            issues.push({ type: 'project_blocked', entity_id: project_id, details: `Proyecto estancado sin tareas running.` });
        }
    }

    return issues;
}

export async function handleAgentFailure(agent_id: string, task_id: string): Promise<void> {
    // Retiramos el agente disfuncional
    await supabase.from('agents').update({ status: 'retired' }).eq('id', agent_id);

    // Devolvemos la tarea (si existe) a pending para que otro agente la tome
    if (task_id) {
        await supabase.from('tasks').update({ status: 'pending', assigned_agent: null }).eq('id', task_id);
    }
}

export async function getProjectDashboard(project_id: string): Promise<Dashboard> {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', project_id).single();
    const { data: tasks } = await supabase.from('tasks').select('status, timeout_ms, started_at').eq('project_id', project_id);

    let pending = 0, queued = 0, running = 0, completed = 0, failed = 0;
    let totalTimeoutMs = 0;

    tasks?.forEach(t => {
        if (t.status === 'pending') pending++;
        if (t.status === 'queued') queued++;
        if (t.status === 'running') running++;
        if (t.status === 'completed') completed++;
        if (t.status === 'failed') failed++;
        totalTimeoutMs += (t.timeout_ms || 0);
    });

    const startedMs = proj?.started_at ? new Date(proj.started_at).getTime() : new Date().getTime();
    const elapsed = new Date().getTime() - startedMs;

    return {
        project_id,
        progress_pct: proj?.progress_pct || 0,
        status: proj?.status || 'unknown',
        tasks_count: { pending, queued, running, completed, failed },
        active_agents: running, // aprox 1:1
        time_elapsed_ms: elapsed,
        estimated_remaining_ms: Math.max(0, totalTimeoutMs - elapsed)
    };
}

export async function sendProgressUpdate(project_id: string): Promise<void> {
    const { data: p } = await supabase.from('projects').select('title, progress_pct').eq('id', project_id).single();
    if (!p) return;

    try {
        await Communications.sendMessage('telegram', process.env.TELEGRAM_OWNER_ID || '', `🟡 Proyecto Fase 3: "${p.title}" - ${p.progress_pct}% completado.`);
    } catch (e) { console.error('Error sendProgressUpdate', e) }
}
