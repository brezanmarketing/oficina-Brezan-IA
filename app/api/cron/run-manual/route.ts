import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processCronTask } from '@/office/jarvis/phase5/cron-engine'
import { runFullSync } from '@/office/jarvis/calendar-sync'

export const dynamic = 'force-dynamic'

/**
 * Endpoint para ejecución manual desde el panel
 * Valida la sesión del usuario (no requiere CRON_SECRET)
 */
export async function POST(req: Request) {
    try {
        const { name } = await req.json()

        // 1. Autorización por SESIÓN
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const isLocal = process.env.NODE_ENV === 'development'

        if (!user && !isLocal) {
            return NextResponse.json({ error: 'No autorizado: Debes iniciar sesión' }, { status: 401 })
        }

        console.log(`[Cron Manual] Ejecución solicitada por ${user?.email || 'DEBUG'} para: ${name}`)

        // 2. Ejecutar la lógica del cron (la función ya usa Service Key internamente)
        const result = await processCronTask(name)

        // 3. Forzar sincronización del calendario para reflejar cambios inmediatos
        await runFullSync()

        return NextResponse.json({
            success: true,
            message: `Cron ${name} ejecutado con éxito`,
            result
        })

    } catch (err: any) {
        console.error('API /api/cron/run-manual Error:', err)
        return NextResponse.json({ error: err.message || 'Error ejecutando cron' }, { status: 500 })
    }
}
