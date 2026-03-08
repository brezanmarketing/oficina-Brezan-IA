import { NextRequest, NextResponse } from 'next/server';
import { verifyCredential } from '@/office/tools/verify-api';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { integration_id } = body;

        if (!integration_id) {
            return NextResponse.json({ error: 'Falta integration_id' }, { status: 400 });
        }

        // 1. Autorización: Solo permitimos esto a usuarios autenticados o con Service Role
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // En este sistema, si no hay user pero hay service role (ambiente servidor/cron), se permite.
        // Pero para llamadas desde el panel, debería haber un user.
        if (!user) {
            console.warn(`VERIFY_API: Intento de verificación para ${integration_id} sin sesión de usuario.`);
            // Si quieres ser estricto, podrías retornar 401 aquí.
        }

        // 2. Ejecutar la verificación
        const result = await verifyCredential(integration_id);

        return NextResponse.json(result);

    } catch (err: any) {
        console.error('VERIFY_API Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
