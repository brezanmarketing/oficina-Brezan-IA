import { getCredential } from '../tools/credential-manager';
import { sendMessage } from '../tools/communications/index';
// Necesitamos importar supabase o buscar el agente por ID. 
// Asumiremos que llamamos a /api/agent/chat tal y como pide el usuario, pero usando la URL absoluta.

export async function processJarvisMessage(
    userMessage: string,
    chatId: string,
    username: string
): Promise<void> {
    try {
        console.log('PROCESANDO MENSAJE:', userMessage)
        await sendTypingAction(chatId)

        console.log('LLAMANDO A JARVIS...')
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/agent/chat`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    source: 'telegram',
                    chatId
                })
            }
        )

        console.log('RESPUESTA DE JARVIS STATUS:', response.status)
        const data = await response.json()
        console.log('RESPUESTA DE JARVIS:', JSON.stringify(data))

        const jarvisReply = data.reply || data.message ||
            data.content || 'Sin respuesta'

        console.log('ENVIANDO A TELEGRAM:', jarvisReply)
        await sendMessage('telegram', chatId, jarvisReply)
        console.log('MENSAJE ENVIADO OK')

    } catch (error) {
        console.error('ERROR EN processJarvisMessage:', error)
        await sendMessage('telegram', chatId,
            'Error interno. Por favor inténtalo de nuevo.')
    }
}

async function sendTypingAction(chatId: string): Promise<void> {
    try {
        const token = await getCredential('telegram', 'Bot Token')
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        })
    } catch (e) {
        console.warn('No se pudo enviar estado "escribiendo" a Telegram:', e);
    }
}
