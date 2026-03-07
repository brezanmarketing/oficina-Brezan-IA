'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Agent } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

const SCALE = 1
const ISO_W = 16 * SCALE
const ISO_H = 8 * SCALE
const OFFSET_X = 550
const OFFSET_Y = 150

export const toIso = (x: number, y: number, z: number = 0) => {
    return {
        x: OFFSET_X + (x - y) * ISO_W,
        y: OFFSET_Y + (x + y) * ISO_H - z * 16 * SCALE
    }
}

interface Furniture {
    x: number;
    y: number;
    w: number;
    h: number;
    d: number;
    colorTop: string;
    colorLeft: string;
    colorRight: string;
    type: 'table' | 'desk' | 'chair' | 'plant_pot' | 'plant_leaves' | 'server_rack' | 'monitor' | 'keyboard' | 'sofa' | 'coffee_machine' | 'wall';
    extra?: string;
}

export const WORKSTATIONS = [
    { id: 0, x: 3, y: 14 },
    { id: 1, x: 7, y: 14 },
    { id: 2, x: 11, y: 14 },
    { id: 3, x: 15, y: 14 },
    { id: 4, x: 19, y: 14 },
    { id: 5, x: 3, y: 22 },
    { id: 6, x: 7, y: 22 },
    { id: 7, x: 11, y: 22 },
    { id: 8, x: 15, y: 22 },
    { id: 9, x: 19, y: 22 },
]

const ZONES = {
    meetingRoom: { x: 1, y: 1, w: 9, h: 9 },
    ceoOffice: { x: 11, y: 1, w: 10, h: 9 },
    serverRoom: { x: 23, y: 1, w: 6, h: 9 },
    cafeteria: { x: 23, y: 12, w: 6, h: 16 },
    pasillos: { x: 1, y: 11, w: 20, h: 2 }
}

function getRandomPointInZone(zone: { x: number, y: number, w: number, h: number }) {
    return {
        x: zone.x + Math.floor(Math.random() * zone.w),
        y: zone.y + Math.floor(Math.random() * zone.h)
    }
}

function getRandomIdlePoint() {
    const zones = [ZONES.meetingRoom, ZONES.cafeteria, ZONES.pasillos]
    const randomZone = zones[Math.floor(Math.random() * zones.length)]
    return getRandomPointInZone(randomZone)
}

const getAgentColor = (agent: Agent) => {
    const colors = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#f87171']
    let hash = 0
    for (let i = 0; i < agent.id.length; i++) hash += agent.id.charCodeAt(i)
    return colors[hash % colors.length]
}

const getAgentFeatures = (agent: Agent) => {
    let hash = 0
    for (let i = 0; i < agent.id.length; i++) hash += agent.id.charCodeAt(i)

    const skinTones = ['#ffdbac', '#f1c27d', '#e0ac69', '#8d5524', '#c68642']
    const hairStyles = ['bald', 'short', 'long', 'mohawk']
    const hairColors = ['#000000', '#4a2c2a', '#2c1608', '#d4af37', '#ffffff']

    return {
        skin: skinTones[hash % skinTones.length],
        hair: hairStyles[(hash >> 2) % hairStyles.length],
        hairColor: hairColors[(hash >> 4) % hairColors.length]
    }
}

