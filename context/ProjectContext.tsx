'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Project {
    id: string
    name: string
    description: string
    directive?: string
    created_at: string
}

interface ProjectContextType {
    projects: Project[]
    activeProjectId: string | null
    setActiveProjectId: (id: string | null) => void
    loading: boolean
    refreshProjects: () => Promise<void>
    deleteProject: (id: string) => Promise<boolean>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null) // null = Oficina Global
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchProjects = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: true })

        if (!error && data) {
            setProjects(data as Project[])
            // Mantener el proyecto activo actual o mantener null (Oficina Global)
            setActiveProjectId((currentId) => {
                if (currentId && !data.find(p => p.id === currentId)) {
                    return null // El proyecto activo fue borrado, volver a Global
                }
                return currentId
            })
        }
        setLoading(false)
    }, [supabase])

    const deleteProject = useCallback(async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) {
            console.error('Error borrando proyecto:', error)
            return false
        }
        // Si borramos el activo, volvemos al contexto global (null)
        if (activeProjectId === id) {
            setActiveProjectId(null)
        }
        await fetchProjects()
        return true
    }, [supabase, activeProjectId, fetchProjects])

    useEffect(() => {
        fetchProjects()

        const channel = supabase.channel('projects-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchProjects, supabase])

    return (
        <ProjectContext.Provider value={{ projects, activeProjectId, setActiveProjectId, loading, refreshProjects: fetchProjects, deleteProject }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider')
    }
    return context
}
