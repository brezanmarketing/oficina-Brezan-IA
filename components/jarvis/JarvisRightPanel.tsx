'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useJarvisChat } from './JarvisChatProvider'
import {
  FolderKanban, Users, Clock, ExternalLink, Brain, Activity, Zap, ChevronRight, Settings
} from 'lucide-react'

/* ─── Types ── */
interface Project {
  id: string
  name: string
  description: string | null
  status: string
  progress?: number
}
interface Agent {
  id: string
  name: string
  role: string
  status: string
  project_id?: string
  avatar_config?: { gradient?: string }
}
interface Memory {
  id: string
  type: string
  content: string
  project_id?: string
  created_at: string
}
interface ActivityItem {
  id: string
  text: string
  ts: Date
}

/* ─── Agent mini-avatar ── */
function AgentAvatar({ agent }: { agent: Agent }) {
  const gradient = agent.avatar_config?.gradient || 'from-indigo-500 to-purple-600'
  const initials = agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const statusClass = {
    active:  'status-online',
    working: 'status-working',
    idle:    'status-idle',
    thinking:'status-thinking',
  }[agent.status] || 'status-idle'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 30, height: 30,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {initials}
        </div>
        <span className={`status-dot ${statusClass}`} style={{ position: 'absolute', bottom: -2, right: -2, width: 7, height: 7 }} />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', margin: 0, lineHeight: 1.2, fontFamily: "'Space Grotesk', sans-serif" }}>
          {agent.name}
        </p>
        <p style={{ fontSize: 10, color: 'var(--on-surface-dim)', margin: 0, lineHeight: 1.2 }}>
          {agent.status === 'active' ? 'Disponible' : agent.status === 'working' ? 'Trabajando' : 'Inactivo'}
        </p>
      </div>
    </div>
  )
}

/* ─── Memory type icons ── */
const MEMORY_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  fact:            { color: 'var(--primary)',   bg: 'rgba(99,102,241,0.1)',   label: 'Dato' },
  preference:      { color: 'var(--secondary)', bg: 'rgba(6,182,212,0.1)',    label: 'Preferencia' },
  decision:        { color: 'var(--warning)',   bg: 'rgba(251,191,36,0.08)',  label: 'Decisión' },
  lesson:          { color: 'var(--success)',   bg: 'rgba(52,211,153,0.08)',  label: 'Aprendizaje' },
  project_context: { color: 'var(--tertiary)',  bg: 'rgba(182,197,251,0.08)', label: 'Contexto' },
}

