import { apiCall } from '../api-gateway/index';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../email-manager/index';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export type Channel = 'telegram' | 'slack' | 'whatsapp' | 'discord';
export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export interface SendOptions {
    parse_mode?: 'MarkdownV2' | 'HTML';
    disable_notification?: boolean;
}

export async function sendMessage(channel: Channel, to: string, text: string, options?: SendOptions, agentId: string = 'system'): Promise<void> {
    const startTime = Date.now();
    let success = true;
    let errorMsg = '';

    try {
        if (channel === 'telegram') {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

            const res = await apiCall({
                url: `https://api.telegram.org/bot${token}/sendMessage`,
                method: 'POST',
                body: {
                    chat_id: to,
                    text: text,
                    parse_mode: options?.parse_mode || 'HTML',
                    disable_notification: options?.disable_notification || false
                },
                toolName: 'communications-telegram'
            });

            if (!res.success) throw new Error(res.error || 'Fallo API Telegram');
        }
        else if (channel === 'slack') {
            const token = process.env.SLACK_BOT_TOKEN;
            if (!token) throw new Error('SLACK_BOT_TOKEN no configurado');

            const res = await apiCall({
                url: 'https://slack.com/api/chat.postMessage',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: {
                    channel: to,
                    text: text
                },
                toolName: 'communications-slack'
            });

            if (!res.success || !res.data.ok) throw new Error(res.error || res.data?.error || 'Fallo API Slack');
        }
        else {
            throw new Error(`Canal no soportado de forma nativa todavía: ${channel}`);
        }
    } catch (err: any) {
        success = false;
        errorMsg = err.message;
        throw err;
    } finally {
        await logNotification({
            agent_id: agentId,
            channel,
            direction: 'sent',
            to_address: to,
            message: text,
            status: success ? 'delivered' : 'failed',
            metadata: { options, error: errorMsg }
        });
    }
}

export async function sendAlert(level: AlertLevel, message: string, context?: any, agentId: string = 'system'): Promise<void> {
    const ownerTelegram = process.env.TELEGRAM_OWNER_ID || '';
    const slackAlertsChannel = process.env.SLACK_ALERTS_CHANNEL || '#alerts';
    const ownerEmail = process.env.OWNER_EMAIL || 'admin@admin.com';

    const text = `🚨 *Alerta Nivel: ${level.toUpperCase()}*\n\n${message}\n\nContexto: ${JSON.stringify(context || {})}`;

    try {
        if (level === 'info') {
            if (ownerTelegram) await sendMessage('telegram', ownerTelegram, text, undefined, agentId);
        }
        else if (level === 'warning') {
            if (ownerTelegram) await sendMessage('telegram', ownerTelegram, text, undefined, agentId);
            if (process.env.SLACK_BOT_TOKEN) await sendMessage('slack', slackAlertsChannel, text, undefined, agentId);
        }
        else if (level === 'error') {
            if (ownerTelegram) await sendMessage('telegram', ownerTelegram, text, undefined, agentId);
            if (process.env.SLACK_BOT_TOKEN) await sendMessage('slack', slackAlertsChannel, text, undefined, agentId);
            if (process.env.GMAIL_CLIENT_ID && ownerEmail) { // If email configured
                await sendEmail(ownerEmail, `🚨 Alerta Error: ${message.substring(0, 20)}...`, text, undefined, agentId).catch(console.error);
            }
        }
        else if (level === 'critical') {
            if (ownerTelegram) await sendMessage('telegram', ownerTelegram, text, undefined, agentId);
            if (process.env.SLACK_BOT_TOKEN) await sendMessage('slack', slackAlertsChannel, text, undefined, agentId);
            if (process.env.GMAIL_CLIENT_ID && ownerEmail) {
                await sendEmail(ownerEmail, `🔥 CRITICAL: ${message.substring(0, 30)}...`, text, undefined, agentId).catch(console.error);
            }
        }
    } catch (error) {
        console.error(`Fallo enviando alerta ${level}:`, error);
    }
}

export async function sendReport(title: string, content: string, charts?: string[], agentId: string = 'system'): Promise<void> {
    const ownerTelegram = process.env.TELEGRAM_OWNER_ID;
    if (!ownerTelegram) return;

    const text = `📊 *REPORTE: ${title}*\n\n${content}\n\n${charts && charts.length ? `[Ver ${charts.length} gráficos adjuntos en la plataforma]` : ''}`;
    await sendMessage('telegram', ownerTelegram, text, { parse_mode: 'HTML' }, agentId);
}

export async function listenForCommands(callback: (message: string, reply: (text: string) => Promise<void>) => void): Promise<void> {
    // Simple Telegram Polling implementation for listenForCommands
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn("No token found for telegram listener");
        return;
    }

    let lastUpdateId = 0;

    // En un sistema real esto debe ser un Webhook o ejecutarse en un proceso daemon separado.
    const poll = async () => {
        try {
            const res = await apiCall({
                url: `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
                method: 'GET',
                toolName: 'communications-telegram-poll',
                timeoutMs: 35000 // Long polling
            });

            if (res.success && res.data.ok) {
                for (const update of res.data.result) {
                    lastUpdateId = Math.max(lastUpdateId, update.update_id);
                    const msg = update.message;
                    if (msg && msg.text) {
                        const chatId = msg.chat.id.toString();
                        // Logs receiving
                        await logNotification({
                            agent_id: 'system',
                            channel: 'telegram',
                            direction: 'received',
                            to_address: chatId,
                            message: msg.text,
                            status: 'delivered',
                            metadata: {}
                        });

                        // Reply function closure
                        const replyFn = async (text: string) => {
                            await sendMessage('telegram', chatId, text);
                        };

                        callback(msg.text, replyFn);
                    }
                }
            }
        } catch (e) {
            console.error('Error polling telegram', e);
        }
        setTimeout(poll, 1000); // Polling continuo cada segundo entre requests o immediately
    }

    poll();
}

async function logNotification(data: {
    agent_id: string;
    channel: string;
    direction: string;
    to_address: string;
    message: string;
    status: string;
    metadata: any;
}) {
    try {
        await supabase.from('notifications_log').insert(data);
    } catch (err) {
        console.error('Fallo log de notificacion', err);
    }
}
