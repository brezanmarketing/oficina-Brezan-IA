import { createClient } from '@supabase/supabase-js';
import { executeJarvisObjective } from './core-executor';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

export async function processCronTask(cronName: string) {
    // 1. Buscar configuración del cron en BD
    const { data: trigger, error } = await getSupabase()
        .from('scheduled_triggers')
        .select('*')
        .eq('name', cronName)
        .eq('is_active', true)
        .single();

    if (error || !trigger) {
        throw new Error(`Cron trigger ${cronName} no encontrado o inactivo.`);
    }

    console.log(`[Cron Engine] Ejecutando: ${trigger.name}`);

    try {
        // 2. Ejecutar Objetivo
        const result = await executeJarvisObjective(
            trigger.objective,
            'cron',
            { cron_id: trigger.id, name: trigger.name }
        );

        // 3. Log Exitoso
        await logTriggerExecution(trigger.id, 'cron', trigger.name, {}, 'success', result);

        // 4. Update counters
        await getSupabase().from('scheduled_triggers')
            .update({
                run_count: (trigger.run_count || 0) + 1,
                last_run_at: new Date().toISOString(),
                last_result: result
            }).eq('id', trigger.id);

        return { ok: true, result };

    } catch (err: any) {
        // Log Error
        await logTriggerExecution(trigger.id, 'cron', trigger.name, {}, 'failed', { error: err.message });
        await getSupabase().from('scheduled_triggers')
            .update({
                fail_count: (trigger.fail_count || 0) + 1,
                last_run_at: new Date().toISOString(),
                last_result: { error: err.message }
            }).eq('id', trigger.id);

        throw err;
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
