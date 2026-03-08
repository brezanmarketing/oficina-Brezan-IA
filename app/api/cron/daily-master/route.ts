import { processCronTask } from '@/office/jarvis/phase5/cron-engine';
import { runFullSync } from '@/office/jarvis/calendar-sync';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Cron Maestro para Vercel Hobby (Límite: 1 cron job)
 * Ejecuta todas las tareas diarias de forma secuencial.
 */
export async function GET(req: Request) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: any = {};
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0: Domingo, 1: Lunes...

    try {
        console.log('[Master Cron] Iniciando tareas diarias...');

        // 1. Briefing matutino
        results.briefing = await processCronTask('Briefing matutino');

        // 2. Revisión de costes
        results.costs = await processCronTask('Revision de costes');

        // 3. Sincronización de Calendario y Limpieza
        await runFullSync();
        results.cleanup = await processCronTask('Limpieza de cache');

        // 4. Informe Semanal (Solo los Lunes)
        if (dayOfWeek === 1) {
            results.weekly = await processCronTask('Informe semanal');
        }

        // 5. Auto-auditoría (Solo los Domingos)
        if (dayOfWeek === 0) {
            results.audit = await processCronTask('Auto-auditoria');
        }

        console.log('[Master Cron] Tareas completadas con éxito.');
        return NextResponse.json({
            ok: true,
            timestamp: now.toISOString(),
            executed_tasks: Object.keys(results)
        });

    } catch (err: any) {
        console.error('[Master Cron] Error fatal:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
