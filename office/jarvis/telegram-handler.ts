import { getCredential } from '../tools/credential-manager';
import { sendMessage } from '../tools/communications/index';
// Necesitamos un cliente supabase con service role o admin para el backend
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function processJarvisMessage(
    userMessage: string,
    chatId: string,
    username: string
): Promise<void> {
    try {
        console.log('PROCESANDO MENSAJE:', userMessage)
        await sendTypingAction(chatId)

        // 1. Obtener la identidad real de J.A.R.V.I.S. desde la base de datos
        const { data: jarvis, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('name', 'J.A.R.V.I.S.')
            .single();

        if (agentError || !jarvis) {
            console.warn("No se encontró a J.A.R.V.I.S. en la BDD, usando prompt default.");
        }

        const systemPrompt = jarvis?.system_prompt || 'Eres J.A.R.V.I.S., la IA estratégica de Brezan. Responde de forma directa.';
        const modelType = jarvis?.model_type || 'Gemini-Flash';
        const agentId = jarvis?.id || 'system-telegram';

        // 2. Recuperar la memoria (Historial) de Telegram desde shared_context
        const contextKey = `telegram_mem_${chatId}`;
        let { data: memoryContext } = await supabase
            .from('shared_context')
            .select('*')
            .eq('created_by', contextKey)
            .limit(1)
            .single();

        // Extraer array de mensajes previos o iniciar uno nuevo
        let chatHistory = memoryContext?.data?.messages || [];

        // Añadir el nuevo mensaje del usuario al historial
        chatHistory.push({ role: 'user', content: userMessage });

        // Mantener solo los últimos 10 mensajes para no saturar tokens
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

        console.log('LLAMANDO A JARVIS CON HISTORIAL DE:', chatHistory.length, 'mensajes');
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/agent/chat`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agentId,
                    modelType: modelType,
                    systemPrompt: systemPrompt,
                    messages: chatHistory
                })
            }
        )

        console.log('RESPUESTA DE JARVIS STATUS:', response.status)
        const data = await response.json()

        // La API /agent/chat devuelve el texto principal en data.result
        let rawReply = data.result || data.reply || data.message ||
            data.content || data.error || 'Sin respuesta';

        // Limpiamos los bloques de ACTION para que el usuario no vea código crudo
        const visibleText = rawReply.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim();
        const jarvisReply = visibleText || "Comando procesado en background.";

        // 3. Guardar la respuesta de Jarvis en el historial
        chatHistory.push({ role: 'agent', content: rawReply }); // Se guarda con comandos raw internamente

        if (memoryContext) {
            // Actualizar registro existente
            await supabase.from('shared_context').update({ data: { messages: chatHistory } }).eq('id', memoryContext.id);
        } else {
            // Crear nuevo registro de memoria
            await supabase.from('shared_context').insert({
                created_by: contextKey,
                data: { messages: chatHistory },
                sender_agent_id: agentId,
                timestamp: new Date().toISOString()
            });
        }

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
