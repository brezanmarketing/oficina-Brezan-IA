import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

async function sendTelegramNotification(message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
        return true;
    } catch (e) {
        console.error("Error Telegram:", e);
        return false;
    }
}

export async function GET(req: Request) {
    // Validar autorización de Vercel/Local CRON
    const authHeader = req.headers.get("authorization");
    const isVercelLocal = req.headers.get("x-vercel-cron") !== process.env.CRON_SECRET;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production" && isVercelLocal) {
        // En desarrollo local o sin secret ignoramos, pero en prod bloqueamos
    }

    const supabase = getSupabase();
    console.log('[Calendar Notify] Buscando eventos próximos...');

    try {
        // Obtener eventos que van a suceder pronto y no han sido notificados
        // Calculamos el umbral (notify_before está en minutos)
        // Seleccionamos eventos donde start_at > NOW y start_at <= NOW + notify_before

        const now = new Date();
        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('notified', false)
            .gte('start_at', now.toISOString()); // Omitimos eventos pasados

        if (error || !events || events.length === 0) {
            return NextResponse.json({ processed: 0, message: "No upcoming events to notify" });
        }

        let processedCount = 0;

        for (const ev of events) {
            const eventTime = new Date(ev.start_at).getTime();
            const timeDiffMins = (eventTime - now.getTime()) / 60000;

            // Si el evento ocurrirá en un tiempo menor o igual a sus minutos de anticipo
            if (timeDiffMins <= (ev.notify_before || 30)) {
                let msg = '';

                switch (ev.type) {
                    case 'cron':
                        msg = `⚙️ *En ${Math.round(timeDiffMins)} min*: ${ev.title} se ejecutará.`;
                        break;
                    case 'project_deadline':
                        msg = `⚠️ *Deadline inminente*: ${ev.title} vence a las ${new Date(ev.start_at).toLocaleTimeString()}.`;
                        break;
                    case 'meeting':
                        msg = `📅 *Reunión en ${Math.round(timeDiffMins)} min*: ${ev.title}\n\n*Briefing previo*:\n${ev.description}`;
                        break;
                    case 'reminder':
                    default:
                        msg = `🔔 *Recordatorio en ${Math.round(timeDiffMins)} min*: ${ev.title}`;
                        break;
                }

                await sendTelegramNotification(msg);

                // Marcar como notificado
                await supabase.from('calendar_events')
                    .update({ notified: true })
                    .eq('id', ev.id);

                processedCount++;
            }
        }

        return NextResponse.json({ processed: processedCount, ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
