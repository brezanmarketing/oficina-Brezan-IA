import { NextRequest, NextResponse } from 'next/server'
import { logTokenUsage } from '@/lib/usage'
import { getCredential } from '@/office/tools/credential-manager'
import { createClient } from '@/lib/supabase/server'
import { costController } from '@/office/jarvis/phase4/cost-controller'

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

        let resultText = ''
        let usageMetadata: any = {}
        const isGPT = model && model.includes('gpt')

        // 7. Llamada a LLM
        if (isGPT) {
            const openAiApiKey = await getCredential('openai', 'API Key')
            if (!openAiApiKey) throw new Error('No hay OPENAI_API_KEY configurada')

            const openAiMessages = [
                { role: "system", content: systemPrompt },
                ...formattedMessages
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
            usageMetadata = data.usage || {}
        } else {
            const apiKey = await getCredential('gemini', 'API Key')
            if (!apiKey) throw new Error('No hay GEMINI API_KEY configurada')

            // Gemini format
            const geminiContents = formattedMessages.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }))

            // Resolve model name.
            let resolvedModel = 'gemini-2.0-flash'
            if (model === 'gemini-2.5-pro') resolvedModel = 'gemini-2.5-pro'
            if (model === 'gemini-2.0-pro-exp') resolvedModel = 'gemini-2.0-pro-exp-02-05'

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`,
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
            usageMetadata = data.usageMetadata || {}
        }

        // 8. Grabar respuesta del asistente a la DB
        if (conversationId && resultText) {
            await supabase.from('messages').insert([{
                conversation_id: conversationId,
                role: 'assistant',
                content: resultText
            }])
            
            await supabase.from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId)
        }

        // 9. Registrar Costos
        try {
            const pToken = usageMetadata.prompt_tokens || usageMetadata.promptTokenCount || 0
            const cToken = usageMetadata.completion_tokens || usageMetadata.candidatesTokenCount || 0
            await costController.recordCost(
                agentId,
                projectId || 'default',
                'chat_interaction',
                model || 'gemini-2.5-flash',
                pToken,
                cToken
            )
            await logTokenUsage({
                agentId,
                model: model || 'gemini-2.5-flash',
                usage: { promptTokenCount: pToken, candidatesTokenCount: cToken, totalTokenCount: pToken + cToken }
            })
        } catch (e) {
            console.error('Error recording cost:', e)
        }

        return NextResponse.json({
            response: resultText,
            usage: usageMetadata
        })

    } catch (err: any) {
        console.error('API /agent/chat Error:', err)
        return NextResponse.json({ error: err.message || 'Error interno en chat' }, { status: 500 })
    }
}
