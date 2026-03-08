import { getCredential } from '../tools/credential-manager';
import { sendMessage } from '../tools/communications/index';
// Necesitamos un cliente supabase con service role o admin para el backend
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// ─── Control de Estado Visual ────────────────────────────────────────────────
async function updateAgentStatus(agentId: string, status: 'idle' | 'working' | 'thinking') {
    try {
        const supabase = getSupabase();
        // 1. Actualizar estado real
        await supabase.from('agents').update({ status }).eq('id', agentId);

        // 2. Insertar mensaje silencioso para disparar el "Jump" visual y el refresh del mapa
        // Usamos la tabla shared_context que sí existe y tiene Realtime habilitado
        await supabase.from('shared_context').insert({
            sender_agent_id: agentId,
            task_id: null,
            data: {
                event: 'STATUS_UPDATE',
                status: status,
                silent: true
            }
        });
    } catch (e) {
        console.warn(`Error actualizando estado visual del agente ${agentId}:`, e);
    }
}

// ─── Parser de Acciones ──────────────────────────────────────────────────────
function parseActionsFromText(text: string): { command: string, params: Record<string, string> }[] {
    const regex = /\[\[ACTION:\s*(\w+)\s*\|([\s\S]*?)\]\]/g
    const actions: { command: string, params: Record<string, string> }[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        const command = match[1].trim()
        const rawParams = match[2]
        const params: Record<string, string> = {}

        const pairs = rawParams.split('|')
        for (const pair of pairs) {
            const eqIndex = pair.indexOf('=')
            if (eqIndex !== -1) {
                const key = pair.substring(0, eqIndex).trim()
                const value = pair.substring(eqIndex + 1).trim()
                if (key) params[key] = value
            }
        }

        actions.push({ command, params })
    }
    return actions
}

