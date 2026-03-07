'use client'

import { motion } from 'framer-motion'
import {
    LayoutDashboard, Activity, Settings, Bot,
    Users, Zap, Building2, ChevronRight, Folder
} from 'lucide-react'


interface SidebarProps {
    activeSection: string
    onSectionChange: (section: string) => void
    agentCount: number
    activeAgents: number
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'office', label: 'Oficina', icon: Activity },
    { id: 'resources', label: 'Recursos', icon: Folder },

    { id: 'connections', label: 'Conexiones API', icon: Zap },
    { id: 'settings', label: 'Configuración', icon: Settings },
]


import { ProjectSelector } from '@/components/ProjectSelector'

export function Sidebar({ activeSection, onSectionChange, agentCount, activeAgents }: SidebarProps) {
    return (
        <aside className="flex flex-col w-64 min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-white/5">
            {/* Logo */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Building2 className="w-5 h-5 text-white" />
                        <motion.div
                            className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-50"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-sm leading-tight">Agencia</h1>
                        <h1 className="text-indigo-400 font-bold text-sm leading-tight">Virtual IA</h1>
                    </div>
                </div>
            </div>

            {/* Selector de Proyecto */}
            <ProjectSelector />

            {/* Stats */}
            <div className="p-4 mx-3 mt-4 rounded-xl bg-white/5 border border-white/5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span className="text-2xl font-bold text-white">{agentCount}</span>
                        </div>
                        <p className="text-slate-500 text-xs">Agentes</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span className="text-2xl font-bold text-amber-400">{activeAgents}</span>
                        </div>
                        <p className="text-slate-500 text-xs">Activos</p>
                    </div>
                </div>
            </div>

            {/* Navegación */}
            <nav className="flex-1 p-3 mt-2 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeSection === item.id
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSectionChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${isActive
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                } ${item.id === 'office' ? 'font-mono uppercase tracking-wider text-xs font-bold' : 'font-medium'}`}
                        >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                            <span className="flex-1 text-left">{item.label}</span>
                            {isActive && (
                                <motion.div layoutId="sidebar-indicator">
                                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                                </motion.div>
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                        <p className="text-white text-xs font-medium">Sistema Activo</p>
                        <div className="flex items-center gap-1">
                            <motion.span
                                className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <p className="text-slate-500 text-xs">Realtime conectado</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
