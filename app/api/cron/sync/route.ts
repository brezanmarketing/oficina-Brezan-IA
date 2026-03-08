import { runFullSync } from '@/office/jarvis/calendar-sync';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const isCronAction = req.headers.get('Authorization') === `Bearer ${process.env.CRON_SECRET}`;
    const isLocal = process.env.NODE_ENV === 'development';

    // 2. Verificar si es una llamada del Frontend (con Sesión usando ANON_KEY)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!isLocal && !isCronAction && !user) {
        console.error('[Sync API] No autorizado. Local:', isLocal, 'CronSecret:', isCronAction);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user?.email || 'Cron/Local';
    try {
        await runFullSync();
        return NextResponse.json({ success: true, user: userEmail });
    } catch (error: any) {
        console.error('[Sync API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
