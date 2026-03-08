import { createClient } from '@supabase/supabase-js';
import { Task } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface QueueStats {
    pending: number;
    queued: number;
    running: number;
    completed_today: number;
    avgTimeMs: number;
}

export async function enqueueProject(project_id: string): Promise<void> {
    // get_ready_tasks es una RPC de Supabase que hemos creado
    const { data: readyTasks, error } = await supabase.rpc('get_ready_tasks', {
        p_project_id: project_id
    });

    if (error) throw new Error(`enqueueProject error: ${error.message}`);

    if (readyTasks && readyTasks.length > 0) {
        const ids = readyTasks.map((t: Task) => t.id);
        await supabase
            .from('tasks')
            .update({ status: 'queued' })
            .in('id', ids)
            .eq('status', 'pending');
    }
}

export async function getNextBatch(max_concurrent: number = 5): Promise<Task[]> {
    // Buscamos cuántas están en running actualmente en todo el sistema
    const { count: runningCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running');

    const currentlyRunning = runningCount || 0;
    const availableSlots = max_concurrent - currentlyRunning;

    if (availableSlots <= 0) return []; // Cola llena

    // Buscamos tareas encoladas y ordenamos por prioridad
    const { data: queuedTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'queued')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(availableSlots);

    if (error || !queuedTasks) return [];

    return queuedTasks as Task[];
}

export async function markComplete(task_id: string, output: any): Promise<void> {
    const { data: task } = await supabase.from('tasks').select('project_id').eq('id', task_id).single();

    await supabase.from('tasks').update({
        status: 'completed',
        output_data: output,
        completed_at: new Date().toISOString()
    }).eq('id', task_id);

    if (task?.project_id) {
        // Al completar una, verificamos si se liberan dependencias y encolamos
        await enqueueProject(task.project_id);

        // Actualizamos recuento de proyecto
        const { data: progress } = await supabase.rpc('project_progress', { p_id: task.project_id });
        await supabase.from('projects').update({ progress_pct: progress }).eq('id', task.project_id);
    }
}

export async function markFailed(task_id: string, errorMessage: string): Promise<void> {
    const { data: task } = await supabase.from('tasks').select('retry_count, max_retries, project_id').eq('id', task_id).single();

    if (!task) return;

    const newRetryCount = (task.retry_count || 0) + 1;

    if (newRetryCount < (task.max_retries || 3)) {
        // Volver a pending para intentar después
        await supabase.from('tasks').update({
            status: 'pending',
            retry_count: newRetryCount
        }).eq('id', task_id);
    } else {
        // Fallo definitivo
        await supabase.from('tasks').update({
            status: 'failed',
            output_data: { error: errorMessage },
            completed_at: new Date().toISOString()
        }).eq('id', task_id);

        if (task.project_id) {
            await supabase.from('projects').update({ status: 'failed', error_log: [errorMessage] }).eq('id', task.project_id);
        }
    }
}

export async function pauseProject(project_id: string): Promise<void> {
    await supabase.from('projects').update({ status: 'paused' }).eq('id', project_id);
}

export async function resumeProject(project_id: string): Promise<void> {
    await supabase.from('projects').update({ status: 'running' }).eq('id', project_id);
    await enqueueProject(project_id);
}

export async function getQueueStats(): Promise<QueueStats> {
    const { data, error } = await supabase.from('tasks').select('status');
    if (error) throw error;

    let stats: QueueStats = {
        pending: 0,
        queued: 0,
        running: 0,
        completed_today: 0,
        avgTimeMs: 0
    };

    for (const t of data) {
        if (t.status === 'pending') stats.pending++;
        if (t.status === 'queued') stats.queued++;
        if (t.status === 'running') stats.running++;
        if (t.status === 'completed') stats.completed_today++;
    }

    return stats;
}
