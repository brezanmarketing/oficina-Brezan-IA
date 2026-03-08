import { createClient } from '@supabase/supabase-js'

let _supabase: any = null
function getSupabase() {
    if (_supabase) return _supabase
    _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    )
    return _supabase
}

const SECRET = process.env.CREDENTIAL_ENCRYPTION_SECRET || ''
const cache = new Map<string, { value: string, expires: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes cache


export async function getCredential(
    integration_id: string,
    key_name: string
): Promise<string> {
    const key = `${integration_id}:${key_name}`
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return cached.value

    if (!SECRET) {
        console.warn("CREDENTIAL_ENCRYPTION_SECRET NO CONFIGURADO EN EL ENTORNO (Requerido para descifrar).")
    }

    const { data, error } = await getSupabase().rpc('get_credential', {
        p_integration_id: integration_id,
        p_key_name: key_name,
        p_secret: SECRET
    })


    if (error || !data) {
        throw new Error(
            `Credencial no encontrada o error de descifrado: ${integration_id} / ${key_name}. Añádela en el Panel de Conexiones.`
        )
    }

    cache.set(key, { value: data, expires: Date.now() + TTL })
    return data
}

export function invalidateCache(integration_id: string) {
    for (const key of cache.keys()) {
        if (key.startsWith(integration_id)) cache.delete(key)
    }
}
