'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Edit3, CheckCircle, Loader2, Bot, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ArchitectResponse, ModelType } from '@/lib/types'

interface HireModalProps {
    isOpen: boolean
    onClose: () => void
    onAgentCreated: () => void
}

type Step = 'describe' | 'preview' | 'success'

const ICON_OPTIONS = ['cpu', 'bar-chart', 'pen-tool', 'bot', 'brain', 'zap', 'globe', 'shield', 'lightbulb', 'code', 'database', 'layers']
const GRADIENT_OPTIONS = [
    { label: 'Índigo', value: 'from-indigo-500 to-purple-600', color: '#6366f1' },
    { label: 'Esmeralda', value: 'from-emerald-500 to-teal-600', color: '#10b981' },
    { label: 'Ámbar', value: 'from-amber-500 to-orange-600', color: '#f59e0b' },
    { label: 'Rosa', value: 'from-rose-500 to-pink-600', color: '#f43f5e' },
    { label: 'Cielo', value: 'from-sky-500 to-blue-600', color: '#0ea5e9' },
    { label: 'Violeta', value: 'from-violet-500 to-purple-600', color: '#8b5cf6' },
]

export function HireModal({ isOpen, onClose, onAgentCreated }: HireModalProps) {
    const [step, setStep] = useState<Step>('describe')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [architectResult, setArchitectResult] = useState<ArchitectResponse | null>(null)

    // Campos editables de la previsualización
    const [editName, setEditName] = useState('')
    const [editRole, setEditRole] = useState('')
    const [editPrompt, setEditPrompt] = useState('')
    const [editModel, setEditModel] = useState<ModelType>('Gemini-Flash')
    const [editIcon, setEditIcon] = useState('cpu')
    const [editGradient, setEditGradient] = useState('from-indigo-500 to-purple-600')
    const [editColor, setEditColor] = useState('#6366f1')

    const supabase = createClient()

    const handleReset = () => {
        setStep('describe')
        setDescription('')
        setLoading(false)
        setError(null)
        setArchitectResult(null)
    }

    const handleClose = () => {
        handleReset()
        onClose()
    }

    const handleGenerate = async () => {
        if (!description.trim()) return
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/architect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description }),
            })

            if (!res.ok) throw new Error('Error al contactar al Arquitecto')

            const data: ArchitectResponse = await res.json()
            setArchitectResult(data)

            // Pre-llenar campos editables
            setEditName(data.suggested_name)
            setEditRole(data.suggested_role)
            setEditPrompt(data.system_prompt)
            setEditModel(data.model_type)

            setStep('preview')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!editName.trim() || !editRole.trim()) return
        setLoading(true)
        setError(null)

        try {
            const { error: insertError } = await supabase.from('agents').insert({
                name: editName.trim(),
                role: editRole.trim(),
                model_type: editModel,
                system_prompt: editPrompt.trim(),
                status: 'idle',
                avatar_config: {
                    color: editColor,
                    icon: editIcon,
                    gradient: editGradient,
                },
            })

            if (insertError) throw insertError

            setStep('success')
            onAgentCreated()
            setTimeout(() => {
                handleClose()
            }, 2000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear el agente')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Decoración de fondo */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -translate-x-32 -translate-y-32 pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl translate-x-32 translate-y-32 pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-center justify-between p-6 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-xl">RRHH de IA</h2>
                                    <p className="text-slate-400 text-sm">Contrata tu próximo agente</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Steps indicator */}
                        <div className="relative flex items-center justify-center gap-2 px-6 py-3 border-b border-white/5">
                            {(['describe', 'preview', 'success'] as Step[]).map((s, i) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s
                                                ? 'bg-indigo-500 text-white'
                                                : i < (['describe', 'preview', 'success'] as Step[]).indexOf(step)
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-white/10 text-slate-500'
                                            }`}
                                    >
                                        {i + 1}
                                    </div>
                                    {i < 2 && <ChevronRight className="w-3 h-3 text-slate-600" />}
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="relative p-6">
                            <AnimatePresence mode="wait">
                                {/* Paso 1: Descripción */}
                                {step === 'describe' && (
                                    <motion.div
                                        key="describe"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-4"
                                    >
                                        <div>
                                            <label className="block text-white font-medium mb-2">
                                                ¿Qué necesitas que haga este agente?
                                            </label>
                                            <p className="text-slate-400 text-sm mb-3">
                                                Describe con detalle la función del agente. El Arquitecto de IA generará el modelo ideal y su prompt optimizado.
                                            </p>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                rows={5}
                                                placeholder="Ej: Necesito un agente especialista en análisis de competencia que pueda investigar mercados, identificar tendencias y generar informes ejecutivos..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                                            />
                                        </div>

                                        {error && (
                                            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                                {error}
                                            </p>
                                        )}

                                        <button
                                            onClick={handleGenerate}
                                            disabled={!description.trim() || loading}
                                            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
                                        >
                                            {loading ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con el Arquitecto...</>
                                            ) : (
                                                <><Sparkles className="w-4 h-4" /> Generar Agente con IA</>
                                            )}
                                        </button>
                                    </motion.div>
                                )}

                                {/* Paso 2: Previsualización y edición */}
                                {step === 'preview' && architectResult && (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Edit3 className="w-4 h-4 text-indigo-400" />
                                            <span className="text-indigo-400 text-sm font-medium">El Arquitecto ha diseñado tu agente. Revisa y edita:</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-slate-400 text-xs mb-1">Nombre</label>
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-slate-400 text-xs mb-1">Rol</label>
                                                <input
                                                    value={editRole}
                                                    onChange={(e) => setEditRole(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">Modelo</label>
                                            <select
                                                value={editModel}
                                                onChange={(e) => setEditModel(e.target.value as ModelType)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                            >
                                                {['GPT-4o', 'GPT-4o-mini', 'Claude-3.5', 'Gemini-1.5', 'Gemini-Flash'].map(m => (
                                                    <option key={m} value={m} className="bg-slate-800">{m}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 text-xs mb-1">System Prompt</label>
                                            <textarea
                                                value={editPrompt}
                                                onChange={(e) => setEditPrompt(e.target.value)}
                                                rows={4}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm resize-none focus:outline-none focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>

                                        {/* Color selector */}
                                        <div>
                                            <label className="block text-slate-400 text-xs mb-2">Color del agente</label>
                                            <div className="flex gap-2">
                                                {GRADIENT_OPTIONS.map((g) => (
                                                    <button
                                                        key={g.value}
                                                        onClick={() => { setEditGradient(g.value); setEditColor(g.color) }}
                                                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${g.value} transition-all ${editGradient === g.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`}
                                                        title={g.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {error && (
                                            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                                {error}
                                            </p>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setStep('describe')}
                                                className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-xl transition-all"
                                            >
                                                Volver
                                            </button>
                                            <button
                                                onClick={handleCreate}
                                                disabled={loading || !editName.trim()}
                                                className="flex-2 flex items-center justify-center gap-2 py-2.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                                            >
                                                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Contratando...</> : <><CheckCircle className="w-4 h-4" /> Contratar Agente</>}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Paso 3: Éxito */}
                                {step === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-8 gap-4"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', delay: 0.1 }}
                                            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30"
                                        >
                                            <CheckCircle className="w-10 h-10 text-white" />
                                        </motion.div>
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="text-center"
                                        >
                                            <h3 className="text-white font-bold text-xl mb-1">¡Bienvenido al equipo, {editName}!</h3>
                                            <p className="text-slate-400 text-sm">El agente ha sido creado y añadido a tu oficina.</p>
                                        </motion.div>
                                        <motion.div
                                            className="flex items-center gap-2"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5 }}
                                        >
                                            <Bot className="w-4 h-4 text-indigo-400" />
                                            <span className="text-indigo-400 text-sm">{editRole}</span>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
