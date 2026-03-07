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
                    agentId: 'system-telegram',
                    modelType: 'Gemini-Flash',
                    systemPrompt: 'Eres J.A.R.V.I.S., la Inteligencia Artificial de la Oficina Brezan. Estás hablando directamente por Telegram con el CEO. Responde de manera profesional, directa y resolutiva.',
                    messages: [
                        { role: 'user', content: userMessage }
                    ]
                })
            }
        )

        console.log('RESPUESTA DE JARVIS STATUS:', response.status)
        const data = await response.json()
        console.log('RESPUESTA DE JARVIS:', JSON.stringify(data))

        // La API /agent/chat devuelve el texto principal en data.result
        let rawReply = data.result || data.reply || data.message ||
            data.content || data.error || 'Sin respuesta'

        // Limpiamos los bloques de ACTION para que el usuario no vea código crudo
        rawReply = rawReply.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim()
        const jarvisReply = rawReply || "Comando procesado en background."

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
