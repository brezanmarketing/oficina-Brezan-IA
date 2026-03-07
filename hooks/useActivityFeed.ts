'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface AuditActivity {
    id: string
    actor: string
    actor_role?: string
    action: string
    resource: string
    resource_id?: string
    status: string
    input_summary?: string
    output_summary?: string
    duration_ms?: number
    created_at: string
}

export function useActivityFeed() {
    const [activities, setActivities] = useState<AuditActivity[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchActivities = async () => {
            const { data, error } = await supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (!error && data) {
                setActivities(data)
            } else if (error) {
                console.error("Error fetching audit feed:", error)
            }
            setLoading(false)
        }

        fetchActivities()

        // Suscripción Realtime a audit_log
        const channel = supabase
            .channel('audit-feed-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_log' },
                (payload) => {
                    const newEntry = payload.new as AuditActivity
                    setActivities((prev) => [newEntry, ...prev.slice(0, 49)])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    return { activities, loading }
}
