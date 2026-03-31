'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Zap, MemoryStick, ListTodo, Users, Search,
  FolderKanban, ChevronDown, Loader2, CheckCircle2,
  AlertCircle, Terminal, Brain, Cpu
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────── */
export interface ChatMessage {
  id: string
  role: 'user' | 'jarvis' | 'system'
  content: string
  timestamp: Date
  isThinking?: boolean
  actions?: ActionResult[]
  model?: string
}

interface ActionResult {
  type: string
  status: 'pending' | 'running' | 'success' | 'error'
  description: string
  result?: string
}

const QUICK_COMMANDS = [
  { label: '/proyecto', icon: FolderKanban, hint: 'Crear o gestionar proyecto' },
  { label: '/recuerda', icon: Brain,        hint: 'Memorizar información clave' },
  { label: '/tarea',    icon: ListTodo,     hint: 'Asignar tarea a agente' },
  { label: '/agentes',  icon: Users,        hint: 'Consultar o gestionar agentes' },
  { label: '/búsqueda', icon: Search,       hint: 'Buscar en web o recursos' },
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-0',
  role: 'jarvis',
  content: `Sistemas en línea. Buenas tardes, CEO.

Soy J.A.R.V.I.S., su sistema central de inteligencia artificial. Todos los subsistemas están operativos y estoy ejecutando en **Modo Autonomía Total** — puedo actuar, ejecutar y completar objetivos sin requerir confirmación para cada paso.

¿En qué trabaja hoy? Puedo gestionar proyectos, coordinar el equipo de agentes, analizar datos, redactar contenido o explorar nuevas oportunidades de negocio.

Aguardo su directiva.`,
  timestamp: new Date(),
  model: 'Gemini Flash'
}

const MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini Flash' },
  { id: 'gemini-2.5-pro',   label: 'Gemini Pro' },
  { id: 'gpt-4o',           label: 'GPT-4o' },
  { id: 'gpt-4o-mini',      label: 'GPT-4o Mini' },
]

/* ─── Subcomponents ──────────────────────────────────── */
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 p-4 msg-jarvis" style={{ borderRadius: '0 12px 12px 12px', maxWidth: 200 }}>
      <div className="flex items-end gap-1" style={{ height: 20 }}>
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
        <div className="waveform-bar" />
      </div>
      <span style={{ fontSize: 12, color: 'var(--on-surface-dim)', fontFamily: "'Space Grotesk', sans-serif" }}>
        procesando...
      </span>
    </div>
  )
}

