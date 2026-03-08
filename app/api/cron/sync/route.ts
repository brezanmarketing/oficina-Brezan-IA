import { runFullSync } from '@/office/jarvis/calendar-sync';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = req.headers.get('authorization');
    const isLocal = process.env.NODE_ENV === 'development';

    // 1. Verificar si es una llamada del Cron (con Secret)
    const isCronAction = auth === `Bearer ${process.env.CRON_SECRET}`;

    // 2. Verificar si es una llamada del Frontend (con Sesión)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!isLocal && !isCronAction && !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[API Sync] Iniciando sincronización manual...');
        await runFullSync();
        return NextResponse.json({ success: true, message: 'Calendario sincronizado correctamente' });
    } catch (err: any) {
        console.error('[API Sync] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
