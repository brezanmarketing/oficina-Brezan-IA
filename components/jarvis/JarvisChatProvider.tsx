'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export interface ActionResult {
  type: string
  status: 'pending' | 'running' | 'success' | 'error'
  description: string
  result?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'jarvis' | 'system'
  content: string
  timestamp: Date
  isThinking?: boolean
  actions?: ActionResult[]
  model?: string
}

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

export const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini Flash' },
  { id: 'gemini-2.5-pro',   label: 'Gemini Pro' },
  { id: 'gpt-4o',           label: 'GPT-4o' },
  { id: 'gpt-4o-mini',      label: 'GPT-4o Mini' },
]

interface JarvisChatContextValue {
  messages: ChatMessage[]
  input: string
  isThinking: boolean
  selectedModel: string
  autonomyMode: 'full' | 'safe' | 'confirm'
  setInput: React.Dispatch<React.SetStateAction<string>>
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>
  setAutonomyMode: React.Dispatch<React.SetStateAction<'full' | 'safe' | 'confirm'>>
  sendMessage: () => Promise<void>
  insertCommand: (cmd: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
}

const JarvisChatContext = createContext<JarvisChatContextValue | undefined>(undefined)

export function JarvisChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
  const [autonomyMode, setAutonomyMode] = useState<'full' | 'safe' | 'confirm'>('full')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [])

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

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const history = messages
        .filter(m => !m.isThinking && m.id !== 'welcome-0')
        .slice(-20)
        .map(m => ({ role: m.role === 'jarvis' ? 'assistant' : 'user', content: m.content }))

      const { createClient } = await import('@/lib/supabase/client')
      const supCli = createClient()
      const { data: pData } = await supCli.from('projects').select('id').eq('status', 'active').limit(1).single()

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          agentId: 'jarvis-system',
          model: selectedModel,
          history,
          autonomyLevel: autonomyMode,
          projectId: pData?.id,
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const insertCommand = useCallback((cmd: string) => {
    setInput(prev => prev ? `${prev} ${cmd} ` : `${cmd} `)
    textareaRef.current?.focus()
  }, [])

  const value: JarvisChatContextValue = {
    messages,
    input,
    isThinking,
    selectedModel,
    autonomyMode,
    setInput,
    setSelectedModel,
    setAutonomyMode,
    sendMessage,
    insertCommand,
    messagesEndRef,
    textareaRef,
    handleInputChange,
    handleKeyDown
  }

  return (
    <JarvisChatContext.Provider value={value}>
      {children}
    </JarvisChatContext.Provider>
  )
}

export function useJarvisChat() {
  const context = useContext(JarvisChatContext)
  if (context === undefined) {
    throw new Error('useJarvisChat must be used within a JarvisChatProvider')
  }
  return context
}
