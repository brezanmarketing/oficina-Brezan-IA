import { apiCall, getCredential } from '../api-gateway/index';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from '../file-manager/index';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export type EmailClass = 'urgente' | 'normal' | 'spam' | 'newsletter' | 'factura' | 'soporte';

export interface Email {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string;
    date: string;
    snippet: string;
    body: string;
    classification?: EmailClass;
}

async function getGmailAccessToken(): Promise<string> {
    const clientId = await getCredential('gmail', 'Client ID');
    const clientSecret = await getCredential('gmail', 'Client Secret');
    const refreshToken = await getCredential('gmail', 'Refresh Token');

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan credenciales de Gmail en el Vault de Jarvis (Connections Panel).');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Error obteniendo Gmail token: ${data.error_description || data.error}`);
    }

    return data.access_token;
}

export async function readInbox(limit: number = 10, since?: string, agentId: string = 'system'): Promise<Email[]> {
    const token = await getGmailAccessToken();
    let query = 'in:inbox';
    if (since) query += ` after:${since}`;

    const res = await apiCall({
        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodeURIComponent(query)}`,
        headers: { 'Authorization': `Bearer ${token}` },
        toolName: 'email-manager-read'
    });

    if (!res.success || !res.data.messages) return [];

    const emails: Email[] = [];
    for (const msg of res.data.messages) {
        const detailRes = await apiCall({
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (detailRes.success && detailRes.data) {
            const data = detailRes.data;
            const headers = data.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name)?.value || '';

            const email: Email = {
                id: data.id,
                threadId: data.threadId,
                subject: getHeader('subject'),
                from: getHeader('from'),
                to: getHeader('to'),
                date: getHeader('date'),
                snippet: data.snippet,
                body: extractBody(data.payload)
            };

            email.classification = await classifyEmail(email);
            emails.push(email);

            // Log to emails_log
            await logEmailToDb(email, 'inbound', agentId);
        }
    }

    return emails;
}

export async function sendEmail(to: string, subject: string, body: string, attachments?: any[], agentId: string = 'system'): Promise<void> {
    const token = await getGmailAccessToken();

    // Basic RFC 2822 formatting
    const rawMessage = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        '',
        body
    ].join('\\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64').split('+').join('-').split('/').join('_').replace(/=+$/, '');

    const res = await apiCall({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { raw: encodedMessage },
        toolName: 'email-manager-send'
    });

    if (!res.success) {
        throw new Error(`Error enviando email: ${res.error}`);
    }

    await logEmailToDb({
        id: res.data.id,
        threadId: res.data.threadId,
        subject,
        from: 'me',
        to,
        date: new Date().toISOString(),
        snippet: body.substring(0, 50),
        body
    }, 'outbound', agentId);
}

export async function replyToEmail(thread_id: string, body: string, to: string, subjectHead: string, agentId: string = 'system'): Promise<void> {
    const token = await getGmailAccessToken();

    const rawMessage = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: =?utf-8?B?${Buffer.from('Re: ' + subjectHead).toString('base64')}?=`,
        '',
        body
    ].join('\\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64').split('+').join('-').split('/').join('_').replace(/=+$/, '');

    const res = await apiCall({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { raw: encodedMessage, threadId: thread_id },
        toolName: 'email-manager-reply'
    });

    if (!res.success) throw new Error(`Error respondiendo email: ${res.error}`);
}

export async function classifyEmail(email: Email): Promise<EmailClass> {
    // Basic classification by keywords, fallback for AI
    const content = (email.subject + ' ' + email.body).toLowerCase();

    if (content.includes('unsubscribe') || content.includes('oferta') || content.includes('descuento')) return 'newsletter';
    if (content.includes('factura') || content.includes('invoice') || content.includes('pago')) return 'factura';
    if (content.includes('urgente') || content.includes('asap') || content.includes('emergencia')) return 'urgente';
    if (content.includes('ayuda') || content.includes('support') || content.includes('error')) return 'soporte';

    if (email.from.includes('marketing') || email.from.includes('noreply')) return 'newsletter';

    return 'normal';
}

export async function getAttachment(email_id: string, attachment_id: string): Promise<Buffer> {
    const token = await getGmailAccessToken();
    const res = await apiCall({
        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email_id}/attachments/${attachment_id}`,
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.success) throw new Error(`Falló carga de adjunto: ${res.error}`);

    const dataAsBase64 = res.data.data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(dataAsBase64, 'base64');
}

export async function applyLabel(email_id: string, label: string): Promise<void> {
    const token = await getGmailAccessToken();
    await apiCall({
        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email_id}/modify`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { addLabelIds: [label] }
    });
}

function extractBody(payload: any): string {
    if (!payload) return '';
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain') {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
    }
    return '';
}

async function logEmailToDb(email: Email, direction: 'inbound' | 'outbound', agentId: string) {
    const supabase = getSupabase();
    try {
        await supabase.from('emails_log').insert({
            agent_id: agentId,
            direction,
            from_addr: email.from,
            to_addr: [email.to],
            subject: email.subject,
            body_preview: email.snippet,
            classification: email.classification || 'normal',
            thread_id: email.threadId,
            has_attachments: false // Simplified for now
        });
    } catch (err) {
        console.error('No se pudo registrar en emails_log', err);
    }
}
