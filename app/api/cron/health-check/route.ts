import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCredential } from '@/office/tools/verify-api'
import { sendMessage } from '@/office/tools/communications/index'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = getSupabase();

        // 1. Obtener todas las credenciales marcadas como activas
        const { data: credentials, error: dbError } = await supabase
            .from('api_credentials')
            .select('integration_id, key_name')
            .eq('is_active', true);

        if (dbError) throw dbError;

        const results = [];
        const failures = [];

        // 2. Verificar cada una
        for (const cred of credentials || []) {
            const result = await verifyCredential(cred.integration_id);
            results.push({
                integration_id: cred.integration_id,
                ok: result.ok,
                latency: result.latency_ms,
                error: result.error
            });

            if (!result.ok) {
                failures.push(cred.integration_id);

                // Si falla, la marcamos como inactiva para evitar errores en cadena de Jarvis
                await supabase.from('api_credentials')
                    .update({ is_active: false })
                    .eq('integration_id', cred.integration_id);
            }
        }

        // 3. Notificar al CEO si hay fallos
        if (failures.length > 0) {
            const ownerId = process.env.TELEGRAM_OWNER_ID || '1404171793';
            await sendMessage('telegram', ownerId,
                `🚨 *ALERTA DE SISTEMA: Credenciales Caídas*\n\n` +
                `Se han detectado fallos en las siguientes integraciones:\n` +
                `${failures.map(f => `• ${f.toUpperCase()}`).join('\n')}\n\n` +
                `_Las credenciales han sido desactivadas preventivamente. Por favor, reconéctalas en el Panel de Conexiones._`
            ).catch(err => console.error('Error enviando alerta de health-check:', err));
        }

        return Response.json({
            ok: true,
            timestamp: new Date().toISOString(),
            total_checked: results.length,
            failures: failures.length,
            results
        });

    } catch (error: any) {
        console.error('HEALTH_CHECK CRITICAL ERROR:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 })
    }
}

