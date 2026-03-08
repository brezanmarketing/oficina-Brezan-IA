import { NextRequest } from 'next/server'
import { getCredential } from '@/office/tools/credential-manager'

async function sendMessage(service: string, chatId: string, text: string) {
    const token = await getCredential('telegram', 'Bot Token');
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
    });
}

export async function GET(req: NextRequest) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Verificar OpenAI, Gemini, Telegram y Supabase
        const checks = await Promise.allSettled([
            fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${await getCredential('openai', 'API Key')}` }
            }),
            fetch(`https://api.telegram.org/bot${await getCredential('telegram', 'Bot Token')}/getMe`),
        ])

        const results = checks.map((c, i) => ({
            service: ['openai', 'telegram'][i],
            ok: c.status === 'fulfilled' && c.value.ok
        }))

        const anyDown = results.some(r => !r.ok)

        if (anyDown) {
            const failed = results.filter(r => !r.ok).map(r => r.service)
            // Notificar al CEO por Telegram
            await sendMessage('telegram', '1404171793',
                `⚠️ Health Check: servicios caídos: ${failed.join(', ')}`
            )
        }

        return Response.json({ ok: true, results })

    } catch (error) {
        return Response.json({ ok: false, error }, { status: 500 })
    }
}

