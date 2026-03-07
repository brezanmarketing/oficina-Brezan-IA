'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, User, Loader2, Play, CheckCircle, XCircle, Zap } from 'lucide-react'
import { Agent } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useProject } from '@/context/ProjectContext'

interface DirectChatPanelProps {
    agent: Agent | null
    isOpen: boolean
    onClose: () => void
    allAgents?: Agent[]
}

type AgentAction = { command: string; params: Record<string, string> }

type Message = {
    id: string
    role: 'user' | 'agent' | 'system'
    content: string
    rawContent?: string       // respuesta original (con [[ACTION: ...]] incluido)
    actions?: AgentAction[]   // acciones parseadas listas para ejecutar
    actionStatus?: 'pending' | 'executing' | 'done' | 'error'
}

// ─── Parser de Acciones ──────────────────────────────────────────────────────
function parseActionsFromText(text: string): AgentAction[] {
    const regex = /\[\[ACTION:\s*(\w+)\s*\|([\s\S]*?)\]\]/g
    const actions: AgentAction[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
        const command = match[1].trim()
        const rawParams = match[2].split('|')
        const params: Record<string, string> = {}
        for (const raw of rawParams) {
            const eqIdx = raw.indexOf('=')
            if (eqIdx > -1) {
                params[raw.slice(0, eqIdx).trim()] = raw.slice(eqIdx + 1).trim()
            }
        }
        actions.push({ command, params })
    }
    return actions
}

// Quita los bloques [[ACTION: ...]] del texto visible al usuario
function cleanTextForDisplay(text: string): string {
    return text.replace(/\[\[ACTION:[\s\S]*?\]\]/g, '').trim()
}

// Descripción legible de una acción para mostrarla al usuario
function describeAction(action: AgentAction): string {
    if (action.command === 'CREATE_AGENT') {
        return `Contratar a **${action.params.name}** como ${action.params.role} (modelo: ${action.params.model || 'Gemini-Flash'})`
    }
    if (action.command === 'ASK_AGENT') {
        return `Consultar a **${action.params.agent_name}**: "${action.params.question?.slice(0, 80)}..."`
    }
    if (action.command === 'UPDATE_DIRECTIVE') {
        return `Actualizar la Directiva Empresarial`
    }
    if (action.command === 'ASSIGN_TEAM') {
        return `Asignar al equipo: **${action.params.agents}**`
    }
    if (action.command === 'WEB_SEARCH') {
        return `Buscar en internet: **"${action.params.query}"**`
    }
    if (action.command === 'WEB_BROWSER') {
        return `Visitar URL: **${action.params.url}**`
    }
    if (action.command === 'FILE_MANAGER') {
        return `Archivo (${action.params.action}): **${action.params.path}**`
    }
    if (action.command === 'SEND_MESSAGE') {
        return `Enviar mensaje por **${action.params.channel}** a **${action.params.to}**`
    }
    if (action.command === 'EXECUTE_OBJECTIVE') {
        return `Iniciar Proyecto Autónomo (Fase 3): **"${action.params.objective}"**`
    }
    return `Ejecutar: ${action.command}`
}

// ─── Normalizador de Modelos (para evitar errores de restricción en DB) ────────
function normalizeModel(modelName?: string): string {
    const valid = ['GPT-4o', 'Claude-3.5', 'Gemini-1.5', 'Gemini-Flash', 'Gemini-Pro', 'GPT-4o-mini']
    const raw = modelName || 'Gemini-Flash'
    // Limpieza básica
    const clean = raw.replace(/gemini-1\.5-flash/i, 'Gemini-Flash')
        .replace(/gemini-1\.5-pro/i, 'Gemini-Pro')
        .replace(/gpt-4o-mini/i, 'GPT-4o-mini')
        .replace(/gpt-4o/i, 'GPT-4o')
        .replace(/claude-3\.5/i, 'Claude-3.5')
        .trim()

    // Si no está en la lista exacta, buscar similitud o por defecto Flash
    const found = valid.find(v => v.toLowerCase() === clean.toLowerCase())
    return found || 'Gemini-Flash'
}

