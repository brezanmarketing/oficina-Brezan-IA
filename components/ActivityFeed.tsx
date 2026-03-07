'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Bot, Zap, MessageSquare, Clock, ShieldAlert, ShieldCheck, AlertTriangle, Lock, Search, Code, Mail } from 'lucide-react'
import { useActivityFeed, AuditActivity } from '@/hooks/useActivityFeed'

export function ActivityFeed() {
    const { activities, loading } = useActivityFeed()

    return (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                    <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-white font-bold text-lg tracking-tight uppercase">Registro de Actividad</h2>

                    <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">Auditoría en Tiempo Real</p>
                </div>
                {/* Live indicator */}
                <div className="ml-auto flex items-center gap-2 px-2 py-1 rounded-lg bg-green-500/5 border border-green-500/10">
                    <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-green-400 text-[9px] font-black tracking-tighter">LIVE</span>
                </div>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <motion.div
                            className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Interceptando Logs de Auditoría...</span>
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4 opacity-40">
                        <ShieldCheck className="w-12 h-12 text-slate-600" />
                        <p className="text-slate-500 text-xs text-center uppercase tracking-widest font-mono">
                            Sistemas en reposo.<br />
                            Esperando actividad de agentes.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {activities.map((activity) => (
                            <ActivityEntry key={activity.id} activity={activity} />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    )
}

function ActivityEntry({ activity }: { activity: AuditActivity }) {
    // Mapeo dinámico de iconos según la acción
    const getIcon = () => {
        const action = activity.action.toLowerCase()
        const resource = activity.resource.toLowerCase()

        if (activity.status === 'denied') return Lock
        if (activity.status === 'error') return AlertTriangle

        if (action.includes('search') || resource.includes('web')) return Search
        if (action.includes('code') || action.includes('execute')) return Code
        if (action.includes('email') || resource.includes('mail')) return Mail
        if (action.includes('message') || resource.includes('telegram')) return MessageSquare

        return Bot
    }

    const Icon = getIcon()

    const statusConfig = {
        ok: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
        denied: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
        error: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    }
    const config = statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.ok

    return (
        <motion.div
            initial={{ opacity: 0, x: -10, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all group"
        >
            {/* Icon Column */}
            <div className="flex-shrink-0">
                <div className={`w-9 h-9 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center shadow-inner transition-transform group-hover:scale-105`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-white text-[11px] font-bold tracking-tight uppercase group-hover:text-indigo-300 transition-colors">
                            {activity.actor}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-slate-500 border border-white/5 font-mono">
                            {activity.actor_role || 'Agent'}
                        </span>
                    </div>
                    <span className="text-slate-600 text-[9px] font-mono">
                        {new Date(activity.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                    </span>
                </div>

                <div className="flex flex-col">
                    <p className="text-slate-300 text-xs font-semibold leading-tight">
                        {activity.action} <span className="text-slate-500 font-normal">on</span> {activity.resource}
                    </p>
                    {(activity.input_summary || activity.output_summary) && (
                        <p className="text-slate-500 text-[10px] line-clamp-2 mt-1 italic leading-relaxed">
                            {activity.output_summary || activity.input_summary}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span className="text-[9px] text-slate-600 font-mono">
                            {activity.duration_ms ? `${activity.duration_ms}ms` : '--'}
                        </span>
                    </div>

                    {activity.status === 'denied' ? (
                        <div className="flex items-center gap-1 text-[9px] text-orange-500 font-bold uppercase tracking-wider">
                            <Lock className="w-2.5 h-2.5" /> Blocked
                        </div>
                    ) : activity.status === 'error' ? (
                        <div className="flex items-center gap-1 text-[9px] text-red-500 font-bold uppercase tracking-wider">
                            <ShieldAlert className="w-2.5 h-2.5" /> Failed
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-[9px] text-indigo-500/80 font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-2.5 h-2.5" /> Authorized
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
