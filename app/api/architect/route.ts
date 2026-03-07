import { NextRequest, NextResponse } from 'next/server'
import { ArchitectResponse } from '@/lib/types'
import { logTokenUsage } from '@/lib/usage'

const MODEL_SELECTION_PROMPT = `Eres el "Arquitecto de IA", un experto en diseño de sistemas multi-agente. Tu función es analizar la descripción de una necesidad empresarial y generar la configuración óptima para un agente de IA.

Dado la descripción del usuario, responde ÚNICAMENTE con un JSON válido (sin markdown, sin bloques de código, solo el JSON puro) con este formato exacto:
{
  "model_type": "Gemini-Flash",
  "suggested_name": "nombre corto del agente (1-2 palabras)",  
  "suggested_role": "rol conciso y profesional",
  "system_prompt": "Prompt del sistema detallado y optimizado para el LLM, en primera persona, describiendo la personalidad, expertise y metodología del agente. Mínimo 100 palabras."
}

Para model_type usa solo uno de: GPT-4o, GPT-4o-mini, Claude-3.5, Gemini-1.5, Gemini-Flash, Gemini-Pro.
Criterios de selección de modelo:
- Gemini-Flash: tareas rápidas, análisis ligero, contenido creativo básico
- GPT-4o-mini: razonamiento moderado, redacción avanzada
- Gemini-1.5: análisis de documentos largos, multimodal
- GPT-4o: razonamiento complejo, código avanzado, decisiones críticas
- Claude-3.5: escritura de alta calidad, análisis estratégico, seguridad
- Gemini-Pro: análisis profundo, razonamiento avanzado, generación larga`

export async function POST(req: NextRequest) {
    let body: { description?: string; agentId?: string } = {}

    try {
        body = await req.json()
        const { description, agentId = null } = body

        if (!description || typeof description !== 'string') {
            return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
        }

        const apiKey = process.env.GEMINI_API_KEY

        // Si no hay API key, devolver respuesta demo con coste simulado
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            const demoResponse = generateDemoResponse(description)
            return NextResponse.json({ ...demoResponse, cost_usd: 0, demo: true })
        }

        // ── Llamada a Gemini Flash ──────────────────────────────────────────────
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `${MODEL_SELECTION_PROMPT}\n\nDescripción del usuario:\n${description}`,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`)
        }

        const geminiData = await response.json()
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

        if (!text) throw new Error('Respuesta vacía del modelo')

        // ── Registrar uso de tokens automáticamente ─────────────────────────────
        const usageMetadata = geminiData.usageMetadata as {
            promptTokenCount?: number
            candidatesTokenCount?: number
            totalTokenCount?: number
        } | undefined

        // Fire-and-forget: no bloqueamos la respuesta
        if (usageMetadata) {
            logTokenUsage({
                agentId: agentId,
                model: 'Gemini-Flash',
                usage: {
                    promptTokenCount: usageMetadata.promptTokenCount,
                    candidatesTokenCount: usageMetadata.candidatesTokenCount,
                },
            }).catch(console.error)
        }

        // ── Parsear la respuesta ────────────────────────────────────────────────
        const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim()
        const parsed: ArchitectResponse = JSON.parse(cleanedText)

        return NextResponse.json({
            ...parsed,
            // Incluimos métricas de uso en la respuesta para que la UI pueda mostrarlas
            _usage: usageMetadata ?? null,
        })
    } catch (error) {
        console.error('Architect error:', error)
        const desc = body?.description ?? 'agente genérico'
        return NextResponse.json(generateDemoResponse(desc))
    }
}

// ── Fallback inteligente por palabras clave (sin API key) ─────────────────
function generateDemoResponse(description: string): ArchitectResponse {
    const lower = description.toLowerCase()

    let model_type: ArchitectResponse['model_type'] = 'Gemini-Flash'
    let suggested_name = 'Agente'
    let suggested_role = 'Asistente de IA'

    if (lower.includes('código') || lower.includes('programar') || lower.includes('developer')) {
        model_type = 'GPT-4o'; suggested_name = 'Codex'; suggested_role = 'Desarrollador Senior'
    } else if (lower.includes('datos') || lower.includes('análisis') || lower.includes('estadística')) {
        model_type = 'Gemini-Flash'; suggested_name = 'Sigma'; suggested_role = 'Analista de Datos'
    } else if (lower.includes('contenido') || lower.includes('redact') || lower.includes('escrib')) {
        model_type = 'GPT-4o-mini'; suggested_name = 'Lyra'; suggested_role = 'Redactora Creativa'
    } else if (lower.includes('estrategia') || lower.includes('negocios') || lower.includes('mercado')) {
        model_type = 'Claude-3.5'; suggested_name = 'Atlas'; suggested_role = 'Estratega de Negocios'
    } else if (lower.includes('document') || lower.includes('contrato') || lower.includes('legal')) {
        model_type = 'Gemini-1.5'; suggested_name = 'Lexis'; suggested_role = 'Analista Documental'
    }

    const system_prompt = `Eres ${suggested_name}, un agente de inteligencia artificial especializado como ${suggested_role} en la Oficina Brezan IA. Tu misión es ${description.length > 100 ? description.slice(0, 100) + '...' : description}. 

Operas con un alto nivel de profesionalismo y precisión. Desglosas cada tarea en pasos claros y accionables. Cuando colaboras con otros agentes del equipo, compartes la información de manera estructurada para facilitar la continuidad del trabajo. Siempre validas tus resultados antes de reportarlos, y proactivamente identificas posibles mejoras o riesgos en cada tarea que realizas. Tu comunicación es concisa, clara y orientada a resultados.`

    return { model_type, suggested_name, suggested_role, system_prompt }
}
