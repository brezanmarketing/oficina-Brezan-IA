import { NextRequest, NextResponse } from 'next/server'
import { logTokenUsage } from '@/lib/usage'
import { getCredential } from '@/office/tools/credential-manager'

// ─── Protocolo de Acciones Autónomas ─────────────────────────────────────────
// Este bloque se inyecta automáticamente al system_prompt de todos los agentes.
// Permite que cualquier agente ejecute acciones reales sin intervención humana.
const ACTIONS_PROTOCOL = `

---
## PROTOCOLO DE ACCIONES AUTÓNOMAS (LEER CON ATENCIÓN)

Para ejecutar acciones reales en la infraestructura, incluye al final de tu respuesta un bloque de acción con el siguiente formato EXACTO (sin comillas extra, sin saltos de línea dentro del bloque):

[[ACTION: NOMBRE_ACCION | clave1=valor1 | clave2=valor2]]

### Acciones Disponibles:

**ASK_AGENT** — Consultar a un experto de tu equipo antes de completar tu tarea.
Parámetros obligatorios: agent_name (nombre del compañero a consultar), question (pregunta concreta)
Ejemplo: [[ACTION: ASK_AGENT | agent_name=Maia | question=¿Puedes revisar este análisis y darme tu opinión experta?]]
IMPORTANTE: Cuando uses ASK_AGENT, el experto responderá, y TÚ serás re-ejecutado con su respuesta.

**CHECK_CREDENTIAL** — Verificar si el usuario ha conectado su API Key en el Vault antes de usar una herramienta externa que lo exija (ej. Web Search, GitHub, Notion).
Parámetros obligatorios: integration_id (el identificador de la API, ej: openai, serper, github, notion, etc)
Ejemplo: [[ACTION: CHECK_CREDENTIAL | integration_id=serper]]

### Reglas de Uso:
- Solo incluye un bloque [[ACTION: ...]] si la tarea lo requiere explícitamente.
- El bloque de acción debe ser lo ÚLTIMO en tu respuesta, en una línea separada.
- Si no necesitas ejecutar ninguna acción, simplemente responde sin el bloque.
- No inventes parámetros. Usar el formato incorrecto puede fallar la acción.
---
`

// ─── Parser de acciones ──────────────────────────────────────────────────────
function parseActions(text: string) {
    const regex = /\[\[ACTION:\s*(\w+)\s*\|([\s\S]*?)\]\]/g
    const actions: Array<{ command: string; params: Record<string, string> }> = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        const command = match[1].trim()
        const rawParams = match[2].split('|')
        const params: Record<string, string> = {}
        for (const raw of rawParams) {
            const eqIdx = raw.indexOf('=')
            if (eqIdx > -1) {
                const key = raw.slice(0, eqIdx).trim()
                const value = raw.slice(eqIdx + 1).trim()
                params[key] = value
            }
        }
        actions.push({ command, params })
    }
    return actions
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { agentId, modelType, systemPrompt, prompt, taskId } = body

        if (!systemPrompt || !prompt) {
            return NextResponse.json({ error: 'Faltan parámetros requeridos (systemPrompt, prompt)' }, { status: 400 })
        }

        // Inyectar protocolo en el system prompt de todos los agentes
        const enrichedSystemPrompt = systemPrompt + ACTIONS_PROTOCOL

        // Routing Inteligente (OpenAI vs Gemini)
        if (modelType && modelType.includes('GPT')) {
            const openAiApiKey = await getCredential('openai', 'API Key')
            if (!openAiApiKey) {
                return NextResponse.json({ error: 'No hay OPENAI_API_KEY configurada' }, { status: 500 })
            }

            const openAiModel = modelType === 'GPT-4o' ? 'gpt-4o' : 'gpt-4o-mini'
            const openAiMessages = [
                { role: "system", content: enrichedSystemPrompt },
                { role: "user", content: prompt }
            ]

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAiApiKey}`
                },
                body: JSON.stringify({
                    model: openAiModel,
                    messages: openAiMessages,
                    temperature: 0.7
                })
            })

            const data = await response.json()
            if (!response.ok) {
                console.error('Error de OpenAI:', data)
                throw new Error(data.error?.message || 'Error en la llamada a OpenAI')
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

            const openAiActions = parseActions(resultText)
            return NextResponse.json({
                result: resultText,
                usage: usageMetadata,
                actions: openAiActions
            })
        }

        // --- Flujo Original Gemini ---
        const apiKey = await getCredential('gemini', 'API Key')
        if (!apiKey) {
            return NextResponse.json({ error: 'No hay GEMINI API_KEY configurada' }, { status: 500 })
        }

        // Determinar modelo (forzando flash para pruebas gratuitas debido a límites de cuota)
        let geminiModel = 'gemini-2.5-flash'
        /* Comentado temporalmente por error 429 API
        if (modelType === 'Gemini-Pro' || modelType === 'GPT-4o' || modelType === 'Claude-3.5') {
            geminiModel = 'gemini-1.5-pro-latest'
        }
        */
        // Llamar a Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: enrichedSystemPrompt }]
                    },
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.7,
                    },
                }),
            }
        )

        const data = await response.json()

        if (!response.ok) {
            console.error('Error de Gemini:', data)
            throw new Error(data.error?.message || 'Error en la llamada a Gemini')
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const usageMetadata = data.usageMetadata || {}

        // Registrar uso si hay agentId
        if (agentId) {
            // logTokenUsage calcula todo internamente. Note: la función espera `promptTokenCount` y `candidatesTokenCount` 
            // y asume req.url está corriendo en backend para insertar en Supabase.
            // Para asegurar permisos directos a backend:
            await logTokenUsage({
                agentId,
                model: modelType || 'Gemini-Flash',
                usage: usageMetadata
            })
        }

        const detectedActions = parseActions(resultText)
        return NextResponse.json({
            result: resultText,
            usage: usageMetadata,
            actions: detectedActions
        })

    } catch (err: any) {
        console.error('API /agent/run Error:', err)
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