// Furniture helper function
const createFurniture = (agents: Agent[]) => {
    const furniture: Furniture[] = [
        // Basic Static Items (Server, Plants, etc.)
    ]

    // Server Racks in Server Room
    for (let i = 0; i < 3; i++) {
        furniture.push({
            x: 24 + i * 1.5, y: 2, w: 1, h: 4, d: 4,
            colorTop: '#1e293b', colorLeft: '#020617', colorRight: '#0f172a', type: 'server_rack'
        })
    }

    // Plants
    const PLANT_POS = [{ x: 1, y: 1 }, { x: 28, y: 1 }, { x: 28, y: 28 }, { x: 1, y: 28 }]
    PLANT_POS.forEach(p => {
        furniture.push({
            x: p.x, y: p.y, w: 1, h: 1, d: 0.8,
            colorTop: '#422006', colorLeft: '#271203', colorRight: '#361b04', type: 'plant_pot'
        })
        furniture.push({
            x: p.x + 0.2, y: p.y + 0.2, w: 0.6, h: 0.6, d: 1.5,
            colorTop: '#10b981', colorLeft: '#059669', colorRight: '#047857', type: 'plant_leaves'
        })
    })

    // Dynamic Workstations based on agents
    agents.forEach((agent, index) => {
        if (index === 0) {
            // J.A.R.V.I.S. / CEO OFFICE
            const cx = 14, cy = 4
            furniture.push({ x: cx, y: cy, w: 4, h: 2, d: 1.2, colorTop: '#3b82f6', colorLeft: '#1d4ed8', colorRight: '#2563eb', type: 'desk', extra: agent.name })
            furniture.push({ x: cx + 1.5, y: cy + 0.2, w: 1.5, h: 0.2, d: 2, colorTop: '#00ffff44', colorLeft: '#000000', colorRight: '#111111', type: 'monitor' })
            furniture.push({ x: cx + 1.5, y: cy + 1, w: 1.5, h: 0.5, d: 1.3, colorTop: '#111111', colorLeft: '#0a0a0a', colorRight: '#151515', type: 'keyboard' })
        } else {
            // Normal Workstations (Cubicles)
            const ws = WORKSTATIONS[(index - 1) % WORKSTATIONS.length]
            furniture.push({ x: ws.x, y: ws.y, w: 2, h: 2, d: 1.1, colorTop: '#475569', colorLeft: '#1e293b', colorRight: '#334155', type: 'desk', extra: agent.name })
            furniture.push({ x: ws.x + 0.5, y: ws.y + 0.2, w: 1, h: 0.2, d: 1.8, colorTop: '#00ffff33', colorLeft: '#000000', colorRight: '#111111', type: 'monitor' })
            furniture.push({ x: ws.x + 0.5, y: ws.y + 0.8, w: 1, h: 0.4, d: 1.15, colorTop: '#111111', colorLeft: '#0a0a0a', colorRight: '#151515', type: 'keyboard' })
            furniture.push({ x: ws.x + 0.5, y: ws.y + 2, w: 1, h: 1, d: 0.8, colorTop: '#ef4444', colorLeft: '#b91c1c', colorRight: '#dc2626', type: 'chair' })
        }
    })

    // Cafeteria (Furniture for the social area)
    const cx = ZONES.cafeteria.x, cy = ZONES.cafeteria.y
    // Coffee Machine
    furniture.push({ x: cx + 1, y: cy + 1, w: 1, h: 1, d: 1.5, colorTop: '#334155', colorLeft: '#0f172a', colorRight: '#1e293b', type: 'coffee_machine' })
    // High Tables
    furniture.push({ x: cx + 3, y: cy + 3, w: 1.5, h: 1.5, d: 1.2, colorTop: '#78350f', colorLeft: '#451a03', colorRight: '#92400e', type: 'table' })
    furniture.push({ x: cx + 3, y: cy + 7, w: 1.5, h: 1.5, d: 1.2, colorTop: '#78350f', colorLeft: '#451a03', colorRight: '#92400e', type: 'table' })

    // Bar Chairs
    furniture.push({ x: cx + 2, y: cy + 3.5, w: 0.8, h: 0.8, d: 0.9, colorTop: '#111', colorLeft: '#000', colorRight: '#222', type: 'chair' })
    furniture.push({ x: cx + 5, y: cy + 3.5, w: 0.8, h: 0.8, d: 0.9, colorTop: '#111', colorLeft: '#000', colorRight: '#222', type: 'chair' })

    // Sofa Zone
    furniture.push({ x: cx + 1, y: cy + 11, w: 4, h: 2, d: 1, colorTop: '#065f46', colorLeft: '#064e3b', colorRight: '#059669', type: 'sofa' })

    // Meeting Room Furniture (Always there)
    const mx = ZONES.meetingRoom.x, my = ZONES.meetingRoom.y
    furniture.push({ x: mx + 2.5, y: my + 2.5, w: 4, h: 4, d: 1.1, colorTop: '#1e293b', colorLeft: '#0f172a', colorRight: '#111827', type: 'table' }) // Gran mesa central

    return furniture
}

