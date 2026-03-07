import { createClient } from '@supabase/supabase-js';
import { ToolResult } from '../index';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export type AuthType = 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2';

export interface ApiCallConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
    retries?: number;
    toolName?: string;
    agentId?: string;
    auth?: {
        type: AuthType;
        integration_id?: string;
        key_name?: string; // usad para api-key, bearer
        username_key?: string; // usado para basic
        password_key?: string; // usado para basic
        header_name?: string; // e.g. 'x-api-key'
        token_resolver?: () => Promise<string>; // Usado para oauth2
    };
    rateLimit?: {
        maxRequestsPerMinute: number;
    };
}

// In-memory rate limiter per domain
const domainRequests: Record<string, number[]> = {};

async function checkRateLimit(domain: string, maxPerMin: number) {
    const now = Date.now();
    if (!domainRequests[domain]) {
        domainRequests[domain] = [];
    }

    // Clean up older than 1 minute
    domainRequests[domain] = domainRequests[domain].filter(t => now - t < 60000);

    if (domainRequests[domain].length >= maxPerMin) {
        const oldest = domainRequests[domain][0];
        const waitTime = oldest + 60000 - now;
        if (waitTime > 0) {
            await new Promise(res => setTimeout(res, waitTime));
        }
    }
    domainRequests[domain].push(Date.now());
}

export async function getCredential(integration_id: string, key_name: string): Promise<string> {
    const secret = process.env.PGP_SECRET_KEY || process.env.ENCRYPTION_SECRET || '';
    if (!secret) {
        throw new Error('Variables de entorno de encriptación no están configuradas.');
    }

    const { data, error } = await supabase.rpc('get_credential', {
        p_integration_id: integration_id,
        p_key_name: key_name,
        p_secret: secret
    });

    if (error) {
        throw new Error(`Error recuperando credencial: ${error.message}`);
    }

    if (!data) {
        throw new Error(`Credencial no encontrada: ${integration_id}/${key_name}`);
    }

    return data;
}

export async function apiCall(config: ApiCallConfig): Promise<ToolResult> {
    const method = config.method || 'GET';
    const timeoutMs = config.timeoutMs || 30000;
    const maxRetries = config.retries ?? 3;
    let attempt = 0;
    let headers = { ...(config.headers || {}) };

    let domain = 'localhost';
    try {
        const urlObj = new URL(config.url);
        domain = urlObj.hostname;
    } catch (e) {
        // Si la URL es invalida, fetch fallará luego
    }

    // Verificación de Rate Limit 
    if (config.rateLimit) {
        await checkRateLimit(domain, config.rateLimit.maxRequestsPerMinute);
    }

    // Manejo de Auth
    if (config.auth && config.auth.type !== 'none') {
        try {
            if (config.auth.type === 'bearer' && config.auth.integration_id && config.auth.key_name) {
                const token = await getCredential(config.auth.integration_id, config.auth.key_name);
                headers['Authorization'] = `Bearer ${token}`;
            } else if (config.auth.type === 'api-key' && config.auth.integration_id && config.auth.key_name) {
                const token = await getCredential(config.auth.integration_id, config.auth.key_name);
                const headerName = config.auth.header_name || 'x-api-key';
                headers[headerName] = token;
            } else if (config.auth.type === 'basic' && config.auth.integration_id && config.auth.username_key && config.auth.password_key) {
                const username = await getCredential(config.auth.integration_id, config.auth.username_key);
                const password = await getCredential(config.auth.integration_id, config.auth.password_key);
                headers['Authorization'] = `Basic ${Buffer.from(username + ':' + password).toString('base64')}`;
            } else if (config.auth.type === 'oauth2' && config.auth.token_resolver) {
                const token = await config.auth.token_resolver();
                headers['Authorization'] = `Bearer ${token}`;
            }
        } catch (authError: any) {
            const res: ToolResult = {
                success: false,
                error: `Autenticación fallida: ${authError.message}`,
                tool_name: config.toolName || 'api-gateway',
                agent_id: config.agentId || 'system',
                duration_ms: 0
            };
            await logToSupabase(res, config, 'error', `Auth Error: ${authError.message}`);
            return res;
        }
    }

    const startTime = Date.now();
    let lastErrorMsg = '';
    let finalStatus = 'error';

    while (attempt <= maxRetries) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(config.url, {
                method,
                headers,
                body: config.body ? JSON.stringify(config.body) : undefined,
                signal: controller.signal
            });

            clearTimeout(id);

            let responseData;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            if (!response.ok) {
                // Retry en 429, 500, 502, 503, 504
                if ([429, 500, 502, 503, 504].includes(response.status)) {
                    throw new Error(`HTTP Error: ${response.status}`);
                } else {
                    finalStatus = 'error';
                    const res: ToolResult = {
                        success: false,
                        error: `HTTP Error: ${response.status} - ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData)}`,
                        tool_name: config.toolName || 'api-gateway',
                        agent_id: config.agentId || 'system',
                        duration_ms: Date.now() - startTime
                    };
                    await logToSupabase(res, config, finalStatus, res.error);
                    return res;
                }
            }

            // Éxito
            const toolResult: ToolResult = {
                success: true,
                data: responseData,
                tool_name: config.toolName || 'api-gateway',
                agent_id: config.agentId || 'system',
                duration_ms: Date.now() - startTime
            };

            await logToSupabase(toolResult, config, 'success');
            return toolResult;

        } catch (err: any) {
            lastErrorMsg = err.message || String(err);
            if (err.name === 'AbortError') {
                lastErrorMsg = 'Timeout reached (Tiempo de espera excedido)';
                finalStatus = 'timeout';
            }

            // Backoff Exponencial (1s, 2s, 4s...)
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(res => setTimeout(res, delay));
                attempt++;
            } else {
                break; // Max reintentos alcanzado
            }
        }
    }

    // Agotados los reintentos
    const errorResult: ToolResult = {
        success: false,
        error: `Fallo después de ${maxRetries} reintentos. Último error: ${lastErrorMsg}`,
        tool_name: config.toolName || 'api-gateway',
        agent_id: config.agentId || 'system',
        duration_ms: Date.now() - startTime
    };

    await logToSupabase(errorResult, config, finalStatus, lastErrorMsg);
    return errorResult;
}

async function logToSupabase(result: ToolResult, config: ApiCallConfig, status: string, errorMsg?: string) {
    try {
        await supabase.from('tool_executions').insert({
            tool_name: result.tool_name,
            agent_id: result.agent_id,
            agent_name: 'jarvis',
            input_params: { url: config.url, method: config.method, authType: config.auth?.type },
            output_data: result.success ? result.data : null,
            status: status,
            error_msg: errorMsg || null,
            duration_ms: result.duration_ms
        });
    } catch (err) {
        console.error('Error guardando log en tool_executions:', err);
    }
}
