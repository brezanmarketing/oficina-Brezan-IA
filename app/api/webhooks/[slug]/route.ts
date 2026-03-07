import { processWebhook } from '@/office/jarvis/phase5/webhook-engine';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: any) {
    let slug = 'unknown';
    try {
        const params = await context.params;
        slug = params?.slug || 'unknown';

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const result = await processWebhook(slug, body, req.headers);

        return NextResponse.json(result);
    } catch (err: any) {
        if (err.message === 'Webhook not found or inactive') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (err.message === 'Invalid signature') {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        console.error(`[Webhook Route] Error processing webhook ${slug}:`, err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
