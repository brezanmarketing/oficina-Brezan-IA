'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FileText,
    FileSpreadsheet,
    FileCode,
    FileSearch,
    Download,
    Eye,
    Star,
    Trash2,
    Search,
    Filter,
    Upload,
    Plus,
    ExternalLink,
    Loader2,
    MoreVertical,
    CheckCircle2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

interface Resource {
    id: string
    title: string
    description: string
    type: 'pdf' | 'excel' | 'markdown' | 'image' | 'code' | 'other'
    category: string
    storage_path: string
    size_bytes: number
    created_at: string
    is_pinned: boolean
    created_by: string
}

export default function RecursosOficina() {
    const supabase = createClient()
    const [resources, setResources] = useState<Resource[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [viewUrl, setViewUrl] = useState<string | null>(null)

    const fetchResources = async () => {
        try {
            const { data, error } = await supabase
                .from('office_resources')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setResources(data || [])
        } catch (err) {
            console.error('Error fetching resources:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchResources()

        const channel = supabase
            .channel('resources_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'office_resources' }, () => {
                fetchResources()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const filteredResources = resources.filter(res => {
        const matchesType = filter === 'all' || res.type === filter || (filter === 'pinned' && res.is_pinned)
        const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase())
        return matchesType && matchesSearch
    })

    const handleView = async (resource: Resource) => {
        setSelectedResource(resource)
        const { data } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(resource.storage_path, 3600)
        setViewUrl(data?.signedUrl || null)
    }

    const handleDownload = async (resource: Resource) => {
        const { data } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(resource.storage_path, 60)

        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank')
        }
    }

    const togglePin = async (resource: Resource) => {
        await supabase
            .from('office_resources')
            .update({ is_pinned: !resource.is_pinned })
            .eq('id', resource.id)
    }

    const deleteResource = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este recurso?')) return
        await supabase
            .from('office_resources')
            .delete()
            .eq('id', id)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen bg-slate-950/20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <FileSearch className="w-6 h-6 text-indigo-400" />
                        </div>
                        RECURSOS DE LA OFICINA
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest">Repositorio Estratégico & Documentación</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-slate-800 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Subir Archivo
                    </button>
                    <div className="relative group">
                        <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                            <Plus className="w-4 h-4" /> Nuevo <MoreVertical className="w-3 h-3" />
                        </button>
                        {/* Dropdown simple placeholder */}
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="BUSCAR EN EL ARCHIVO..."
                        className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {['all', 'pdf', 'excel', 'markdown', 'pinned'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filter === t ? 'bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:border-white/20'
                                }`}
                        >
                            {t === 'all' ? 'Todos' : t === 'pinned' ? '⭐ Fijados' : t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resources Grid */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-slate-500 font-mono text-[10px] uppercase animate-pulse">Consultando Registros Centrales...</p>
                </div>
            ) : filteredResources.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 bg-slate-950/20 border border-dashed border-white/10 rounded-3xl opacity-50">
                    <FileSearch className="w-12 h-12 text-slate-700" />
                    <p className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.2em]">No se han localizado documentos con esos criterios.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence>
                        {filteredResources.map((res) => (
                            <ResourceCard
                                key={res.id}
                                resource={res}
                                onView={() => handleView(res)}
                                onDownload={() => handleDownload(res)}
                                onTogglePin={() => togglePin(res)}
                                onDelete={() => deleteResource(res.id)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal Visor */}
            <AnimatePresence>
                {selectedResource && viewUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                        >
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeConfig(selectedResource.type).bg}`}>
                                        {getTypeConfig(selectedResource.type).icon}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm tracking-tight">{selectedResource.title}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{selectedResource.type} · {(selectedResource.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedResource(null)}
                                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 flex items-center justify-center transition-all"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-950/40 p-4">
                                {selectedResource.type === 'pdf' ? (
                                    <iframe src={viewUrl} className="w-full h-full rounded-xl border border-white/5" />
                                ) : selectedResource.type === 'markdown' ? (
                                    <div className="prose prose-invert max-w-none p-8">
                                        {/* Aquí llamaríamos al fetch del contenido MD o lo pasamos si está en BD */}
                                        <p className="text-slate-500 italic">Visualizando contenido Markdown...</p>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                                        <FileSpreadsheet className="w-20 h-20 text-indigo-500 opacity-20" />
                                        <div>
                                            <p className="text-white font-black text-xl">VISOR NATIVO ${selectedResource.type.toUpperCase()}</p>
                                            <p className="text-slate-500 text-sm mt-2 max-w-sm">Este formato no admite vista previa en el navegador. Por favor descarga el archivo para verlo.</p>
                                        </div>
                                        <button
                                            onClick={() => handleDownload(selectedResource)}
                                            className="px-8 py-3 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/10"
                                        >
                                            DESCARGAR AHORA
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

function ResourceCard({ resource, onView, onDownload, onTogglePin, onDelete }: any) {
    const config = getTypeConfig(resource.type)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -5 }}
            className="group relative bg-slate-900/50 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-300 overflow-hidden"
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${config.gradient} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity blur-2xl`} />

            <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bg} border ${config.border} shadow-lg shadow-black/20`}>
                    {config.icon}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onTogglePin} className={`p-2 rounded-lg ${resource.is_pinned ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 text-slate-500'} hover:bg-white/10 transition-colors`}>
                        <Star className={`w-4 h-4 ${resource.is_pinned ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={onDelete} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-white font-bold text-sm tracking-tight line-clamp-2 leading-relaxed min-h-[2.5rem] group-hover:text-indigo-400 transition-colors">
                    {resource.title}
                </h3>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2">
                    <span className="text-slate-700">●</span> {resource.created_by.includes('-') ? 'Jarvis' : 'Usuario'} · {(resource.size_bytes / 1024).toFixed(1)} KB
                </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
                <button
                    onClick={onView}
                    className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    <Eye className="w-3.5 h-3.5 inline mr-2" /> Ver
                </button>
                <button
                    onClick={onDownload}
                    className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center transition-all"
                >
                    <Download className="w-4 h-4" />
                </button>
            </div>

            <div className="absolute top-2 left-2">
                {resource.is_pinned && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />}
            </div>
        </motion.div>
    )
}

function getTypeConfig(type: string) {
    switch (type) {
        case 'pdf': return {
            icon: <FileText className="w-6 h-6 text-rose-400" />,
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            gradient: 'from-rose-500 to-transparent'
        }
        case 'excel': return {
            icon: <FileSpreadsheet className="w-6 h-6 text-emerald-400" />,
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            gradient: 'from-emerald-500 to-transparent'
        }
        case 'markdown': return {
            icon: <FileCode className="w-6 h-6 text-indigo-400" />,
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/20',
            gradient: 'from-indigo-500 to-transparent'
        }
        default: return {
            icon: <FileText className="w-6 h-6 text-slate-400" />,
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/20',
            gradient: 'from-slate-500 to-transparent'
        }
    }
}
