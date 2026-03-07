import * as Tools from '../tools/index';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

import { securityLayer } from './phase4/security-layer';
import { auditLogger } from './phase4/audit-logger';

export interface ToolInstance {
    name: string;
    execute: (input: any, agent?: any) => Promise<any>;
}

export interface ToolRegistration {
    tool: ToolInstance;
    triggers: string[];
    cost_estimate: 'free' | 'cheap' | 'medium' | 'expensive';
    requires_credentials: string[];
    can_be_parallelized: boolean;
    timeout_ms: number;
}

export interface CredentialStatus {
    integration_id: string;
    key_name: string;
    available: boolean;
}

// Registro global de tools de la oficina
export const Registry: ToolRegistration[] = [
    {
        tool: {
            name: 'web-search',
            execute: async (q) => Tools.WebSearch.searchWeb(q.query)
        },
        triggers: ['buscar', 'internet', 'search', 'investigar', 'actualidad', 'noticias'],
        cost_estimate: 'cheap',
        requires_credentials: ['serper'], // O tavily
        can_be_parallelized: true,
        timeout_ms: 15000
    },
    {
        tool: {
            name: 'file-manager',
            execute: async (p) => {
                if (p.action === 'read') return Tools.FileManager.readFile(p.path);
                if (p.action === 'write') return Tools.FileManager.writeFile(p.path, p.content);
                if (p.action === 'list') return Tools.FileManager.listFiles(p.prefix);
            }
        },
        triggers: ['archivo', 'leer', 'guardar', 'documento', 'file', 'storage', 'registros'],
        cost_estimate: 'free',
        requires_credentials: [], // Usa el token service role de supabase
        can_be_parallelized: true,
        timeout_ms: 30000
    },
    {
        tool: {
            name: 'code-executor',
            execute: async (p) => Tools.CodeExecutor.executeCode(p.language, p.code)
        },
        triggers: ['programar', 'codigo', 'script', 'python', 'javascript', 'ejecutar', 'matematicas'],
        cost_estimate: 'free',
        requires_credentials: [],
        can_be_parallelized: false, // Sandbox consume recursos intensos
        timeout_ms: 60000
    },
    {
        tool: {
            name: 'web-browser',
            execute: async (p) => {
                if (p.action === 'visit') return Tools.WebBrowser.visitPage(p.url);
                if (p.action === 'screenshot') return Tools.WebBrowser.screenshot(p.url);
            }
        },
        triggers: ['navegar', 'pagina', 'url', 'web', 'visitar', 'scraping', 'screenshot'],
        cost_estimate: 'medium', // Requiere headless browser, usa tiempo y memoria
        requires_credentials: [],
        can_be_parallelized: false,
        timeout_ms: 60000
    },
    {
        tool: {
            name: 'data-analyzer',
            execute: async (p) => {
                if (p.format === 'csv') return Tools.DataAnalyzer.analyzeCSV(p.data);
                if (p.action === 'chart') return Tools.DataAnalyzer.generateChart(p.data, p.type, p.options);
            }
        },
        triggers: ['analizar', 'datos', 'estadisticas', 'grafico', 'csv', 'dataset', 'tendencias'],
        cost_estimate: 'free',
        requires_credentials: [],
        can_be_parallelized: true,
        timeout_ms: 20000
    },
    {
        tool: {
            name: 'email-manager',
            execute: async (p) => {
                if (p.action === 'read') return Tools.EmailManager.readInbox(p.limit);
                if (p.action === 'send') return Tools.EmailManager.sendEmail(p.to, p.subject, p.body);
            }
        },
        triggers: ['email', 'correo', 'inbox', 'gmail', 'mensaje', 'responder', 'clientes'],
        cost_estimate: 'free',
        requires_credentials: ['gmail'], // Integración a definir en DB
        can_be_parallelized: true,
        timeout_ms: 10000
    },
    {
        tool: {
            name: 'communications',
            execute: async (p) => {
                if (p.action === 'alert') return Tools.Communications.sendAlert(p.level, p.message);
                if (p.action === 'send') return Tools.Communications.sendMessage(p.channel, p.to, p.text);
            }
        },
        triggers: ['telegram', 'slack', 'notificar', 'alerta', 'urgente', 'avisar al owner', 'mensaje'],
        cost_estimate: 'free',
        requires_credentials: ['telegram', 'slack'], // Not estrictamente si se usan env vars, pero ideal check
        can_be_parallelized: true,
        timeout_ms: 5000
    }
];

