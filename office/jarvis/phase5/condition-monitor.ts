import { createClient } from '@supabase/supabase-js';
import { executeJarvisObjective } from './core-executor';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

export async function checkAllConditions() {
    console.log('[Condition Monitor] Evaluando métricas del sistema...');

    // 1. Obtener triggers activos
    const { data: triggers } = await getSupabase()
        .from('condition_triggers')
        .select('*')
        .eq('is_active', true);

    if (!triggers) return { checked: 0, triggered: 0 };

    let triggeredCount = 0;

    for (const trigger of triggers) {
        try {
            // 2. Obtener métrica actual
            const currentValue = await getMetricValue(trigger.metric);

            // 3. Evaluar
            const isTriggered = evaluateCondition(currentValue, trigger.operator, trigger.threshold);

            if (!isTriggered) continue;

            // 4. Respetar cooldown
            if (trigger.last_triggered) {
                const lastTriggeredDate = new Date(trigger.last_triggered);
                const cooldownMs = (trigger.cooldown_min || 60) * 60 * 1000;
                if (Date.now() - lastTriggeredDate.getTime() < cooldownMs) {
                    console.log(`[Condition Monitor] Cooldown activo para: ${trigger.name}`);
                    continue; // cooldown still active
                }
            }

            console.log(`[Condition Monitor] METRICA DISPARADA: ${trigger.name} (Actual: ${currentValue} ${trigger.operator} Umbral: ${trigger.threshold})`);

            // 5. Ejecutar objetivo
            const objective = String(trigger.objective)
                .replace('{value}', String(currentValue))
                .replace('{threshold}', String(trigger.threshold));

            const result = await executeJarvisObjective(
                objective,
                'condition_trigger',
                { condition_id: trigger.id, metric: trigger.metric, actual_value: currentValue }
            );

            // 6. Actualizar persistencia y log
            await getSupabase().from('condition_triggers')
                .update({ last_triggered: new Date().toISOString() })
                .eq('id', trigger.id);

            await logTriggerExecution(trigger.id, 'condition', trigger.name, { metric: trigger.metric, value: currentValue }, 'success', result);
            triggeredCount++;

        } catch (err: any) {
            console.error(`[Condition Monitor] Fallo al evaluar ${trigger.name}:`, err);
            await logTriggerExecution(trigger.id, 'condition', trigger.name, {}, 'failed', { error: err.message });
        }
    }

    return { checked: triggers.length, triggered: triggeredCount };
}

async function getMetricValue(metric: string): Promise<number> {
    const supabase = getSupabase();
    switch (metric) {
        case 'monthly_cost_usd':
            // Sumamos costs
            const { data: monthlyData } = await supabase.rpc('project_cost_month');
            if (!monthlyData) return 0;
            return monthlyData.reduce((acc: number, curr: { cost_usd: number }) => acc + (curr.cost_usd || 0), 0);

        case 'error_rate_pct':
            // Tasa de error de executions
            const { count: errCount } = await supabase.from('trigger_executions').select('*', { count: 'exact', head: true }).eq('status', 'failed');
            const { count: totalCount } = await supabase.from('trigger_executions').select('*', { count: 'exact', head: true });
            if (!totalCount) return 0;
            return (errCount! / totalCount!) * 100;

        case 'agents_in_error':
            const { count: agentsErr } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'error');
            return agentsErr || 0;

        case 'queue_depth':
            const { count: pending } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            return pending || 0;

        default:
            console.warn(`[Condition Monitor] Métrica no soportada: ${metric}`);
            return 0;
    }
}

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
        case 'gt': case '>': return value > threshold;
        case 'gte': case '>=': return value >= threshold;
        case 'lt': case '<': return value < threshold;
        case 'lte': case '<=': return value <= threshold;
        case 'eq': case '==': case '=': return value === threshold;
        default: return false; // Fail safe
    }
}

export async function logTriggerExecution(triggerId: string, type: string, name: string, input: any, status: 'success' | 'failed' | 'skipped', result: any) {
    await getSupabase().from('trigger_executions').insert({
        trigger_id: triggerId,
        trigger_type: type,
        trigger_name: name,
        input_data: input,
        status: status,
        result: result
    });
}
