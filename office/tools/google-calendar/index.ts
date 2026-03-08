import { createClient } from '@supabase/supabase-js';
import { getCredential } from '../credential-manager';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

/**
 * Intercambia el Refresh Token por un nuevo Access Token usando el endpoint OAUTH2 de Google
 */
async function getAccessToken(): Promise<string | null> {
    try {
        const clientId = await getCredential('google_calendar', 'Client ID');
        const clientSecret = await getCredential('google_calendar', 'Client Secret');
        const refreshToken = await getCredential('google_calendar', 'Refresh Token');

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
            console.error('[Google Calendar] Error refrescando token:', data);
            return null;
        }

        return data.access_token;
    } catch (error) {
        console.error('[Google Calendar] Credenciales no configuradas o inválidas.');
        return null; // Silent fail if disabled
    }
}

/**
 * Obtiene eventos de los próximos 30 días y los inyecta en la base de datos de la Agenda
 */
export async function syncFromGoogleCalendar() {
    console.log('[Google Calendar] Iniciando sincronización de reuniones...');

    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.log('[Google Calendar] Sincronización saltada (no hay token disponible).');
        return;
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error?.message || 'Error fetching events');
        }

        const events = data.items || [];
        const supabase = getSupabase();

        // Limpiar reuniones de Google Calendar futuras para repoblar (evita duplicados si cambian de hora)
        await supabase.from('calendar_events')
            .delete()
            .eq('source', 'google_calendar')
            .gte('start_at', timeMin);

        const newEventsList = [];

        for (const ev of events) {
            const startStr = ev.start?.dateTime || ev.start?.date;
            const endStr = ev.end?.dateTime || ev.end?.date;

            if (!startStr) continue;

            const isAllDay = !ev.start?.dateTime;

            // Extraer asistentes
            const attendees = (ev.attendees || []).map((a: any) => a.email).join(', ');

            newEventsList.push({
                title: `[GCal] ${ev.summary || 'Sin título'}`,
                description: `Enlace sugerido: ${ev.htmlLink || ''}\nAsistentes: ${attendees}\n\n${ev.description || ''}`,
                type: 'meeting',
                color: '#9333ea', // purple-600
                start_at: new Date(startStr).toISOString(),
                end_at: endStr ? new Date(endStr).toISOString() : null,
                all_day: isAllDay,
                source: 'google_calendar',
                source_id: ev.id,
                notify_before: 30, // Avisar con 30 minutos a Jarvis
                metadata: { htmlLink: ev.htmlLink, attendees: ev.attendees }
            });
        }

        if (newEventsList.length > 0) {
            await supabase.from('calendar_events').insert(newEventsList);
            console.log(`[Google Calendar] Sincronizadas ${newEventsList.length} reuniones.`);
        }

    } catch (error: any) {
        console.error('[Google Calendar] Error sincronizando:', error.message);
    }
}
