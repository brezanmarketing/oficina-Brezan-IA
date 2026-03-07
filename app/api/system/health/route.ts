import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCredential } from '@/office/tools/credential-manager';

export async function GET(req: NextRequest) {
    const results: any = {
        openai: { status: 'check', latency: 0 },
        google: { status: 'check', latency: 0 },
        telegram: { status: 'check', latency: 0 },
        supabase: { status: 'check', latency: 0 },
        vercel: { status: 'ok', latency: 0, message: 'Operativo' },
        serper: { status: 'check', latency: 0 }
    };

    const startTime = Date.now();

    // 1. Supabase Check
    try {
        const supabase = await createClient();
        const start = Date.now();
        const { error } = await supabase.from('agents').select('id').limit(1);
        results.supabase.latency = Date.now() - start;
        results.supabase.status = error ? 'error' : 'ok';
        if (error) results.supabase.message = error.message;
    } catch (err: any) {
        results.supabase.status = 'error';
        results.supabase.message = err.message;
    }

    // 2. OpenAI Check
    try {
        const token = await getCredential('openai', 'API Key');
        const start = Date.now();
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        results.openai.latency = Date.now() - start;
        results.openai.status = res.ok ? 'ok' : 'error';
        if (!res.ok) results.openai.message = `HTTP ${res.status}`;
    } catch (err: any) {
        results.openai.status = err.message.includes('No encontrado') ? 'warn' : 'error';
        results.openai.message = err.message;
    }

    // 3. Gemini Check
    try {
        const token = await getCredential('gemini', 'API Key');
        const start = Date.now();
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${token}`);
        results.google.latency = Date.now() - start;
        results.google.status = res.ok ? 'ok' : 'error';
        if (!res.ok) results.google.message = `HTTP ${res.status}`;
    } catch (err: any) {
        results.google.status = err.message.includes('No encontrado') ? 'warn' : 'error';
        results.google.message = err.message;
    }

    // 4. Telegram Check
    try {
        const token = await getCredential('telegram', 'Bot Token');
        const start = Date.now();
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        results.telegram.latency = Date.now() - start;
        results.telegram.status = data.ok ? 'ok' : 'error';
        if (!data.ok) results.telegram.message = data.description || 'Error en Telegram API';
    } catch (err: any) {
        results.telegram.status = err.message.includes('No encontrado') ? 'warn' : 'error';
        results.telegram.message = err.message;
    }

    // 5. Serper Check (Solo presencia de credencial)
    try {
        await getCredential('serper', 'API Key');
        results.serper.status = 'ok';
    } catch (err: any) {
        results.serper.status = 'warn';
        results.serper.message = 'Añadir en Conexiones API';
    }

    return NextResponse.json(results);
}
