import { checkAllConditions } from '@/office/jarvis/phase5/condition-monitor';
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const result = await checkAllConditions();
        return Response.json({ ok: true, result })
    } catch (error) {
        return Response.json({ ok: false, error }, { status: 500 })
    }
}
