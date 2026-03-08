import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCredential } from '@/office/tools/credential-manager';

export async function GET() {
    const results: any = {};

    try {
        const openaiKey = await getCredential('openai', 'API Key');
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${openaiKey}` }
        });
        results.openai = res.ok;
        if (!res.ok) results.openai_err = `HTTP ${res.status}`;
    } catch (e: any) {
        results.openai = false;
        results.openai_err = e.message;
    }

    try {
        const geminiKey = await getCredential('gemini', 'API Key');
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`
        );
        results.google = res.ok;
        if (!res.ok) results.google_err = `HTTP ${res.status}`;
    } catch (e: any) {
        results.google = false;
        results.google_err = e.message;
    }

    try {
        const token = await getCredential('telegram', 'Bot Token');
        const res = await fetch(
            `https://api.telegram.org/bot${token}/getMe`
        );
        results.telegram = res.ok;
        if (!res.ok) results.telegram_err = `HTTP ${res.status}`;
    } catch (e: any) {
        results.telegram = false;
        results.telegram_err = e.message;
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.from('agents').select('id').limit(1);
        results.supabase = !error;
        if (error) results.supabase_err = error.message;
    } catch (e: any) {
        results.supabase = false;
        results.supabase_err = e.message;
    }

    results.vercel = true;

    try {
        const serper = await getCredential('serper', 'API Key');
        results.serper = !!serper;
    } catch (e: any) {
        results.serper = false;
        results.serper_err = e.message;
    }

    return NextResponse.json(results);
}