/* ─── Main Component ── */
export default function JarvisRightPanel() {
  const { activeProjectId, setActiveProjectId } = useJarvisChat()
  const [projects, setProjects]           = useState<Project[]>([])
  const [teamAgents, setTeamAgents]       = useState<Agent[]>([])
  const [memories, setMemories]           = useState<Memory[]>([])
  const [activity, setActivity]           = useState<ActivityItem[]>([])
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isSelectingProject, setIsSelectingProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', directive: '' })
  const supabase = createClient()

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null
  , [projects, activeProjectId])

  useEffect(() => {
    loadData()
    // Simulate live activity
    const interval = setInterval(() => {
      const items = [
        'Jarvis analizando petición entrante...',
        'Sincronizando memoria con Supabase',
        'Verificando estado de los agentes',
        'Procesando contexto del proyecto activo',
        'Analizando datos de rendimiento',
      ]
      const randomItem: ActivityItem = {
        id: `act-${Date.now()}`,
        text: items[Math.floor(Math.random() * items.length)],
        ts: new Date(),
      }
      setActivity(prev => [randomItem, ...prev.slice(0, 4)])
    }, 8000)
    return () => clearInterval(interval)
  }, [activeProjectId])

  async function loadData() {
    // Load all projects
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, name, description, status')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (allProjects) {
      setProjects(allProjects.map(p => ({ ...p, progress: Math.floor(Math.random() * 50) + 30 })))
    }

    // Load agents for active project (or recent ones if no active)
    let query = supabase.from('agents').select('id, name, role, status, avatar_config, project_id')
    if (activeProjectId) {
      query = query.eq('project_id', activeProjectId)
    }
    const { data: agents } = await query
      .neq('name', 'J.A.R.V.I.S.')
      .limit(4)
      .order('created_at', { ascending: false })

    if (agents) setTeamAgents(agents)

    // Load recent memory (filtered by project if active)
    let memQuery = supabase.from('jarvis_memory').select('id, type, content, created_at, project_id')
    if (activeProjectId) {
      memQuery = memQuery.eq('project_id', activeProjectId)
    }
    const { data: mem } = await memQuery
      .order('created_at', { ascending: false })
      .limit(3)

    if (mem) setMemories(mem)
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProject.name.trim()) return

    const { data, error } = await supabase.from('projects').insert([
      {
        name: newProject.name,
        description: newProject.description,
        directive: newProject.directive,
        status: 'active'
      }
    ]).select()

    if (error) {
      console.error('Error creating project:', error)
      alert('Error en Supabase: ' + JSON.stringify(error))
    } else {
      setIsCreatingProject(false)
      setNewProject({ name: '', description: '', directive: '' })
      if (data && data[0]) {
        setActiveProjectId(data[0].id)
      }
      await loadData()
    }
  }

  const statusLabel: Record<string, { label: string; class: string }> = {
    active:   { label: 'ACTIVO',   class: 'badge-running' },
    planning: { label: 'PLANIF.', class: 'badge-planning' },
    paused:   { label: 'PAUSADO', class: 'badge-paused' },
    done:     { label: 'COMPLETO', class: 'badge-completed' },
  }

  return (
    <div
      className="flex flex-col overflow-y-auto custom-scrollbar"
      style={{
        width: 300,
        flexShrink: 0,
        background: 'var(--sidebar)',
        borderLeft: '1px solid rgba(70, 69, 84, 0.25)',
        padding: '16px 14px',
        gap: 12,
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {/* ── War Room Activo ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span
            className="font-display"
            style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            War Room Activo
          </span>
          <div className="flex gap-2">
            <button onClick={() => setIsSelectingProject(!isSelectingProject)} className="hover:text-primary transition-colors">
              <FolderKanban size={12} style={{ color: activeProjectId ? 'var(--primary)' : 'var(--on-surface-dim)' }} />
            </button>
          </div>
        </div>

        {isCreatingProject ? (
          <div className="card-hud" style={{ padding: 14 }}>
            <form onSubmit={handleCreateProject} className="flex flex-col gap-3">
              <p className="font-display font-bold text-white text-xs text-center border-b border-white/5 pb-2">NUEVO PROYECTO</p>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-mono text-gray-400">Nombre</label>
                <input required autoFocus value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" placeholder="Ej. Jarvis v2.0" />
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-mono text-gray-400">Descripción (Opcional)</label>
                <input value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" placeholder="Contexto general" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-mono text-indigo-400 flex items-center justify-between">
                  Directiva Principal <Zap size={8} />
                </label>
                <textarea required value={newProject.directive} onChange={e => setNewProject({...newProject, directive: e.target.value})} rows={3} className="bg-black/40 border border-indigo-500/30 rounded px-2 py-1.5 text-xs text-indigo-100 outline-none focus:border-indigo-500 resize-none" placeholder="Instrucción central para todos los agentes. Ej: 'Rediseñar el dashboard sin romper features existentes.'" />
              </div>

              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setIsCreatingProject(false)} className="flex-1 bg-white/5 hover:bg-white/10 rounded py-1.5 text-[10px] text-gray-300 transition-colors uppercase font-bold tracking-wider">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 rounded py-1.5 text-[10px] text-white transition-colors uppercase font-bold tracking-wider" style={{boxShadow: '0 0 10px rgba(99,102,241,0.3)'}}>Iniciar</button>
              </div>
            </form>
          </div>
        ) : isSelectingProject ? (
          <div className="card-hud overflow-hidden flex flex-col gap-1" style={{ padding: '8px 4px' }}>
            <p className="px-3 py-1 text-[9px] font-bold text-indigo-400 tracking-widest uppercase">Seleccionar War Room</p>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar px-2">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProjectId(p.id)
                    setIsSelectingProject(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center justify-between group transition-all ${activeProjectId === p.id ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <div>
                    <p className={`text-xs font-semibold ${activeProjectId === p.id ? 'text-indigo-400' : 'text-white'}`}>{p.name}</p>
                    <p className="text-[10px] text-gray-500 truncate w-40">{p.status}</p>
                  </div>
                  <ChevronRight size={14} className={`${activeProjectId === p.id ? 'text-indigo-500' : 'text-gray-600 opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))}
              <button 
                onClick={() => { setIsCreatingProject(true); setIsSelectingProject(false); }}
                className="w-full text-center py-2 text-[10px] font-bold text-gray-400 hover:text-white border-t border-white/5 mt-1"
              >
                + NUEVO PROYECTO
              </button>
            </div>
          </div>
        ) : activeProject ? (
          <div
            className="card-hud"
            style={{ padding: 14, cursor: 'pointer', borderLeft: '2px solid var(--primary-container)' }}
            onClick={() => setIsSelectingProject(true)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <p
                className="font-display font-semibold"
                style={{ fontSize: 13, color: 'var(--on-surface)', margin: 0, lineHeight: 1.3 }}
              >
                {activeProject.name}
              </p>
              <span className={statusLabel[activeProject.status]?.class || 'badge-planning'}>
                {statusLabel[activeProject.status]?.label || 'PLANIF.'}
              </span>
            </div>
            {activeProject.description && (
              <p style={{ fontSize: 11, color: 'var(--on-surface-dim)', margin: '0 0 10px', lineHeight: 1.4 }}>
                {activeProject.description.length > 80 ? activeProject.description.slice(0, 80) + '...' : activeProject.description}
              </p>
            )}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--on-surface-dim)', fontFamily: "'Space Grotesk', sans-serif" }}>Progreso Global</span>
                <span className="font-display font-bold" style={{ fontSize: 11, color: 'var(--primary)' }}>
                  {activeProject.progress}%
                </span>
              </div>
              <div className="progress-hud">
                <div className="progress-hud-fill" style={{ width: `${activeProject.progress}%` }} />
              </div>
            </div>
            <button
              className="btn-ghost"
              style={{ fontSize: 11, padding: '5px 10px', width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <Settings size={10} /> Configurar War Room
            </button>
          </div>
        ) : (
          <div className="card-hud" style={{ padding: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--on-surface-dim)', margin: 0 }}>Sin proyecto activo</p>
            <button onClick={() => setIsCreatingProject(true)} className="btn-primary w-full flex items-center justify-center" style={{ fontSize: 11, padding: '6px 12px', marginTop: 10 }}>
              + Iniciar War Room
            </button>
          </div>
        )}
      </section>

      {/* ── Equipo Asignado ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span
            className="font-display"
            style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Equipo Asignado
          </span>
          <Users size={12} style={{ color: 'var(--on-surface-dim)' }} />
        </div>

        {teamAgents.length > 0 ? (
          <div className="card-hud" style={{ padding: '8px 14px' }}>
            {teamAgents.map(agent => (
              <AgentAvatar key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="card-hud" style={{ padding: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--on-surface-dim)', margin: 0, textAlign: 'center' }}>
              Sin agentes asignados
            </p>
          </div>
        )}
      </section>

      {/* ── Memoria Reciente ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span
            className="font-display"
            style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Memoria Reciente
          </span>
          <Brain size={12} style={{ color: 'var(--on-surface-dim)' }} />
        </div>

        <div className="card-hud" style={{ padding: '6px 14px' }}>
          {memories.length > 0 ? memories.map(mem => {
            const cfg = MEMORY_TYPE_CONFIG[mem.type] || MEMORY_TYPE_CONFIG.fact
            return (
              <div key={mem.id} className="memory-item">
                <div className="memory-icon" style={{ background: cfg.bg }}>
                  <Brain size={12} style={{ color: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--on-surface)', margin: '0 0 2px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {mem.content}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: cfg.color, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em' }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--on-surface-dim)' }}>
                      {new Date(mem.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            )
          }) : (
            <p style={{ fontSize: 11, color: 'var(--on-surface-dim)', textAlign: 'center', padding: '8px 0' }}>
              Sin memorias registradas aún
            </p>
          )}
        </div>
      </section>

      {/* ── Actividad en Vivo ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span
            className="font-display"
            style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Actividad en Vivo
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span className="animate-pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            <Activity size={12} style={{ color: 'var(--on-surface-dim)' }} />
          </div>
        </div>

        <div className="card-hud" style={{ padding: '6px 14px' }}>
          {activity.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--on-surface-dim)', textAlign: 'center', padding: '8px 0' }}>
              Monitoreando...
            </p>
          )}
          {activity.map(item => (
            <div key={item.id} className="activity-item">
              <Zap size={9} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