function ActionCard({ action }: { action: ActionResult }) {
  const icons = {
    pending: <Loader2 size={12} className="text-dim" />,
    running: <Loader2 size={12} className="text-secondary animate-spin" />,
    success: <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />,
    error:   <AlertCircle size={12} style={{ color: 'var(--danger)' }} />,
  }
  const colors = {
    pending: 'var(--on-surface-dim)',
    running: 'var(--secondary)',
    success: 'var(--success)',
    error:   'var(--danger)',
  }
  return (
    <div className="action-card mt-2">
      <div className="action-card-header">
        {icons[action.status]}
        <Terminal size={11} style={{ color: 'var(--primary)' }} />
        <span className="font-display" style={{ fontSize: 11, color: colors[action.status], fontWeight: 600 }}>
          {action.type}
        </span>
      </div>
      <div style={{ padding: '8px 14px' }}>
        <p style={{ fontSize: 12, color: 'var(--on-surface-dim)', margin: 0 }}>{action.description}</p>
        {action.result && (
          <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4, margin: '4px 0 0' }}>
            {action.result}
          </p>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isJarvis = msg.role === 'jarvis'
  const isSystem = msg.role === 'system'
  const isUser   = msg.role === 'user'

  if (msg.isThinking) {
    return (
      <div className="flex gap-3 animate-float-up" style={{ alignItems: 'flex-start' }}>
        <JarvisAvatar small />
        <ThinkingIndicator />
      </div>
    )
  }

  if (isSystem) {
    return (
      <div className="flex justify-center animate-float-up">
        <div className="msg-system px-4 py-2 text-xs font-display tracking-wide">
          ⚡ {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex gap-3 animate-float-up ${isUser ? 'flex-row-reverse' : ''}`}
      style={{ alignItems: 'flex-start' }}
    >
      {isJarvis && <JarvisAvatar small />}
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--on-surface-dim)', flexDirection: isUser ? 'row-reverse' : 'row' }}>
          <span className="font-display font-semibold" style={{ color: isJarvis ? 'var(--primary)' : 'var(--secondary)' }}>
            {isJarvis ? 'J.A.R.V.I.S.' : 'CEO'}
          </span>
          {msg.model && <span style={{ color: 'var(--on-surface-dim)', fontSize: 10 }}>· {msg.model}</span>}
          <span suppressHydrationWarning>{msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Content */}
        <div className={isJarvis ? 'msg-jarvis' : 'msg-user'} style={{ padding: '12px 16px' }}>
          <div
            style={{ fontSize: 14, lineHeight: '1.6', whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" }}
            dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--primary);font-weight:600">$1</strong>')
                .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace;color:var(--secondary)">$1</code>')
            }}
          />
        </div>

        {/* Action cards */}
        {msg.actions?.map((action, i) => (
          <ActionCard key={i} action={action} />
        ))}
      </div>
    </div>
  )
}

function JarvisAvatar({ small = false }: { small?: boolean }) {
  const size = small ? 32 : 48
  return (
    <div
      className="jarvis-ring"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0d1530, #1a1f3a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
        }}
      >
        <Cpu size={small ? 14 : 20} style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────── */
export default function JarvisChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash')
  const [autonomyMode, setAutonomyMode] = useState<'full' | 'safe' | 'confirm'>('full')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isThinking) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    const thinkingMsg: ChatMessage = {
      id: `thinking-${Date.now()}`,
      role: 'jarvis',
      content: '',
      timestamp: new Date(),
      isThinking: true,
    }

    setMessages(prev => [...prev, userMsg, thinkingMsg])
    setInput('')
    setIsThinking(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const history = messages
        .filter(m => !m.isThinking && m.id !== 'welcome-0')
        .slice(-20)
        .map(m => ({ role: m.role === 'jarvis' ? 'assistant' : 'user', content: m.content }))

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          agentId: 'jarvis-system',
          model: selectedModel,
          history,
          autonomyLevel: autonomyMode,
        }),
      })

      const data = await res.json()

      const jarvisMsg: ChatMessage = {
        id: `jarvis-${Date.now()}`,
        role: 'jarvis',
        content: data.response || data.message || data.error || 'Sin respuesta del sistema.',
        timestamp: new Date(),
        model: MODELS.find(m => m.id === selectedModel)?.label,
      }

      setMessages(prev => prev.filter(m => !m.isThinking).concat(jarvisMsg))
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Error de conexión con el sistema. Reintentando...',
        timestamp: new Date(),
      }
      setMessages(prev => prev.filter(m => !m.isThinking).concat(errorMsg))
    } finally {
      setIsThinking(false)
    }
  }, [input, isThinking, messages, selectedModel, autonomyMode])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const insertCommand = (cmd: string) => {
    setInput(prev => prev ? `${prev} ${cmd} ` : `${cmd} `)
    textareaRef.current?.focus()
  }

  const autonomyLabels = {
    full:    { label: 'Autonomía TOTAL', color: 'var(--secondary)', bg: 'rgba(6,182,212,0.08)' },
    safe:    { label: 'Modo Seguro',     color: 'var(--warning)',   bg: 'rgba(251,191,36,0.05)' },
    confirm: { label: 'Confirmación',   color: 'var(--on-surface-dim)', bg: 'rgba(99,102,241,0.05)' },
  }
  const currentAutonomy = autonomyLabels[autonomyMode]

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-low)',
          flexShrink: 0,
        }}
      >
        {/* Jarvis Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <JarvisAvatar />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2
                className="font-display font-bold"
                style={{ fontSize: 16, color: 'var(--on-surface)', letterSpacing: '-0.02em', margin: 0 }}
              >
                J.A.R.V.I.S.
              </h2>
              <span className="status-dot status-thinking" style={{ width: 7, height: 7 }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--on-surface-dim)', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
              Director de IA · {currentAutonomy.label}
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Autonomy toggle */}
          <button
            onClick={() => setAutonomyMode(m => m === 'full' ? 'safe' : m === 'safe' ? 'confirm' : 'full')}
            style={{
              background: currentAutonomy.bg,
              border: `1px solid ${currentAutonomy.color}30`,
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: currentAutonomy.color,
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Zap size={11} />
            {currentAutonomy.label}
          </button>

          {/* Model selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="model-selector"
              style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: '28px' }}
            >
              {MODELS.find(m => m.id === selectedModel)?.label}
              <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} />
            </button>
            {showModelDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: 'var(--surface-highest)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  zIndex: 50,
                  minWidth: 140,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                {MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false) }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 14px',
                      textAlign: 'left',
                      background: selectedModel === model.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: selectedModel === model.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                      fontSize: 12,
                      fontWeight: selectedModel === model.id ? 700 : 400,
                      fontFamily: "'Space Grotesk', sans-serif",
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      border: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = selectedModel === model.id ? 'rgba(99,102,241,0.12)' : 'transparent')}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface-low)' }}>

        {/* Quick commands */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 16px 6px',
            overflowX: 'auto',
          }}
          className="scrollbar-hide"
        >
          {QUICK_COMMANDS.map(cmd => (
            <button
              key={cmd.label}
              onClick={() => insertCommand(cmd.label)}
              className="chip-command"
              title={cmd.hint}
              style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
            >
              <cmd.icon size={10} />
              {cmd.label}
            </button>
          ))}
        </div>

        {/* Textarea + Send */}
        <div style={{ padding: '6px 16px 14px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una orden a Jarvis... (Enter para enviar, Shift+Enter para nueva línea)"
            rows={1}
            className="chat-input flex-1"
            style={{
              padding: '12px 16px',
              fontSize: 14,
              lineHeight: '1.5',
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            id="jarvis-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className="btn-primary"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: (!input.trim() || isThinking) ? 0.4 : 1,
              cursor: (!input.trim() || isThinking) ? 'not-allowed' : 'pointer',
            }}
          >
            {isThinking
              ? <Loader2 size={18} className="animate-spin" style={{ color: 'white' }} />
              : <Send size={18} style={{ color: 'white' }} />
            }
          </button>
        </div>

        {/* Status bar */}
        <div
          className={`autonomy-bar ${autonomyMode === 'full' ? 'active' : ''}`}
          style={{ background: currentAutonomy.bg }}
        >
          <Zap size={12} style={{ color: currentAutonomy.color }} />
          <span
            className="font-display"
            style={{ fontSize: 11, fontWeight: 600, color: currentAutonomy.color, letterSpacing: '0.03em' }}
          >
            {currentAutonomy.label} activada
          </span>
          <span style={{ fontSize: 11, color: 'var(--on-surface-dim)', marginLeft: 'auto' }}>
            {isThinking ? 'Procesando...' : 'Listo'} · {MODELS.find(m => m.id === selectedModel)?.label}
          </span>
        </div>
      </div>
    </div>
  )
}
