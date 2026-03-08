import { createClient } from '@supabase/supabase-js';
import cronParser from 'cron-parser';
// @ts-ignore
const parseCron = cronParser.parseExpression || (cronParser as any).default?.parseExpression || (cronParser as any).parse;

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function syncCronJobsToCalendar() {
    console.log('[Calendar Sync] Iniciando sincronización de Crons con cron-parser...');
    const supabase = getSupabase();

    // 1. Obtener Crons Activos
    const { data: triggers, error: trigErr } = await supabase
        .from('scheduled_triggers')
        .select('*')
        .eq('is_active', true)
        .not('cron_expr', 'is', null);

    if (trigErr) {
        console.error('[Calendar Sync] Error obteniendo triggers:', trigErr);
        return;
    }

    if (!triggers || triggers.length === 0) {
        console.log('[Calendar Sync] No se encontraron crons activos.');
        return;
    }

    console.log(`[Calendar Sync] Procesando ${triggers.length} crons activos...`);

    // 2. Borrar eventos futuros proyectados previamente por Jarvis (para no duplicar)
    // NOTA: Solo borramos eventos de tipo 'cron' y fuente 'jarvis' a futuro.
    const nowIso = new Date().toISOString();
    const { error: delErr } = await supabase.from('calendar_events')
        .delete()
        .eq('type', 'cron')
        .eq('source', 'jarvis')
        .gt('start_at', nowIso);

    if (delErr) console.error('[Calendar Sync] Error en delete previo:', delErr);

    const newEvents = [];

    // 3. Proyectar las próximas 30 ejecuciones para cada cron
    for (const trigger of triggers) {
        try {
            console.log(`[Calendar Sync] Parseando cron: "${trigger.name}" expresión: "${trigger.cron_expr}"`);

            // Validar que la expresión no esté vacía
            if (!trigger.cron_expr || trigger.cron_expr.trim() === '') {
                console.warn(`[Calendar Sync] Salteando ${trigger.name}: Expresión vacía.`);
                continue;
            }

            const interval = parseCron(trigger.cron_expr);

            // Determinar color solicitado por el usuario
            const color = '#6366F1';

            for (let i = 0; i < 4; i++) { // Proyectar exactamente 4 ejecuciones
                const nextDate = interval.next().toDate();
                newEvents.push({
                    title: trigger.name, // Nombre limpio solicitado
                    description: trigger.objective, // Objetivo directo
                    type: 'cron',
                    color: color,
                    start_at: nextDate.toISOString(),
                    end_at: new Date(nextDate.getTime() + 15 * 60000).toISOString(),
                    all_day: false,
                    recurring: true,
                    cron_expr: trigger.cron_expr,
                    source: 'jarvis',
                    trigger_id: trigger.id,
                    notify_before: 5
                });
            }
        } catch (err: any) {
            console.error(`[Calendar Sync] Falla parseando cron "${trigger.name}" (${trigger.cron_expr}):`, err.message);
        }
    }

    if (newEvents.length > 0) {
        console.log(`[Calendar Sync] Intentando insertar ${newEvents.length} eventos en el calendario...`);
        const { data, error: insErr } = await supabase.from('calendar_events').insert(newEvents).select();

        if (insErr) {
            console.error('[Calendar Sync] Error FATAL en insert final:', JSON.stringify(insErr));
        } else {
            console.log(`[Calendar Sync] Sincronización exitosa. Insertados ${data?.length} eventos.`);
        }
    } else {
        console.log('[Calendar Sync] No se generaron nuevos eventos para insertar.');
    }
}

export async function syncProjectsToCalendar() {
    console.log('[Calendar Sync] Sincronizando Deadlines de Proyectos...');
    const supabase = getSupabase();

    const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .in('status', ['planning', 'running']);

    if (!projects) return;

    // Borrar deadlines existentes para actualizar
    const nowIso = new Date().toISOString();
    await supabase.from('calendar_events')
        .delete()
        .eq('type', 'project_deadline')
        .gt('start_at', nowIso);

    const newEvents = [];

    for (const project of projects) {
        let deadline = project.deadline;
        let isEstimated = false;

        // Estimar deadline si no existe (asumiendo 1 día por tarea completable)
        if (!deadline && project.estimated_tasks) {
            deadline = new Date(Date.now() + (project.estimated_tasks * 24 * 60 * 60 * 1000));
            isEstimated = true;
        }

        if (deadline) {
            newEvents.push({
                title: `[Deadline] ${project.name}`, // Corregido project.title -> project.name
                description: `Progreso: ${project.progress_pct || 0}%${isEstimated ? ' (Fecha estimada)' : ''}`,
                type: 'project_deadline',
                color: '#f97316', // orange-500
                start_at: new Date(deadline).toISOString(),
                all_day: true,
                source: 'jarvis',
                project_id: project.id,
                notify_before: 1440 // Avisar 1 día antes
            });
        }
    }

    if (newEvents.length > 0) {
        await supabase.from('calendar_events').insert(newEvents);
    }
}

export async function syncTasksToCalendar() {
    // Implementación futura si se requiere
}

export async function runFullSync() {
    console.log('[Calendar Sync] Iniciando RUN_FULL_SYNC...');
    await syncCronJobsToCalendar();
    await syncProjectsToCalendar();
    await syncTasksToCalendar();
    console.log('[Calendar Sync] Sincronización Completa');
}
