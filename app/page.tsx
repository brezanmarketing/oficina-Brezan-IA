'use client'

import { useState } from 'react'
import JarvisSidebar, { type JarvisView } from '@/components/jarvis/JarvisSidebar'
import JarvisChat from '@/components/jarvis/JarvisChat'
import JarvisRightPanel from '@/components/jarvis/JarvisRightPanel'
import ProjectWorkspace from '@/components/jarvis/ProjectWorkspace'
import { FolderKanban, Users, Zap, BarChart3, Calendar, HardDrive, Link2, Cpu } from 'lucide-react'
import { SystemStatus } from '@/components/SystemStatus'


/* ─── Placeholder views ────────────────────────────────── */
function PlaceholderView({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center circuit-bg"
      style={{ background: 'var(--surface)' }}
    >
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '20px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.15)',
          }}
        >
          <Icon size={32} style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
        </div>
        <h2
          className="font-display font-bold"
          style={{ fontSize: 22, color: 'var(--on-surface)', marginBottom: 8, letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--on-surface-dim)', maxWidth: 300 }}>{subtitle}</p>
        <div
          style={{
            marginTop: 24,
            padding: '8px 20px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--primary)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
          }}
        >
          <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
          Próximamente en desarrollo
        </div>
      </div>
    </div>
  )
}

/* ─── View Routing ─────────────────────────────────────── */
const VIEW_CONFIG: Record<JarvisView, { icon: React.ElementType; title: string; subtitle: string } | null> = {
  jarvis:       null, // Special case — full layout
  projects:     { icon: FolderKanban, title: 'War Rooms',        subtitle: 'Gestión de proyectos con IA y equipos autónomos' },
  agents:       { icon: Users,        title: 'Equipo de Agentes', subtitle: 'Gestiona tu fuerza laboral de inteligencia artificial' },
  automations:  { icon: Zap,          title: 'Automatizaciones',  subtitle: 'Flujos de trabajo autónomos ejecutados por Jarvis' },
  resources:    { icon: HardDrive,    title: 'Recursos',          subtitle: 'Archivos, documentos y datos de la oficina' },
  calendar:     { icon: Calendar,     title: 'Calendario',        subtitle: 'Agenda inteligente gestionada por Jarvis' },
  connections:  { icon: Link2,        title: 'Conexiones',        subtitle: 'Integraciones con APIs, SaaS y servicios externos' },
  analytics:    { icon: BarChart3,    title: 'Analíticas',        subtitle: 'Métricas de rendimiento e inteligencia de negocio' },
}

/* ─── Main App ─────────────────────────────────────────── */
export default function OficinaBrezanIA() {
  const [activeView, setActiveView] = useState<JarvisView>('jarvis')

  const isJarvisView = activeView === 'jarvis'
  const isProjectView = activeView === 'projects'
  const placeholder = VIEW_CONFIG[activeView]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--void)',
        position: 'relative',
      }}
    >
      {/* Ambient glow overlay */}
      <div className="ambient-orb-top" aria-hidden="true" />
      
      {/* ── System Status Bar ── */}
      <div style={{ zIndex: 10 }}>
        <SystemStatus />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <JarvisSidebar activeView={activeView} onNavigate={setActiveView} />

        {/* ── Main Content ── */}
        <main
        className="flex-1 flex circuit-bg"
        style={{
          overflow: 'hidden',
          background: 'var(--surface)',
          position: 'relative',
        }}
      >
        {isJarvisView ? (
          <>
            {/* Jarvis Chat — full layout */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ zIndex: 1 }}>
              <JarvisChat />
            </div>
            {/* Right Panel */}
            <JarvisRightPanel />
          </>
        ) : isProjectView ? (
          <ProjectWorkspace />
        ) : (
          /* Placeholder views */
          placeholder && <PlaceholderView {...placeholder} />
        )}
      </main>
      </div>
    </div>
  )
}
