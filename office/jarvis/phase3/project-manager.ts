import { createClient } from '@supabase/supabase-js';
import { Project, Task, Agent, ProjectStatus } from './types';
import { decomposeObjective, TaskPlan } from './task-decomposer';
import { spawnAgent, retireAgent } from './agent-spawner';
import { enqueueProject, getNextBatch, markComplete, markFailed } from './task-queue';
import { Communications } from '../../tools'; // Orquestador de alertas

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function createProject(objective: string, options?: any): Promise<Project> {
    // 1. Descomponer
    const plan: TaskPlan = await decomposeObjective(objective);

    // 2. Crear Proyecto en BD
    const { data: projData, error: projErr } = await supabase
        .from('projects')
        .insert({
            title: `Proyecto: ${objective.substring(0, 50)}...`,
            objective: objective,
            status: 'planning',
            created_by: 'jarvis'
        })
        .select()
        .single();

    if (projErr) throw new Error(`createProject error: ${projErr.message}`);
    const project = projData as Project;

    // 3. Crear tareas en BD y mantener un mapa de "id_ref -> ID_UUID"
    const idMap: Record<number, string> = {};
    const taskInsertPromises = plan.tasks.map(async (t) => {
        const { data: createdTask } = await supabase
            .from('tasks')
            .insert({
                project_id: project.id,
                title: t.title,
                description: t.description,
                tools_needed: t.tools_needed,
                model_hint: t.model_hint,
                priority: t.priority,
                timeout_ms: t.estimated_duration_ms,
                status: 'pending'
            })
            .select()
            .single();
        if (createdTask) {
            idMap[t.id_ref] = createdTask.id;
        }
        return { refTask: t, created_id: createdTask?.id };
    });

    const createdTasksArray = await Promise.all(taskInsertPromises);

    // 4. Crear dependencias en BD
    for (const t of createdTasksArray) {
        if (!t.created_id) continue;
        const taskDef = t.refTask;
        if (taskDef.depends_on_refs && taskDef.depends_on_refs.length > 0) {
            for (const ref of taskDef.depends_on_refs) {
                const depends_on_uuid = idMap[ref];
                if (depends_on_uuid) {
                    await supabase.from('task_dependencies').insert({
                        task_id: t.created_id,
                        depends_on_id: depends_on_uuid
                    });
                }
            }
        }
    }

    // 5. Cambiar a status 'running' y encolar las listas
    await supabase.from('projects').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', project.id);
    await enqueueProject(project.id);

    // 6. Notificar por Telegram
    try {
        await Communications.sendMessage('telegram', process.env.TELEGRAM_OWNER_ID || '', `🚀 Proyecto iniciado: "${project.title}". Asignadas ${createdTasksArray.length} tareas a la oficina.`);
    } catch (e) { console.error('Error notificando', e) }

    return project;
}

export async function runProject(project_id: string): Promise<void> {
    // 1. Sacar tareas batch (max_concurrent = 5 en getNextBatch())
    const batch = await getNextBatch(5);
    if (!batch || batch.length === 0) {
        // Podría estar finalizado
        const { data: proj } = await supabase.from('projects').select('progress_pct').eq('id', project_id).single();
        if (proj && proj.progress_pct === 100) {
            await finalizeProject(project_id);
        }
        return;
    }

    // 2. Ejecutar tareas en paralelo
    const executionPromises = batch.map(async (task) => {
        // Marcar como running
        await supabase.from('tasks').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', task.id);

        try {
            // Asignar agente
            const agent = await spawnAgent(task);

            // Vincular agente en DB
            await supabase.from('tasks').update({ assigned_agent: agent.id }).eq('id', task.id);

            // Ejecutar 
            const result = await executeTask(task, agent);

            // Completar
            await markComplete(task.id, result);

            // Retirar/Liberar agente
            await retireAgent(agent.id);

        } catch (error: any) {
            await markFailed(task.id, error.message);
        }
    });

    await Promise.all(executionPromises);
}

export async function executeTask(task: Task, agent: Agent): Promise<any> {
    // 1. Obtener outputs de dependencias para contexto (opcional)
    const { data: deps } = await supabase.from('task_dependencies').select('depends_on_id').eq('task_id', task.id);
    let contextData = '';

    if (deps && deps.length > 0) {
        const depIds = deps.map(d => d.depends_on_id);
        const { data: prevTasks } = await supabase.from('tasks').select('title, output_data').in('id', depIds);
        if (prevTasks) {
            contextData = JSON.stringify(prevTasks);
        }
    }

    const finalPrompt = `
      ${agent.system_prompt}
      CONTEXTO ANTERIOR: ${contextData}
    `;

    // Invocación a LLM según model. 
    // Dado que existe /api/agent/chat, simularemos llamar a un helper propio de Jarvis
    // AQUI iría la llama real usando "Tools.Registry" o un helper HTTP para no acoplar.
    // Simularemos el output para el ejemplo arquitectónico:

    // Si la llamada real tomara tiempo, await new Promise(r => setTimeout(r, 2000));
    const mockOutput = {
        result: `Completado por ${agent.name}`,
        summary: "Tarea procesada exitosamente."
    };

    return mockOutput;
}

export async function finalizeProject(project_id: string): Promise<void> {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', project_id).single();
    if (!proj || proj.status === 'completed') return;

    // Obtener outputs finales de tareas clave (simplificado: todas)
    const { data: tasks } = await supabase.from('tasks').select('title, output_data').eq('project_id', project_id);

    // Guardar final
    await supabase.from('projects').update({
        status: 'completed',
        result: { summary: 'Proyecto Completado Correctamente', details: tasks },
        completed_at: new Date().toISOString()
    }).eq('id', project_id);

    try {
        await Communications.sendMessage('telegram', process.env.TELEGRAM_OWNER_ID || '', `✅ Proyecto completado: "${proj.title}". Jarvis te invita a revisar el tablero.`);
    } catch (e) { }
}

export async function getProjectStatus(project_id: string): Promise<ProjectStatus> {
    const { data } = await supabase.from('projects').select('status').eq('id', project_id).single();
    return data?.status || 'pending';
}

export async function listProjects(filter?: any): Promise<Project[]> {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    return (data || []) as Project[];
}
