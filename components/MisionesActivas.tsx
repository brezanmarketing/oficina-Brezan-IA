'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Clock, User, ChevronRight, ChevronDown, CheckCircle2, Loader2, PauseCircle, PlayCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Project, Task } from '@/lib/types'

export function MisionesActivas() {
    const supabase = createClient()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [tasks, setTasks] = useState<Record<string, Task[]>>({})

    const fetchProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*, agents:project_agents(agent:agents(*))')
                .in('status', ['planning', 'running', 'paused'])
                .order('created_at', { ascending: false })

            if (error) throw error

            // Transformar la data para que coincida con la interfaz Project
            const transformed: Project[] = (data || []).map((p: any) => ({
                ...p,
                agents: p.agents?.map((a: any) => a.agent).filter(Boolean) || []
            }))

            setProjects(transformed)
        } catch (error) {
            console.error('Error fetching projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTasks = async (projectId: string) => {
        if (tasks[projectId]) return // Cache simple
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setTasks(prev => ({ ...prev, [projectId]: data || [] }))
        } catch (error) {
            console.error('Error fetching tasks:', error)
        }
    }

    useEffect(() => {
        fetchProjects()

        // Suscripción Realtime
        const channel = supabase
            .channel('projects_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const toggleExpand = (projectId: string) => {
        if (expandedId === projectId) {
            setExpandedId(null)
        } else {
            setExpandedId(projectId)
            fetchTasks(projectId)
        }
    }

    if (loading) {
        return (
            <div className="w-full py-12 flex flex-col items-center justify-center gap-4 bg-slate-900/20 border border-white/5 rounded-2xl">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-slate-500 text-sm font-mono animate-pulse uppercase tracking-widest">Localizando Misiones Activas...</span>
            </div>
        )
    }

    if (projects.length === 0) {
        return <MisionesFallback />
    }

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-3 mb-2 px-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Rocket className="w-4 h-4 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight uppercase">Misiones Activas</h2>
                <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold uppercase">
                    {projects.length} en curso
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        isExpanded={expandedId === project.id}
                        onToggle={() => toggleExpand(project.id)}
                        projectTasks={tasks[project.id] || []}
                    />
                ))}
            </div>
        </div>
    )
}

function ProjectCard({ project, isExpanded, onToggle, projectTasks }: { project: Project, isExpanded: boolean, onToggle: () => void, projectTasks: Task[] }) {
    const mainAgent = project.agents?.[0]

    const statusConfig = {
        planning: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Planificando', icon: Clock, animate: false },
        running: { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'En Curso', icon: PlayCircle, animate: true },
        paused: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', label: 'Pausada', icon: PauseCircle, animate: false },
        completed: { color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-500/20', label: 'Completada', icon: CheckCircle2, animate: false },
        cancelled: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Cancelada', icon: AlertCircle, animate: false },

    }

    const config = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.planning
    const StatusIcon = config.icon

    return (
        <motion.div
            layout
            className={`flex flex-col bg-slate-900/50 backdrop-blur-sm border ${isExpanded ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/10'} rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20`}
        >
            <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="text-white font-bold leading-tight">{project.name}</h3>
                    <div className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.border} ${config.color} text-[10px] font-bold uppercase tracking-wider`}>
                        {config.animate && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />}
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Progreso</span>
                        <span className="text-white">{project.progress_pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${project.progress_pct}%` }}
                            className={`h-full ${project.status === 'running' ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-slate-600'}`}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                            {mainAgent?.avatar_url ? (
                                <img src={mainAgent.avatar_url} alt={mainAgent.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-3 h-3 text-slate-400" />
                            )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">{mainAgent?.name || 'Sin asignar'}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(project.started_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <button
                    onClick={onToggle}
                    className={`w-full mt-2 py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${isExpanded ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                    {isExpanded ? <><ChevronDown className="w-4 h-4" /> Ocultar Tareas</> : <><ChevronRight className="w-4 h-4" /> Ver Detalles</>}
                </button>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-black/20 border-t border-white/5"
                    >
                        <div className="p-4 space-y-2">
                            {projectTasks.length === 0 ? (
                                <p className="text-[10px] text-slate-600 italic text-center py-2 uppercase tracking-tight">Traduciendo objetivos en tareas individuales...</p>
                            ) : (
                                projectTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-lg">
                                        {task.status === 'completed' ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                        ) : task.status === 'in_progress' ? (
                                            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
                                        ) : (
                                            <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[11px] font-medium truncate ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                                {task.title}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function MisionesFallback() {
    // Ejemplo de cómo se vería cuando está cargado pero vacío
    const dummyProjects: any[] = [
        { id: 'd1', name: 'Optimización de Memoria Jarvis', status: 'running', progress_pct: 65, started_at: new Date().toISOString(), agents: [{ name: 'Ada' }] },
        { id: 'd2', name: 'Módulo de Voz Fase 5', status: 'planning', progress_pct: 12, started_at: new Date().toISOString(), agents: [{ name: 'J.A.R.V.I.S.' }] }
    ]

    return (
        <div className="w-full opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-white/10">
                    <Rocket className="w-4 h-4 text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-500 tracking-tight uppercase">Control de Proyectos</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dummyProjects.map(p => (
                    <ProjectCard key={p.id} project={p} isExpanded={false} onToggle={() => { }} projectTasks={[]} />
                ))}
            </div>
            <p className="mt-4 text-center text-[10px] text-slate-600 uppercase tracking-widest font-mono">El sistema está listo para monitorizar nuevas misiones. No se detectan proyectos activos en este momento.</p>

        </div>
    )
}
