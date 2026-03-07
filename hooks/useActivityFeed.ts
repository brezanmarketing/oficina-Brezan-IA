'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SharedContext } from '@/lib/types'

interface ActivityEntry extends SharedContext {
    agent_name?: string
    task_title?: string
}

export function useActivityFeed() {
    const [activities, setActivities] = useState<ActivityEntry[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        // Carga inicial con joins
        const fetchActivities = async () => {
            const { data, error } = await supabase
                .from('shared_context')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (!error && data) {
                // Fetch agent names
                const agentIds = Array.from(new Set(data.map(d => d.sender_agent_id).filter(Boolean)))
                const taskIds = Array.from(new Set(data.map(d => d.task_id).filter(Boolean)))

                const [agentsRes, tasksRes] = await Promise.all([
                    agentIds.length > 0 ? supabase.from('agents').select('id, name').in('id', agentIds) : Promise.resolve({ data: [] }),
                    taskIds.length > 0 ? supabase.from('tasks').select('id, title').in('id', taskIds) : Promise.resolve({ data: [] })
                ])

                const agentsMap = new Map((agentsRes.data || []).map(a => [a.id, a.name]))
                const tasksMap = new Map((tasksRes.data || []).map(t => [t.id, t.title]))

                setActivities(
                    data.map((d) => ({
                        ...d,
                        agent_name: d.sender_agent_id ? agentsMap.get(d.sender_agent_id) : undefined,
                        task_title: d.task_id ? tasksMap.get(d.task_id) : undefined,
                    }))
                )
            } else if (error) {
                console.error("Error fetching activity feed:", error)
            }
            setLoading(false)
        }

        fetchActivities()

        // Suscripción Realtime a shared_context
        const channel = supabase
            .channel('activity-feed-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'shared_context' },
                async (payload) => {
                    // Enriquecer con datos del agente y tarea
                    const newEntry = payload.new as SharedContext

                    const [agentRes, taskRes] = await Promise.all([
                        newEntry.sender_agent_id
                            ? supabase.from('agents').select('name').eq('id', newEntry.sender_agent_id).single()
                            : Promise.resolve({ data: null }),
                        newEntry.task_id
                            ? supabase.from('tasks').select('title').eq('id', newEntry.task_id).single()
                            : Promise.resolve({ data: null }),
                    ])

                    const enriched: ActivityEntry = {
                        ...newEntry,
                        agent_name: (agentRes.data as { name?: string } | null)?.name,
                        task_title: (taskRes.data as { title?: string } | null)?.title,
                    }

                    setActivities((prev) => [enriched, ...prev.slice(0, 49)])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    return { activities, loading }
}
