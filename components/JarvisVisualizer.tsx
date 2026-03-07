'use client'

import { motion } from 'framer-motion'

interface JarvisVisualizerProps {
    status: string // Permitir cualquier estado para evitar errores de tipo con AgentStatus
    size?: number
}

export function JarvisVisualizer({ status, size = 48 }: JarvisVisualizerProps) {
    const isThinking = status === 'thinking'
    const isWorking = status === 'working'

    // Configuración de animación según estado
    const centerPulse = {
        scale: isWorking ? [1, 1.2, 1] : isThinking ? [1, 1.1, 1] : 1,
        opacity: isWorking ? [0.8, 1, 0.8] : isThinking ? [0.6, 0.9, 0.6] : 0.7,
    }

    const centerPulseTransition = {
        duration: isWorking ? 0.8 : 2,
        repeat: Infinity,
        ease: 'easeInOut' as const
    }

    const ringRotation = (duration: number, reverse = false) => ({
        rotate: reverse ? [360, 0] : [0, 360],
    })

    const ringRotationTransition = (duration: number) => ({
        duration: isWorking ? duration / 2 : isThinking ? duration : duration * 2,
        repeat: Infinity,
        ease: 'linear' as const
    })

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Brillo exterior (Aura) */}
            <motion.div
                className="absolute inset-0 rounded-full blur-md opacity-40"
                style={{ backgroundColor: '#00f2ff' }}
                animate={{
                    opacity: isWorking ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2],
                    scale: isWorking ? [1, 1.2, 1] : 1
                }}
                transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Anillo Exterior (Segmentado) */}
            <motion.svg
                viewBox="0 0 100 100"
                className="absolute w-full h-full"
                animate={ringRotation(6)}
                transition={ringRotationTransition(6)}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#00f2ff"
                    strokeWidth="2"
                    strokeDasharray="15 10"
                    className="opacity-40"
                />
            </motion.svg>

            {/* Anillo Medio (Puntos) */}
            <motion.svg
                viewBox="0 0 100 100"
                className="absolute w-[80%] h-[80%]"
                animate={ringRotation(4, true)}
                transition={ringRotationTransition(4)}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#00f2ff"
                    strokeWidth="1.5"
                    strokeDasharray="2 6"
                    className="opacity-60"
                />
            </motion.svg>

            {/* Anillo Interior (Sólido con huecos) */}
            <motion.svg
                viewBox="0 0 100 100"
                className="absolute w-[60%] h-[60%]"
                animate={ringRotation(3)}
                transition={ringRotationTransition(3)}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="none"
                    stroke="#00f2ff"
                    strokeWidth="3"
                    strokeDasharray="40 20"
                    className="opacity-80"
                />
            </motion.svg>

            {/* Núcleo Central (Reactor Arc) */}
            <motion.div
                className="relative z-10 rounded-full bg-cyan-400 shadow-[0_0_15px_#00f2ff]"
                style={{ width: '30%', height: '30%' }}
                animate={centerPulse}
                transition={centerPulseTransition}
            >
                {/* Reflejo interno */}
                <div className="absolute inset-[20%] rounded-full bg-white opacity-80 blur-[1px]" />
            </motion.div>

            {/* Micro-vibraciones en estado working */}
            {isWorking && (
                <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{
                        x: [-1, 1, -1, 0],
                        y: [1, -1, 1, 0]
                    }}
                    transition={{ duration: 0.1, repeat: Infinity }}
                />
            )}
        </div>
    )
}
