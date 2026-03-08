import { processCronTask } from '@/office/jarvis/phase5/cron-engine';
import { runFullSync } from '@/office/jarvis/calendar-sync';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { id, name } = await req.json();
        if (!name) return NextResponse.json({ error: 'Nombre del cron requerido' }, { status: 400 });

        // Autorización
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user && process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[API Test] Forzando ejecución de cron: ${name} por user ${user?.id || 'LOCAL'}`);

        // 1. Ejecutar el cron realmente
        const result = await processCronTask(name);

        // 2. Sincronizar calendario por si hubo cambios
        await runFullSync();

        return NextResponse.json({
            success: true,
            message: `Cron "${name}" ejecutado correctamente`,
            result: result
        });
    } catch (err: any) {
        console.error('[API Test] Fallo en ejecución:', err.message);
        return NextResponse.json({
            success: false,
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 });
    }
}
