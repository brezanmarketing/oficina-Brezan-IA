'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { DollarSign, ShieldAlert, PauseCircle, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AgentCostSummary } from '@/types/supabase'

// Componente para animar "números rodantes" suavemente
function Counter({ value }: { value: number }) {
    const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 })
    const display = useTransform(spring, (current) => `$${current.toFixed(4)}`)

    useEffect(() => {
        spring.set(value)
    }, [spring, value])

    return <motion.span>{display}</motion.span>
}

export function FinanceMonitor() {
    const supabase = createClient()
    const [totalCost, setTotalCost] = useState(0)
    const [agentCosts, setAgentCosts] = useState<AgentCostSummary[]>([])
    const [dailyLimit, setDailyLimit] = useState<number>(5.0) // 5 USD por defecto
    const [isPaused, setIsPaused] = useState(false)

    // Cargar estado inicial
    useEffect(() => {
        async function fetchInitialData() {
            // Obtenemos los gastos agrupados desde la vista que creamos en SQL
            const { data, error } = await supabase
                .from('agent_cost_summary')
                .select('*')

            if (error) {
                console.error('Error fetching cost summary:', error)
                return
            }

            if (data) {
                setAgentCosts(data)
                const total = data.reduce((acc, curr) => acc + Number(curr.total_cost_usd), 0)
                setTotalCost(total)
                checkLimitAndPause(total)
            }

            // Cargar límite diario desde la DB
            const { data: settings } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'daily_budget_limit')
                .single()

            if (settings) {
                setDailyLimit(Number(settings.value))
            }
        }
        fetchInitialData()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Usar ref para el dailyLimit dentro de la subscripción de supabase
    const limitRef = useRef(dailyLimit)
    useEffect(() => {
        limitRef.current = dailyLimit
    }, [dailyLimit])

    const totalCostRef = useRef(totalCost)
    useEffect(() => {
        totalCostRef.current = totalCost
    }, [totalCost])

    // Lógica para pausar agentes si se supera
    const checkLimitAndPause = async (currentTotal: number) => {
        if (currentTotal >= limitRef.current && !isPaused) {
            setIsPaused(true)

            // Pausar a todos los agentes que estén trabajando o thinking
            await supabase
                .from('agents')
                .update({ status: 'paused' })
                .in('status', ['idle', 'thinking', 'working'])
        } else if (currentTotal < limitRef.current && isPaused) {
            // Reactivar si el límite sube por encima del gasto
            setIsPaused(false)
        }
    }

    const saveBudgetLimit = async (val: number) => {
        setDailyLimit(val)
        await supabase
            .from('system_settings')
            .upsert({ key: 'daily_budget_limit', value: val.toString() })
    }

    // Suscripciones Realtime
    useEffect(() => {
        // Canal para Token Usage (Costes)
        const usageChannel = supabase
            .channel('finance-usage')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'token_usage' },
                (payload) => {
                    const newUsage = payload.new
                    const newCost = Number(newUsage.cost_usd)

                    setTotalCost((prev) => {
                        const nextTotal = prev + newCost
                        checkLimitAndPause(nextTotal)
                        return nextTotal
                    })

                    setAgentCosts((prev) => {
                        const agentIndex = prev.findIndex((a) => a.agent_id === newUsage.agent_id)
                        if (agentIndex > -1) {
                            const updated = [...prev]
                            updated[agentIndex].total_cost_usd = Number(updated[agentIndex].total_cost_usd) + newCost
                            return updated
                        }
                        return prev
                    })
                }
            )
            .subscribe()

        // Canal para System Settings (Límite Presupuestario)
        const settingsChannel = supabase
            .channel('finance-settings')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.daily_budget_limit' },
                (payload) => {
                    setDailyLimit(Number(payload.new.value))
                }
            )
            .subscribe()

        // Canal para Agents (Sincronización de Modelos/Nombres)
        const agentsChannel = supabase
            .channel('finance-agents')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'agents' },
                (payload) => {
                    setAgentCosts((prev) => {
                        const agentIndex = prev.findIndex((a) => a.agent_id === payload.new.id)
                        if (agentIndex > -1) {
                            const updated = [...prev]
                            updated[agentIndex] = {
                                ...updated[agentIndex],
                                agent_name: payload.new.name,
                                model_type: payload.new.model_type
                            }
                            return updated
                        }
                        return prev
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(usageChannel)
            supabase.removeChannel(settingsChannel)
            supabase.removeChannel(agentsChannel)
        }
    }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-5 hover:border-emerald-500/40 transition-all duration-300">

            {/* Header Financiero */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold">Monitor de Costes</h3>
                </div>

                {isPaused && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
                        <PauseCircle className="w-3.5 h-3.5" />
                        LÍMITE ALCANZADO
                    </span>
                )}
            </div>

            {/* Contador Total */}
            <div className="flex flex-col items-center py-4 bg-slate-950/50 rounded-xl border border-white/5 relative overflow-hidden">
                <div className="text-sm text-slate-400 mb-1 z-10">Gasto Total Acumulado</div>
                <div className={`text-4xl font-black tabular-nums z-10 tracking-tight ${isPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                    <Counter value={totalCost} />
                </div>

                {/* Glow background */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 blur-3xl opacity-20 rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-500'}`} />
            </div>

            {/* Limite Diario */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Presupuesto Diario
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">$</span>
                    <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={dailyLimit}
                        onChange={(e) => saveBudgetLimit(Number(e.target.value))}
                        disabled={isPaused}
                        className="bg-transparent border-none text-white font-semibold flex-1 focus:ring-0 p-0"
                    />
                    <span className="text-xs text-slate-500">USD</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <motion.div
                        className={`h-full rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: Math.min((totalCost / dailyLimit) * 100, 100) + '%' }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Desglose por Trabajador */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Desglose por Agente
                </h4>

                <div className="space-y-2">
                    {agentCosts.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">Sin gastos registrados</p>
                    ) : (
                        agentCosts.map((agent) => (
                            <div key={agent.agent_id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white truncate max-w-[120px]">
                                        {agent.agent_name}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {agent.model_type}
                                    </span>
                                </div>
                                <div className="text-sm font-mono text-emerald-400">
                                    <Counter value={Number(agent.total_cost_usd)} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    )
}