export function DirectChatPanel({ agent, isOpen, onClose, allAgents = [] }: DirectChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()
    const { activeProjectId, projects } = useProject()

    const activeProject = projects.find(p => p.id === activeProjectId)

    useEffect(() => {
        if (isOpen && agent) {
            const savedChat = localStorage.getItem(`chat_history_${agent.id}`)
            if (savedChat) {
                try {
                    const parsed = JSON.parse(savedChat)
                    if (parsed && parsed.length > 0) {
                        setMessages(parsed)
                        return
                    }
                } catch (e) {
                    console.error('Error parsing saved chat:', e)
                }
            }
            setMessages([{
                id: '0',
                role: 'agent',
                content: `Hola CEO, aquí ${agent.name}. ¿En qué te ayudo hoy?`
            }])
        }
    }, [isOpen, agent])

    useEffect(() => {
        if (agent && messages.length > 0) {
            localStorage.setItem(`chat_history_${agent.id}`, JSON.stringify(messages))
        }
    }, [messages, agent])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || !agent || isSending) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsSending(true)

        try {
            const projectContextText = activeProject?.directive
                ? `\n\n## DIRECTIVA DE ESTE PROYECTO TÁCTICO (WAR ROOM: ${activeProject.name}):\n${activeProject.directive}\nPrioriza esta directiva para las respuestas y decisiones. Tienes autoridad para gestionar el equipo.`
                : ''

            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agent.id,
                    modelType: agent.model_type,
                    systemPrompt: agent.system_prompt + projectContextText,
                    messages: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }))
                })
            })

            const data = await res.json()
            if (data.error) throw new Error(data.error)

            const rawResult: string = data.result || 'Sin respuesta.'
            const detectedActions = parseActionsFromText(rawResult)
            const visibleText = cleanTextForDisplay(rawResult)

            const agentMsgId = Date.now().toString()
            const agentMsg: Message = {
                id: agentMsgId,
                role: 'agent',
                content: visibleText,
                rawContent: rawResult,
                actions: detectedActions.length > 0 ? detectedActions : undefined,
                actionStatus: detectedActions.length > 0 ? 'pending' : undefined
            }
            setMessages(prev => [...prev, agentMsg])

            // Auto-ejecución de comandos seguros o de comunicación
            if (agent && detectedActions.length > 0) {
                const autoExecuteCommands = ['SEND_MESSAGE', 'WEB_SEARCH', 'FILE_MANAGER']
                // Si el Agente es JARVIS y TODAS las acciones son seguras, ejecutamos solos
                const allSafe = detectedActions.every(a => autoExecuteCommands.includes(a.command))
                if (agent.name === 'J.A.R.V.I.S.' && allSafe) {
                    setTimeout(() => {
                        executeAction(agentMsgId, detectedActions, true)
                    }, 300)
                }
            }

        } catch (error) {
            console.error('Error in chat:', error)
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'agent',
                content: '🛑 Error de conexión con mis sistemas. Inténtalo de nuevo.'
            }])
        } finally {
            setIsSending(false)
        }
    }

    // ─── Actualizar Estado de un Agente en Supabase ───────────────────────────
    const updateAgentStatus = async (agentId: string, status: 'idle' | 'working' | 'thinking') => {
        try {
            await supabase.from('agents').update({ status }).eq('id', agentId)
        } catch (e) {
            console.warn(`Error actualizando estado de agente ${agentId}:`, e)
        }
    }

    // ─── Ejecuto de Acciones desde el Chat ──────────────────────────────────
    const executeAction = async (msgId: string, actions: AgentAction[], isAutoFlow = false) => {
        if (!agent) return
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'executing' } : m))
        await updateAgentStatus(agent.id, 'thinking')

        try {
            for (const action of actions) {
                if (action.command === 'CREATE_AGENT') {
                    const { name, role, model, prompt: agentPrompt } = action.params
                    if (!name || !role || !agentPrompt) throw new Error('Parámetros incompletos para CREATE_AGENT')

                    const icons = ['cpu', 'brain', 'zap', 'globe', 'shield', 'lightbulb', 'code', 'database', 'layers']
                    const gradients = [
                        'from-emerald-500 to-teal-600', 'from-orange-500 to-red-600',
                        'from-blue-500 to-cyan-600', 'from-violet-500 to-purple-600', 'from-rose-500 to-pink-600'
                    ]

                    const normalizedModel = normalizeModel(model)

                    const { error } = await supabase.from('agents').insert({
                        name: name.trim(),
                        role: role.trim(),
                        model_type: normalizedModel,
                        system_prompt: agentPrompt.trim(),
                        status: 'idle',
                        avatar_config: {
                            icon: icons[Math.floor(Math.random() * icons.length)],
                            gradient: gradients[Math.floor(Math.random() * gradients.length)]
                        }
                    })
                    if (error) throw error

                } else if (action.command === 'ASSIGN_TEAM') {
                    if (!activeProjectId) throw new Error('No puedes asignar un equipo porque no hay un proyecto activo (War Room).')
                    const agentsStr = action.params.agents
                    if (!agentsStr) throw new Error('No se proporcionaron agentes para asignar (agents).')

                    const agentNames = agentsStr.split(',').map(n => n.trim().toLowerCase())
                    const agentsToAssign = allAgents.filter(a => agentNames.some(n => a.name.toLowerCase().includes(n)))

                    if (agentsToAssign.length > 0) {
                        const inserts = agentsToAssign.map(a => ({
                            project_id: activeProjectId,
                            agent_id: a.id
                        }))
                        // Inserción ignorando conflictos si ya están asignados
                        const { error } = await supabase.from('project_agents').upsert(inserts, { onConflict: 'project_id, agent_id' })
                        if (error) throw error
                    } else {
                        console.warn('Ningún agente encontrado con esos nombres:', agentsStr)
                    }

                } else if (action.command === 'ASK_AGENT') {
                    const { agent_name, question } = action.params
                    const expertAgent = allAgents.find(a =>
                        a.name.toLowerCase().includes(agent_name?.toLowerCase()) && a.id !== agent?.id
                    )
                    if (!expertAgent) throw new Error(`No se encontró al agente '${agent_name}'`)

                    // Obtener la Directiva de la empresa para dársela al experto
                    const { data: directiveData } = await supabase.from('system_settings').select('value').eq('key', 'company_directive').single()
                    const directive = directiveData?.value || 'No hay directiva establecida aún.'

                    // Poner al experto a trabajar (visibilidad en dashboard)
                    await updateAgentStatus(expertAgent.id, 'working')

                    try {
                        // Ejecutar consulta al experto con contexto de directiva
                        const res = await fetch('/api/agent/run', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agentId: expertAgent.id,
                                modelType: expertAgent.model_type,
                                systemPrompt: `${expertAgent.system_prompt}\n\n## CONTEXTO CORPORATIVO (DIRECTIVA):\n${directive}`,
                                prompt: `${agent?.name} te consulta:\n\n${question}\n\nREGLA: Usa la Directiva Corporativa para responder. Si la información está ahí, NO hagas preguntas adicionales al CEO.`,
                            })
                        })

                        if (!res.ok) throw new Error(`La API de ${expertAgent.name} falló (Status: ${res.status})`)

                        const consultData = await res.json()
                        const expertResult = consultData.result || '(sin respuesta)'

                        // Añadir respuesta del experto como mensaje de sistema en el chat
                        setMessages(prev => [...prev, {
                            id: `consult-${Date.now()}`,
                            role: 'system',
                            content: `💬 **${expertAgent.name}** responde:\n\n${expertResult}`
                        }])

                        // Seguir con el agente original (Jarvis) de forma automática
                        setIsSending(true)
                        const followupRes = await fetch('/api/agent/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agentId: agent?.id,
                                modelType: agent?.model_type,
                                systemPrompt: agent?.system_prompt,
                                messages: [
                                    ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                                    {
                                        role: 'user',
                                        content: `${expertAgent.name} ha respondido:\n\n${expertResult}\n\nExcelente. Ahora usa esta información para COMPLETAR la tarea (por ejemplo, ejecutando CREATE_AGENT con el prompt diseñado).`
                                    }
                                ]
                            })
                        })

                        if (!followupRes.ok) throw new Error(`Fallo en el re-ejecutor de ${agent?.name}`)

                        const followupData = await followupRes.json()
                        const followupRaw = followupData.result || ''
                        const followupActions = parseActionsFromText(followupRaw)
                        const followupText = cleanTextForDisplay(followupRaw)

                        const followupId = `followup-${Date.now()}`
                        setMessages(prev => [...prev, {
                            id: followupId,
                            role: 'agent',
                            content: followupText,
                            actions: followupActions.length > 0 ? followupActions : undefined,
                            actionStatus: followupActions.length > 0 ? 'pending' : undefined
                        }])

                        // ─── AUTOMATIZACIÓN TOTAL ─────────────────────────────────
                        if (followupActions.length > 0) {
                            // Ejecución inmediata automática
                            await executeAction(followupId, followupActions, true)
                        }

                    } finally {
                        await updateAgentStatus(expertAgent.id, 'idle')
                        setIsSending(false)
                    }

                } else if (action.command === 'UPDATE_DIRECTIVE') {
                    const { content } = action.params
                    if (!content) throw new Error('Falta el contenido de la directiva')
                    const { error } = await supabase.from('system_settings').upsert({
                        key: 'company_directive',
                        value: content.trim()
                    })
                    if (error) throw error
                } else {
                    // Ejecutor genérico para Herramientas Operativas (Fase 2 y 3)
                    const res = await fetch('/api/agent/run-tool', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            command: action.command,
                            params: action.params
                        })
                    })

                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Error al ejecutar herramienta')

                    // Respondemos nosotros como sistema el resultado de la herramienta
                    const toolResult = typeof data.result === 'object' ? JSON.stringify(data.result, null, 2) : data.result
                    setMessages(prev => [...prev, {
                        id: `tool-${Date.now()}`,
                        role: 'system',
                        content: `✅ Herramienta completada (${action.command}):\n\n${toolResult}`
                    }])
                }
            }

            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'done' } : m))

        } catch (err: any) {
            console.error('[CHAT ACTION] Error ejecutando acción:', err)
            setMessages(prev => prev.map(m => m.id === msgId
                ? { ...m, actionStatus: 'error', content: m.content + `\n\n⚠️ Error: ${err.message}` }
                : m
            ))
        } finally {
            await updateAgentStatus(agent.id, 'idle')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <AnimatePresence>
            {isOpen && agent && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]"
                    />
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-slate-900 border-l border-white/10 z-[100] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.avatar_config?.gradient || 'from-indigo-500 to-purple-600'} flex items-center justify-center shadow-lg`}>
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{agent.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-sm text-slate-400 capitalize">{agent.role}</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar bg-slate-950/50">
                            {messages.map((msg) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-[85%]' : 'max-w-[90%]'} ${msg.role === 'system' ? 'max-w-full' : ''}`}
                                >
                                    {msg.role !== 'system' && (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/10 text-slate-300'}`}>
                                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2 flex-1">
                                        {/* Burbuja de texto */}
                                        {msg.role === 'system' ? (
                                            <div className="w-full px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                                                {msg.content}
                                            </div>
                                        ) : (
                                            <div className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user'
                                                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-sm'
                                                : 'bg-slate-800 border border-white/5 text-slate-300 rounded-tl-sm'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        )}

                                        {/* Tarjeta de Confirmación de Acciones */}
                                        {msg.actions && msg.actions.length > 0 && msg.actionStatus !== 'done' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                                className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20">
                                                    <Zap className="w-4 h-4 text-indigo-400" />
                                                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                                                        {msg.actions.length === 1 ? 'Acción Propuesta' : `${msg.actions.length} Acciones Propuestas`}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-3 flex flex-col gap-2">
                                                    {msg.actions.map((action, i) => (
                                                        <div key={i} className="text-xs text-slate-300">
                                                            <span className="font-mono text-indigo-400 mr-2">[{action.command}]</span>
                                                            <span dangerouslySetInnerHTML={{ __html: describeAction(action).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 px-4 pb-3">
                                                    {msg.actionStatus === 'executing' ? (
                                                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Ejecutando...
                                                        </div>
                                                    ) : msg.actionStatus === 'error' ? (
                                                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                                                            <XCircle className="w-4 h-4" /> Error en la ejecución
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => executeAction(msg.id, msg.actions!)}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                                Confirmar y Ejecutar
                                                            </button>
                                                            <button
                                                                onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionStatus: 'error', actions: undefined } : m))}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg transition-all"
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                Cancelar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                        {msg.actionStatus === 'done' && (
                                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 px-1">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Acción ejecutada con éxito
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isSending && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-white/10 text-slate-300 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-slate-800 border border-white/5 text-slate-400 rounded-tl-sm text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-slate-900 border-t border-white/10 shrink-0">
                            <div className="relative flex items-center">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={`Mensaje a ${agent.name}...`}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none overflow-hidden max-h-32 custom-scrollbar transition-all"
                                    rows={1}
                                    style={{ height: 'auto', minHeight: '52px' }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isSending}
                                    className="absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-800 text-white transition-all shadow-md"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-3 font-medium">
                                Shift + Enter para salto de línea • Las acciones requieren tu confirmación
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
