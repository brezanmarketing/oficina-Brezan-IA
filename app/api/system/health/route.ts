import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCredential } from '@/office/tools/credential-manager';

export async function GET() {
    const results: Record<string, boolean> = {};

    try {
        const openaiKey = await getCredential('openai', 'API Key');
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${openaiKey}` }
        });
        results.openai = res.ok;
    } catch { results.openai = false; }

    try {
        const geminiKey = await getCredential('gemini', 'API Key');
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`
        );
        results.google = res.ok;
    } catch { results.google = false; }

    try {
        const token = await getCredential('telegram', 'Bot Token');
        const res = await fetch(
            `https://api.telegram.org/bot${token}/getMe`
        );
        results.telegram = res.ok;
    } catch { results.telegram = false; }

    try {
        const supabase = await createClient();
        const { error } = await supabase.from('agents').select('id').limit(1);
        results.supabase = !error;
    } catch { results.supabase = false; }

    results.vercel = true;

    try {
        const serper = await getCredential('serper', 'API Key');
        results.serper = !!serper;
    } catch { results.serper = false; }

    return NextResponse.json(results);
}