const DataLines = ({ agents, positions, activeTasks }: { agents: Agent[], positions: Record<string, { x: number, y: number }>, activeTasks: any[] }) => {
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
            <defs>
                <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
                    <stop offset="50%" stopColor="#34d399" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
            </defs>
            <AnimatePresence>
                {activeTasks.map(task => {
                    const chain = task.chain_of_command || []
                    if (chain.length < 2) return null

                    const connections: any[] = []
                    for (let i = 0; i < chain.length - 1; i++) {
                        const a1 = chain[i]
                        const a2 = chain[i + 1]
                        const p1 = positions[a1] ? inventions(toIso(positions[a1].x, positions[a1].y)) : null
                        const p2 = positions[a2] ? inventions(toIso(positions[a2].x, positions[a2].y)) : null

                        if (p1 && p2) {
                            connections.push({ id: `${task.id}-${a1}-${a2}`, p1, p2 })
                        }
                    }

                    function inventions(p: { x: number, y: number }) {
                        return { x: p.x, y: p.y - 20 } // Elevamos un poco para que salga del pecho
                    }

                    return connections.map(conn => (
                        <motion.path
                            key={conn.id}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            d={`M ${conn.p1.x} ${conn.p1.y} Q ${(conn.p1.x + conn.p2.x) / 2} ${(conn.p1.y + conn.p2.y) / 2 - 40}, ${conn.p2.x} ${conn.p2.y}`}
                            stroke="url(#flow-grad)"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray="4 4"
                            className="drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                        />
                    ))
                })}
            </AnimatePresence>
        </svg>
    )
}

const SpeechBubble = ({ message, type = 'speech', partnerName }: { message: string, type?: 'speech' | 'thinking', partnerName?: string | null }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 10 }}
            className="mb-3 relative z-[100]"
        >
            <div className={`
                px-3 py-2 rounded-xl backdrop-blur-md border-2 
                ${type === 'thinking'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white/10 border-white/20'
                }
                shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
                max-w-[200px] min-w-[60px] text-center
            `}>
                {partnerName && (
                    <div className="flex items-center justify-center gap-1 mb-1 border-b border-white/10 pb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[7px] font-bold text-indigo-300 uppercase tracking-wider">Colab: {partnerName}</span>
                    </div>
                )}
                <p className={`font-medium text-[10px] leading-relaxed break-words tracking-wide
                    ${type === 'thinking' ? 'text-amber-200' : 'text-white'}
                `}>
                    {type === 'thinking' ? (
                        <span className="flex justify-center gap-1">
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }}>●</motion.span>
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}>●</motion.span>
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}>●</motion.span>
                        </span>
                    ) : message}
                </p>
            </div>
            {/* Glass Tail */}
            <div className={`
                absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r-2 border-b-2 
                ${type === 'thinking' ? 'bg-amber-900/40 border-amber-500/30' : 'bg-slate-900/40 border-white/20'}
                backdrop-blur-sm
            `} />
        </motion.div>
    )
}

