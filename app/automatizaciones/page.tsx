'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Globe, Mail, Activity, Play, Pause, Plus, List, Trash2 } from 'lucide-react';
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

    useEffect(() => {
        fetchCrons();
    }, []);

    const fetchCrons = async () => {
        const { data } = await supabase.from('scheduled_triggers').select('*').order('created_at', { ascending: false });
        if (data) setCrons(data);
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        await supabase.from('scheduled_triggers').update({ is_active: !currentStatus }).eq('id', id);
        fetchCrons();
    };

    return (
        <div className="space-y-4">
            {crons.map(cron => (
                <div key={cron.id} className="bg-slate-900 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
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
                        <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${cron.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                                {cron.is_active ? 'Activo' : 'Pausado'}
                            </span>
                            <button onClick={() => toggleStatus(cron.id, cron.is_active)} className="text-slate-400 hover:text-white">
                                {cron.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-3 text-sm text-slate-300 border border-white/5 mb-4">
                        <span className="text-indigo-400 font-semibold mr-2">Objetivo:</span>
                        {cron.objective}
                    </div>

                    <div className="flex gap-4 text-xs text-slate-500">
                        <span>Último: {cron.last_run_at ? new Date(cron.last_run_at).toLocaleString() : 'Nunca'}</span>
                        <span>Ejecuciones: {cron.run_count}</span>
                        <span>Fallos: <span className={cron.fail_count > 0 ? "text-red-400" : ""}>{cron.fail_count}</span></span>
                    </div>
                </div>
            ))}
            {crons.length === 0 && <p className="text-slate-500 text-center py-10">No hay cron jobs configurados.</p>}
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
