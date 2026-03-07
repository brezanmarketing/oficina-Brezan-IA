'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Agent } from '@/lib/types'

export function useAgents() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchAgents = useCallback(async () => {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .order('created_at', { ascending: true })

        if (!error && data) {
            setAgents(data as Agent[])
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchAgents()

        // Suscripción Realtime a cambios en agents
        const channel = supabase
            .channel('agents-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'agents' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setAgents((prev) => [...prev, payload.new as Agent])
                    } else if (payload.eventType === 'UPDATE') {
                        setAgents((prev) =>
                            prev.map((a) =>
                                a.id === payload.new.id ? (payload.new as Agent) : a
                            )
                        )
                    } else if (payload.eventType === 'DELETE') {
                        setAgents((prev) =>
                            prev.filter((a) => a.id !== payload.old.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchAgents, supabase])

    return { agents, loading, refetch: fetchAgents }
}
