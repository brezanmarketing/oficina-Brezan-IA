import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()

        // 1. Obtener los IDs únicos de integraciones que tienen al menos una credencial activa
        const { data, error } = await supabase
            .from('api_credentials')
            .select('integration_id')
            .eq('is_active', true)

        if (error) {
            console.error('API /credentials/status Error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 2. Extraer IDs únicos
        const connectedIds = Array.from(new Set(data?.map(item => item.integration_id) || []))

        return NextResponse.json({ connected_ids: connectedIds })

    } catch (err: any) {
        console.error('API /credentials/status Error desconido:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