// Componente para Muebles Isometricos en DOM
const IsoBox = ({ f, zOffset = 0 }: { f: Furniture, zOffset?: number }) => {
    const { x, y, w, h, d, colorTop, colorLeft, colorRight, type, extra } = f
    const pTop = [toIso(x, y, d), toIso(x + w, y, d), toIso(x + w, y + h, d), toIso(x, y + h, d)]
    const pLeft = [toIso(x, y + h, 0), toIso(x + w, y + h, 0), toIso(x + w, y + h, d), toIso(x, y + h, d)]
    const pRight = [toIso(x + w, y, 0), toIso(x + w, y + h, 0), toIso(x + w, y + h, d), toIso(x + w, y, d)]

    const pts = [...pTop, ...pLeft, ...pRight]
    const minX = Math.min(...pts.map(p => p.x))
    const minY = Math.min(...pts.map(p => p.y))
    const maxX = Math.max(...pts.map(p => p.x))
    const maxY = Math.max(...pts.map(p => p.y))

    const width = maxX - minX
    const height = maxY - minY
    const adjust = (points: { x: number, y: number }[]) => points.map(p => `${p.x - minX},${p.y - minY}`).join(' ')

    return (
        <div
            className="absolute pointer-events-none drop-shadow-lg"
            style={{
                left: minX, top: minY, width, height,
                zIndex: Math.floor(x + y + h + zOffset) // Oclusión corregida
            }}
        >
            <svg width={width} height={height} className="absolute inset-0 overflow-visible">
                {type === 'monitor' && (
                    <rect x={adjust(pTop).split(' ')[0].split(',')[0]} y="-2" width="20" height="20" fill="cyan" className="animate-pulse blur-[10px] opacity-20" />
                )}
                {type === 'coffee_machine' && (
                    <rect x="2" y="5" width="4" height="6" fill="#ef4444" className="animate-pulse" />
                )}
                <polygon points={adjust(pTop)} fill={colorTop} />
                <polygon points={adjust(pLeft)} fill={colorLeft} />
                <polygon points={adjust(pRight)} fill={colorRight} />
                {type === 'coffee_machine' && (
                    <path d="M 6,2 Q 8,0 10,2" stroke="white" strokeWidth="0.5" fill="none" className="animate-bounce" />
                )}
                {extra && (
                    <text x="2" y="10" fill="white" className="font-mono text-[6px] opacity-40 uppercase pointer-events-none">
                        {extra}
                    </text>
                )}
                {type === 'server_rack' && (
                    <>
                        <circle cx={4} cy={10} r="1.5" fill={Math.random() > 0.5 ? '#22c55e' : '#ef4444'} className="animate-pulse" />
                        <circle cx={4} cy={14} r="1.5" fill={Math.random() > 0.5 ? '#22c55e' : '#ef4444'} className="animate-pulse" />
                        <circle cx={4} cy={18} r="1.5" fill={Math.random() > 0.5 ? '#22c55e' : '#ef4444'} className="animate-pulse" />
                    </>
                )}
            </svg>
        </div>
    )
}

