import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Obtener todas las credenciales con sus metadatos de verificación
        const { data, error } = await supabase
            .from('api_credentials')
            .select('integration_id, is_active, last_verified_at, last_verify_ok, last_error');

        if (error) {
            console.error('API /credentials/status Error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ credentials: data || [] })

    } catch (err: any) {
        console.error('API /credentials/status Error desconocido:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
