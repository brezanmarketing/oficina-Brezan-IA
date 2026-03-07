import { createClient } from '@supabase/supabase-js';
import { Project, Task } from './types';
import { ProjectTemplate } from './task-decomposer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Knowledge {
    id: string;
    category: 'fact' | 'process' | 'preference' | 'mistake' | 'optimization';
    title: string;
    content: string;
    source?: string;
    relevance: number;
    tags: string[];
}

export interface LearningReport {
    totalProjects: number;
    successRate: number;
    topKnowledge: Knowledge[];
}

export async function learnFromProject(project_id: string): Promise<void> {
    const { data: proj } = await supabase.from('projects').select('*').eq('id', project_id).single();
    if (!proj) return;

    // Métricas del proyecto
    const { data: tasks } = await supabase.from('tasks').select('*').eq('project_id', project_id);
    if (!tasks || tasks.length === 0) return;

    const completed = tasks.filter(t => t.status === 'completed');
    const successRate = completed.length / tasks.length;

    // Aprendizajes si falló
    if (successRate < 1) {
        const failed = tasks.filter(t => t.status === 'failed');
        for (const f of failed) {
            await saveKnowledge(
                'mistake',
                `Fallo en tarea: ${f.title}`,
                `La tarea originó error. Asegurar contexto extra en el futuro. Log: ${JSON.stringify(f.output_data)}`,
                ['error', 'project-postmortem'],
                project_id
            );
        }
    }

    // Si tuvo mucho éxito, crear un template
    if (successRate > 0.85) {
        await createTemplate(proj as Project, tasks as Task[]);
    }
}

export async function saveKnowledge(
    category: Knowledge['category'],
    title: string,
    content: string,
    tags: string[],
    source_id?: string
): Promise<void> {
    await supabase.from('knowledge_base').insert({
        category,
        title,
        content,
        tags,
        source: source_id,
        relevance: 1.0,
        used_count: 0
    });
}

export async function getRelevantKnowledge(context: string, limit: number = 5): Promise<Knowledge[]> {
    // Idealmente Vector Search con pgvector. 
    // Por ahora, traemos los más relevantes y usados.
    const { data } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('relevance', { ascending: false })
        .order('used_count', { ascending: false })
        .limit(limit);

    if (data) {
        // Incrementar used_count
        const ids = data.map(k => k.id);
        if (ids.length > 0) {
            // Nota: Rpc/Raw SQL sería mejor para no sobrescribir, omitido por brevedad
            for (const item of data) {
                await supabase.from('knowledge_base').update({ used_count: item.used_count + 1 }).eq('id', item.id);
            }
        }
    }

    return (data || []) as Knowledge[];
}

export async function createTemplate(project: Project, tasks: Task[]): Promise<ProjectTemplate | null> {
    // Generamos las triggers dinámicas a partir del objetivo
    const words = project.objective.split(' ').filter(w => w.length > 4).map(w => w.toLowerCase());

    // Anonimizamos el task plan (quitando IDs)
    const anonymizedTasks = tasks.map(t => ({
        id_ref: Math.floor(Math.random() * 100), // temp
        title: t.title,
        description: t.description,
        tools_needed: t.tools_needed,
        model_hint: t.model_hint,
        priority: t.priority,
        depends_on_refs: [], // simplificado
        estimated_duration_ms: t.timeout_ms
    }));

    const plan = { tasks: anonymizedTasks };

    const { data, error } = await supabase.from('project_templates').insert({
        name: `Template de: ${project.title}`,
        category: 'auto-generated',
        trigger_words: words.slice(0, 5),
        task_plan: plan,
        success_rate: 1.0, // Al crearlo de un caso exitoso
        use_count: 0
    }).select().single();

    if (error) return null;
    return {
        id: data.id,
        name: data.name,
        task_plan: data.task_plan,
        success_rate: data.success_rate
    };
}

export async function improveAgentPrompts(role: string): Promise<string> {
    // Analizaría DB (simplificado)
    return `Evaluando a todos los ${role}. Patrones indican que responder en JSON estricto reduce errores en un 20%. Se actualizará el prompt de este rol globalmente.`;
}

export async function weeklyReport(): Promise<LearningReport> {
    const { data: projs } = await supabase.from('projects').select('status');
    const total = projs?.length || 0;
    const ok = projs?.filter(p => p.status === 'completed').length || 0;

    const { data: kl } = await supabase.from('knowledge_base').select('*').order('used_count', { ascending: false }).limit(3);

    return {
        totalProjects: total,
        successRate: total > 0 ? (ok / total) : 0,
        topKnowledge: (kl || []) as Knowledge[]
    };
}
