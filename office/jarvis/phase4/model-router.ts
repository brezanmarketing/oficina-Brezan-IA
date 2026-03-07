import { getSupabaseService } from './supabase-service';

// Eliminamos inicialización estática que falla en build


export interface ModelSelection {
    model: string;
    estimated_cost: number;
    reason: string;
}

class ModelRouter {
    private static instance: ModelRouter;

    private constructor() { }

    public static getInstance(): ModelRouter {
        if (!ModelRouter.instance) {
            ModelRouter.instance = new ModelRouter();
        }
        return ModelRouter.instance;
    }

    /**
     * Selecciona el mejor modelo para una tarea basándose en complejidad, keywords y presupuesto.
     */
    async selectModel(taskDescription: string, modelHint?: string, budgetRemaining: number = 100): Promise<ModelSelection> {
        const desc = taskDescription.toLowerCase();
        let selectedModel = 'gemini-2.0-flash'; // Default más barato
        let reason = 'Modelo optimizado por defecto';

        // 1. Prioridad a Hints explícitos si el presupuesto lo permite
        if (modelHint === 'smart' || modelHint === 'complex' || modelHint === 'code') {
            selectedModel = 'gpt-4o';
            reason = `Seleccionado GPT-4o por hint de complejidad: ${modelHint}`;
        }
        // 2. Detección por palabras clave
        else if (desc.includes('busca') || desc.includes('search') || desc.includes('crawl')) {
            selectedModel = 'gemini-2.0-flash';
            reason = 'Gemini Flash es óptimo para extracción y búsqueda web';
        }
        else if (desc.includes('analiza') || desc.includes('estadística') || desc.includes('data')) {
            selectedModel = 'gpt-4o-mini';
            reason = 'GPT-4o mini es excelente para análisis estructurado a bajo coste';
        }
        else if (desc.includes('escribe') || desc.includes('redacta') || desc.includes('informe')) {
            selectedModel = 'gemini-1.5-pro';
            reason = 'Gemini 1.5 Pro ofrece gran ventana de contexto para redacción extensa';
        }
        else if (desc.includes('razona') || desc.includes('planifica') || desc.includes('decide')) {
            selectedModel = 'gpt-4o';
            reason = 'GPT-4o es necesario para razonamiento lógico de alto nivel';
        }

        // 3. Verificación de Presupuesto (Safe-guard)
        if (budgetRemaining < 0.5 && selectedModel !== 'gemini-2.0-flash') {
            selectedModel = 'gemini-2.0-flash';
            reason = 'PRESUPUESTO BAJO: Degradando a modelo más económico por seguridad financiera';
        }

        return {
            model: selectedModel,
            estimated_cost: 0, // Podríamos calcularlo con calculate_cost si fuera necesario
            reason
        };
    }

    /**
     * Estima los tokens necesarios.
     */
    estimateTokens(prompt: string, expectedOutput: 'short' | 'medium' | 'long'): number {
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = expectedOutput === 'short' ? 200 : expectedOutput === 'medium' ? 800 : 2000;
        return inputTokens + outputTokens;
    }
}

export const modelRouter = ModelRouter.getInstance();
