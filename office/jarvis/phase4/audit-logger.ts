import { getSupabaseService } from './supabase-service';


export interface AuditEntry {
    actor: string;          // agent_id | 'jarvis' | 'user' | 'system'
    actor_role?: string;
    action: string;         // CREATE | READ | EXECUTE | DELETE | SEND | RECEIVE
    resource: string;       // tool, integracion o tabla afectada
    resource_id?: string;
    project_id?: string;
    task_id?: string;
    input_summary?: string; // resumen del input (NUNCA datos sensibles)
    output_summary?: string;
    status: 'success' | 'denied' | 'error';
    deny_reason?: string;
    duration_ms?: number;
}

class AuditLogger {
    private static instance: AuditLogger;

    private constructor() { }

    public static getInstance(): AuditLogger {
        if (!AuditLogger.instance) {
            AuditLogger.instance = new AuditLogger();
        }
        return AuditLogger.instance;
    }

    /**
     * Registra una entrada en el log de auditoría de forma inmutable.
     */
    async log(entry: AuditEntry): Promise<void> {
        try {
            const supabase = getSupabaseService();
            if (!supabase) return;

            const { error } = await supabase

                .from('audit_log')
                .insert([{
                    actor: entry.actor,
                    actor_role: entry.actor_role,
                    action: entry.action,
                    resource: entry.resource,
                    resource_id: entry.resource_id,
                    project_id: entry.project_id,
                    task_id: entry.task_id,
                    input_summary: this.sanitize(entry.input_summary),
                    output_summary: this.sanitize(entry.output_summary),
                    status: entry.status,
                    deny_reason: entry.deny_reason,
                    duration_ms: entry.duration_ms
                }]);

            if (error) throw error;
        } catch (err) {
            console.error('CRITICAL: Failed to write to audit_log:', err);
            // No lanzamos error para no bloquear la operación principal, 
            // pero el fallo de auditoría es un evento grave en producción.
        }
    }

    /**
     * Helper para registrar llamadas a herramientas.
     */
    async logToolCall(
        agentId: string,
        toolName: string,
        input: any,
        output: any,
        durationMs: number,
        status: 'success' | 'error' | 'denied' = 'success',
        projectId?: string,
        taskId?: string
    ): Promise<void> {
        await this.log({
            actor: agentId,
            actor_role: 'agent',
            action: 'EXECUTE',
            resource: `tool:${toolName}`,
            project_id: projectId,
            task_id: taskId,
            input_summary: typeof input === 'string' ? input : JSON.stringify(input),
            output_summary: typeof output === 'string' ? output : JSON.stringify(output),
            status: status,
            duration_ms: durationMs
        });
    }

    /**
     * Helper para registrar llamadas a modelos de IA.
     */
    async logModelCall(
        agentId: string,
        model: string,
        promptSummary: string,
        responseSummary: string,
        tokens: number,
        projectId?: string,
        taskId?: string
    ): Promise<void> {
        await this.log({
            actor: agentId,
            actor_role: 'agent',
            action: 'EXECUTE',
            resource: `model:${model}`,
            project_id: projectId,
            task_id: taskId,
            input_summary: promptSummary,
            output_summary: responseSummary,
            status: 'success',
            duration_ms: 0 // Podríamos medirlo si fuera necesario
        });
    }

    /**
     * Sanitiza strings para evitar que API keys o secretos lleguen al log.
     */
    private sanitize(text?: string): string | undefined {
        if (!text) return text;
        // Patrón simple para redactar posibles API Keys
        return text.replace(/(sk-|AIza|sb_|[a-zA-Z0-9]{32,})[a-zA-Z0-9_-]*/g, '[REDACTED]');
    }

    /**
     * Obtiene el historial de auditoría de un proyecto.
     */
    async getProjectAudit(projectId: string): Promise<any[]> {
        const supabase = getSupabaseService();
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('audit_log')

            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }
}

export const auditLogger = AuditLogger.getInstance();
