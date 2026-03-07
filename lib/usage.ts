import { createClient } from '@/lib/supabase/client'

// ─── Tarifas 2026 (USD por 1M tokens) ─────────────────────────────────────
const PRICING_TABLE: Record<string, { input: number; output: number }> = {
    // Gemini
    'Gemini-Flash': { input: 0.075, output: 0.30 },  // Gemini 3 Flash
    'Gemini-1.5': { input: 0.075, output: 0.30 },  // alias Flash
    'Gemini-Pro': { input: 1.25, output: 5.00 },  // Gemini 3 Pro
    // OpenAI
    'GPT-4o': { input: 2.50, output: 10.00 },
    'GPT-4o-mini': { input: 0.15, output: 0.60 },
    // Anthropic
    'Claude-3.5': { input: 3.00, output: 15.00 },
}

export interface UsageMetadata {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
    // OpenAI style:
    prompt_tokens?: number
    completion_tokens?: number
}

export interface LogUsageOptions {
    agentId: string | null
    model: string
    usage: UsageMetadata
}

/**
 * Calcula el coste en USD dado el modelo y los tokens consumidos.
 */
export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const pricing = PRICING_TABLE[model] ?? { input: 0.075, output: 0.30 }
    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    return inputCost + outputCost
}

/**
 * Registra el uso de tokens en la tabla token_usage de Supabase.
 * Se llama automáticamente tras cada respuesta de un agente/LLM.
 */
export async function logTokenUsage({ agentId, model, usage }: LogUsageOptions): Promise<void> {
    const supabase = createClient()

    // Normalizar tokens para Gemini y OpenAI
    const inputTokens = usage.promptTokenCount ?? usage.prompt_tokens ?? 0
    const outputTokens = usage.candidatesTokenCount ?? usage.completion_tokens ?? 0
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    const { error } = await supabase.from('token_usage').insert({
        agent_id: agentId,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
    })

    if (error) {
        console.error('[token_usage] Error al registrar uso:', error.message)
    } else {
        console.info(
            `[token_usage] ${model} | in:${inputTokens} out:${outputTokens} | $${costUsd.toFixed(8)}`
        )
    }
}

/**
 * Helper para calcular y mostrar un resumen de coste sin insertarlo en DB.
 * Útil para mostrar previews en la UI.
 */
export function estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): { costUsd: number; costStr: string } {
    const costUsd = calculateCost(model, inputTokens, outputTokens)
    const costStr = costUsd < 0.001
        ? `< $0.001`
        : `$${costUsd.toFixed(5)}`
    return { costUsd, costStr }
}
