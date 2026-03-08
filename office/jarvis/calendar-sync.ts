import { createClient } from '@supabase/supabase-js';
const cronParser = require('cron-parser');

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function syncCronJobsToCalendar() {
    console.log('[Calendar Sync] Sincronizando Crons programados...');
    const supabase = getSupabase();

    // 1. Obtener Crons Activos
    const { data: triggers } = await supabase
        .from('scheduled_triggers')
        .select('*')
        .eq('is_active', true)
        .not('cron_expr', 'is', null);

    if (!triggers || triggers.length === 0) return;

    // 2. Borrar eventos futuros proyectados previamente por Jarvis (para no duplicar)
    await supabase.from('calendar_events')
        .delete()
        .eq('type', 'cron')
        .eq('source', 'jarvis')
        .gte('start_at', new Date().toISOString());

    const newEvents = [];

    // 3. Proyectar las próximas 30 ejecuciones para cada cron
    for (const trigger of triggers) {
        try {
            const interval = cronParser.parseExpression(trigger.cron_expr);
            for (let i = 0; i < 30; i++) {
                const nextDate = interval.next().toDate();
                newEvents.push({
                    title: `[Jarvis] ${trigger.name}`,
                    description: `Objetivo: ${trigger.objective}\nEste es un evento programado automáticamente.`,
                    type: 'cron',
                    color: '#3b82f6', // blue-500
                    start_at: nextDate.toISOString(),
                    end_at: new Date(nextDate.getTime() + 5 * 60000).toISOString(), // 5 mins de duración visual
                    all_day: false,
                    recurring: true,
                    cron_expr: trigger.cron_expr,
                    source: 'jarvis',
                    trigger_id: trigger.id,
                    notify_before: 10
                });
            }
        } catch (err: any) {
            console.error(`[Calendar Sync] Falla parseando cron ${trigger.name}:`, err.message);
        }
    }

    if (newEvents.length > 0) {
        await supabase.from('calendar_events').insert(newEvents);
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
    await supabase.from('calendar_events')
        .delete()
        .eq('type', 'project_deadline')
        .gte('start_at', new Date().toISOString());

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
                title: `[Deadline] ${project.title}`,
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
    console.log('[Calendar Sync] Sincronizando Tareas...');
    // Simulación de tareas asignadas para completitud del framework Fase 5
    // Esto dependería de si se ha migrado `project_tasks` con una fecha estimada de completado.
}

export async function runFullSync() {
    await syncCronJobsToCalendar();
    await syncProjectsToCalendar();
    await syncTasksToCalendar();
    console.log('[Calendar Sync] Sincronización Completa');
}
