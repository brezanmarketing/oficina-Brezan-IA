import { auditLogger } from './audit-logger';
import { getSupabaseService } from './supabase-service';


// Eliminamos inicialización estática que falla en build


export interface HealthStatus {
    ok: boolean;
    issues: string[];
}

class ObservabilityHub {
    private static instance: ObservabilityHub;
    private intervalId?: NodeJS.Timeout;

    private constructor() { }

    public static getInstance(): ObservabilityHub {
        if (!ObservabilityHub.instance) {
            ObservabilityHub.instance = new ObservabilityHub();
        }
        return ObservabilityHub.instance;
    }

    /**
     * Inicia el ciclo de monitoreo continuo (cada 60 segundos).
     */
    public start() {
        if (this.intervalId) return;

        console.log('Observability Hub: Starting monitoring cycle...');
        this.intervalId = setInterval(() => this.collectSnapshot(), 60000);
        this.collectSnapshot(); // Primera ejecución inmediata
    }

    /**
     * Detiene el monitoreo.
     */
    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    /**
     * Recopila métricas actuales del sistema y las guarda en Supabase.
     */
    private async collectSnapshot() {
        try {
            const supabase = getSupabaseService();
            if (!supabase) return;

            // 1. Obtener métricas de agentes
            const { data: agents } = await supabase.from('agents').select('status');

            const activeAgents = (agents as any[])?.filter((a: any) => a.status !== 'idle' && a.status !== 'retired').length || 0;
            const idleAgents = (agents as any[])?.filter((a: any) => a.status === 'idle').length || 0;


            // 2. Obtener métricas de tareas
            const { data: tasks } = await supabase.from('tasks').select('status');
            const runningTasks = (tasks as any[])?.filter((t: any) => t.status === 'running').length || 0;
            const queuedTasks = (tasks as any[])?.filter((t: any) => t.status === 'queued').length || 0;


            // 3. Obtener costes del día
            const today = new Date().toISOString().split('T')[0];
            const { data: costEvents } = await supabase
                .from('cost_events')
                .select('cost_usd')
                .gte('created_at', today);
            const costToday = (costEvents as any[])?.reduce((sum: number, e: any) => sum + Number(e.cost_usd), 0) || 0;


            // 4. Obtener budget usado (Global)
            const { data: globalBudget } = await supabase
                .from('budgets')
                .select('budget_usd, spent_usd')
                .eq('scope', 'global')
                .single();
            const budgetPct = globalBudget ? (Number(globalBudget.spent_usd) / Number(globalBudget.budget_usd)) * 100 : 0;

            // 5. Guardar Snapshot
            await supabase.from('system_health').insert([{
                agents_active: activeAgents,
                agents_idle: idleAgents,
                tasks_running: runningTasks,
                tasks_queued: queuedTasks,
                cost_today_usd: costToday,
                budget_pct_used: budgetPct,
                snapshot_at: new Date().toISOString()
            }]);

            // 6. Detectar Anomalías
            await this.detectAnomalies(costToday, budgetPct);

        } catch (err) {
            console.error('Error in collectSnapshot:', err);
        }
    }

    /**
     * Detecta comportamientos anómalos y dispara alertas.
     */
    private async detectAnomalies(costToday: number, budgetPct: number) {
        // Alerta de Presupuesto Crítico
        if (budgetPct >= 90) {
            await this.sendAlert('critical', `¡ALERTA CRÍTICA! Se ha consumido el ${budgetPct.toFixed(1)}% del presupuesto mensual global.`);
        } else if (budgetPct >= 80) {
            await this.sendAlert('high', `Presupuesto Global al ${budgetPct.toFixed(1)}%.`);
        }

        // Pico de gasto diario (Umbral ajustable, ej: $10)
        if (costToday > 10) {
            await this.sendAlert('medium', `Gasto diario actual ($${costToday.toFixed(2)}) por encima del umbral de advertencia.`);
        }
    }

    /**
     * Envía una alerta a través del canal oficial (Telegram/DB).
     */
    public async sendAlert(level: 'info' | 'medium' | 'high' | 'critical', message: string, context?: any) {
        console.log(`[ALERT ${level.toUpperCase()}] ${message}`);

        const supabase = getSupabaseService();
        if (!supabase) return;

        // 1. Guardar incidente en DB
        await supabase.from('security_incidents').insert([{
            severity: level === 'info' ? 'low' : level,
            type: 'anomaly',
            description: message,
            evidence: context
        }]);


        // 2. Enviar a Telegram si es Medium o superior
        if (level !== 'info') {
            try {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                await fetch(`${appUrl}/api/telegram/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `⚠️ *JARVIS MONITOR*: ${message}\nNivel: ${level.toUpperCase()}`,
                        parse_mode: 'Markdown'
                    })
                });
            } catch (err) {
                console.error('Failed to send Telegram alert:', err);
            }
        }
    }

    /**
     * Verifica la salud de las integraciones críticas.
     */
    public async healthCheck(): Promise<HealthStatus> {
        const issues: string[] = [];

        const supabase = getSupabaseService();
        if (!supabase) {
            return { ok: true, issues: [] }; // Durante build asumimos OK
        }

        // Check Supabase
        const { error: dbError } = await supabase.from('agents').select('id').limit(1);

        if (dbError) issues.push('Supabase connection failing');

        // Aquí añadiríamos checks de OpenAI/Google APIs si fuera necesario

        return {
            ok: issues.length === 0,
            issues
        };
    }
}

export const observabilityHub = ObservabilityHub.getInstance();
