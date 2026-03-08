'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Globe, Mail, Activity, Play, Pause, Plus, List, Trash2, Zap, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AutomatizacionesPage() {
    const [activeTab, setActiveTab] = useState<'cron' | 'webhooks' | 'emails' | 'conditions'>('cron');
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-white rounded-2xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        Triggers de Autonomía Total (Fase 5)
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Configura cómo Jarvis reacciona automáticamente al mundo, sin tu intervención.
                    </p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-colors">
                    <Plus className="w-4 h-4" />
                    Nueva Automatización
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 border-b border-white/5 overflow-x-auto">
                <TabButton active={activeTab === 'cron'} onClick={() => setActiveTab('cron')} icon={Clock} label="Cron Jobs" />
                <TabButton active={activeTab === 'webhooks'} onClick={() => setActiveTab('webhooks')} icon={Globe} label="Webhooks" />
                <TabButton active={activeTab === 'emails'} onClick={() => setActiveTab('emails')} icon={Mail} label="Emails" />
                <TabButton active={activeTab === 'conditions'} onClick={() => setActiveTab('conditions')} icon={Activity} label="Condicionales" />
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                {activeTab === 'cron' && <CronTab />}
                {activeTab === 'webhooks' && <WebhooksTab />}
                {activeTab === 'emails' && <EmailsTab />}
                {activeTab === 'conditions' && <ConditionsTab />}
            </div>

            {/* Modal de Nueva Automatización */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold">Crear Automatización</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Trigger</label>
                                <select className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white">
                                    <option value="cron">Cron Job (Programado)</option>
                                    <option value="webhook">Webhook (Evento externo)</option>
                                    <option value="email">Email (Reacción a correo)</option>
                                    <option value="condition">Condición (Métrica del sistema)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
                                <input type="text" placeholder="Ej: Reporte de final de mes" className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Objetivo de Jarvis (Prompt)</label>
                                <textarea placeholder="¿Qué debe hacer Jarvis cuando se dispare?" rows={3} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white resize-none" />
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 bg-slate-800/30 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl">Cancelar</button>
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Crear y Activar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────
// CRON TAB
// ─────────────────────────────────────────────────────────────────
function CronTab() {
    const supabase = createClient();
    const [crons, setCrons] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCron, setEditingCron] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCrons();
    }, []);

    const fetchCrons = async () => {
        const { data } = await supabase.from('scheduled_triggers').select('*').eq('type', 'cron').order('created_at', { ascending: false });
        if (data) setCrons(data);
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        await supabase.from('scheduled_triggers').update({ is_active: !currentStatus }).eq('id', id);
        fetchCrons();
        syncCalendar();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;
        setLoading(true);
        await supabase.from('scheduled_triggers').delete().eq('id', id);
        await fetchCrons();
        await syncCalendar();
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);

        const payload = {
            name: fd.get('name') as string,
            description: fd.get('description') as string,
            cron_expr: fd.get('cron_expr') as string,
            objective: fd.get('objective') as string,
            type: 'cron',
            is_active: true
        };

        if (editingCron) {
            await supabase.from('scheduled_triggers').update(payload).eq('id', editingCron.id);
        } else {
            await supabase.from('scheduled_triggers').insert(payload);
        }

        setIsEditModalOpen(false);
        setEditingCron(null);
        await fetchCrons();
        await syncCalendar();
        setLoading(false);
    };

    const syncCalendar = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cron/sync');
            const data = await res.json();
            if (data.success) {
                alert('Agenda sincronizada con éxito');
            } else {
                alert('Error sincronizando: ' + (data.error || 'Desconocido'));
            }
        } catch (e) {
            console.error('Error syncing calendar:', e);
            alert('Fallo de red al sincronizar');
        }
        setLoading(false);
    };

    const handleRunTest = async (cron: any) => {
        if (!confirm(`¿Quieres ejecutar "${cron.name}" ahora mismo?`)) return;
        setLoading(true);
        try {
            const res = await fetch('/api/cron/run-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cron.id, name: cron.name })
            });
            const data = await res.json();

            if (data.success) {
                alert(`✅ Éxito: ${data.message}\nResultado: ${JSON.stringify(data.result?.summary || data.result?.result?.summary || 'Ejecutado')}`);
                await fetchCrons();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            alert('Error de conexión al ejecutar test');
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white/90">Gestión de Tareas Programadas</h3>
                    <p className="text-xs text-slate-500">Jarvis ejecuta estas tareas automáticamente según el cron configurado.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={syncCalendar}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Sincronizar Agenda
                    </button>
                    <button
                        onClick={() => { setEditingCron(null); setIsEditModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Cron
                    </button>
                </div>
            </div>

            {crons.map(cron => (
                <div key={cron.id} className="bg-slate-900 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Clock className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{cron.name}</h3>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{cron.cron_expr} • {cron.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${cron.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                                {cron.is_active ? 'Activo' : 'Pausado'}
                            </span>

                            {/* Botones de acción mejorados con etiquetas claras */}
                            <div className="flex items-center gap-2 ml-2">
                                <button
                                    onClick={() => handleRunTest(cron)}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                >
                                    <Zap className="w-3.5 h-3.5" /> EJECUTAR AHORA
                                </button>

                                <button
                                    onClick={() => { setEditingCron(cron); setIsEditModalOpen(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold transition-all"
                                >
                                    <List className="w-3.5 h-3.5" /> EDITAR
                                </button>

                                <button
                                    onClick={() => handleDelete(cron.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-bold transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> BORRAR
                                </button>

                                <div className="w-[1px] h-6 bg-white/10 mx-1" />

                                <button
                                    onClick={() => toggleStatus(cron.id, cron.is_active)}
                                    title={cron.is_active ? "Pausar" : "Activar"}
                                    className={`p-2 rounded-lg transition-colors ${cron.is_active ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-green-500 hover:bg-green-500/10'}`}
                                >
                                    {cron.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-sm text-slate-300 border border-white/5 mb-4 font-light">
                        <span className="text-indigo-400 font-semibold mr-2 border-r border-white/10 pr-2">JARVIS OBJECTIVE</span>
                        {cron.objective}
                    </div>

                    <div className="flex gap-6 text-[10px] text-slate-500 font-mono">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            ÚLTIMA EJECUCIÓN: {cron.last_run_at ? new Date(cron.last_run_at).toLocaleString() : 'NUNCA'}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3" />
                            COUNT: {cron.run_count}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3" />
                            FAIL: <span className={cron.fail_count > 0 ? "text-red-400" : ""}>{cron.fail_count}</span>
                        </div>
                    </div>
                </div>
            ))}

            {crons.length === 0 && <p className="text-slate-500 text-center py-10 italic">No hay cron jobs configurados.</p>}

            {/* Modal de Edición/Creación */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-950 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <form onSubmit={handleSave}>
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-indigo-400" />
                                    {editingCron ? 'Editar Cron Job' : 'Nuevo Cron Job'}
                                </h3>
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre</label>
                                        <input name="name" defaultValue={editingCron?.name} required type="text" placeholder="Reporte diario" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-indigo-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expresión Cron</label>
                                        <input name="cron_expr" defaultValue={editingCron?.cron_expr || '0 9 * * *'} required type="text" placeholder="0 9 * * *" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white font-mono focus:border-indigo-500 outline-none transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción Corta</label>
                                    <input name="description" defaultValue={editingCron?.description} required type="text" placeholder="Breve resumen de la tarea" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-indigo-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Objetivo de Jarvis (Prompt)</label>
                                    <textarea name="objective" defaultValue={editingCron?.objective} required placeholder="Define exactamente qué debe hacer Jarvis..." rows={4} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white resize-none focus:border-indigo-500 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50">
                                    {loading ? 'Guardando...' : (editingCron ? 'Actualizar' : 'Crear y Activar')}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// WEBHOOKS TAB
// ─────────────────────────────────────────────────────────────────
function WebhooksTab() {
    const supabase = createClient();
    const [webhooks, setWebhooks] = useState<any[]>([]);

    useEffect(() => {
        fetchWebhooks();
    }, []);

    const fetchWebhooks = async () => {
        const { data } = await supabase.from('webhook_endpoints').select('*').order('created_at', { ascending: false });
        if (data) setWebhooks(data);
    };

    return (
        <div className="space-y-4">
            {webhooks.map(w => (
                <div key={w.id} className="bg-slate-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <Globe className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{w.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Fuente: {w.source || 'Custo'} • Invocaciones: {w.trigger_count}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-sm font-mono text-slate-400 border border-white/5 mb-4 flex items-center justify-between">
                        <span>/api/webhooks/{w.slug}</span>
                        <button className="text-indigo-400 hover:text-indigo-300 text-xs">Copiar</button>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-sm text-slate-300 border border-white/5">
                        <span className="text-blue-400 font-semibold mr-2">Objetivo:</span>
                        {w.objective}
                    </div>
                </div>
            ))}
            {webhooks.length === 0 && <p className="text-slate-500 text-center py-10">No hay webhooks configurados.</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// EMAILS TAB
// ─────────────────────────────────────────────────────────────────
function EmailsTab() {
    const supabase = createClient();
    const [emails, setEmails] = useState<any[]>([]);

    useEffect(() => {
        fetchEmails();
    }, []);

    const fetchEmails = async () => {
        const { data } = await supabase.from('email_triggers').select('*').order('created_at', { ascending: false });
        if (data) setEmails(data);
    };

    return (
        <div className="space-y-4">
            {emails.map(e => (
                <div key={e.id} className="bg-slate-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                <Mail className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{e.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {e.match_from ? `De: ${e.match_from} ` : ''}
                                    {e.match_subject ? `Asunto: ${e.match_subject}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-sm text-slate-300 border border-white/5">
                        <span className="text-orange-400 font-semibold mr-2">Objetivo:</span>
                        {e.objective}
                    </div>
                </div>
            ))}
            {emails.length === 0 && <p className="text-slate-500 text-center py-10">No hay triggers de email configurados.</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// CONDITIONS TAB
// ─────────────────────────────────────────────────────────────────
function ConditionsTab() {
    const supabase = createClient();
    const [conditions, setConditions] = useState<any[]>([]);

    useEffect(() => {
        fetchConds();
    }, []);

    const fetchConds = async () => {
        const { data } = await supabase.from('condition_triggers').select('*').order('created_at', { ascending: false });
        if (data) setConditions(data);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conditions.map(c => (
                <div key={c.id} className="bg-slate-900 border border-white/10 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                <Activity className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{c.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Métrica: {c.metric}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 mb-4 relative z-10">
                        <span className="text-2xl font-bold text-white">{c.operator} {c.threshold}</span>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-xs text-slate-300 border border-white/5 relative z-10">
                        <span className="text-rose-400 font-semibold mr-1">Acción Jarvis:</span> {c.objective}
                    </div>
                </div>
            ))}
            {conditions.length === 0 && <p className="text-slate-500 text-center py-10 col-span-2">No hay condiciones configuradas.</p>}
        </div>
    );
}
