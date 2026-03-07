'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Agent } from '@/lib/types'

interface Point {
  x: number
  y: number
}

interface Connection {
  id: string
  from: Point
  to: Point
}

interface HandoffVisualizerProps {
  agents: Agent[]
}

export function HandoffVisualizer({ agents }: HandoffVisualizerProps) {
  const [connections, setConnections] = useState<Connection[]>([])

  useEffect(() => {
    // Lógica para visualizar Handoffs Activos
    // Encontramos un agente 'thinking' o 'working' y asumimos contexto.
    // Para una Demo de Handoff real, buscamos la transición:
    // Alguien estaba working y acaba de pasar a idle/paused y OTRO acaba de pasar a thinking/working.

    const buildConnections = () => {
      const newConnections: Connection[] = []

      const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'thinking')
      const inactiveAgents = agents.filter(a => a.status === 'idle')

      // Si tenemos al menos 2 agentes interactuando, creamos un link visual para ilustrar el orquestador.
      // (En producción, esta información vendría del estado current_step_index de la tabla tasks).
      // Como heurística de demo visual, si hay un agente pensando/trabajando y existe al menos otro
      // dibujamos una línea desde el último que se actualizó (asumiendo que le pasó el relevo).

      // Vamos a trazar una línea entre el agente activo y el "responsable" anterior, o simplemente 
      // entre todos los agentes de forma ilustrativa si hay alguno 'thinking' para la demo del Cerebro.

      if (activeAgents.length > 0) {
        const mainTarget = activeAgents[0] // El primero que esté trabajando/pensando
        // Buscar a alguien como "origen", preferiblemente un inactivo reciente
        const source = inactiveAgents.length > 0 ? inactiveAgents[inactiveAgents.length - 1] : (activeAgents.length > 1 ? activeAgents[1] : null)

        if (mainTarget && source && mainTarget.id !== source.id) {
          const sourceEl = document.getElementById(`agent-${source.id}`)
          const targetEl = document.getElementById(`agent-${mainTarget.id}`)

          if (sourceEl && targetEl) {
            const sRect = sourceEl.getBoundingClientRect()
            const tRect = targetEl.getBoundingClientRect()

            // Centro derecho del source
            const p1 = {
              x: sRect.width > tRect.width ? sRect.left + sRect.width / 2 : sRect.right - 20,
              y: sRect.top + sRect.height / 2
            }

            // Centro izquierdo del target
            const p2 = {
              x: tRect.left + 20,
              y: tRect.top + tRect.height / 2
            }

            newConnections.push({
              id: `${source.id}-${mainTarget.id}`,
              from: p1,
              to: p2
            })
          }
        }
      }

      setConnections(newConnections)
    }

    // Retardo pequeño para asegurar renderizado del DOM de los AgentCards
    const timeout = setTimeout(buildConnections, 300)

    // Resize observer
    window.addEventListener('resize', buildConnections)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', buildConnections)
    }
  }, [agents])

  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none z-40">
      <AnimatePresence>
        {connections.map((conn) => {
          // Cubic bezier curve para suavizar la línea de conexión
          const cX = (conn.from.x + conn.to.x) / 2
          const path = `M ${conn.from.x} ${conn.from.y} C ${cX} ${conn.from.y}, ${cX} ${conn.to.y}, ${conn.to.x} ${conn.to.y}`

          return (
            <motion.path
              key={conn.id}
              d={path}
              stroke="url(#handoff-gradient)"
              strokeWidth="4"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              strokeLinecap="round"
              strokeDasharray="8 8" // Estilo de línea punteada/futurista
            />
          )
        })}
      </AnimatePresence>
      <defs>
        <linearGradient id="handoff-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#c084fc" stopOpacity="1" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
        </linearGradient>
      </defs>
    </svg>
  )
}
