import { runFullSync } from '@/office/jarvis/calendar-sync';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = req.headers.get('authorization');
    const isLocal = process.env.NODE_ENV === 'development';

    // Permitir acceso sin auth en local o con CRON_SECRET
    if (!isLocal && auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