// Componente de Agente Humanoide 2.5D
const IsoAgent = ({ agent, pos, isThinking, lastMsgTrigger, agents }: { agent: Agent, pos: { x: number, y: number }, isThinking: boolean, lastMsgTrigger?: number, agents: Agent[] }) => {
    const isoPos = toIso(pos.x, pos.y, 0)
    const color = getAgentColor(agent)
    const features = getAgentFeatures(agent)
    const isWorking = agent.status === 'working'
    const zIndex = Math.floor(pos.x + pos.y)

    // Lógica de Mensajes
    const [showBubble, setShowBubble] = useState(false)
    const [pendingMessage, setPendingMessage] = useState<string | null>(null)
    const [lastSeenMsg, setLastSeenMsg] = useState<string | null>(agent.last_message || null)
    const [isJumping, setIsJumping] = useState(false)

    // Detectar mensajes nuevos
    useEffect(() => {
        if (agent.last_message && agent.last_message !== lastSeenMsg) {
            setPendingMessage(agent.last_message)
            setLastSeenMsg(agent.last_message)
            // Pequeña reacción física al recibir/enviar mensaje
            setIsJumping(true)
            setTimeout(() => setIsJumping(false), 400)
        }
    }, [agent.last_message, lastSeenMsg])

    // Mostrar mensaje cuando no esté pensando
    useEffect(() => {
        if (pendingMessage && !isThinking) {
            setShowBubble(true)
            const timer = setTimeout(() => {
                setShowBubble(false)
                setPendingMessage(null)
            }, 6000)
            return () => clearTimeout(timer)
        }
    }, [pendingMessage, isThinking])

    // Reacción por suscripción (Realtime)
    useEffect(() => {
        if (lastMsgTrigger) {
            setIsJumping(true)
            setTimeout(() => setIsJumping(false), 500)
        }
    }, [lastMsgTrigger])

    // Determinar si está en movimiento para la animación de balanceo
    const [lastPos, setLastPos] = useState(pos)
    const [isMoving, setIsMoving] = useState(false)

    useEffect(() => {
        if (pos.x !== lastPos.x || pos.y !== lastPos.y) {
            setIsMoving(true)
            const timeout = setTimeout(() => setIsMoving(false), 1500)
            setLastPos(pos)
            return () => clearTimeout(timeout)
        }
    }, [pos, lastPos])

    const partner = agent.collaboration_with ? agents.find(a => a.id === agent.collaboration_with) : null

    return (
        <motion.div
            className="absolute group"
            style={{ left: 0, top: 0, zIndex }}
            initial={false}
            animate={{
                x: isoPos.x,
                y: isWorking ? isoPos.y + 4 : isoPos.y,
                zIndex: zIndex + (showBubble ? 50 : 0) // Subir zIndex si tiene mensaje activo
            }}
            transition={{
                x: { duration: 1.5, ease: "easeInOut" },
                y: { duration: 1.5, ease: "easeInOut" }
            }}
        >
            <div className="relative pointer-events-auto cursor-pointer">
                {/* SOMBRA DINÁMICA */}
                <motion.div
                    className="absolute -left-2 -top-1 w-[16px] h-[8px] bg-black/40 rounded-[100%] blur-[2px]"
                    animate={{
                        scale: (isThinking || isJumping) ? 0.7 : 1,
                        opacity: (isThinking || isJumping) ? 0.2 : 0.5,
                    }}
                />

                {/* CUERPO HUMANOIDE CON LEVITACIÓN */}
                <motion.div
                    className="relative flex flex-col items-center"
                    animate={
                        isJumping ? { y: [0, -12, 0] } :
                            isThinking ? { y: [0, -8, 0], scale: [1, 1.05, 1] } :
                                isMoving ? { y: [0, -4, 0] } :
                                    isWorking ? { rotate: [0, -1, 0, 1, 0], y: [0, -2, 0] } :
                                        { y: [0, -4, 0] } // Flotación suave en reposo
                    }
                    transition={{
                        y: {
                            duration: isJumping ? 0.4 : (isThinking ? 1.5 : 2.5),
                            repeat: Infinity,
                            ease: "easeInOut"
                        },
                        rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                    }}
                >
                    {/* CABEZA */}
                    <div className="w-[12px] h-[12px] rounded-sm relative shadow-sm z-20" style={{ backgroundColor: features.skin }}>
                        {/* PELO */}
                        {features.hair !== 'bald' && (
                            <div
                                className={`absolute inset-x-0 -top-1 h-[6px] rounded-t-sm ${features.hair === 'long' ? 'h-[10px] -mx-1' : ''}`}
                                style={{ backgroundColor: features.hairColor }}
                            />
                        )}
                        {/* OJOS */}
                        <div className="absolute top-[5px] left-[2px] w-[2px] h-[2px] bg-slate-900/80 rounded-full" />
                        <div className="absolute top-[5px] right-[2px] w-[2px] h-[2px] bg-slate-900/80 rounded-full" />
                    </div>

                    {/* TORSO / CAMISETA */}
                    <div
                        className="w-[14px] h-[16px] -mt-1 rounded-sm relative z-10 shadow-md border-b-2 border-black/20 overflow-hidden"
                        style={{ backgroundColor: color }}
                    >
                        {/* Reflejo premium */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40" />

                        {/* BRAZOS */}
                        <div className="absolute -left-1.5 top-0 w-[4px] h-[10px] bg-white/10 rounded-full" />
                        <div className="absolute -right-1.5 top-0 w-[4px] h-[10px] bg-white/10 rounded-full" />
                    </div>

                    {/* PIERNAS (Solo si no está sentado/working) */}
                    {!isWorking && (
                        <div className="flex gap-1 -mt-0.5 z-0">
                            <div className="w-[4px] h-[6px] bg-slate-800 rounded-b-sm" />
                            <div className="w-[4px] h-[6px] bg-slate-800 rounded-b-sm" />
                        </div>
                    )}

                    {/* AURA DE PENSAMIENTO */}
                    <AnimatePresence>
                        {isThinking && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }}
                                exit={{ opacity: 0 }}
                                className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-xl z-0"
                            />
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* ETIQUETAS Y BOCADILLOS */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-[110]">
                    <AnimatePresence mode="wait">
                        {isThinking ? (
                            <SpeechBubble key="thinking" message="..." type="thinking" partnerName={partner?.name} />
                        ) : showBubble && pendingMessage ? (
                            <SpeechBubble key="speech" message={pendingMessage} partnerName={partner?.name} />
                        ) : null}
                    </AnimatePresence>

                    {/* Nombre (Glassmorphism Style) */}
                    <div className="mt-1 px-2.5 py-1 backdrop-blur-md bg-white/5 border border-white/20 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: color }} />
                        <span className="text-white font-bold text-[8px] uppercase tracking-[0.2em] drop-shadow-md">
                            {agent.name}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Mapa Completo de Obstáculos ──────────────────────────────────────────────
// Incluye muros internos, escritorios y zonas sin paso.
// Definimos las celdas bloqueadas como rangos de [x1,y1,x2,y2] (inclusive).
const BLOCKED_RECTS: [number, number, number, number][] = [
    // Muro trasero derecho (y=0)
    [0, 0, 30, 0],
    // Muro vertical CEO/Meetings (x~10.5)
    [10, 0, 11, 10],
    // Muro vertical CEO/Server (x~22)
    [22, 0, 23, 10],
    // Muro horizontal central (y~10.5)
    [0, 10, 22, 11],
    // Zona de escritorios fila 1
    [2, 13, 20, 15],
    // Zona de escritorios fila 2
    [2, 21, 20, 23],
    // Sala de reuniones — mesa central
    [3, 3, 7, 7],
    // Zona server rack
    [24, 2, 28, 8],
    // Límites del mapa
    [-1, -1, -1, 30],
    [30, -1, 30, 30],
]

const WALKABLE_CAFETERIA_SLOTS: { x: number; y: number }[] = [
    { x: 25, y: 14 }, { x: 27, y: 14 },
    { x: 25, y: 16 }, { x: 27, y: 16 },
    { x: 25, y: 18 }, { x: 27, y: 18 },
    { x: 25, y: 20 }, { x: 27, y: 20 },
    { x: 24, y: 22 }, { x: 26, y: 22 },
    { x: 24, y: 24 }, { x: 26, y: 24 },
]

const WALKABLE_MEETING_SLOTS: { x: number; y: number }[] = [
    { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 8, y: 2 },
    { x: 2, y: 5 }, { x: 8, y: 5 },
    { x: 2, y: 8 }, { x: 5, y: 8 }, { x: 8, y: 8 },
]

const isCellBlocked = (x: number, y: number): boolean => {
    if (x < 0 || x > 29 || y < 0 || y > 29) return true
    return BLOCKED_RECTS.some(([x1, y1, x2, y2]) =>
        x >= x1 && x <= x2 && y >= y1 && y <= y2
    )
}

// Mantener compatibilidad con el nombre anterior también
const isObstacle = (x: number, y: number, _furniture?: Furniture[]) => isCellBlocked(x, y)

export function OfficeMap({ agents }: { agents: Agent[] }) {
    const supabase = useMemo(() => createClient(), [])
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({})
    const [agentMessages, setAgentMessages] = useState<Record<string, number>>({})
    const [activeTasks, setActiveTasks] = useState<any[]>([])
    const furniture = useMemo(() => createFurniture(agents), [agents])

    // Suscripción a Tareas Activas
    useEffect(() => {
        const fetchTasks = async () => {
            const { data } = await supabase.from('tasks').select('*').in('status', ['pending', 'in_progress'])
            if (data) setActiveTasks(data)
        }
        fetchTasks()

        const channel = supabase
            .channel('office_collaboration')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchTasks()
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_messages' }, payload => {
                const newMsg = payload.new
                const agentId = newMsg.sender_agent_id || newMsg.agent_id
                if (agentId) {
                    setAgentMessages(prev => ({ ...prev, [agentId]: Date.now() }))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const workstationAssignments = useMemo(() => {
        const assignments: Record<string, { x: number, y: number }> = {}

        // Separar agentes colaborando vs no
        const collaborating = agents.filter(agent =>
            activeTasks.some(t =>
                t.status === 'in_progress' &&
                t.chain_of_command?.includes(agent.id) &&
                t.chain_of_command.length > 1
            )
        )
        const notCollaborating = agents.filter(a => !collaborating.includes(a))

        // Agentes colaborando → Sala de Reuniones (slots fijos)
        collaborating.forEach((agent, i) => {
            const slot = WALKABLE_MEETING_SLOTS[i % WALKABLE_MEETING_SLOTS.length]
            assignments[agent.id] = { x: slot.x, y: slot.y }
        })

        // Agentes no colaborando → Puesto de trabajo o cafetería
        notCollaborating.forEach((agent, i) => {
            const globalIdx = agents.indexOf(agent)
            if (globalIdx === 0) {
                // J.A.R.V.I.S. → Despacho CEO
                assignments[agent.id] = { x: 15, y: 5 }
            } else if (agent.status === 'working' || agent.status === 'thinking') {
                const wsIdx = (globalIdx - 1) % WORKSTATIONS.length
                const ws = WORKSTATIONS[wsIdx]
                assignments[agent.id] = { x: ws.x, y: ws.y + 1 }
            } else {
                // IDLE → slot único en cafetería
                const idleIdx = notCollaborating
                    .filter(a => a.status === 'idle' && agents.indexOf(a) > 0)
                    .indexOf(agent)
                const slot = WALKABLE_CAFETERIA_SLOTS[Math.max(0, idleIdx) % WALKABLE_CAFETERIA_SLOTS.length]
                assignments[agent.id] = { x: slot.x, y: slot.y }
            }
        })

        return assignments
    }, [agents, activeTasks])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, 1100, 720)

        // Fondo profundo
        ctx.fillStyle = '#020617'
        ctx.fillRect(0, 0, 1100, 720)

        const drawPoly = (points: { x: number, y: number }[], color: string) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
            ctx.closePath()
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'
            ctx.lineWidth = 1
            ctx.stroke()
        }

        // --- DIBUJAR SUELO (Grid Isométrico 30x30) ---
        for (let x = 0; x < 30; x++) {
            for (let y = 0; y < 30; y++) {
                const p1 = toIso(x, y)
                const p2 = toIso(x + 1, y)
                const p3 = toIso(x + 1, y + 1)
                const p4 = toIso(x, y + 1)
                const color = (x + y) % 2 === 0 ? '#1e293b' : '#0f172a'
                drawPoly([p1, p2, p3, p4], color)
            }
        }

        // --- MUROS BASE EN CANVAS (Paredes de Fondo Izquierda y Derecha) ---
        // Para no ocluir agentes, los muros TRASEROS se dibujan en Canvas (siempre debajo de todo)
        const drawCanvasWall = (x: number, y: number, w: number, h: number, z: number, colorTop: string, colorLeft: string, colorRight: string) => {
            const pTop = [toIso(x, y, z), toIso(x + w, y, z), toIso(x + w, y + h, z), toIso(x, y + h, z)]
            const pLeft = [toIso(x, y + h, 0), toIso(x + w, y + h, 0), toIso(x + w, y + h, z), toIso(x, y + h, z)]
            const pRight = [toIso(x + w, y, 0), toIso(x + w, y + h, 0), toIso(x + w, y + h, z), toIso(x + w, y, z)]
            drawPoly(pTop, colorTop)
            drawPoly(pLeft, colorLeft)
            drawPoly(pRight, colorRight)
        }

        // Pared Trasera Izquierda (X:0..30, Y:-0.5..0)
        drawCanvasWall(0, -0.5, 30, 0.5, 6, '#334155', '#0f172a', '#1e293b')
        // Pared Trasera Derecha (X:-0.5..0, Y:0..30)
        drawCanvasWall(-0.5, 0, 0.5, 30, 6, '#334155', '#0f172a', '#1e293b')

    }, [])

    useEffect(() => {
        setPositions(prev => {
            const next = { ...prev }
            let needsUpdate = false
            agents.forEach(agent => {
                if (!next[agent.id]) {
                    next[agent.id] = { x: 15, y: 15 } // Initial position for new agents
                    needsUpdate = true
                }
            })
            return needsUpdate ? next : prev
        })

        const interval = setInterval(() => {
            setPositions(() => {
                // Volvemos a computar directamente desde workstationAssignments
                // para que los agentes siempre estén en su posición asignada.
                const next: Record<string, { x: number, y: number }> = {}
                agents.forEach(agent => {
                    const target = workstationAssignments[agent.id]
                    if (target) next[agent.id] = target
                })
                return next
            })
        }, 2000)
        return () => clearInterval(interval)
    }, [agents, workstationAssignments])

    return (
        <div className="flex flex-col items-center justify-center w-full h-full">
            <div className="relative overflow-hidden border-4 border-slate-800 rounded-xl bg-slate-950 shadow-2xl flex-shrink-0" style={{ width: 1100, height: 720 }}>
                {/* 1. Capa Base (Suelo y Paredes Traseras) */}
                <canvas ref={canvasRef} width={1100} height={720} className="absolute inset-0 z-0 pointer-events-none" />

                {/* 2. Capa Muros Interiores DOM (Z-Sorted) */}
                {/* Muro CEO-Meetings */}
                <IsoBox f={{ x: 10.5, y: 0, w: 0.5, h: 10, d: 2, colorTop: '#475569', colorLeft: '#1e293b', colorRight: '#334155', type: 'wall' }} zOffset={-1} />
                {/* Muro CEO-Kitchen */}
                <IsoBox f={{ x: 22, y: 0, w: 0.5, h: 10, d: 2, colorTop: '#475569', colorLeft: '#1e293b', colorRight: '#334155', type: 'wall' }} zOffset={-1} />
                {/* Muro Central Bajo */}
                <IsoBox f={{ x: 0, y: 10.5, w: 22.5, h: 0.5, d: 1, colorTop: '#475569', colorLeft: '#1e293b', colorRight: '#334155', type: 'wall' }} zOffset={-1} />


                {/* 3. Capa Mobiliario Dinámico (Z-Sorted) */}
                {furniture.map((f, i) => (
                    <IsoBox key={`furn-${i}`} f={f} />
                ))}

                {/* Capa de Conexiones de Datos (Fase 24) */}
                <DataLines agents={agents} positions={positions} activeTasks={activeTasks} />

                {/* 4. Capa Agentes 2.5D (Z-Sorted) */}
                {agents.map(agent => (
                    <IsoAgent
                        key={agent.id}
                        agent={agent}
                        agents={agents}
                        pos={positions[agent.id] || { x: 0, y: 0 }}
                        isThinking={agent.status === 'thinking'}
                        lastMsgTrigger={agentMessages[agent.id]}
                    />
                ))}
            </div>

            {/* HUD Status Bar */}
            <div className="w-[1100px] mt-4 bg-slate-900 border-2 border-slate-700 rounded-xl p-3 flex flex-wrap gap-3 font-mono text-xs overflow-hidden min-h-[52px] shrink-0 shadow-lg">
                <div className="absolute left-6 text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">STATUS_LOG</div>
                <div className="flex flex-wrap gap-3 pl-24 w-full">
                    {agents.map(agent => (
                        <div key={agent.id} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-sm border border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: getAgentColor(agent) }} />
                            <span className="text-slate-300 font-bold truncate max-w-[120px] ml-1">{agent.name}</span>
                            <span className={`px-2 py-0.5 rounded-sm uppercase font-bold text-[9px] tracking-wider
                                ${agent.status === 'working' ? 'bg-indigo-500/20 text-indigo-400' : ''}
                                ${agent.status === 'thinking' ? 'bg-amber-500/20 text-amber-400 animate-pulse' : ''}
                                ${agent.status === 'idle' ? 'bg-slate-500/20 text-slate-400' : ''}
                            `}>
                                &gt; {agent.status}
                            </span>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <div className="text-slate-500 italic px-2 py-1">&gt; No hay unidades desplegadas.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