/**
 * Ejecuta una herramienta de forma segura, auditada y controlada.
 */
export async function executeTool(toolName: string, input: any, agent: any): Promise<any> {
    const registration = Registry.find(r => r.tool.name === toolName);
    if (!registration) throw new Error(`Tool ${toolName} not found in registry`);

    const startTime = Date.now();
    let status: 'success' | 'error' | 'denied' = 'success';
    let result: any;

    try {
        // 1. SEGURIDAD: Autorización por rol
        const auth = await securityLayer.authorize(agent.role, toolName, 'execute', agent.id);
        if (!auth.granted) {
            status = 'denied';
            throw new Error(auth.reason);
        }

        // 2. SEGURIDAD: Sanitización de Input
        const sanitizedInput = typeof input === 'string'
            ? securityLayer.sanitizeInput(input)
            : JSON.parse(securityLayer.sanitizeInput(JSON.stringify(input)));

        // 3. EJECUCIÓN
        result = await registration.tool.execute(sanitizedInput, agent);

        // 4. SEGURIDAD: Validación de Output
        if (typeof result === 'string') {
            result = securityLayer.validateOutput(result, agent.id);
        } else if (result && typeof result === 'object') {
            result = JSON.parse(securityLayer.validateOutput(JSON.stringify(result), agent.id));
        }

        return result;
    } catch (err: any) {
        status = err.message.includes('Acceso denegado') ? 'denied' : 'error';
        result = { error: err.message };
        throw err;
    } finally {
        const duration = Date.now() - startTime;
        // 5. AUDITORÍA: Registro inmutable
        await auditLogger.logToolCall(
            agent.id,
            toolName,
            input,
            result,
            duration,
            status,
            agent.project_id,
            agent.task_id
        );
    }
}

export function selectTool(task_description: string): ToolRegistration[] {
    const words: string[] = task_description.toLowerCase().match(/\\b(\\w+)\\b/g) || [];

    // Puntuamos las tools basadas en cuantas palabras clave hacen match
    const scoredTools = Registry.map(reg => {
        let score = 0;
        reg.triggers.forEach(trigger => {
            if (words.includes(trigger) || task_description.toLowerCase().includes(trigger)) {
                score++;
            }
        });

        // Bonificación por coste
        if (reg.cost_estimate === 'free') score += 0.5;
        if (reg.cost_estimate === 'cheap') score += 0.2;

        return { registration: reg, score };
    });

    // Filtramos las que tienen score > 0 y ordenamos
    return scoredTools
        .filter(t => t.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(t => t.registration);
}

export async function checkAllCredentials(): Promise<CredentialStatus[]> {
    const required = Array.from(new Set(Registry.flatMap(r => r.requires_credentials)));
    const statuses: CredentialStatus[] = [];

    for (const integration of required) { // simplified check logic
        const { data, error } = await supabase.rpc('check_credential', {
            integration_id_param: integration
        });

        // fall-back if function signature is different
        let available = data;
        if (error || data === undefined) {
            const { data: d2, error: e2 } = await supabase.rpc('check_credential', {
                integration_id: integration
            });
            if (!e2) available = d2;
        }

        statuses.push({
            integration_id: integration,
            key_name: 'Main Key', // simplificación temporal
            available: Boolean(available)
        });
    }

    return statuses;
}
