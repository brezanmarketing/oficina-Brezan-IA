'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Bot, Sparkles, Search, Filter,
  LayoutGrid, Activity, Settings, Cpu, Loader2, ShieldAlert, Target, Users, Trash2
} from 'lucide-react'
import { AgentCard } from '@/components/AgentCard'
import { ActivityFeed } from '@/components/ActivityFeed'
import { HireModal } from '@/components/HireModal'
import { Sidebar } from '@/components/Sidebar'
import { FinanceMonitor } from '@/components/FinanceMonitor'
import { OfficeMap } from '@/components/OfficeMap'
import { SystemStatus } from '@/components/SystemStatus'
import { MisionesActivas } from '@/components/MisionesActivas'

import { useAgents } from '@/hooks/useAgents'
import { useOrchestrator } from '@/hooks/useOrchestrator'
import { createClient } from '@/lib/supabase/client'
import { CreateTaskModal } from '@/components/CreateTaskModal'
import { HandoffVisualizer } from '@/components/HandoffVisualizer'
import { AgentInspector } from '@/components/AgentInspector'
import { MissionManager } from '@/components/MissionManager'
import { DirectChatPanel } from '@/components/DirectChatPanel'
import { CompanyDirective } from '@/components/CompanyDirective'
import { ProjectTeamManager } from '@/components/ProjectTeamManager'
import { useProject } from '@/context/ProjectContext'
import JarvisConnections from './connections/page'

