import { NextRequest, NextResponse } from 'next/server'
import { logTokenUsage } from '@/lib/usage'
import { getCredential } from '@/office/tools/credential-manager'
import { createClient } from '@/lib/supabase/server'
import { costController } from '@/office/jarvis/phase4/cost-controller'
import { executeTool } from '@/office/jarvis/tool-registry'

const ACTIONS_PROTOCOL = `
---
## PROTOCOLO DE HERRAMIENTAS Y RAZONAMIENTO (OBLIGATORIO)

Para realizar acciones en el sistema, DEBES generar un bloque al final de tu respuesta con el formato exacto:
[[ACTION: NOMBRE_ACCION | clave1=valor1 | clave2=valor2]]

### Herramientas de Gestión de Equipo (RRHH):
- **ASK_AGENT**: Preguntar a expertos de tu equipo. Parámetros: agent_name, question.
- **CREATE_AGENT**: Contratar un nuevo trabajador. Parámetros: name, role, model, prompt, reason.
- **UPDATE_AGENT_PROMPT**: Mejorar las instrucciones de un agente. Parámetros: agent_name, new_prompt.

### Herramientas Operativas:
- **WEB_SEARCH**: Buscar información en internet. Parámetros: query.
- **WEB_BROWSER**: Navegar o capturar webs. Parámetros: url, action (visit|screenshot).
- **FILE_MANAGER**: Gestionar el sistema de archivos de la oficina. Parámetros: action (read|write|list), path, content (si es write).
- **DATA_ANALYZER**: Analizar CSVs o generar gráficos. Parámetros: action (analyze|chart), data, type.
- **SEND_MESSAGE**: Comunicación externa. Parámetros obligatorios: channel (telegram|slack), to (ID de usuario o canal), text.
- **CREATE_TASK**: Crear una nueva tarea en el tablero War Room. Parámetros: title, priority (alta|media|baja), status (pending|in_progress|completed), assigned_agent_name (opcional).

### Herramientas del Sistema Jarvis:
- **MEMORY_STORE**: Guardar información importante a largo plazo. Parámetros: content, tags, importance (1-5).
- **MEMORY_SEARCH**: Buscar en la memoria a largo plazo. Parámetros: query.
- **EXECUTE_OBJECTIVE**: Iniciar un proyecto autónomo de múltiples pasos (War Room). Parámetros: objective.

REGLA CRÍTICA: NO digas "voy a hacer X" si puedes usar una herramienta. DEBES incluir el bloque [[ACTION: NOMBRE_ACCION ...]].
---
`

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { message, agentId = 'jarvis-system', model, history = [], autonomyLevel = 'full', projectId } = body

        if (!message) {
            return NextResponse.json({ error: 'Mensaje requerido.' }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Obtener información del Agente (Jarvis)
        const { data: agentData } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()

        const baseSystemPrompt = agentData?.prompt || 'Eres J.A.R.V.I.S., el agente central de la oficina.'

        // 2. Obtener Directorio de Agentes
        const { data: agentsList } = await supabase.from('agents').select('name, role')
        const teamDir = (agentsList || []).map(a => `- ${a.name} (${a.role})`).join('\n')

        // 3. Crear o recuperar la Sesión de Conversación
        // Aquí simplificaremos: buscaremos la última o crearemos una nueva.
        const { data: lastConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('agent_id', agentId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()

        let conversationId = lastConv?.id
        if (!conversationId) {
            const { data: newConv } = await supabase
                .from('conversations')
                .insert([{ agent_id: agentId, title: 'Chat Principal' }])
                .select()
                .single()
            if (newConv) conversationId = newConv.id
        }

        // 4. Guardar mensaje del usuario
        if (conversationId) {
            await supabase.from('messages').insert([{
                conversation_id: conversationId,
                role: 'user',
                content: message
            }])
        }

        // 5. Preparar System Prompt final
        const systemPrompt = `
${baseSystemPrompt}

## DIRECTORIO DEL EQUIPO ACTUAL:
${teamDir}

## MODO DE AUTONOMÍA:
Actual = ${autonomyLevel.toUpperCase()}
${autonomyLevel === 'full' ? 'Puedes ejecutar herramientas sin pedir confirmación, asume autonomía total.' : 'Deberás requerir confirmación antes de ejecutar herramientas críticas.'}

${ACTIONS_PROTOCOL}
`.trim()

        // 6. Preparar el historial de mensajes
        const formattedMessages = history.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }))
        formattedMessages.push({ role: 'user', content: message })

        let isGPT = model && model.includes('gpt')
        let finalResultText = ''
        let totalUsage = { promptTokenCount: 0, candidatesTokenCount: 0 }
        
        let currentMessages = [...formattedMessages]
        let loopCount = 0
        const MAX_LOOPS = 5
        let lastUsageMetadata: any = {}

        // LLM credentials
        const openAiApiKey = isGPT ? await getCredential('openai', 'API Key') : null
        const geminiApiKey = !isGPT ? await getCredential('gemini', 'API Key') : null

        if (isGPT && !openAiApiKey) throw new Error('No hay OPENAI_API_KEY configurada')
        if (!isGPT && !geminiApiKey) throw new Error('No hay GEMINI API_KEY configurada')

        let resolvedModel = 'gemini-2.5-flash'
        if (!isGPT) {
            if (model === 'gemini-2.5-pro') resolvedModel = 'gemini-2.5-pro'
            if (model === 'gemini-2.0-pro-exp') resolvedModel = 'gemini-2.0-pro-exp-02-05'
        }

        while (loopCount < MAX_LOOPS) {
            loopCount++
            let resultText = ''

            // 7. Llamada a LLM
            if (isGPT) {
                const openAiMessages = [
                    { role: "system", content: systemPrompt },
                    ...currentMessages
                ]

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openAiApiKey}`
                    },
                    body: JSON.stringify({
                        model: model || 'gpt-4o-mini',
                        messages: openAiMessages,
                        temperature: 0.7
                    })
                })

                const data = await response.json()
                if (!response.ok) throw new Error(data.error?.message || 'Error OpenAI')

                resultText = data.choices?.[0]?.message?.content || ''
                lastUsageMetadata = data.usage || {}
                totalUsage.promptTokenCount += lastUsageMetadata.prompt_tokens || 0
                totalUsage.candidatesTokenCount += lastUsageMetadata.completion_tokens || 0
            } else {
                const geminiContents = currentMessages.map((msg: any) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }))

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents: geminiContents,
                            generationConfig: { temperature: 0.7 },
                        }),
                    }
                )

                const data = await response.json()
                if (!response.ok) throw new Error(data.error?.message || 'Error Gemini')

                resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                lastUsageMetadata = data.usageMetadata || {}
                totalUsage.promptTokenCount += lastUsageMetadata.promptTokenCount || 0
                totalUsage.candidatesTokenCount += lastUsageMetadata.candidatesTokenCount || 0
            }

            // Regex for action extracting
            const actionRegex = /\[\[ACTION:\s*([A-Za-z_]+)\s*(?:\|(.*?))?\]\]/g;
            const matches = [...resultText.matchAll(actionRegex)];

            if (matches.length === 0) {
                finalResultText = resultText;
                break;
            }

            // Execute Actions
            const toolResults = [];
            for (const match of matches) {
                const actionName = match[1];
                const paramsStr = match[2] || '';
                
                // Parse parameters
                const params: any = {};
                if (paramsStr) {
                    const parts = paramsStr.split('|');
                    for (const p of parts) {
                        const idx = p.indexOf('=');
                        if (idx !== -1) {
                            params[p.substring(0, idx).trim()] = p.substring(idx + 1).trim();
                        }
                    }
                }

                try {
                    const normalizedToolName = actionName.toLowerCase().replace(/_/g, '-');
                    const agentContext = {
                        id: agentId,
                        role: agentData?.role || 'assistant',
                        project_id: projectId || 'default',
                        task_id: 'chat_interaction'
                    };
                    const res = await executeTool(normalizedToolName, params, agentContext);
                    
                    // Format output safely
                    const resStr = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
                    toolResults.push(`[Herramienta ${actionName} completada]\nResultado:\n${resStr}`);
                } catch (e: any) {
                    toolResults.push(`[Herramienta ${actionName} fallida]\nError: ${e.message}`);
                }
            }

            // Inyectamos resultados a la conversación para la próxima iteración
            currentMessages.push({ role: isGPT ? 'assistant' : 'assistant', content: resultText });
            currentMessages.push({ 
                role: 'user', 
                content: `System Tool Results:\n${toolResults.join('\n\n')}\n\nAnaliza estos resultados. Si la tarea del usuario está completa, dale tu respuesta final amable sin usar herramientas. Si necesitas hacer más acciones para completar su petición original, usa otra [[ACTION: ...]].` 
            });

            // En caso de que sea la última iteración, guardar algo para mostrar
            finalResultText = resultText + '\n\n' + toolResults.join('\n'); 
        }

        // 8. Grabar respuesta del asistente a la DB
        if (conversationId && finalResultText) {
            // Guardamos solo la final o toda la traza? Mejor solo la última traza amigable, o todo el finalResultText
            await supabase.from('messages').insert([{
                conversation_id: conversationId,
                role: 'assistant',
                content: finalResultText
            }])
            
            await supabase.from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId)
        }

        // 9. Registrar Costos Totales Acumulados
        try {
            await costController.recordCost(
                agentId,
                projectId || 'default',
                'chat_interaction',
                model || 'gemini-2.5-flash',
                totalUsage.promptTokenCount,
                totalUsage.candidatesTokenCount
            )
            await logTokenUsage({
                agentId,
                model: model || 'gemini-2.5-flash',
                usage: { 
                    promptTokenCount: totalUsage.promptTokenCount, 
                    candidatesTokenCount: totalUsage.candidatesTokenCount, 
                    totalTokenCount: totalUsage.promptTokenCount + totalUsage.candidatesTokenCount 
                }
            })
        } catch (e) {
            console.error('Error recording cost:', e)
        }

        return NextResponse.json({
            response: finalResultText,
            usage: lastUsageMetadata // Return the last one for the client, since total might be confusing for the UI schema
        })

    } catch (err: any) {
        console.error('API /agent/chat Error:', err)
        return NextResponse.json({ error: err.message || 'Error interno en chat' }, { status: 500 })
    }
}
