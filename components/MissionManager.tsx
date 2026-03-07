'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldAlert, Activity, StopCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Task, Agent } from '@/lib/types'
import { useProject } from '@/context/ProjectContext'

interface MissionManagerProps {
    isOpen: boolean
    onClose: () => void
    agents: Agent[]
}

export function MissionManager({ isOpen, onClose, agents }: MissionManagerProps) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const supabase = createClient()
    const { activeProjectId } = useProject()

    const fetchTasks = async () => {
        if (!activeProjectId) return

        setLoading(true)
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', activeProjectId)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: false })

        if (!error && data) {
            setTasks(data as Task[])
        }
        setLoading(false)
    }

    useEffect(() => {
        if (isOpen && activeProjectId) {
            fetchTasks()
        }
    }, [isOpen, activeProjectId])

    const handleAbort = async (task: Task) => {
        setCancellingId(task.id)
        try {
            // 1. Marcar tarea como cancelada
            await supabase
                .from('tasks')
                .update({ status: 'cancelled' })
                .eq('id', task.id)

            // 2. Liberar a todos los agentes implicados en la cadena de mando
            if (task.chain_of_command && task.chain_of_command.length > 0) {
                await supabase
                    .from('agents')
                    .update({ status: 'idle' })
                    .in('id', task.chain_of_command)
            }

            // Refrescar lista
            await fetchTasks()

        } catch (err) {
            console.error('Error abortando misión:', err)
        } finally {
            setCancellingId(null)
        }
    }

    const getAgentName = (id?: string | null) => {
        if (!id) return 'Sistema'
        const agent = agents.find(a => a.id === id)
        return agent ? agent.name : 'Desconocido'
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-orange-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-lg">Misiones Activas</h2>
                                    <p className="text-slate-400 text-xs">Gestiona y audita operaciones en curso</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={fetchTasks}
                                    className={`w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all`}
                                    title="Refrescar"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                            {loading && tasks.length === 0 ? (
                                <div className="flex items-center justify-center h-40">
                                    <motion.div
                                        className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    />
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3">
                                    <ShieldAlert className="w-10 h-10 text-slate-600" />
                                    <p className="text-slate-500 font-medium">No hay misiones activas o atascadas en este momento.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {tasks.map((task) => (
                                        <div key={task.id} className="bg-slate-950 rounded-xl p-4 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                                            <div>
                                                <h3 className="text-slate-200 font-medium">{task.title}</h3>
                                                <div className="flex items-center gap-3 mt-2 text-xs">
                                                    <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                        {task.status === 'in_progress' ? 'En Progreso' : 'Pendiente'}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        Responsable actual: <span className="text-slate-300 font-medium">{getAgentName(task.assigned_agent_id)}</span>
                                                    </span>
                                                    <span className="text-slate-500">
                                                        Paso {task.current_step_index! + 1} de {task.chain_of_command?.length || 1}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleAbort(task)}
                                                disabled={cancellingId === task.id}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cancellingId === task.id
                                                    ? 'bg-rose-500/20 text-rose-300 cursor-not-allowed'
                                                    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                                                    }`}
                                            >
                                                {cancellingId === task.id ? (
                                                    <motion.div
                                                        className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full"
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    />
                                                ) : (
                                                    <StopCircle className="w-4 h-4" />
                                                )}
                                                Abortar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )
            }
        </AnimatePresence >
    )
}
