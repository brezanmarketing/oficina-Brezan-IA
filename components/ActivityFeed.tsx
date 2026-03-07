'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Bot, Zap, MessageSquare, Clock } from 'lucide-react'
import { useActivityFeed } from '@/hooks/useActivityFeed'

export function ActivityFeed() {
    const { activities, loading } = useActivityFeed()

    return (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-white font-bold text-lg">Sala de Guerra</h2>
                    <p className="text-slate-400 text-sm">Feed de actividad en tiempo real</p>
                </div>
                {/* Live indicator */}
                <div className="ml-auto flex items-center gap-2">
                    <motion.div
                        className="w-2 h-2 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-green-400 text-xs font-medium">EN VIVO</span>
                </div>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <motion.div
                            className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-3">
                        <MessageSquare className="w-8 h-8 text-slate-600" />
                        <p className="text-slate-500 text-sm text-center">
                            La sala está en silencio.<br />
                            Los agentes aún no han comenzado a colaborar.
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

function ActivityEntry({ activity }: { activity: ReturnType<typeof useActivityFeed>['activities'][number] }) {
    const message = typeof activity.data === 'object' && 'message' in activity.data
        ? String(activity.data.message)
        : JSON.stringify(activity.data).slice(0, 120)

    const eventType = typeof activity.data === 'object' && 'event' in activity.data
        ? String(activity.data.event)
        : 'data_share'

    const iconMap: Record<string, React.ElementType> = {
        task_complete: Zap,
        task_start: Activity,
        data_share: MessageSquare,
    }
    const EntryIcon = iconMap[eventType] || MessageSquare

    return (
        <motion.div
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, type: 'spring' }}
            className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
        >
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium truncate">
                        {activity.agent_name || 'Sistema'}
                    </span>
                    {activity.task_title && (
                        <span className="text-indigo-400 text-xs px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 truncate">
                            {activity.task_title}
                        </span>
                    )}
                </div>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    {message}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span className="text-slate-600 text-xs">
                        {new Date(activity.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}
                    </span>
                    <EntryIcon className="w-3 h-3 text-slate-600 ml-1" />
                </div>
            </div>
        </motion.div>
    )
}
