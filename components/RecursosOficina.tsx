'use client'

import { useEffect, useState, useRef } from 'react'
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
    CheckCircle2,
    Folder,
    FolderPlus,
    ChevronRight,
    ArrowLeft,
    X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

interface OfficeFolder {
    id: string
    name: string
    parent_id: string | null
    color: string
}

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
    folder_id: string | null
}

export default function RecursosOficina() {
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // States
    const [resources, setResources] = useState<Resource[]>([])
    const [folders, setFolders] = useState<OfficeFolder[]>([])
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [viewUrl, setViewUrl] = useState<string | null>(null)

    // Modals
    const [showFolderModal, setShowFolderModal] = useState(false)
    const [showDocModal, setShowDocModal] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [newDocTitle, setNewDocTitle] = useState('')
    const [newDocContent, setNewDocContent] = useState('')

    const fetchData = async () => {
        try {
            setLoading(true)
            // Fetch Resources
            const { data: resData, error: resError } = await supabase
                .from('office_resources')
                .select('*')
                .order('created_at', { ascending: false })

            if (resError) throw resError
            setResources(resData || [])

            // Fetch Folders
            const { data: foldData, error: foldError } = await supabase
                .from('office_folders')
                .select('*')
                .order('name')

            if (foldError) throw foldError
            setFolders(foldData || [])

        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        const resChannel = supabase
            .channel('resources_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'office_resources' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'office_folders' }, () => fetchData())
            .subscribe()

        return () => { supabase.removeChannel(resChannel) }
    }, [])

    // Filtering
    const filteredFolders = folders.filter(f => f.parent_id === currentFolderId)
    const filteredResources = resources.filter(res => {
        const matchesFolder = res.folder_id === currentFolderId
        const matchesType = filter === 'all' || res.type === filter || (filter === 'pinned' && res.is_pinned)
        const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase())
        return matchesFolder && matchesType && matchesSearch
    })

    // Navigation
    const breadcrumbs = () => {
        const crumbs: OfficeFolder[] = []
        let current: OfficeFolder | undefined = folders.find(f => f.id === currentFolderId)
        while (current) {
            crumbs.unshift(current)
            const parentId: string | null = current.parent_id
            current = parentId ? folders.find(f => f.id === parentId) : undefined
        }
        return crumbs
    }

    // Actions
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
            const storagePath = `uploads/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('office-resources')
                .upload(storagePath, file)

            if (uploadError) throw uploadError

            // Determine type
            let type: Resource['type'] = 'other'
            if (file.type.includes('pdf')) type = 'pdf'
            else if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx')) type = 'excel'
            else if (file.type.includes('markdown') || file.name.endsWith('.md')) type = 'markdown'
            else if (file.type.includes('image')) type = 'image'

            await supabase.from('office_resources').insert({
                title: file.name,
                type,
                storage_path: storagePath,
                size_bytes: file.size,
                created_by: 'user',
                folder_id: currentFolderId
            })

            fetchData()
        } catch (err) {
            console.error('Upload error:', err)
            alert('Error al subir archivo')
        } finally {
            setUploading(false)
        }
    }

    const createFolder = async () => {
        if (!newFolderName) return
        await supabase.from('office_folders').insert({
            name: newFolderName,
            parent_id: currentFolderId
        })
        setNewFolderName('')
        setShowFolderModal(false)
        fetchData()
    }

    const createNote = async () => {
        if (!newDocTitle) return
        try {
            const fileName = `${Date.now()}_${newDocTitle.replace(/\s+/g, '_')}.md`
            const storagePath = `notes/${fileName}`
            const content = newDocContent || '# ' + newDocTitle

            await supabase.storage
                .from('office-resources')
                .upload(storagePath, new Blob([content], { type: 'text/markdown' }))

            await supabase.from('office_resources').insert({
                title: newDocTitle,
                type: 'markdown',
                storage_path: storagePath,
                size_bytes: content.length,
                created_by: 'user',
                folder_id: currentFolderId
            })

            setNewDocTitle('')
            setNewDocContent('')
            setShowDocModal(false)
            fetchData()
        } catch (err) {
            console.error('Create note error:', err)
        }
    }

    const handleView = async (resource: Resource) => {
        setSelectedResource(resource)
        const { data } = await supabase.storage
            .from('office-resources')
            .createSignedUrl(resource.storage_path, 3600)
        setViewUrl(data?.signedUrl || null)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen bg-slate-950/20">
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
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 bg-slate-800 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Subir Archivo
                    </button>

                    <div className="flex items-center bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 overflow-hidden">
                        <button
                            onClick={() => setShowDocModal(true)}
                            className="px-4 py-2 text-white text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 border-r border-indigo-400/30 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Nuevo
                        </button>
                        <button
                            onClick={() => setShowFolderModal(true)}
                            className="px-3 py-2 text-white hover:bg-indigo-600 transition-all"
                            title="Nueva Carpeta"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900/40 px-4 py-2 rounded-xl border border-white/5">
                <button
                    onClick={() => setCurrentFolderId(null)}
                    className={`hover:text-indigo-400 transition-colors ${!currentFolderId ? 'text-indigo-400 font-bold' : ''}`}
                >
                    RAÍZ
                </button>
                {breadcrumbs().map(crumb => (
                    <div key={crumb.id} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-slate-700" />
                        <button
                            onClick={() => setCurrentFolderId(crumb.id)}
                            className={`hover:text-indigo-400 transition-colors ${currentFolderId === crumb.id ? 'text-indigo-400 font-bold' : ''}`}
                        >
                            {crumb.name.toUpperCase()}
                        </button>
                    </div>
                ))}
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="BUSCAR EN ESTA CARPETA..."
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

            {/* Content: Folders + Resources */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-slate-500 font-mono text-[10px] uppercase animate-pulse">Analizando Archivos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Folder Cards */}
                    {filteredFolders.map(folder => (
                        <motion.div
                            key={folder.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="group bg-slate-900/40 border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/60 transition-all flex items-center gap-4"
                        >
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Folder className="w-6 h-6 text-indigo-400 fill-indigo-400/20" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-white font-bold text-sm truncate">{folder.name}</h3>
                                <p className="text-[10px] text-slate-500 uppercase font-mono">Carpeta</p>
                            </div>
                        </motion.div>
                    ))}

                    {/* Resource Cards */}
                    <AnimatePresence>
                        {filteredResources.map((res) => (
                            <ResourceCard
                                key={res.id}
                                resource={res}
                                onView={() => handleView(res)}
                                onDownload={async () => {
                                    const { data } = await supabase.storage.from('office-resources').createSignedUrl(res.storage_path, 60)
                                    if (data?.signedUrl) window.open(data.signedUrl)
                                }}
                                onDelete={async () => {
                                    if (confirm('¿Eliminar recurso?')) {
                                        await supabase.from('office_resources').delete().eq('id', res.id)
                                        fetchData()
                                    }
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredFolders.length === 0 && filteredResources.length === 0 && (
                <div className="h-48 flex flex-col items-center justify-center gap-4 bg-slate-950/20 border border-dashed border-white/10 rounded-3xl opacity-50">
                    <FileSearch className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-600 font-mono text-[10px] uppercase tracking-widest">Carpeta Vacía</p>
                </div>
            )}

            {/* MODAL: Nueva Carpeta */}
            <AnimatePresence>
                {showFolderModal && (
                    <Modal onClose={() => setShowFolderModal(false)} title="NUEVA CARPETA">
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="NOMBRE DE LA CARPETA..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                autoFocus
                            />
                            <button
                                onClick={createFolder}
                                className="w-full py-3 bg-indigo-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all"
                            >
                                CREAR CARPETA
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* MODAL: Nuevo Documento (Nota) */}
            <AnimatePresence>
                {showDocModal && (
                    <Modal onClose={() => setShowDocModal(false)} title="NUEVA NOTA ESTRATÉGICA">
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="TÍTULO DE LA NOTA..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                                value={newDocTitle}
                                onChange={e => setNewDocTitle(e.target.value)}
                            />
                            <textarea
                                placeholder="CONTENIDO (MARKDOWN ADMITIDO)..."
                                className="w-full h-48 bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                                value={newDocContent}
                                onChange={e => setNewDocContent(e.target.value)}
                            />
                            <button
                                onClick={createNote}
                                className="w-full py-3 bg-indigo-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all"
                            >
                                GUARDAR NOTA
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Modal Visor (PDF/MD) */}
            <AnimatePresence>
                {selectedResource && viewUrl && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">{selectedResource.title}</h3>
                                </div>
                                <button onClick={() => setSelectedResource(null)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 bg-slate-950 overflow-hidden">
                                {selectedResource.type === 'pdf' ? (
                                    <iframe src={viewUrl} className="w-full h-full border-none" />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                                        <ExternalLink className="w-10 h-10 opacity-20" />
                                        <p className="text-xs font-mono uppercase tracking-[0.2em]">Visualización no soportada</p>
                                        <a href={viewUrl} target="_blank" className="text-indigo-400 text-[10px] font-bold underline">ABRIR EN NUEVA PESTAÑA</a>
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

function Modal({ children, onClose, title }: any) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white font-black text-[10px] tracking-[0.3em] uppercase">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </motion.div>
        </div>
    )
}

function ResourceCard({ resource, onView, onDownload, onDelete }: any) {
    const config = getTypeConfig(resource.type)
    return (
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group relative bg-slate-900/50 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-300"
        >
            <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bg} border ${config.border}`}>
                    {config.icon}
                </div>
                <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <h3 className="text-white font-bold text-sm tracking-tight line-clamp-2 min-h-[2.5rem] mb-4">{resource.title}</h3>
            <div className="flex items-center justify-between">
                <button onClick={onView} className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Ver
                </button>
                <button onClick={onDownload} className="text-[10px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-1">
                    <Download className="w-3 h-3" /> Bajar
                </button>
            </div>
            <div className="absolute top-2 left-2">
                {resource.is_pinned && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            </div>
        </motion.div>
    )
}

function getTypeConfig(type: string) {
    switch (type) {
        case 'pdf': return { icon: <FileText className="w-6 h-6 text-rose-400" />, bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
        case 'excel': return { icon: <FileSpreadsheet className="w-6 h-6 text-emerald-400" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
        case 'markdown': return { icon: <FileCode className="w-6 h-6 text-indigo-400" />, bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' }
        default: return { icon: <FileText className="w-6 h-6 text-slate-400" />, bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
    }
}
