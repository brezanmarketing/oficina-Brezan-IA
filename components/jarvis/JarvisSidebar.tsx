'use client'

import { useState } from 'react'
import {
  Cpu, FolderKanban, Users, Zap, HardDrive,
  Calendar, Link2, BarChart3, Settings, LogOut
} from 'lucide-react'

export type JarvisView =
  | 'jarvis'
  | 'projects'
  | 'agents'
  | 'automations'
  | 'resources'
  | 'calendar'
  | 'connections'
  | 'analytics'

interface NavItem {
  id: JarvisView
  icon: React.ElementType
  label: string
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { id: 'jarvis',       icon: Cpu,           label: 'J.A.R.V.I.S.' },
  { id: 'projects',     icon: FolderKanban,  label: 'War Rooms' },
  { id: 'agents',       icon: Users,         label: 'Agentes' },
  { id: 'automations',  icon: Zap,           label: 'Automatizaciones' },
  { id: 'resources',    icon: HardDrive,     label: 'Recursos' },
  { id: 'calendar',     icon: Calendar,      label: 'Calendario' },
  { id: 'connections',  icon: Link2,         label: 'Conexiones' },
  { id: 'analytics',    icon: BarChart3,     label: 'Analíticas' },
]

interface Props {
  activeView: JarvisView
  onNavigate: (view: JarvisView) => void
}

export default function JarvisSidebar({ activeView, onNavigate }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <aside
      className="flex flex-col items-center py-4 gap-1 relative z-20"
      style={{
        width: '64px',
        background: 'var(--sidebar)',
        borderRight: '1px solid rgba(70, 69, 84, 0.25)',
        flexShrink: 0,
      }}
    >
      {/* Logo mark */}
      <div className="mb-6 mt-1 relative">
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #4cd7f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
          }}
        >
          <span className="font-display font-bold text-white" style={{ fontSize: '16px', letterSpacing: '-0.05em' }}>B</span>
        </div>
        {/* Online dot */}
        <span
          className="status-dot status-online"
          style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8 }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 w-full px-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          const isHovered = hovered === item.id

          return (
            <div key={item.id} className="relative w-full flex justify-center">
              {/* Tooltip */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    left: '52px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'var(--surface-highest)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--on-surface)',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    pointerEvents: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {item.label}
                  {/* Arrow */}
                  <span style={{
                    position: 'absolute',
                    left: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 0,
                    height: 0,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderRight: '5px solid var(--surface-highest)',
                  }} />
                </div>
              )}

              <button
                onClick={() => onNavigate(item.id)}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
                className={`sidebar-icon ${isActive ? 'active' : ''}`}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={item.id === 'jarvis' ? 20 : 18} strokeWidth={isActive ? 2 : 1.5} />
                {/* Jarvis special indicator */}
                {item.id === 'jarvis' && (
                  <span
                    className="status-dot status-thinking"
                    style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6 }}
                  />
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 w-full px-2 mt-auto">
        <div style={{ width: '100%', height: '1px', background: 'rgba(70,69,84,0.3)', margin: '8px 0' }} />
        <button className="sidebar-icon" title="Ajustes" aria-label="Ajustes">
          <Settings size={16} strokeWidth={1.5} />
        </button>
        <button className="sidebar-icon" title="Salir" aria-label="Salir">
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}
