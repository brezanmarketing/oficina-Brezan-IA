'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Check, Loader2, Save, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProject } from '@/context/ProjectContext'
import { Agent } from '@/lib/types'

interface ProjectTeamManagerProps {
    isOpen: boolean
    onClose: () => void
    onSaved: () => void
}

export function ProjectTeamManager({ isOpen, onClose, onSaved }: ProjectTeamManagerProps) {
    const { activeProjectId, projects } = useProject()
    const [allAgents, setAllAgents] = useState<Agent[]>([])
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    const activeProject = projects.find(p => p.id === activeProjectId)

    useEffect(() => {
        if (!isOpen || !activeProjectId) return

        const loadData = async () => {
            setLoading(true)
            // Cargar todos los agentes disponibles en la Oficina Global
            const { data: agents } = await supabase.from('agents').select('*').order('name', { ascending: true })
            if (agents) setAllAgents(agents as Agent[])

            // Cargar los asignados actualmente al proyecto
            const { data: assignments } = await supabase
                .from('project_agents')
                .select('agent_id')
                .eq('project_id', activeProjectId)

            if (assignments) {
                setSelectedAgentIds(assignments.map(a => a.agent_id))
            }
            setLoading(false)
        }

        loadData()
    }, [isOpen, activeProjectId, supabase])

    const toggleAgent = (agentId: string) => {
        setSelectedAgentIds(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        )
    }

    const handleSave = async () => {
        if (!activeProjectId) return
        setSaving(true)

        // Borrar todos y reinsertar
        await supabase.from('project_agents').delete().eq('project_id', activeProjectId)

        if (selectedAgentIds.length > 0) {
            const inserts = selectedAgentIds.map(id => ({
                project_id: activeProjectId,
                agent_id: id
            }))
            await supabase.from('project_agents').insert(inserts)
        }

        setSaving(false)
        onSaved()
        onClose()
    }

    if (!activeProjectId) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Gestionar Equipo</h2>
                                    <p className="text-sm text-slate-400 truncate max-w-[250px]">
                                        Proyecto: {activeProject?.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                    <p className="text-slate-400 text-sm">Cargando agentes de la oficina...</p>
                                </div>
                            ) : allAgents.length === 0 ? (
                                <div className="text-center p-8 text-slate-400">
                                    No hay agentes contratados en la Oficina Global.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {allAgents.map(agent => {
                                        const isSelected = selectedAgentIds.includes(agent.id)
                                        return (
                                            <div
                                                key={agent.id}
                                                onClick={() => toggleAgent(agent.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                                                    : 'bg-slate-950/50 border-white/5 hover:border-white/10 hover:bg-slate-800'
                                                    }`}
                                            >
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-800 border border-white/10 shrink-0">
                                                    <Bot className={`w-5 h-5 ${agent.avatar_config?.color || 'text-indigo-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{agent.role}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600'
                                                    }`}>
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 bg-slate-900 shrink-0 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || loading}
                                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Equipo
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
