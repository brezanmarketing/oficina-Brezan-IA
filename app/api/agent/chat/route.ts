import { NextRequest, NextResponse } from 'next/server'
import { logTokenUsage } from '@/lib/usage'
import { getCredential } from '@/office/tools/credential-manager'
import { createClient } from '@/lib/supabase/server'

const ACTIONS_PROTOCOL = `
---
## PROTOCOLO DE HERRAMIENTAS Y RAZONAMIENTO (OBLIGATORIO)

Para realizar acciones en el sistema, DEBES generar un bloque al final de tu respuesta con el formato exacto:
[[ACTION: NOMBRE_ACCION | clave1=valor1 | clave2=valor2]]

### Herramientas de Gestión de Equipo (RRHH):
- **ASK_AGENT**: Preguntar a expertos de tu equipo. Parámetros: agent_name, question.
- **CREATE_AGENT**: Contratar un nuevo trabajador. Parámetros: name, role, model, prompt, reason.
- **UPDATE_AGENT_PROMPT**: Mejorar las instrucciones de un agente. Parámetros: agent_name, new_prompt.

### Herramientas Operativas (Fase 2):
- **WEB_SEARCH**: Buscar información en internet. Parámetros: query.
- **WEB_BROWSER**: Navegar o capturar webs. Parámetros: url, action (visit|screenshot).
- **FILE_MANAGER**: Gestionar el sistema de archivos de la oficina. Parámetros: action (read|write|list), path, content (si es write).
- **DATA_ANALYZER**: Analizar CSVs o generar gráficos. Parámetros: action (analyze|chart), data, type.
- **SEND_MESSAGE**: Comunicación externa instantánea. Parámetros obligatorios: channel (telegram|slack), to (ID de usuario o canal), message (texto completo del mensaje que quieres enviar). EJEMPLO: [[ACTION: SEND_MESSAGE | channel=telegram | to=123456 | message=Hola CEO, reporte listo]].
- **EXECUTE_CODE**: Ejecutar scripts de Python o JS de forma segura. Parámetros: language, code.

### Herramientas de Orquestación (Fase 3):
- **EXECUTE_OBJECTIVE**: Iniciar un proyecto autónomo de múltiples pasos. Parámetros: objective. (Usa esto para misiones complejas).

### Tabla de Costos de Modelos:
- Gemini-Flash: $0.075 / 1M tokens (IDEAL para tareas de rutina, búsqueda y análisis).
- Gemini-Pro: $1.25 / 1M tokens (Razonamiento intermedio).
- GPT-4o: $5.00 / 1M tokens (USAR SOLO para código complejo o arquitectura crítica).

REGLA CRÍTICA: NO digas "voy a hacer X" si puedes usar una herramienta. DEBES incluir el bloque [[ACTION: NOMBRE_ACCION ...]].
---
`

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { agentId, modelType, systemPrompt: baseSystemPrompt, messages } = body

        if (!baseSystemPrompt || !messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Faltan parámetros requeridos (systemPrompt, messages array)' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: agentsData } = await supabase.from('agents').select('name, role')
        const agents = (agentsData || []) as { name: string, role: string }[]
        const teamDir = agents.map(a => `- ${a.name} (${a.role})`).join('\n')

        const systemPrompt = `
${baseSystemPrompt}

## DIRECTORIO DEL EQUIPO ACTUAL:
${teamDir}

${ACTIONS_PROTOCOL}
`.trim()

        // Routing Inteligente (OpenAI vs Gemini)
        if (modelType && modelType.includes('GPT')) {
            const openAiApiKey = await getCredential('openai', 'API Key')
            if (!openAiApiKey) {
                return NextResponse.json({ error: 'No hay OPENAI_API_KEY configurada' }, { status: 500 })
            }

            const openAiModel = modelType === 'GPT-4o' ? 'gpt-4o' : 'gpt-4o-mini'
            const openAiMessages = [
                { role: "system", content: systemPrompt },
                ...messages.map((msg: any) => ({
                    role: msg.role === 'agent' ? 'assistant' : 'user',
                    content: msg.content
                }))
            ]

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAiApiKey} `
                },
                body: JSON.stringify({
                    model: openAiModel,
                    messages: openAiMessages,
                    temperature: 0.7
                })
            })

            const data = await response.json()
            if (!response.ok) {
                console.error('Error de OpenAI Chat:', data)
                throw new Error(data.error?.message || 'Error en la llamada a OpenAI Chat')
            }

            const resultText = data.choices?.[0]?.message?.content || ''
            const usageMetadata = data.usage || {}

            if (agentId) {
                await logTokenUsage({
                    agentId,
                    model: modelType,
                    usage: {
                        promptTokenCount: usageMetadata.prompt_tokens || 0,
                        candidatesTokenCount: usageMetadata.completion_tokens || 0,
                        totalTokenCount: usageMetadata.total_tokens || 0
                    }
                })
            }

            return NextResponse.json({
                result: resultText,
                usage: usageMetadata
            })
        }

        // --- Flujo Original Gemini ---
        const apiKey = await getCredential('gemini', 'API Key')
        if (!apiKey) {
            return NextResponse.json({ error: 'No hay GEMINI API_KEY configurada' }, { status: 500 })
        }

        // Forzar flash para evitar cuota de la capa gratuita
        let geminiModel = 'gemini-2.5-flash'
        /* Comentado temporalmente por error 429 API
        if (modelType === 'Gemini-Pro' || modelType === 'GPT-4o' || modelType === 'Claude-3.5') {
            geminiModel = 'gemini-1.5-pro-latest'
        }
        */

        // Formatear mensajes para Gemini
        const formattedContents = messages.map((msg: any) => ({
            role: msg.role === 'agent' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }))

        // Llamar a Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: formattedContents,
                    generationConfig: {
                        temperature: 0.7,
                    },
                }),
            }
        )

        const data = await response.json()

        if (!response.ok) {
            console.error('Error de Gemini Chat:', data)
            throw new Error(data.error?.message || 'Error en la llamada a Gemini Chat')
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const usageMetadata = data.usageMetadata || {}

        // Registrar uso si hay agentId
        if (agentId) {
            await logTokenUsage({
                agentId,
                model: modelType || 'Gemini-Flash',
                usage: usageMetadata
            })
        }

        return NextResponse.json({
            result: resultText,
            usage: usageMetadata
        })

    } catch (err: any) {
        console.error('API /agent/chat Error:', err)
        return NextResponse.json({ error: err.message || 'Error interno en chat' }, { status: 500 })
    }
}
