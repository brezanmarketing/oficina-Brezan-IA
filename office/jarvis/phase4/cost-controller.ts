import { auditLogger } from './audit-logger';
import { getSupabaseService } from './supabase-service';

// Eliminamos inicialización estática que falla en build



export interface BudgetCheck {
    allowed: boolean;
    reason?: string;
    remaining_usd: number;
}

export interface CostSummary {
    total_spent: number;
    budget: number;
    percentage: number;
}

class CostController {
    private static instance: CostController;

    private constructor() { }

    public static getInstance(): CostController {
        if (!CostController.instance) {
            CostController.instance = new CostController();
        }
        return CostController.instance;
    }

    /**
     * Verifica si hay presupuesto disponible antes de realizar una operación.
     */
    async checkBudget(
        agentId: string,
        projectId: string,
        estimatedTokens: number,
        model: string
    ): Promise<BudgetCheck> {
        try {
            const supabase = getSupabaseService();
            if (!supabase) return { allowed: true, remaining_usd: 1000 };

            // 1. Obtener coste estimado usando la función SQL
            const { data: estimatedCost, error: costError } = await supabase
                .rpc('calculate_cost', {
                    p_model: model,
                    p_tokens_in: estimatedTokens,
                    p_tokens_out: Math.floor(estimatedTokens * 0.5) // Estimación conservadora de output
                });

            if (costError) throw costError;

            // 2. Verificar presupuestos (Global, Proyecto, Agente)
            // Buscamos los budgets activos que podrían aplicar
            const { data: activeBudgets, error: budgetError } = await supabase
                .from('budgets')
                .select('*')
                .eq('is_active', true)
                .or(`scope.eq.global,and(scope.eq.project,scope_id.eq.${projectId}),and(scope.eq.agent,scope_id.eq.${agentId})`);


            if (budgetError) throw budgetError;

            let minRemaining = Infinity;
            let blockingReason = '';
            let isAllowed = true;

            for (const budget of activeBudgets || []) {
                const remaining = Number(budget.budget_usd) - Number(budget.spent_usd);

                // Alerta si estamos cerca del límite (80% por defecto)
                const pctUsed = (Number(budget.spent_usd) / Number(budget.budget_usd)) * 100;
                if (pctUsed >= budget.alert_at_pct) {
                    console.warn(`WARNING: Budget ${budget.scope} (${budget.scope_id || ''}) at ${pctUsed.toFixed(1)}%`);
                    // Aquí podríamos disparar una notificación de Telegram en v2
                }

                if (budget.hard_limit && remaining < estimatedCost) {
                    isAllowed = false;
                    blockingReason = `Presupuesto agotado para ${budget.scope} (${budget.scope_id || 'global'}). Restante: $${remaining.toFixed(4)}, Necesario: $${estimatedCost.toFixed(4)}`;
                    break;
                }

                if (remaining < minRemaining) minRemaining = remaining;
            }

            return {
                allowed: isAllowed,
                reason: blockingReason,
                remaining_usd: minRemaining === Infinity ? 1000 : minRemaining // Fallback si no hay budgets definidos
            };

        } catch (err) {
            console.error('Error checking budget:', err);
            // Por seguridad, si falla el sistema de control de costes, permitimos pero logueamos el error
            return { allowed: true, remaining_usd: 0 };
        }
    }

    /**
     * Registra el coste real de una operación.
     */
    async recordCost(
        agentId: string,
        projectId: string,
        taskId: string,
        model: string,
        tokensIn: number,
        tokensOut: number,
        toolUsed?: string
    ): Promise<void> {
        try {
            const supabase = getSupabaseService();
            if (!supabase) return;

            // 1. Calcular coste real
            const { data: costUsd, error: costError } = await supabase
                .rpc('calculate_cost', {
                    p_model: model,
                    p_tokens_in: tokensIn,
                    p_tokens_out: tokensOut
                });

            if (costError) throw costError;

            // 2. Insertar evento de coste
            const { error: eventError } = await supabase
                .from('cost_events')
                .insert([{
                    agent_id: agentId,
                    project_id: projectId,
                    task_id: taskId,
                    model: model,
                    tokens_input: tokensIn,
                    tokens_output: tokensOut,
                    cost_usd: costUsd,
                    tool_used: toolUsed,
                    operation: 'completion'
                }]);

            if (eventError) throw eventError;

            // 3. Actualizar budgets (Incrementar spent_usd)
            // Actualizamos todos los budgets que coincidan con el scope
            const { error: updateError } = await supabase.rpc('increment_budgets', {
                p_amount: costUsd,
                p_agent_id: agentId,
                p_project_id: projectId
            });


            if (updateError) {
                // Fallback si la función RPC no existe aún o falla (actualización manual)
                await this.manualUpdateBudgets(costUsd, agentId, projectId);
            }

            // 4. Audit Log
            await auditLogger.log({
                actor: agentId,
                action: 'EXECUTE',
                resource: `billing:cost_event`,
                project_id: projectId,
                task_id: taskId,
                output_summary: `Cost: $${costUsd} | Tokens: ${tokensIn + tokensOut}`,
                status: 'success'
            });

        } catch (err) {
            console.error('Error recording cost:', err);
        }
    }

    private async manualUpdateBudgets(amount: number, agentId: string, projectId: string) {
        const supabase = getSupabaseService();
        if (!supabase) return;

        // Actualización global
        await supabase
            .from('budgets')
            .update({ spent_usd: supabase.rpc('increment', { row: 'spent_usd', x: amount }) as any })
            .eq('scope', 'global')
            .eq('is_active', true);


        // Actualización de proyecto
        await supabase
            .from('budgets')
            .update({ spent_usd: supabase.rpc('increment', { row: 'spent_usd', x: amount }) as any })
            .eq('scope', 'project')
            .eq('scope_id', projectId)
            .eq('is_active', true);

        // Actualización de agente
        await supabase
            .from('budgets')
            .update({ spent_usd: supabase.rpc('increment', { row: 'spent_usd', x: amount }) as any })
            .eq('scope', 'agent')
            .eq('scope_id', agentId)
            .eq('is_active', true);
    }

    /**
     * Configura un presupuesto inicial.
     */
    async setBudget(scope: string, scopeId: string | null, amountUsd: number, period: string = 'monthly'): Promise<void> {
        const supabase = getSupabaseService();
        if (!supabase) return;

        const { error } = await supabase
            .from('budgets')
            .upsert({
                scope,
                scope_id: scopeId,
                budget_usd: amountUsd,
                period,
                is_active: true
            }, { onConflict: 'scope,scope_id' });


        if (error) throw error;
    }
}

export const costController = CostController.getInstance();
