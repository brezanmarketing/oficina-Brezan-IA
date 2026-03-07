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

        // 1. Check user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 2. Secret key en entorno para cifrar
        const pgpSecret = process.env.PGP_SECRET_KEY
        if (!pgpSecret) {
            console.error('CRITICAL: PGP_SECRET_KEY is not set in environment variables')
            return NextResponse.json({ error: 'Error interno del servidor de cifrado' }, { status: 500 })
        }

        // 3. Upsert integration in catalog if it doesn't exist to satisfy foreign key
        // We do this minimally just with the id
        await supabase.from('integration_catalog').upsert({ id: integration_id, name: integration_id, category: 'auto' }, { onConflict: 'id' }).select()

        // 4. Guardar cada llave cifrada
        for (const keyObj of keys) {
            if (!keyObj.key_name || !keyObj.value) continue;

            const { error: insertError } = await supabase.rpc('save_encrypted_credential', {
                p_integration_id: integration_id,
                p_key_name: keyObj.key_name,
                p_value: keyObj.value,
                p_secret: pgpSecret
            });

            if (insertError) {
                console.error(`Error saving credential for ${integration_id} / ${keyObj.key_name}:`, insertError);
                throw new Error('Fallo al guardar una credencial en la base de datos');
            }
        }

        invalidateCache(integration_id);
        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('API /credentials/save Error:', err)
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
