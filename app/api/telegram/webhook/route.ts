import { NextRequest } from 'next/server'
import { processJarvisMessage } from '@/office/jarvis/telegram-handler'

export async function POST(req: NextRequest) {
    try {
        const update = await req.json()
        console.log('WEBHOOK RECIBIDO:', JSON.stringify(update))

        // Verificar que es un mensaje de texto
        if (!update.message?.text) {
            console.log('Sin texto, ignorando')
            return Response.json({ ok: true })
        }

        const chatId = update.message.chat.id.toString()
        const text = update.message.text
        console.log('MENSAJE DE:', chatId, 'TEXTO:', text)
        console.log('OWNER ID:', '1404171793')
        console.log('ES OWNER:', chatId === '1404171793')
        const username = update.message.from?.first_name || 'CEO'

        // Solo responder al owner (seguridad)
        if (chatId !== '1404171793') {
            console.warn(`Intento de acceso denegado desde el chat: ${chatId}`);
            return Response.json({ ok: true })
        }

        // Vercel congela la función si retornamos antes de que acabe la promesa.
        // Por tanto, debemos hacer await a processJarvisMessage.
        await processJarvisMessage(text, chatId, username)

        return Response.json({ ok: true })

    } catch (e: any) {
        console.error("Error en el webhook de Telegram:", e);
        // Telegram requiere un 200 OK incluso en errores para no reintentar infinitamente
        return Response.json({ ok: true })
    }
}
