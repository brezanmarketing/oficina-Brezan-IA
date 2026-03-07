import { createClient } from '@supabase/supabase-js';
import { getCredential } from '@/office/tools/credential-manager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface TaskDefinition {
    id_ref: number; // Referencia temporal para dependencias
    title: string;
    description: string;
    tools_needed: string[];
    model_hint: 'fast' | 'smart' | 'vision' | 'code';
    depends_on_refs: number[];
    priority: number;
    estimated_duration_ms: number;
}

export interface TaskPlan {
    tasks: TaskDefinition[];
}

export interface ProjectTemplate {
    id: string;
    name: string;
    task_plan: TaskPlan;
    success_rate: number;
}

async function callGPT4oJson(systemPrompt: string, userPrompt: string): Promise<any> {
    const apiKey = await getCredential('openai', 'API Key');
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Error en llamada a OpenAI');
    }

    return JSON.parse(data.choices[0].message.content);
}

export async function decomposeObjective(objective: string, context?: any): Promise<TaskPlan> {
    // Primero revisamos si hay templates
    const template = await suggestTemplate(objective);
    if (template) {
        return template.task_plan; // Ya es un plan probado
    }

    const systemPrompt = `
Eres un experto en gestión de proyectos de desarrollo e IA. 
Dado un objetivo del usuario, crea un plan de tareas concretas, ordenadas y ejecutables por agentes autónomos.
Responde SOLO en JSON con este esquema exacto:
{
  "tasks": [
    {
      "id_ref": 1, // Numeración secuencial
      "title": "Nombre corto de la tarea",
      "description": "Instrucciones detalladas de lo que el agente debe hacer",
      "tools_needed": ["web-search", "web-browser", ...], // Opciones: web-search, file-manager, code-executor, web-browser, data-analyzer, email-manager, communications. Vacio si no requiere.
      "model_hint": "fast", // Opciones: fast, smart, vision, code
      "depends_on_refs": [], // Array de id_refs de tareas que deben terminar ANTES que esta
      "priority": 5, // 1 (crítica) a 10 (baja)
      "estimated_duration_ms": 15000 // Estimación en milisegundos
    }
  ]
}
Restricciones: 
- Máximo 10 tareas por objetivo.
- Trata de paralelizar tareas independientes (ej: buscar 3 cosas distintas -> 3 tareas sin dependencias entre sí).
- La última tarea casi siempre debe recopilar y formatear (model_hint: smart).`.trim();

    const userPrompt = `Objetivo: ${objective}\nContexto: ${JSON.stringify(context || {})}`;
    const plan: TaskPlan = await callGPT4oJson(systemPrompt, userPrompt);

    // Mantenemos max 10
    if (plan.tasks && plan.tasks.length > 10) {
        plan.tasks = plan.tasks.slice(0, 10);
    }

    return plan;
}

export function estimateComplexity(objective: string): 'simple' | 'medium' | 'complex' {
    const words = objective.split(' ').length;
    if (words < 10 && !objective.includes('analiza') && !objective.includes('investiga profundamente')) return 'simple';
    if (words > 30 || objective.includes('complejo') || objective.includes('sistema entero')) return 'complex';
    return 'medium';
}

export async function suggestTemplate(objective: string): Promise<ProjectTemplate | null> {
    // Implementación simplificada (búsqueda por palabras clave en BD)
    // Lo ideal: un vector search en Supabase
    const words: string[] = objective.toLowerCase().match(/\\b(\\w{4,})\\b/g) || [];
    if (words.length === 0) return null;

    // Hacemos una búsqueda que contenga al menos un trigger_word
    // Solo se reutilizan si success_rate > 0.8
    const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .gte('success_rate', 0.8)
        .order('success_rate', { ascending: false });

    if (error || !data || data.length === 0) return null;

    // Buscar mejor coincidencia localmente (naive match)
    let bestMatch = null;
    let maxScore = 0;

    for (const tpl of data) {
        let score = 0;
        const triggers: string[] = tpl.trigger_words || [];
        triggers.forEach((trig: string) => {
            if (words.includes(trig.toLowerCase())) score++;
        });
        if (score > maxScore) {
            maxScore = score;
            bestMatch = tpl;
        }
    }

    // Requiere al menos 2 palabras clave coincidentes para aplicar template
    if (maxScore >= 2 && bestMatch) {
        return {
            id: bestMatch.id,
            name: bestMatch.name,
            task_plan: bestMatch.task_plan as TaskPlan,
            success_rate: bestMatch.success_rate
        };
    }
    return null;
}

export async function refineWithFeedback(plan: TaskPlan, feedback: string): Promise<TaskPlan> {
    const systemPrompt = `
Eres un experto gestor de proyectos ajustando un plan existente.
El usuario ha dado un feedback sobre el plan actual. Debes devolver la versión corregida.
Responde SOLO en JSON conformando el mismo esquema { "tasks": [...] }.
`;
    const userPrompt = `Plan Actual: ${JSON.stringify(plan)}\nFeedback del Usuario: ${feedback}`;
    const newPlan: TaskPlan = await callGPT4oJson(systemPrompt, userPrompt);
    return newPlan;
}
