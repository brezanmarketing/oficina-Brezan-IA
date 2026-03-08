import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function processWebhook(slug: string, body: any, headers: Headers) {
    // 1. Buscar configuración del webhook en BD
    const { data: webhook, error } = await getSupabase()
        .from('webhook_endpoints')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error || !webhook) {
        throw new Error('Webhook not found or inactive');
    }

    // 2. Verificar firma si tiene secret configurado
    if (webhook.secret) {
        const signature = headers.get('x-webhook-signature');
        if (!verifySignature(signature, body, webhook.secret)) {
            throw new Error('Invalid signature');
        }
    }

    // 3. Aplicar filtros si están configurados
    if (webhook.filters) {
        const matches = evaluateFilters(webhook.filters, body);
        if (!matches) {
            return { ok: true, skipped: true, reason: 'Filters did not match' };
        }
    }

    // 4. Transformar el objetivo inyectando variables del payload (idealmente usando jsonpath o similar, simplificado aquí)
    const objective = String(webhook.objective).replace('{data}', JSON.stringify(body).slice(0, 500) + '...'); // limit data size

    // 5. Enviar a Jarvis (aquí haríamos la llamada real a la función de encolar de Jarvis)
    // Como Jarvis maneja todo mediante /api/jarvis, podríamos inyectarlo en el sistema de tareas

    console.log(`[Webhook Engine] Despachando objetivo: ${objective}`);
    // LÓGICA DE EXECUCIÓN DE JARVIS
    // (Placeholder hasta tener el executor unificado exportado)

    // 6. Actualizar contador
    await getSupabase()
        .from('webhook_endpoints')
        .update({ trigger_count: (webhook.trigger_count || 0) + 1 })
        .eq('id', webhook.id);

    // 7. Loguear ejecución
    await logTriggerExecution(webhook.id, 'webhook', webhook.name, body, 'success', { message: 'Objetivo despachado' });

    return { ok: true, dispatched: true };
}

function verifySignature(signature: string | null, payload: any, secret: string): boolean {
    if (!signature) return false;
    // Implementación simplificada (depende de cada proveedor como Stripe, GitHub, etc)
    try {
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(JSON.stringify(payload)).digest('hex');
        return signature === digest;
    } catch (e) {
        return false;
    }
}

function evaluateFilters(filters: any, body: any): boolean {
    // Implementación simplificada de evaluación de JSON, ej: { "event": "invoice.paid" }
    if (typeof filters === 'object' && filters !== null) {
        for (const [key, expectedValue] of Object.entries(filters)) {
            if (body[key] !== expectedValue) return false;
        }
    }
    return true; // Match o no filters defined
}

export async function logTriggerExecution(triggerId: string, type: string, name: string, input: any, status: 'success' | 'failed' | 'skipped', result: any) {
    await getSupabase().from('trigger_executions').insert({
        trigger_id: triggerId,
        trigger_type: type,
        trigger_name: name,
        input_data: input,
        status: status,
        result: result,
        duration_ms: 0 // calcular si es synch.
    });
}
