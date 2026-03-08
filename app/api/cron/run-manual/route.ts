import { processCronTask } from '@/office/jarvis/phase5/cron-engine';
import { runFullSync } from '@/office/jarvis/calendar-sync';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para ejecución MANUAL desde el frontend.
 * Valida la sesión del usuario de Supabase en lugar del CRON_SECRET.
 */
export async function POST(req: Request) {
    try {
        const { id, name } = await req.json();
        if (!name) return NextResponse.json({ error: 'Nombre del cron requerido' }, { status: 400 });

        // 1. Autorización por SESIÓN (No por Secret)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const isLocal = process.env.NODE_ENV === 'development';

        if (!user && !isLocal) {
            return NextResponse.json({ error: 'No autorizado: Debes iniciar sesión' }, { status: 401 });
        }

        console.log(`[Manual Run] Ejecutando cron: ${name} (Iniciado por: ${user?.email || 'LOCAL'})`);

        // 2. Ejecutar la lógica del cron
        const result = await processCronTask(name);

        // 3. Forzar sincronización del calendario para reflejar cambios inmediatos
        await runFullSync();

        return NextResponse.json({
            success: true,
            message: `Ejecución manual de "${name}" completada`,
            result: result
        });
    } catch (err: any) {
        console.error('[Manual Run] Error:', err.message);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
