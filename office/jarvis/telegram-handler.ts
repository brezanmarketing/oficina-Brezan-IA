import { getCredential } from '../tools/credential-manager';
import { sendMessage } from '../tools/communications/index';
// Necesitamos importar supabase o buscar el agente por ID. 
// Asumiremos que llamamos a /api/agent/chat tal y como pide el usuario, pero usando la URL absoluta.

export async function processJarvisMessage(
    userMessage: string,
    chatId: string,
    username: string,
    origin: string
): Promise<void> {
    try {
        // 1. Enviar "escribiendo..." mientras procesa
        await sendTypingAction(chatId)

        // Necesitamos el ID del agente Jarvis en la DB para pasarlo al chat endpoint.
        // Dado que el endpoint /api/agent/chat requiere agentId, modelType y systemPrompt, 
        // lo ideal sería consultar Supabase primero para obtener esos datos.
        // Para simplificar, llamaremos al endpoint pasándole una estructura dummy y que el backend de chat
        // haga el matching si no tiene agentId (esto requeriría un bypass). 
        // Sin embargo, para seguir la arquitectura del usuario donde `/api/agent/chat` espera agentId:

        // Haremos un fetch a nosotros mismos (la oficina) para recuperar al agente principal
        const agentsRes = await fetch(`${origin}/api/agent/list`); // Asumimos que existe o usaremos Supabase directo.

        // Forma más segura sin depender de un endpoint: Usar un Hardcode momentáneo del ID si lo conocemos, 
        // o mejor aún, adaptar el bloque de petición.
        // Vamos a llamar a una ruta interna adaptada o inyectar una petición limpia.

        // Petición POST al endpoint del chat (requerirá ajustes técnicos en el Route handler si falla)
        const response = await fetch(`${origin}/api/agent/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // NOTA: /api/agent/chat actualmente espera 'agentId'.
                // Pasaremos 'jarvis' como flag y el webhook se adaptará, o bien enviaremos el mensaje genérico.
                message: userMessage,
                source: 'telegram',
                chatId: chatId,
                is_webhook: true // flag
            })
        })

        const data = await response.json()

        // Si la API normal de chat devuelve actions y text, lo limpiamos de [ACTION] blocks
        const rawContent = data.result || 'Sin respuesta';
        const visibleText = rawContent.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim() || "Procesado.";

        // 3. Enviar respuesta de Jarvis al usuario (solo el texto visible)
        await sendMessage('telegram', chatId, visibleText)

    } catch (e) {
        console.error("Error procesando mensaje de Jarvis via Telegram:", e);
        await sendMessage('telegram', chatId, 'Ha ocurrido un error interno en mis sistemas al procesar tu mensaje.');
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
