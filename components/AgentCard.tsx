'use client'

import { motion } from 'framer-motion'
import {
    Cpu, BarChart2, PenTool, Bot, Brain, Zap, Globe, Shield,
    Lightbulb, Code2, Database, Layers, MessageSquare
} from 'lucide-react'
import { Agent } from '@/lib/types'
import { JarvisVisualizer } from './JarvisVisualizer'

interface AgentCardProps {
    agent: Agent
    onDelete?: (id: string) => void
    onClick?: () => void
    onChat?: (agent: Agent) => void
}

const iconMap: Record<string, React.ElementType> = {
    cpu: Cpu,
    'bar-chart': BarChart2,
    'pen-tool': PenTool,
    bot: Bot,
    brain: Brain,
    zap: Zap,
    globe: Globe,
    shield: Shield,
    lightbulb: Lightbulb,
    code: Code2,
    database: Database,
    layers: Layers,
}

const modelColors: Record<string, string> = {
    'GPT-4o': '#10b981',
    'GPT-4o-mini': '#34d399',
    'Claude-3.5': '#f59e0b',
    'Gemini-1.5': '#6366f1',
    'Gemini-Flash': '#8b5cf6',
}

const statusLabel: Record<string, string> = {
    idle: 'En reposo',
    thinking: 'Pensando...',
    working: 'Trabajando',
}

function getAuraAnimation(status: Agent['status']) {
    if (status === 'thinking') {
        return {
            opacity: [0.3, 0.6, 0.3] as number[],
            scale: [1, 1.08, 1] as number[],
            transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
        }
    }
    if (status === 'working') {
        return {
            opacity: [0.5, 1, 0.5] as number[],
            scale: [1, 1.12, 1] as number[],
            transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' as const },
        }
    }
    return { opacity: 0, scale: 1 }
}

const pulseColor: Record<string, string> = {
    idle: 'transparent',
    thinking: '#6366f1',
    working: '#f59e0b',
}

export function AgentCard({ agent, onDelete, onClick, onChat }: AgentCardProps) {
    const IconComponent = iconMap[agent.avatar_config?.icon] || Bot
    const gradient = agent.avatar_config?.gradient || 'from-indigo-500 to-purple-600'
    const modelColor = modelColors[agent.model_type] || '#6366f1'
    const isJarvis = agent.name.toLowerCase().includes('jarvis')
    const finalGradient = isJarvis ? 'from-cyan-500 to-blue-600' : gradient
    const finalPulseColor = isJarvis ? (agent.status === 'idle' ? 'transparent' : '#00f2ff') : pulseColor[agent.status]

    return (
        <motion.div
            layout
            id={`agent-${agent.id}`}
            onClick={onClick}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
            className={`relative group ${onClick ? 'cursor-pointer' : ''}`}
        >
            {/* Aura de estado */}
            <motion.div
                className="absolute inset-0 rounded-2xl blur-xl"
                style={{ backgroundColor: finalPulseColor }}
                animate={getAuraAnimation(agent.status)}
            />

            {/* Card principal */}
            <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 overflow-hidden">

                {/* Decoración de fondo */}
                <div className={`absolute top - 0 right - 0 w - 32 h - 32 bg - gradient - to - br ${gradient} opacity - 10 blur - 2xl rounded - full - translate - y - 8 translate - x - 8`} />

                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <motion.div
                            className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${finalGradient} flex items-center justify-center shadow-lg overflow-hidden`}
                            animate={
                                agent.status === 'idle'
                                    ? { scale: [1, 1.05, 1], filter: ['brightness(1)', 'brightness(1.1)', 'brightness(1)'] }
                                    : agent.status === 'working'
                                        ? { scale: [1, 1.15, 1], filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'] }
                                        : { scale: 1, filter: 'brightness(1)' }
                            }
                            transition={
                                agent.status === 'idle'
                                    ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                                    : agent.status === 'working'
                                        ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                                        : { duration: 0.3 }
                            }
                        >
                            {isJarvis ? (
                                <JarvisVisualizer status={agent.status} size={32} />
                            ) : (
                                <IconComponent className="w-6 h-6 text-white" />
                            )}

                            {/* Indicador de status */}
                            <motion.span
                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900"
                                style={{
                                    backgroundColor:
                                        agent.status === 'idle'
                                            ? '#6b7280'
                                            : agent.status === 'thinking'
                                                ? (isJarvis ? '#00f2ff' : '#6366f1')
                                                : (isJarvis ? '#00f2ff' : '#f59e0b'),
                                }}
                                animate={
                                    agent.status !== 'idle'
                                        ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }
                                        : { scale: 1, opacity: 1 }
                                }
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        </motion.div>
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight">{agent.name}</h3>
                            <p className="text-slate-400 text-sm">{agent.role}</p>
                        </div>
                    </div>

                    {/* Model badge */}
                    <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                        style={{
                            color: modelColor,
                            borderColor: `${modelColor} 40`,
                            backgroundColor: `${modelColor} 15`,
                        }}
                    >
                        {agent.model_type}
                    </span>
                </div>

                {/* Status bar */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-700 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{
                                background:
                                    agent.status === 'idle'
                                        ? '#374151'
                                        : agent.status === 'thinking'
                                            ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                                            : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                            }}
                            animate={
                                agent.status === 'working'
                                    ? { width: ['30%', '85%', '60%'] }
                                    : agent.status === 'thinking'
                                        ? { width: ['20%', '70%', '40%'] }
                                        : { width: '0%' }
                            }
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </div>
                    <span
                        className="text-xs font-medium"
                        style={{
                            color:
                                agent.status === 'idle'
                                    ? '#6b7280'
                                    : agent.status === 'thinking'
                                        ? '#818cf8'
                                        : '#fbbf24',
                        }}
                    >
                        {statusLabel[agent.status]}
                    </span>
                </div>

                {/* System prompt preview */}
                {agent.system_prompt && (
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-4">
                        {agent.system_prompt}
                    </p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-4 pt-4 border-t border-white/5 relative z-10">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-[10px] uppercase tracking-widest font-medium">
                            Incorporado: {new Date(agent.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                        {onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                                className="text-slate-600 hover:text-red-500/80 text-[10px] uppercase tracking-wider font-bold transition-all duration-200 opacity-0 group-hover:opacity-100 px-2 py-1 hover:bg-red-500/5 rounded-md"
                            >
                                Despedir
                            </button>
                        )}
                    </div>

                    {onChat && (
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => { e.stopPropagation(); onChat(agent); }}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 shadow-lg transition-all duration-300 group/btn"
                            style={{
                                boxShadow: `0 10px 30px -10px ${modelColor}33`
                            }}
                        >
                            <MessageSquare
                                className="w-4 h-4 transition-transform duration-300 group-hover/btn:rotate-12"
                                style={{ color: modelColor }}
                            />
                            <span className="text-sm font-bold text-white tracking-wide">
                                Hablar con {agent.name.split(' ')[0]}
                            </span>
                            <div
                                className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 rounded-xl"
                                style={{
                                    background: `radial-gradient(circle at center, ${modelColor}22 0%, transparent 70%)`
                                }}
                            />
                        </motion.button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
