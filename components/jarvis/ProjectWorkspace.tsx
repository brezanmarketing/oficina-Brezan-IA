'use client'

import React, { useState, useEffect } from 'react'
import { Plus, MoreVertical, CheckCircle2, Circle, Clock, Flame, Users, Bot, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import JarvisChat from '@/components/jarvis/JarvisChat'

export default function ProjectWorkspace() {
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchWorkspace()

    const channel = supabase.channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        fetchWorkspace()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchWorkspace = async () => {
    try {
      const { data: pData } = await supabase.from('projects').select('*').limit(1).single()
      
      let tData: any[] = []
      if (pData) {
        // Fetch tasks
        const { data } = await supabase.from('tasks').select('*')
        tData = data || []
      }

      const { data: aData } = await supabase.from('agents').select('*')

      if (pData) {
        setProject(pData)
        setTasks(tData)
        setAgents(aData || [])
      }
    } catch (error) {
      console.error('Error loading workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    
    // Update Supabase
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (error) {
      console.error('Error updating task status:', error)
      fetchWorkspace() // revert on fail
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    
    const newTask = {
      title: newTaskTitle,
      status: 'pending',
      user_id: user?.id || null,
      project_id: project?.id || null
    }

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single()
    if (error) {
      console.error('Error creating task:', JSON.stringify(error, null, 2))
      alert('Error detallado de Supabase: ' + JSON.stringify(error))
    } else if (data) {
      setTasks(prev => [...prev, data])
    }

    setNewTaskTitle('')
    setIsModalOpen(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--void)' }}>
        <div className="animate-pulse-dot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)' }} />
      </div>
    )
  }

  const currentProject = project || { name: 'Sin Proyecto Activo', progress: 0 }
  
  const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'pending' || !t.status)
  const doingTasks = tasks.filter((t) => t.status === 'doing' || t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'completed')

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden" style={{ background: 'var(--void)', position: 'relative' }}>
      <div className="circuit-bg absolute inset-0 opacity-50" />
      <div className="ambient-orb-top absolute opacity-30" style={{ left: '20%', top: '-10%' }} />

      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(5, 8, 21, 0.4)' }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">{currentProject.name || currentProject.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              Activo
            </span>
          </div>
          <p className="text-sm font-sans" style={{ color: 'var(--on-surface-dim)' }}>War Room • Espacio de trabajo coordinado por IA</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-2 w-48">
            <div className="flex items-center justify-between text-xs font-mono" style={{ color: 'var(--primary)' }}>
              <span>PROGRESO</span>
              <span>{tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${tasks.length > 0 ? (doneTasks.length / tasks.length) * 100 : 0}%`, background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
            </div>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-125 cursor-pointer" style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' }}>
            <Plus size={16} />
            Nueva Tarea
          </button>
        </div>
      </header>

      {/* GRID MAIN */}
      <div className="relative z-10 flex-1 overflow-hidden flex gap-6 p-6">
        
        {/* LEFT PANEL: KANBAN BOARD */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
          
          <KanbanColumn title="TO DO" icon={Circle} color="#64748b" count={todoTasks.length} onDrop={(e: any) => handleDrop(e, 'pending')} onDragOver={handleDragOver}>
            {todoTasks.map(task => <TaskCard key={task.id} task={task} agents={agents} onDragStart={(e) => handleDragStart(e, task.id)} />)}
          </KanbanColumn>
          
          <KanbanColumn title="IN PROGRESS" icon={Clock} color="#3b82f6" count={doingTasks.length} isActive onDrop={(e: any) => handleDrop(e, 'in_progress')} onDragOver={handleDragOver}>
            {doingTasks.map(task => <TaskCard key={task.id} task={task} agents={agents} onDragStart={(e) => handleDragStart(e, task.id)} />)}
          </KanbanColumn>
          
          <KanbanColumn title="DONE" icon={CheckCircle2} color="#10b981" count={doneTasks.length} onDrop={(e: any) => handleDrop(e, 'completed')} onDragOver={handleDragOver}>
            {doneTasks.map(task => <TaskCard key={task.id} task={task} agents={agents} onDragStart={(e) => handleDragStart(e, task.id)} />)}
          </KanbanColumn>

        </div>

        {/* RIGHT PANEL: CONTEXT & AGENTS */}
        <div className="w-80 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Users size={16} style={{ color: 'var(--primary)' }} />
              Fuerza de Trabajo
            </h3>
            <div className="flex flex-col gap-4">
              {agents.map(agent => {
                const color = agent.avatar_config?.color || '#6366f1'
                return (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: `${color}20`, color: color, border: `1px solid ${color}40` }}>
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>{agent.role}</div>
                    </div>
                  </div>
                )
              })}
              {agents.length === 0 && <span className="text-sm text-gray-500">No hay agentes.</span>}
            </div>
          </div>

          <JarvisChat variant="compact" />

        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Crear Nueva Tarea</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-2">TÍTULO DE LA TAREA</label>
                <input autoFocus type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-black/40 border rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" style={{ borderColor: 'var(--border)' }} placeholder="E.g. Optimizar Hero Section" required />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-125" style={{ background: 'var(--primary)', color: '#fff' }}>Crear Tarea</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

function KanbanColumn({ title, icon: Icon, color, count, isActive, children, onDrop, onDragOver }: any) {
  return (
    <div onDrop={onDrop} onDragOver={onDragOver} className="flex flex-col flex-1 min-w-[280px] rounded-xl border transition-colors" style={{ background: 'var(--surface)', borderColor: isActive ? `${color}40` : 'var(--border)', boxShadow: isActive ? `0 0 20px ${color}10 text-white` : 'none' }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color }} />
          <h3 className="font-semibold text-sm tracking-wide text-white">{title}</h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--on-surface-dim)' }}>
          {count}
        </span>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  )
}

function TaskCard({ task, agents, onDragStart }: { task: any, agents: any[], onDragStart: (e: React.DragEvent) => void }) {
  const agent = agents.find(a => a.id === task.assigned_agent_id)
  
  return (
    <div draggable onDragStart={onDragStart} className="group p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing hover:bg-white/5" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-gray-200 leading-snug">{task.title}</p>
        <button className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical size={14} />
        </button>
      </div>
      
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Flame size={12} className="text-orange-500/80" />
          <span>Alta Prioridad</span>
        </div>
        
        {agent && agent.avatar_config && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" title={agent.name} style={{ background: `${agent.avatar_config.color}20`, color: agent.avatar_config.color, border: `1px solid ${agent.avatar_config.color}40` }}>
            {agent.name.charAt(0)}
          </div>
        )}
      </div>
    </div>
  )
}
