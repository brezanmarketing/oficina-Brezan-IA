'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, ChevronDown, Check, FolderPlus, Loader2, Globe } from 'lucide-react'
import { useProject } from '@/context/ProjectContext'
import { CreateProjectModal } from '@/components/CreateProjectModal'

export function ProjectSelector() {
    const { projects, activeProjectId, setActiveProjectId, loading } = useProject()
    const [isOpen, setIsOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const activeProject = projects.find(p => p.id === activeProjectId)

    if (loading) {
        return (
            <div className="flex items-center justify-between p-3 mx-3 mt-4 rounded-xl bg-white/5 border border-white/5 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10" />
                    <div className="space-y-2">
                        <div className="h-3 w-20 bg-white/10 rounded" />
                        <div className="h-2 w-12 bg-white/10 rounded" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative mx-3 mt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 hover:border-white/20 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 group-hover:bg-indigo-500/30 transition-colors">
                        {activeProjectId ? <FolderGit2 className="w-4 h-4 text-indigo-400" /> : <Globe className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="text-left">
                        <p className="text-xs text-slate-400 font-medium">Vista Actual</p>
                        <p className="text-sm text-white font-semibold truncate max-w-[120px]">
                            {activeProjectId === null ? '🏢 Oficina Global' : (activeProject?.name || 'Seleccionar...')}
                        </p>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-2 p-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                        <div className="max-h-60 overflow-y-auto space-y-1 p-1 custom-scrollbar">
                            <button
                                onClick={() => {
                                    setActiveProjectId(null)
                                    setIsOpen(false)
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${activeProjectId === null
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className="flex items-center gap-2 truncate pr-4">
                                    <Globe className="w-4 h-4" />
                                    Oficina Global
                                </span>
                                {activeProjectId === null && <Check className="w-4 h-4 shrink-0" />}
                            </button>

                            {projects.length > 0 && <div className="h-px w-full bg-white/10 my-2" />}

                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => {
                                        setActiveProjectId(project.id)
                                        setIsOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${activeProjectId === project.id
                                        ? 'bg-indigo-500/20 text-indigo-300'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <span className="flex items-center gap-2 truncate pr-4">
                                        <FolderGit2 className="w-4 h-4" />
                                        {project.name}
                                    </span>
                                    {activeProjectId === project.id && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                            ))}
                        </div>
                        <div className="p-2 border-t border-white/10 mt-1">
                            <button
                                onClick={() => {
                                    setIsOpen(false)
                                    setIsCreateModalOpen(true)
                                }}
                                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Crear Proyecto
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
        </div>
    )
}
