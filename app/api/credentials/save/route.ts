import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateCache } from '@/office/tools/credential-manager'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { integration_id, keys } = body

        if (!integration_id || !keys || !Array.isArray(keys)) {
            return NextResponse.json({ error: 'Faltan parámetros: integration_id o keys array' }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Check user authentication (Opcional si usas Service Key y es entorno privado)
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) {
                console.warn('SAVE_API: Petición sin sesión activa, continuando con Service Role...')
            } else {
                console.log('SAVE_API: Usuario autenticado:', user.email)
            }
        } catch (e) {
            console.warn('SAVE_API: Error al verificar auth (no crítico):', e)
        }

        // 2. Secret key en entorno para cifrar
        const pgpSecret = process.env.CREDENTIAL_ENCRYPTION_SECRET || process.env.PGP_SECRET_KEY || process.env.ENCRYPTION_SECRET;
        if (!pgpSecret) {
            console.error('SAVE_API CRITICAL: No encryption secret found')
            return NextResponse.json({ error: 'CONFIG_ERROR: No se encontró el secreto de cifrado en el servidor' }, { status: 500 })
        }

        console.log(`SAVE_API: Intentando guardar ${keys.length} llaves para ${integration_id}`);

        // 3. Upsert integration in catalog
        const { error: catalogError } = await supabase
            .from('integration_catalog')
            .upsert({ id: integration_id, name: integration_id, category: 'auto' }, { onConflict: 'id' });

        if (catalogError) {
            console.error('SAVE_API: Error en integration_catalog upsert:', catalogError);
            return NextResponse.json({ error: `DATABASE_ERROR: No se pudo registrar la integración: ${catalogError.message}` }, { status: 500 });
        }

        // 4. Guardar cada llave cifrada
        for (const keyObj of keys) {
            if (!keyObj.key_name || !keyObj.value) {
                console.warn('SAVE_API: Saltando llave incompleta:', keyObj.key_name);
                continue;
            }

            console.log(`SAVE_API: Ejecutando RPC save_encrypted_credential para ${keyObj.key_name}`);
            const { error: insertError } = await supabase.rpc('save_encrypted_credential', {
                p_integration_id: integration_id,
                p_key_name: keyObj.key_name,
                p_value: keyObj.value,
                p_secret: pgpSecret
            });

            if (insertError) {
                console.error(`SAVE_API: RPC Error para ${keyObj.key_name}:`, insertError);
                return NextResponse.json({ error: `VAULT_ERROR: Error al cifrar/guardar ${keyObj.key_name}: ${insertError.message}` }, { status: 500 });
            }
        }

        console.log(`SAVE_API: Guardado exitoso para ${integration_id}`);
        try {
            invalidateCache(integration_id);
        } catch (e) {
            console.warn('SAVE_API: No se pudo invalidar cache (no crítico):', e);
        }

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('SAVE_API: Error no controlado:', err)
        return NextResponse.json({ error: `SYSTEM_ERROR: ${err.message || 'Error desconocido'}` }, { status: 500 })
    }
}
