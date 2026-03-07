import { auditLogger } from './audit-logger';
import { getSupabaseService } from './supabase-service';

// Eliminamos inicialización estática que falla en build



export interface AuthResult {
    granted: boolean;
    reason?: string;
}

class SecurityLayer {
    private static instance: SecurityLayer;

    private constructor() { }

    public static getInstance(): SecurityLayer {
        if (!SecurityLayer.instance) {
            SecurityLayer.instance = new SecurityLayer();
        }
        return SecurityLayer.instance;
    }

    /**
     * Verifica si un agente tiene permiso para ejecutar una acción sobre un recurso.
     */
    async authorize(agentRole: string, resource: string, action: string, agentId: string, projectId?: string): Promise<AuthResult> {
        try {
            const supabase = getSupabaseService();
            if (!supabase) return { granted: true }; // Default tolerante en build

            const { data: granted, error } = await supabase.rpc('check_permission', {

                p_role: agentRole,
                p_resource: resource,
                p_action: action
            });

            if (error) throw error;

            if (!granted) {
                await this.handleAccessDenied(agentId, agentRole, resource, action, projectId);
                return { granted: false, reason: `Acceso denegado: El rol ${agentRole} no tiene permiso para ${action} en ${resource}` };
            }

            return { granted: true };
        } catch (err) {
            console.error('Security authorization error:', err);
            // Por seguridad, si el sistema de permisos falla, denegamos por defecto
            return { granted: false, reason: 'Error interno en el sistema de seguridad' };
        }
    }

    /**
     * Detecta y neutraliza intentos de Prompt Injection.
     */
    sanitizeInput(input: string): string {
        if (!input) return input;

        const injectionPatterns = [
            /ignore previous/gi,
            /system:/gi,
            /forget your/gi,
            /new instruction/gi,
            /override/gi,
            /jailbreak/gi,
            /developer mode/gi
        ];

        let sanitized = input;
        let detected = false;

        for (const pattern of injectionPatterns) {
            if (pattern.test(sanitized)) {
                sanitized = sanitized.replace(pattern, '[REMOVED_POTENTIAL_INJECTION]');
                detected = true;
            }
        }

        if (detected) {
            console.warn('SECURITY ALERT: Potential prompt injection detected and neutralized.');
            // Aquí registraríamos un incidente de seguridad en v2
        }

        return sanitized;
    }

    /**
     * Verifica que el output no contenga credenciales o datos sensibles.
     */
    validateOutput(output: string, agentId: string): string {
        if (!output) return output;

        // Redactar API Keys y secretos comunes
        const redacted = output.replace(/(sk-|AIza|sb_|[a-zA-Z0-9]{32,})[a-zA-Z0-9_-]*/g, '[REDACTED_BY_SECURITY]');

        if (redacted !== output) {
            this.logSecurityIncident('high', 'data_leak', agentId, 'Se detectó una posible fuga de credenciales en el output del agente.');
        }

        return redacted;
    }

    private async handleAccessDenied(agentId: string, role: string, resource: string, action: string, projectId?: string) {
        await auditLogger.log({
            actor: agentId,
            actor_role: role,
            action: action,
            resource: resource,
            project_id: projectId,
            status: 'denied',
            deny_reason: 'Políticas de permisos de agente Insuficientes'
        });

        await this.logSecurityIncident('medium', 'permission_denied', agentId, `Intento de acceso no autorizado a ${resource} (${action}) por el rol ${role}`);
    }

    private async logSecurityIncident(severity: 'low' | 'medium' | 'high' | 'critical', type: string, agentId: string, description: string) {
        const supabase = getSupabaseService();
        if (!supabase) return;

        await supabase.from('security_incidents').insert([{
            severity,
            type,
            agent_id: agentId,
            description
        }]);

    }
}

export const securityLayer = SecurityLayer.getInstance();
