'use client'

import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, Users, FileText, CheckCircle2, AlertCircle, Play, X, Target, Bot } from 'lucide-react';

export default function AgendaPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

    const supabase = createClient();

    const fetchEvents = async () => {
        setLoading(true);
        // Primero intentar resync manual para asegurar que los crons aparecen
        try {
            await fetch('/api/cron/sync');
        } catch (e) { }

        const { data, error } = await supabase
            .from('calendar_events')
            .select('*')
            .order('start_at', { ascending: true });

        if (data && !error) {
            const formattedEvents = data.map((ev: any) => ({
                id: ev.id,
                title: ev.title,
                start: ev.start_at,
                end: ev.end_at || ev.start_at,
                allDay: ev.all_day,
                backgroundColor: ev.color || '#64748b', // fallback grey
                borderColor: 'transparent',
                extendedProps: {
                    description: ev.description,
                    type: ev.type,
                    source: ev.source,
                    metadata: ev.metadata,
                    project_id: ev.project_id
                }
            }));
            setEvents(formattedEvents);

            // Filtrar próximos 7 días para la barra lateral
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const upcoming = formattedEvents.filter(e => {
                const start = new Date(e.start);
                return start >= now && start <= nextWeek;
            });
            setUpcomingEvents(upcoming);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();

        // Escuchar cambios realtime
        const channel = supabase.channel('calendar_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
                fetchEvents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleEventClick = (info: any) => {
        setSelectedEvent({
            title: info.event.title,
            start: info.event.start,
            end: info.event.end,
            allDay: info.event.allDay,
            ...info.event.extendedProps
        });
    };

    return (
        <div className="flex h-full gap-6 text-white">
            {/* Contenedor Principal Calendario */}
            <div className="flex-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <CalendarIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold">Agenda Central</h2>
                    </div>
                    <button
                        onClick={() => setIsNewEventModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                        + Nuevo Evento
                    </button>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar calendar-container">
                    <style suppressHydrationWarning>{`
                        /* Overrides para dark mode en FullCalendar */
                        .fc-theme-standard td, .fc-theme-standard th { border-color: rgba(255,255,255,0.05); }
                        .fc-col-header-cell-cushion { color: #94a3b8; font-weight: 600; padding: 12px 0 !important; }
                        .fc-daygrid-day-number { color: #f8fafc; font-size: 0.875rem; padding: 8px !important; }
                        .fc-day-today { background-color: rgba(99, 102, 241, 0.05) !important; }
                        .fc-button-primary { background-color: #1e293b !important; border-color: #334155 !important; text-transform: capitalize !important;}
                        .fc-button-active { background-color: #4f46e5 !important; border-color: #4f46e5 !important; }
                        .fc-event { cursor: pointer; border-radius: 4px; padding: 2px 4px; transition: opacity 0.2s; }
                        .fc-event:hover { opacity: 0.8; }
                        .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 700 !important; color: white !important; }
                        .fc-list-day-cushion { background-color: rgba(30, 41, 59, 1) !important; }
                        .fc-list-event:hover td { background-color: rgba(255,255,255,0.05) !important; }
                        .fc-timegrid-slot-label-cushion { color: #64748b; }
                    `}</style>
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                        }}
                        events={events}
                        eventClick={handleEventClick}
                        height="100%"
                        locale="es"
                        buttonText={{
                            today: 'Hoy',
                            month: 'Mes',
                            week: 'Semana',
                            day: 'Día',
                            list: 'Lista'
                        }}
                    />
                </div>
            </div>

            {/* Panel Lateral: Leyenda y Próximos Eventos */}
            <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto hidden xl:flex">
                <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-5">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Leyenda</h3>
                    <div className="space-y-3">
                        <LegendItem color="bg-blue-500" label="Crons Jarvis" />
                        <LegendItem color="bg-orange-500" label="Deadlines Proyectos" />
                        <LegendItem color="bg-purple-600" label="Reuniones (Google)" />
                        <LegendItem color="bg-green-500" label="Tareas Completadas" />
                        <LegendItem color="bg-slate-500" label="Tareas Pendientes" />
                        <LegendItem color="bg-red-500" label="Acción Urgente" />
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-5 flex-1 select-none">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Próximos 7 días</h3>
                    {upcomingEvents.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">No hay eventos próximos</div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingEvents.slice(0, 8).map((ev, i) => (
                                <div key={i} className="flex gap-3 relative before:absolute before:left-1 before:top-6 before:bottom-[-16px] before:w-[2px] before:bg-white/5 last:before:hidden">
                                    <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10" style={{ backgroundColor: ev.backgroundColor }} />
                                    <div>
                                        <p className="text-xs text-slate-400 mb-0.5">
                                            {new Date(ev.start).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-sm font-medium text-white line-clamp-2">{ev.title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Detalle */}
            <AnimatePresence>
                {selectedEvent && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedEvent(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400">
                                            {selectedEvent.type}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                                            {selectedEvent.source}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">{selectedEvent.title}</h2>
                                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        {new Date(selectedEvent.start).toLocaleString()}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedEvent(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="bg-slate-950 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap border border-white/5 mb-6">
                                {selectedEvent.description || 'Sin descripción detallada.'}
                            </div>

                            {selectedEvent.type === 'meeting' && selectedEvent.source === 'google_calendar' && (
                                <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all">
                                    <Bot className="w-5 h-5" />
                                    Pedir Briefing a Jarvis
                                </button>
                            )}

                            {selectedEvent.type === 'cron' && selectedEvent.source === 'jarvis' && (
                                <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all border border-indigo-500/30">
                                    <Play className="w-4 h-4 text-indigo-400" />
                                    Ejecutar Ahora
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                )}

                {/* Modal Nuevo Evento / Delegar a Jarvis */}
                {isNewEventModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsNewEventModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold text-white mb-6">Crear Nuevo Evento</h2>
                            <form className="space-y-4" onSubmit={async (e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                const title = fd.get('title') as string;
                                const dateStr = fd.get('date') as string;
                                const assignToJarvis = fd.get('jarvis') === 'on';

                                if (!title || !dateStr) return;
                                const date = new Date(dateStr);

                                if (assignToJarvis) {
                                    // Generar CRON expression exacto para la fecha
                                    const cronExpr = `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`;

                                    await supabase.from('scheduled_triggers').insert({
                                        name: `Delegado: ${title}`,
                                        objective: `Ejecutar la tarea programada: ${title}`,
                                        cron_expr: cronExpr,
                                        category: 'task',
                                        is_active: true
                                    });
                                } else {
                                    await supabase.from('calendar_events').insert({
                                        title: title,
                                        start_at: date.toISOString(),
                                        type: 'reminder',
                                        color: '#ef4444',
                                        source: 'user',
                                        notify_before: 15
                                    });
                                }

                                setIsNewEventModalOpen(false);
                                fetchEvents();
                            }}>
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase">Título del Evento</label>
                                    <input name="title" required type="text" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 mt-1 text-white focus:outline-none focus:border-indigo-500" placeholder="Ej: Revisión Financiera" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase">Fecha y Hora Exácta</label>
                                    <input name="date" required type="datetime-local" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 mt-1 text-white focus:outline-none focus:border-indigo-500" />
                                </div>

                                <label className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl cursor-pointer hover:bg-indigo-500/20 transition-colors">
                                    <input type="checkbox" name="jarvis" className="w-5 h-5 accent-indigo-500 rounded bg-slate-900 border-white/20" />
                                    <div>
                                        <div className="text-white font-medium flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-indigo-400" /> Asignar a Jarvis
                                        </div>
                                        <div className="text-xs text-indigo-300 mt-0.5">La IA tomará el control del sistema a esa hora y ejecutará el objetivo automáticamente.</div>
                                    </div>
                                </label>

                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
                                    <button type="button" onClick={() => setIsNewEventModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium">Cancelar</button>
                                    <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors border border-indigo-400/30">Programar</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-xs text-slate-400">{label}</span>
        </div>
    );
}
