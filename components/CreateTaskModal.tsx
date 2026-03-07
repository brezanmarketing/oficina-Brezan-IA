'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, PlayCircle, Plus, CheckCircle, Bot, Link } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Agent } from '@/lib/types'
import { useProject } from '@/context/ProjectContext'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
}

export function CreateTaskModal({ isOpen, onClose, agents }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Array de Agent IDs en orden
  const [chainOfCommand, setChainOfCommand] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { activeProjectId } = useProject()

  const handleToggleAgent = (agentId: string) => {
    if (chainOfCommand.includes(agentId)) {
      setChainOfCommand(chainOfCommand.filter(id => id !== agentId))
    } else {
      setChainOfCommand([...chainOfCommand, agentId])
    }
  }

  const handleCreateTask = async () => {
    if (!title.trim() || chainOfCommand.length === 0 || !activeProjectId) return
    setLoading(true)

    try {
      const firstAgentId = chainOfCommand[0]

      // 1. Crear Tarea
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          assigned_agent_id: firstAgentId,
          chain_of_command: chainOfCommand,
          current_step_index: 0,
          status: 'in_progress',
          project_id: activeProjectId
        })
        .select()
        .single()

      if (error) throw error

      // 2. Despertar al primer agente
      await supabase
        .from('agents')
        .update({ status: 'working' })
        .eq('id', firstAgentId)

      // 3. (Opcional) Log inicial en shared_context
      await supabase
        .from('shared_context')
        .insert({
          task_id: task.id,
          data: {
            event: 'TASK_STARTED',
            message: `Misión iniciada: "${title}". Cadena de mando configurada con ${chainOfCommand.length} agentes.`,
            prompt: description || title
          }
        })

      onClose()
      setTitle('')
      setDescription('')
      setChainOfCommand([])
    } catch (err) {
      console.error(err)
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Nueva Misión</h2>
                  <p className="text-slate-400 text-xs">Define el objetivo y la Cadena de Mando</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Título de la Misión</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Análisis de mercado Q1"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Contexto Inicial (Opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Instrucciones para el primer agente..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link className="w-4 h-4 text-emerald-400" />
                  <label className="text-slate-300 text-sm font-medium">Cadena de Mando (Orden de Ejecución)</label>
                </div>

                <div className="bg-slate-950 border border-white/5 rounded-xl block p-1">
                  {agents.length === 0 ? (
                    <p className="text-slate-500 text-sm p-4 text-center">No hay agentes disponibles en la oficina.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {agents.map((agent) => {
                        const index = chainOfCommand.indexOf(agent.id)
                        const isSelected = index !== -1

                        return (
                          <button
                            key={agent.id}
                            onClick={() => handleToggleAgent(agent.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isSelected
                              ? 'bg-indigo-500/10 border-indigo-500/30'
                              : 'bg-transparent border-transparent hover:bg-white/5'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                                {isSelected ? <span className="text-white font-bold text-sm">{index + 1}</span> : <Bot className="w-4 h-4 text-slate-400" />}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-white">{agent.name}</h4>
                                <p className="text-xs text-slate-400">{agent.role}</p>
                              </div>
                            </div>
                            {isSelected && <CheckCircle className="w-5 h-5 text-indigo-400" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {chainOfCommand.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Secuencia:</span>
                    {chainOfCommand.map((id, i) => {
                      const a = agents.find(x => x.id === id)
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded-md">{a?.name}</span>
                          {i < chainOfCommand.length - 1 && <span className="text-slate-600">→</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-white/10 shrink-0">
              <button
                onClick={handleCreateTask}
                disabled={!title.trim() || chainOfCommand.length === 0 || loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {loading ? 'Iniciando...' : <><PlayCircle className="w-5 h-5" /> Lanzar Misión</>}
              </button>
            </div>
          </motion.div>
        </motion.div >
      )
      }
    </AnimatePresence >
  )
}
