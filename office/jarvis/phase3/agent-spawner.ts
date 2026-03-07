import { createClient } from '@supabase/supabase-js';
import { Task, Agent, AgentStats } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

import { modelRouter } from '../phase4/model-router';
import { costController } from '../phase4/cost-controller';

const PROFILES: Record<string, { role: string, tools: string[], desc: string }> = {
    'Researcher': { role: 'Researcher', tools: ['web-search', 'web-browser'], desc: 'Buscar información, noticias, datos' },
    'Analyst': { role: 'Analyst', tools: ['data-analyzer', 'file-manager'], desc: 'Analizar datos, detectar patrones' },
    'Writer': { role: 'Writer', tools: ['file-manager'], desc: 'Redactar informes, emails, contenido' },
    'Coder': { role: 'Coder', tools: ['code-executor', 'file-manager'], desc: 'Escribir y ejecutar código' },
    'Communicator': { role: 'Communicator', tools: ['email-manager', 'communications'], desc: 'Enviar notificaciones y emails' },
    'Coordinator': { role: 'Coordinator', tools: [], desc: 'Tareas complejas que requieren múltiples tools' }
};

export async function getModelForTask(task: Task, budgetRemaining: number = 100): Promise<string> {
    const selection = await modelRouter.selectModel(task.description, task.model_hint, budgetRemaining);
    return selection.model;
}

function determineRole(task: Task): string {
    const tools = task.tools_needed || [];
    if (tools.includes('code-executor')) return 'Coder';
    if (tools.includes('data-analyzer')) return 'Analyst';
    if (tools.includes('email-manager') || tools.includes('communications')) return 'Communicator';
    if (tools.includes('web-search') || tools.includes('web-browser')) return 'Researcher';
    if (tools.includes('file-manager') && task.description.toLowerCase().includes('escrib')) return 'Writer';

    return 'Coordinator';
}

export async function buildSystemPrompt(role: string, task: Task): Promise<string> {
    const profile = PROFILES[role];
    const base = `Eres un agente experto con el rol de ${role}. 
Tu propósito general es: ${profile ? profile.desc : 'Asistir en tareas complejas'}.
Se te ha asignado la tarea específica: "${task.title}".
Descripción detallada: ${task.description}.

RESTRICCIONES:
1. Resuelve lo que se te pide interactuando con las herramientas.
2. Formatea tu respuesta de regreso al project manager claramente.
`;

    // Intentamos traer contexto de la BD de conocimientos útil para esta tarea (ejemplo mock)
    // const knowledge = await LearningEngine.getRelevantKnowledge(...)
    return base;
}

export async function spawnAgent(task: Task, budgetRemaining: number = 100): Promise<Agent> {
    const role = determineRole(task);
    const model = await getModelForTask(task, budgetRemaining);

    // 1. Buscar agente 'idle' con mismo rol y modelo
    const { data: idleAgents, error: searchErr } = await supabase
        .from('agents')
        .select('*')
        .eq('status', 'idle')
        .eq('role', role)
        .eq('model', model)
        .limit(1);

    if (!searchErr && idleAgents && idleAgents.length > 0) {
        const agent = idleAgents[0];
        // Lo marcamos busy
        await supabase.from('agents').update({ status: 'busy', current_task: task.id }).eq('id', agent.id);
        agent.status = 'busy';
        agent.current_task = task.id;
        agent.system_prompt = await buildSystemPrompt(role, task); // actualizamos su prompt
        return agent as Agent;
    }

    const uniqueId = Math.floor(Math.random() * 10000);
    const systemPrompt = await buildSystemPrompt(role, task);

    const newAgent = {
        name: `${role}-${uniqueId}`,
        role: role,
        model: model,
        status: 'busy',
        system_prompt: systemPrompt,
        tools: task.tools_needed,
        capabilities: [],
        current_task: task.id,
        tasks_done: 0,
        tasks_failed: 0,
        performance: 1.0,
        budget_tokens: 100000,
        tokens_used: 0,
        created_by: 'jarvis'
    };

    const { data: inserted, error } = await supabase
        .from('agents')
        .insert(newAgent)
        .select()
        .single();

    if (error) throw new Error(`Error spawnAgent: ${error.message}`);
    return inserted as Agent;
}

export async function retireAgent(agent_id: string): Promise<void> {
    await supabase.from('agents').update({
        status: 'retired',
        retired_at: new Date().toISOString()
    }).eq('id', agent_id);
}

export async function getAgentPool(): Promise<AgentStats> {
    const { data, error } = await supabase.from('agents').select('status, role, tokens_used, model');
    if (error) throw new Error(error.message);

    let active = 0;
    let idle = 0;
    let roles: Record<string, number> = {};
    let approxCost = 0;

    for (const a of data) {
        if (a.status === 'busy') active++;
        if (a.status === 'idle') idle++;
        roles[a.role] = (roles[a.role] || 0) + 1;

        const tokens = a.tokens_used || 0;
        if (a.model.includes('gpt-4o')) approxCost += (tokens / 1000000) * 5.0; // aprox per mix
        else if (a.model.includes('gemini-2.5-flash')) approxCost += (tokens / 1000000) * 0.075;
    }

    return {
        total: data.length,
        active,
        idle,
        byRole: roles,
        totalCostUSD: approxCost
    };
}
