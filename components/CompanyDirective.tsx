'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Target, Edit3, Save, Loader2, BookOpen, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CompanyDirectiveProps {
    isOpen: boolean
    onClose: () => void
}

export function CompanyDirective({ isOpen, onClose }: CompanyDirectiveProps) {
    const [directive, setDirective] = useState('')
    const [editedDirective, setEditedDirective] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (isOpen) {
            supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'company_directive')
                .single()
                .then(({ data }) => {
                    const text = data?.value
                        ? (typeof data.value === 'string' ? data.value : JSON.stringify(data.value, null, 2))
                        : ''
                    setDirective(text)
                    setEditedDirective(text)
                })
        }
    }, [isOpen, supabase])

    const handleSave = async () => {
        setIsSaving(true)
        await supabase
            .from('system_settings')
            .upsert({ key: 'company_directive', value: editedDirective })
        setDirective(editedDirective)
        setIsSaving(false)
        setIsEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const handleCancel = () => {
        setEditedDirective(directive)
        setIsEditing(false)
    }

    // Render departamentos del organigrama
    const renderMarkdown = (text: string) => {
        if (!text) return null
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mb-3 mt-2">{line.replace('# ', '')}</h1>
            if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-indigo-400 mt-5 mb-2 border-b border-white/5 pb-1">{line.replace('## ', '')}</h2>
            if (line.startsWith('**Propósito:**')) return <p key={i} className="text-slate-300 text-sm mb-2 italic">{line.replace('**Propósito:**', '').trim()}</p>
            if (line.startsWith('**Stack:**')) return <p key={i} className="text-slate-400 text-xs mb-2 font-mono bg-slate-800 px-2 py-1 rounded">Stack: {line.replace('**Stack:**', '').trim()}</p>
            if (line.startsWith('- ')) return (
                <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-indigo-400 mt-1 shrink-0">▸</span>
                    <span className="text-slate-300 text-sm">{line.replace('- ', '')}</span>
                </div>
            )
            if (line.startsWith('---')) return <hr key={i} className="border-white/5 my-3" />
            if (line.trim() === '') return <div key={i} className="h-1" />
            return <p key={i} className="text-slate-400 text-sm">{line}</p>
        })
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-white/10 z-[100] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <Target className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Directiva Empresarial</h2>
                                    <p className="text-sm text-slate-400">Organigrama y estrategia — visible por todos los agentes</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {saved && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center gap-1.5 text-emerald-400 text-sm"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Guardado
                                    </motion.div>
                                )}
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        Editar
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCancel}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 text-sm transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500/80 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Guardar
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Indicador de que los agentes lo ven */}
                        <div className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-300/80">
                                Esta directiva se inyecta automáticamente en el contexto de <strong>todos los agentes</strong> al ejecutar tareas. Puedes actualizarla en cualquier momento.
                            </p>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isEditing ? (
                                <textarea
                                    value={editedDirective}
                                    onChange={(e) => setEditedDirective(e.target.value)}
                                    className="w-full h-full bg-[#1d1f21] text-slate-300 text-sm font-mono p-6 resize-none focus:outline-none"
                                    placeholder="Escribe aquí el plan estratégico de la empresa..."
                                />
                            ) : (
                                <div className="p-6">
                                    {directive ? renderMarkdown(directive) : (
                                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                                            <Target className="w-10 h-10 text-slate-600" />
                                            <p className="text-slate-500">No hay directiva empresarial definida todavía.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