export async function processJarvisMessage(
    userMessage: string,
    chatId: string,
    username: string
): Promise<void> {
    const supabase = getSupabase();
    let agentId = 'system-telegram'; // Default fallback
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
        agentId = jarvis?.id || 'system-telegram';

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

        // Mantener solo los últimos 12 mensajes para no saturar tokens
        if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);

        let keepThinking = true;
        let iterations = 0;
        let finalJarvisReply = "";

        // Bucle ReAct (máx 3 iteraciones para evitar infinitos)
        while (keepThinking && iterations < 3) {
            keepThinking = false;
            iterations++;

            await updateAgentStatus(agentId, 'thinking');

            console.log(`LLAMANDO A JARVIS (Iteración ${iterations}) CON HISTORIAL DE:`, chatHistory.length, 'mensajes');
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

            const data = await response.json()

            // La API /agent/chat devuelve el texto principal en data.result
            let rawReply = data.result || data.reply || data.message || data.content || data.error || 'Sin respuesta';

            const actions = parseActionsFromText(rawReply);
            const visibleText = rawReply.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim();

            // 3. Guardar la respuesta pura de Jarvis en el historial
            chatHistory.push({ role: 'agent', content: rawReply }); // Se guarda con comandos raw internamente

            if (visibleText && iterations === 1 && actions.length > 0) {
                // Si dice algo útil antes de usar herramientas, se lo enviamos
                await sendMessage('telegram', chatId, visibleText);
            } else if (visibleText && actions.length === 0) {
                finalJarvisReply = visibleText;
            }

            // Ejecutor interno de herramientas para Telegram
            if (actions.length > 0) {
                await updateAgentStatus(agentId, 'working');
                await sendTypingAction(chatId); // Reactivar el typing mientras hace peticiones
                for (const action of actions) {
                    let actionResult = "Ejecutado.";
                    try {
                        console.log(`Ejecutando acción autónoma:`, action.command);
                        if (action.command === 'ASK_AGENT') {
                            // Interacción directa con otros agentes de la oficina
                            const { data: targetAgent } = await supabase.from('agents').select('*').or(`name.eq.${action.params.agent_name},role.eq.${action.params.agent_name}`).limit(1).single();
                            if (!targetAgent) {
                                actionResult = `Error: Agente "${action.params.agent_name}" no encontrado en BDD.`;
                            } else {
                                await updateAgentStatus(targetAgent.id, 'thinking');
                                const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/chat`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        agentId: targetAgent.id,
                                        modelType: targetAgent.model_type,
                                        systemPrompt: targetAgent.system_prompt,
                                        messages: [{ role: 'user', content: `J.A.R.V.I.S. pregunta vía Telegram: ${action.params.question}` }]
                                    })
                                });
                                const ans = await res.json();
                                actionResult = ans.result || 'Sin respuesta.';
                                await updateAgentStatus(targetAgent.id, 'idle');
                            }
                        } else if (action.command === 'EXECUTE_OBJECTIVE') {
                            // Crear una misión real en la base de datos
                            const { objective } = action.params;
                            if (!objective) {
                                actionResult = "Error: Falta descripción del objetivo.";
                            } else {
                                // 1. Crear Tarea (Misión)
                                const { data: projects } = await supabase.from('projects').select('id').limit(1).single();
                                const projectId = projects?.id || null;

                                const { data: newTask, error: taskErr } = await supabase.from('tasks').insert({
                                    title: `Objetivo Telegram: ${objective.substring(0, 30)}...`,
                                    description: objective,
                                    assigned_agent_id: agentId, // Se auto-asigna o empieza por él mismo
                                    chain_of_command: [agentId], // Cadena simple por defecto
                                    current_step_index: 0,
                                    status: 'in_progress',
                                    project_id: projectId
                                }).select().single();

                                if (taskErr) throw taskErr;

                                // 2. Insertar evento de inicio
                                await supabase.from('shared_context').insert({
                                    task_id: newTask.id,
                                    data: {
                                        event: 'TASK_STARTED',
                                        message: `Misión iniciada vía Telegram: "${objective}"`,
                                        prompt: objective
                                    }
                                });

                                actionResult = `Misión lanzada con éxito (ID: ${newTask.id}). He registrado el objetivo en el sistema y comenzaré a trabajar en ello.`;
                            }
                        } else {
                            // Resto de herramientas operativas (DATA_ANALYZER, FILE_MANAGER, WEB_SEARCH, EXECUTE_CODE)
                            const toolRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/run-tool`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ command: action.command, params: action.params })
                            });
                            const toolData = await toolRes.json();
                            actionResult = toolData.success ? JSON.stringify(toolData.result) : (toolData.error || 'Fallo interno de herramienta.');
                        }
                    } catch (e: any) {
                        actionResult = `Fallo crítico de sistema en ${action.command}: ${e.message}`;
                    }

                    // Inyectar el resultado al historial como mensaje de sistema (user role para el LLM)
                    chatHistory.push({ role: 'user', content: `[SYSTEM: RESULTADO DE HERRAMIENTA ${action.command}]\n${actionResult}` });
                }

                // Forzar a pensar de nuevo para devolver respuesta de la herramienta
                keepThinking = true;
            }
        }

        if (!finalJarvisReply) {
            // Fallback si tras 3 bucles no generó texto visible
            const lastAgentMsg = [...chatHistory].reverse().find(m => m.role === 'agent');
            finalJarvisReply = lastAgentMsg ? lastAgentMsg.content.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim() : "Comando procesado, pero sin respuesta final en texto.";
        }

        // GUARDADO DE BASE DE DATOS
        if (memoryContext) {
            await supabase.from('shared_context').update({ data: { messages: chatHistory } }).eq('id', memoryContext.id);
        } else {
            await supabase.from('shared_context').insert({
                created_by: contextKey,
                data: { messages: chatHistory },
                sender_agent_id: agentId,
                timestamp: new Date().toISOString()
            });
        }

        console.log('ENVIANDO A TELEGRAM MJE FINAL:', finalJarvisReply)
        if (finalJarvisReply) {
            await sendMessage('telegram', chatId, finalJarvisReply)
        }
        console.log('MENSAJE ENVIADO OK')

    } catch (error) {
        console.error('ERROR EN processJarvisMessage:', error)
        await sendMessage('telegram', chatId,
            'Error interno grave en la unidad de procesamiento. Por favor inténtelo de nuevo.')
    } finally {
        await updateAgentStatus(agentId, 'idle');
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
