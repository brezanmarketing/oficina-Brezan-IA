'use client'

import { motion } from 'framer-motion'

interface JarvisVisualizerProps {
    status: string
    size?: number
}

export function JarvisVisualizer({ status, size = 48 }: JarvisVisualizerProps) {
    const isThinking = status === 'thinking'
    const isWorking = status === 'working'

    // Velocidades según estado
    const rotationDuration = isWorking ? 3 : isThinking ? 5 : 10
    const pulseDuration = isWorking ? 0.5 : isThinking ? 1 : 2

    return (
        <div className="relative flex items-center justify-center overflow-hidden rounded-full" style={{ width: size, height: size }}>
            {/* Fondo / Brillo de la esfera */}
            <motion.div
                className="absolute inset-[10%] rounded-full bg-cyan-500/10 blur-sm"
                animate={{
                    opacity: [0.1, 0.3, 0.1],
                    scale: isWorking ? [0.9, 1.1, 0.9] : 1
                }}
                transition={{ duration: pulseDuration, repeat: Infinity }}
            />

            {/* Cuadrícula de Latitudes (Elipses horizontales) */}
            <div className="absolute inset-0 flex flex-col justify-around py-[15%] pointer-events-none opacity-40">
                {[...Array(3)].map((_, i) => (
                    <div key={`lat-${i}`} className="w-full h-[1px] bg-cyan-400/30" />
                ))}
            </div>

            {/* Red de Longitudes Rotatorias (Simulación 3D) */}
            <div className="absolute inset-0 flex items-center justify-center">
                {[0, 45, 90, 135].map((angle, i) => (
                    <motion.div
                        key={`long-${i}`}
                        className="absolute h-full border-l border-cyan-400/40"
                        style={{ width: '100%', borderRadius: '50%' }}
                        animate={{
                            rotateY: [angle, angle + 360],
                            opacity: isThinking || isWorking ? [0.3, 0.6, 0.3] : 0.4
                        }}
                        transition={{
                            rotateY: { duration: rotationDuration, repeat: Infinity, ease: 'linear' },
                            opacity: { duration: 2, repeat: Infinity }
                        }}
                    />
                ))}
            </div>

            {/* Nodos de Datos (Puntos Aleatorios sobre la superficie) */}
            <div className="absolute inset-0">
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={`node-${i}`}
                        className="absolute w-1 h-1 bg-cyan-300 rounded-full shadow-[0_0_5px_#00f2ff]"
                        style={{
                            top: `${20 + Math.random() * 60}%`,
                            left: `${20 + Math.random() * 60}%`,
                        }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.2, 0.5],
                        }}
                        transition={{
                            duration: 0.5 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>

            {/* Anillo de Escaneo Externo (HUD) */}
            <motion.svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full opacity-20"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="#00f2ff"
                    strokeWidth="0.5"
                    strokeDasharray="5 15"
                />
            </motion.svg>

            {/* Núcleo de Energía Interno */}
            <motion.div
                className="relative z-10 w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#00f2ff]"
                animate={{
                    scale: isWorking ? [1, 1.5, 1] : 1,
                    opacity: isThinking ? [0.5, 1, 0.5] : 0.8
                }}
                transition={{ duration: pulseDuration, repeat: Infinity }}
            />

            {/* Destello de procesado (Solo en thinking/working) */}
            {(isThinking || isWorking) && (
                <motion.div
                    className="absolute inset-0 bg-cyan-400/5 mix-blend-overlay"
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                />
            )}
        </div>
    )
}
