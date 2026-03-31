'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FolderKanban, Users, Clock, ExternalLink, Brain, Activity, Zap
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
  avatar_config?: { gradient?: string }
}
interface Memory {
  id: string
  type: string
  content: string
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
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [teamAgents, setTeamAgents]       = useState<Agent[]>([])
  const [memories, setMemories]           = useState<Memory[]>([])
  const [activity, setActivity]           = useState<ActivityItem[]>([])
  const supabase = createClient()

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
  }, [])

  async function loadData() {
    // Load active project
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, description, status')
      .eq('status', 'active')
      .limit(1)
      .single()

    if (projects) setActiveProject({ ...projects, progress: Math.floor(Math.random() * 50) + 30 })

    // Load agents (excluding Jarvis system agent)
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, role, status, avatar_config')
      .neq('name', 'J.A.R.V.I.S.')
      .limit(4)
      .order('created_at', { ascending: false })

    if (agents) setTeamAgents(agents)

    // Load recent memory
    const { data: mem } = await supabase
      .from('jarvis_memory')
      .select('id, type, content, created_at')
      .order('created_at', { ascending: false })
      .limit(3)

    if (mem) setMemories(mem)
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
          <FolderKanban size={12} style={{ color: 'var(--on-surface-dim)' }} />
        </div>

        {activeProject ? (
          <div
            className="card-hud"
            style={{ padding: 14, cursor: 'pointer', borderLeft: '2px solid var(--primary-container)' }}
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
                {activeProject.description.slice(0, 80)}...
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
              <ExternalLink size={10} /> Abrir War Room
            </button>
          </div>
        ) : (
          <div className="card-hud" style={{ padding: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--on-surface-dim)', margin: 0 }}>Sin proyecto activo</p>
            <button className="btn-primary" style={{ fontSize: 11, padding: '6px 12px', marginTop: 8 }}>
              + Nuevo Proyecto
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
