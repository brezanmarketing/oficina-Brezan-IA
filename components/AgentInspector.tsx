'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Bot, Loader2, User, UserCircle, Cpu, Copy, Check } from 'lucide-react'
import { Agent } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-markdown'
import 'prismjs/themes/prism-tomorrow.css'

interface AgentInspectorProps {
    agent: Agent | null
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

const AVAILABLE_MODELS = [
    'Gemini-Flash',
    'Gemini-1.5',
    'Gemini-Pro',
    'GPT-4o',
    'GPT-4o-mini',
    'Claude-3.5'
]

export function AgentInspector({ agent, isOpen, onClose, onUpdate }: AgentInspectorProps) {
    const [name, setName] = useState('')
    const [role, setRole] = useState('')
    const [modelType, setModelType] = useState('')
    const [prompt, setPrompt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [copied, setCopied] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (agent) {
            setName(agent.name || '')
            setRole(agent.role || '')
            setModelType(agent.model_type || '')
            setPrompt(agent.system_prompt || '')
        }
    }, [agent])

    const handleSave = async () => {
        if (!agent) return

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('agents')
                .update({
                    name,
                    role,
                    model_type: modelType,
                    system_prompt: prompt
                })
                .eq('id', agent.id)

            if (error) throw error
            onUpdate()
            onClose()
        } catch (err) {
            console.error('Error updating agent:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(prompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
        }
    }

    const hasChanges = agent && (
        name !== agent.name ||
        role !== agent.role ||
        modelType !== agent.model_type ||
        prompt !== agent.system_prompt
    )

    return (
        <AnimatePresence>
            {isOpen && agent && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]"
                    />

                    {/* Panel Lateral */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-slate-900 border-l border-white/10 z-[100] flex flex-col shadow-2xl"
                        onKeyDown={handleKeyDown}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                    <Bot className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Editar Trabajador</h2>
                                    <p className="text-sm text-slate-400">Personalización de Agente</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col custom-scrollbar gap-6">
                            {/* Nombre y Rol */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                                        <UserCircle className="w-3 h-3" /> Nombre
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                                        <User className="w-3 h-3" /> Rol / Título
                                    </label>
                                    <input
                                        type="text"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Modelo Base Selection */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                                    <Cpu className="w-3 h-3" /> Modelo de Inteligencia Artificial
                                </label>
                                <select
                                    value={modelType}
                                    onChange={(e) => setModelType(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                                >
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex-1 flex flex-col min-h-[300px]">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-semibold text-slate-300">System Instruction (Prompt)</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={copyToClipboard}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs text-slate-300 transition-all active:scale-95"
                                        >
                                            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                            {copied ? 'Copiado' : 'Copiar'}
                                        </button>
                                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">
                                            Markdown
                                        </span>
                                    </div>
                                </div>

                                <div
                                    className="flex-1 bg-[#1d1f21] border border-white/10 rounded-xl overflow-y-auto focus-within:border-indigo-500/50 transition-colors custom-scrollbar max-h-[400px]"
                                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                                >
                                    <Editor
                                        value={prompt}
                                        onValueChange={setPrompt}
                                        highlight={code => Prism.highlight(code, Prism.languages.markdown || Prism.languages.javascript, 'markdown')}
                                        padding={16}
                                        style={{
                                            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                                            fontSize: 14,
                                            width: '100%',
                                            backgroundColor: 'transparent',
                                            cursor: 'text'
                                        }}
                                        className="focus:outline-none"
                                        textareaClassName="focus:outline-none placeholder:text-slate-700 selection:bg-indigo-500/40"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 bg-slate-900/50 shrink-0">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !hasChanges}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            >
                                {isSaving ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                                ) : (
                                    <><Save className="w-5 h-5" /> Aplicar Cambios al Trabajador</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