export default function HomePage() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isHireModalOpen, setIsHireModalOpen] = useState(false)
  const [isMissionManagerOpen, setIsMissionManagerOpen] = useState(false)
  const [isDirectiveOpen, setIsDirectiveOpen] = useState(false)
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedAgentForInspection, setSelectedAgentForInspection] = useState<any | null>(null)
  const [selectedAgentForChat, setSelectedAgentForChat] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const { activeProjectId, deleteProject, projects: allProjectsContext } = useProject()
  const { agents, loading, refetch } = useAgents()
  useOrchestrator(agents, activeProjectId)
  const supabase = createClient()

  const activeAgents = agents.filter((a) => a.status === 'working' || a.status === 'thinking').length

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || a.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleDeleteAgent = async (id: string) => {
    await supabase.from('agents').delete().eq('id', id)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        agentCount={agents.length}
        activeAgents={activeAgents}
      />

      {/* Visualización de Cadena de Mando (Líneas SVG) */}
      <HandoffVisualizer agents={agents} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-2xl flex items-center gap-2">
                {activeSection === 'dashboard' && (
                  <><LayoutGrid className="w-6 h-6 text-indigo-400" /> Dashboard</>
                )}
                {activeSection === 'office' && (
                  <><Activity className="w-6 h-6 text-rose-400" /> Oficina</>
                )}
                {activeSection === 'settings' && (
                  <><Settings className="w-6 h-6 text-slate-400" /> Configuración</>
                )}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {activeSection === 'dashboard' && `${agents.length} agentes contratados · ${activeAgents} activos ahora`}
                {activeSection === 'office' && 'Simulador de Oficina en vivo'}
                {activeSection === 'settings' && 'Configuración del sistema'}
              </p>
            </div>

            {activeSection === 'dashboard' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsDirectiveOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-semibold rounded-xl transition-all border border-amber-500/20"
                >
                  <Target className="w-4 h-4" />
                  Directiva
                </button>
                {activeProjectId && (
                  <>
                    <button
                      onClick={() => setIsTeamManagerOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-sm font-semibold rounded-xl transition-all border border-indigo-500/20 shadow-lg shadow-indigo-500/5 group"
                    >
                      <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
                      Asignar Equipo
                    </button>
                    <button
                      onClick={async () => {
                        const project = allProjectsContext.find(p => p.id === activeProjectId)
                        if (window.confirm(`¿Estás seguro de que quieres borrar el proyecto "${project?.name}"? Esta acción eliminará todo su contenido.`)) {
                          await deleteProject(activeProjectId)
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-semibold rounded-xl transition-all border border-red-500/20 shadow-lg shadow-red-500/5 group"
                    >
                      <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                      Borrar Proyecto
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsMissionManagerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all border border-white/10"
                >
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  Misiones Activas
                </button>
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Activity className="w-4 h-4" />
                  Nueva Misión
                </button>
                <button
                  onClick={() => setIsHireModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  Contratar Agente
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Sección 3: Estado del Sistema */}
        <SystemStatus />


        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <div className="p-6">
            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Trabajando"
                value={agents.filter((a) => a.status === 'working').length}
                color="from-amber-500 to-orange-500"
                icon={Cpu}
              />
              <StatCard
                label="Pensando"
                value={agents.filter((a) => a.status === 'thinking').length}
                color="from-indigo-500 to-purple-500"
                icon={Sparkles}
              />
              <StatCard
                label="En reposo"
                value={agents.filter((a) => a.status === 'idle' || a.status === 'paused').length}
                color="from-slate-500 to-slate-600"
                icon={Bot}
              />
            </div>

            {/* Filtros y búsqueda */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar agente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                {['all', 'idle', 'thinking', 'working', 'paused'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }`}
                  >
                    {s === 'all' ? 'Todos' : s === 'idle' ? 'Reposo' : s === 'thinking' ? 'Pensando' : s === 'working' ? 'Trabajando' : 'Pausado'}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout principal del Dashboard: Agentes a la izq, Finanzas a la der */}
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin sr-only" />
                      <p className="text-slate-400 text-sm">Cargando agentes...</p>
                    </div>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <EmptyState onHire={() => setIsHireModalOpen(true)} />
                ) : (
                  <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <AnimatePresence>
                      {filteredAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          onDelete={handleDeleteAgent}
                          onClick={() => setSelectedAgentForInspection(agent)}
                          onChat={(agent) => { setSelectedAgentForChat(agent); setIsChatOpen(true); }}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>

              {/* Columna derecha: Finance Monitor + Activity Feed */}
              <div className="w-[340px] sticky top-24 shrink-0 flex flex-col gap-6">
                <FinanceMonitor />
                <ActivityFeed />
              </div>
            </div>

            {/* Sección 1: Misiones Activas (Ocupa ancho completo) */}
            <div className="mt-12">
              <MisionesActivas />
            </div>

          </div>
        )}

        {/* Office Section */}
        {activeSection === 'office' && (
          <div className="p-6 h-[calc(100vh-73px)] overflow-hidden">
            <OfficeMap agents={agents} />
          </div>
        )}

        {/* Connections Section */}
        {activeSection === 'connections' && (
          <div className="p-6 h-[calc(100vh-73px)] overflow-hidden">
            <JarvisConnections />
          </div>
        )}

        {/* Settings Section */}
        {activeSection === 'settings' && (
          <div className="p-6">
            <SettingsPanel />
          </div>
        )}
      </main>

      {/* Modal de contratación */}
      <HireModal
        isOpen={isHireModalOpen}
        onClose={() => setIsHireModalOpen(false)}
        onAgentCreated={refetch}
      />

      {/* Modal de Tareas */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        agents={agents}
      />

      {/* Inspector de Trabajador */}
      <AgentInspector
        agent={selectedAgentForInspection}
        isOpen={!!selectedAgentForInspection}
        onClose={() => setSelectedAgentForInspection(null)}
        onUpdate={refetch}
      />

      {/* Gestor de Misiones */}
      <MissionManager
        isOpen={isMissionManagerOpen}
        onClose={() => setIsMissionManagerOpen(false)}
        agents={agents}
      />

      {/* Chat Directo */}
      <DirectChatPanel
        agent={selectedAgentForChat}
        allAgents={agents}
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false)
          setSelectedAgentForChat(null)
        }}
      />

      {/* Directiva Empresarial */}
      <CompanyDirective
        isOpen={isDirectiveOpen}
        onClose={() => setIsDirectiveOpen(false)}
      />

      <ProjectTeamManager
        isOpen={isTeamManagerOpen}
        onClose={() => setIsTeamManagerOpen(false)}
        onSaved={() => refetch()}
      />
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ElementType
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-5 flex items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-3xl font-bold text-white">{value}</div>
        <div className="text-slate-400 text-sm">{label}</div>
      </div>
    </motion.div>
  )
}

function EmptyState({ onHire }: { onHire: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-64 gap-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <Bot className="w-10 h-10 text-indigo-400" />
      </div>
      <div className="text-center">
        <h3 className="text-white font-semibold text-lg mb-1">
          {`La oficina está vacía`}
        </h3>
        <p className="text-slate-400 text-sm">
          Contrata tu primer agente de IA para comenzar
        </p>
      </div>
      <button
        onClick={onHire}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg"
      >
        <Plus className="w-4 h-4" />
        Contratar primer agente
      </button>
    </motion.div>
  )
}

function SettingsPanel() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Configuración de Supabase</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-slate-400 text-sm">Proyecto</span>
            <span className="text-white text-sm font-medium">Oficina Brezan IA</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-slate-400 text-sm">Realtime</span>
            <span className="text-green-400 text-sm font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Activo
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-400 text-sm">Región</span>
            <span className="text-white text-sm font-medium">us-west-2</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-2">API del Arquitecto</h3>
        <p className="text-slate-400 text-sm mb-3">
          Añade tu API key de Gemini en el archivo <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">.env.local</code> para activar la generación de agentes con IA real.
        </p>
        <code className="block bg-slate-800 text-emerald-400 text-xs p-3 rounded-lg">
          GEMINI_API_KEY=tu_api_key_aqui
        </code>
      </div>
    </div>
  )
}
