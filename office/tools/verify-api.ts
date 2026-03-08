import { getCredential } from './credential-manager';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export interface VerificationResult {
    ok: boolean;
    latency_ms: number;
    bot_name?: string;
    error?: string;
    details?: string;
}

export async function verifyCredential(integration_id: string): Promise<VerificationResult> {
    const startTime = Date.now();
    let result: VerificationResult = { ok: false, latency_ms: 0 };

    try {
        switch (integration_id) {
            case 'openai': {
                const key = await getCredential('openai', 'API Key');
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                    signal: AbortSignal.timeout(10000)
                });
                result.ok = res.ok;
                if (!res.ok) result.error = `Error ${res.status}: ${res.statusText}`;
                break;
            }

            case 'gemini': {
                const key = await getCredential('gemini', 'API Key');
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`, {
                    signal: AbortSignal.timeout(10000)
                });
                result.ok = res.ok;
                if (!res.ok) result.error = `Error ${res.status}: ${res.statusText}`;
                break;
            }

            case 'telegram': {
                const token = await getCredential('telegram', 'Bot Token');
                const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
                    signal: AbortSignal.timeout(10000)
                });
                const data = await res.json();
                result.ok = data.ok;
                if (data.ok) {
                    result.bot_name = data.result?.username;
                } else {
                    result.error = data.description || 'Fallo API Telegram';
                }
                break;
            }

            case 'serper': {
                const key = await getCredential('serper', 'API Key');
                const res = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'test connectivity' }),
                    signal: AbortSignal.timeout(10000)
                });
                result.ok = res.ok;
                if (!res.ok) result.error = `Error ${res.status}: ${res.statusText}`;
                break;
            }

            default: {
                // Verificación genérica: ¿podemos al menos leer la llave primaria?
                // Primero intentamos encontrar el nombre de la llave esperada en el catálogo
                const { data: cat } = await getSupabase().from('integration_catalog').select('required_keys').eq('id', integration_id).single();
                const keyToTest = (cat?.required_keys && cat.required_keys.length > 0) ? cat.required_keys[0].name : 'API Key';

                const val = await getCredential(integration_id, keyToTest);
                result.ok = !!val;
                if (!val) result.error = 'Credencial no legible o vacía';
                break;
            }
        }
    } catch (err: any) {
        result.ok = false;
        result.error = err.name === 'TimeoutError' ? 'Tiempo de espera agotado (10s)' : err.message;
    } finally {
        result.latency_ms = Date.now() - startTime;
    }

    // Actualizar base de datos
    try {
        await getSupabase().from('api_credentials')
            .update({
                last_verified_at: new Date().toISOString(),
                last_verify_ok: result.ok,
                last_error: result.ok ? null : result.error,
                // Si la verificación es exitosa, nos aseguramos que esté activa
                is_active: result.ok ? true : undefined
            })
            .eq('integration_id', integration_id);
    } catch (e) {
        console.error(`Error persistiendo verificación de ${integration_id}:`, e);
    }

    return result;
}
