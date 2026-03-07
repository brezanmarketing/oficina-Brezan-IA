'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, ShieldCheck, AlertCircle, Cpu, Wifi, Globe, MessageSquare, Database } from 'lucide-react'

interface HealthStatus {
    status: 'ok' | 'warn' | 'error' | 'check'
    latency?: number
    message?: string
}

interface HealthData {
    openai: HealthStatus
    google: HealthStatus
    telegram: HealthStatus
    supabase: HealthStatus
    vercel: HealthStatus
    serper: HealthStatus
}

export function SystemStatus() {
    const [health, setHealth] = useState<HealthData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/system/health')
            if (res.ok) {
                const data = await res.json()
                setHealth(data)
            }
        } catch (error) {
            console.error('Error fetching system health:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHealth()
        const interval = setInterval(fetchHealth, 60000) // Refresh every 60s
        return () => clearInterval(interval)
    }, [])

    if (!health && loading) {
        return (
            <div className="w-full h-12 bg-slate-900/50 backdrop-blur-sm border-b border-white/5 flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Sincronizando Sistemas de Observabilidad...</span>
                </div>
            </div>
        )
    }

    const services = [
        { id: 'openai', label: 'OpenAI', icon: Cpu, data: health?.openai },
        { id: 'google', label: 'Gemini', icon: Globe, data: health?.google },
        { id: 'telegram', label: 'Telegram', icon: MessageSquare, data: health?.telegram },
        { id: 'supabase', label: 'Supabase', icon: Database, data: health?.supabase },
        { id: 'vercel', label: 'Vercel', icon: Wifi, data: health?.vercel },
        { id: 'serper', label: 'Serper', icon: ShieldCheck, data: health?.serper },
    ]

    return (
        <div className="w-full bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 pr-6 border-r border-white/10">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white tracking-tight uppercase">System Health</span>
                </div>

                <div className="flex items-center gap-8">
                    {services.map((service) => (
                        <ServiceIndicator
                            key={service.id}
                            label={service.label}
                            icon={service.icon}
                            status={service.data?.status || 'check'}
                            latency={service.data?.latency}
                            message={service.data?.message}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="text-[10px] text-slate-500 font-mono">
                    LAST UPDATE: {new Date().toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[9px] font-bold text-green-500 uppercase">Live</span>
                </div>
            </div>
        </div>
    )
}

function ServiceIndicator({ label, icon: Icon, status, latency, message }: {
    label: string,
    icon: any,
    status: 'ok' | 'warn' | 'error' | 'check',
    latency?: number,
    message?: string
}) {
    const statusColors = {
        ok: 'text-green-400 bg-green-400/10 border-green-400/20',
        warn: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
        error: 'text-red-400 bg-red-400/10 border-red-400/20',
        check: 'text-slate-500 bg-slate-500/10 border-slate-500/20'
    }

    const dotColors = {
        ok: 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]',
        warn: 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]',
        error: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]',
        check: 'bg-slate-500'
    }

    return (
        <div className="group relative flex items-center gap-2 cursor-help">
            <div className={`p-1.5 rounded-lg border ${statusColors[status]} transition-all duration-300 group-hover:scale-110`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-300 tracking-wide uppercase">{label}</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${dotColors[status]}`} />
                    <span className="text-[9px] font-mono text-slate-500 uppercase">
                        {status === 'ok' ? (latency ? `${latency}ms` : 'Online') : status === 'warn' ? 'Config' : status === 'error' ? 'Error' : '...'}
                    </span>
                </div>
            </div>

            {/* Tooltip simple */}
            <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">{label} API Status</div>
                <div className={`text-[9px] leading-relaxed ${status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                    {message || (status === 'ok' ? 'Servicio funcionando correctamente dentro de los parámetros esperados.' : 'Verificando estado...')}
                </div>
                {latency && status === 'ok' && (
                    <div className="mt-2 text-[8px] font-mono text-indigo-400">
                        LATENCY: {latency}ms
                    </div>
                )}
            </div>
        </div>
    )
}
