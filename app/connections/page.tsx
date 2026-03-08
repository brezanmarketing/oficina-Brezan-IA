'use client'
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── DATA ────────────────────────────────────────────────────────────────────

const INTEGRATIONS = [
    // IA & Modelos
    { id: "openai", name: "OpenAI", cat: "ia", icon: "◆", color: "#10A37F", desc: "GPT-4o, DALL·E, Whisper, Embeddings", keys: [{ k: "API Key", s: true }, { k: "Organization ID", s: false }], status: "disconnected", popular: true },
    { id: "gemini", name: "Google Gemini", cat: "ia", icon: "✦", color: "#4285F4", desc: "Gemini Ultra, Pro, Flash", keys: [{ k: "API Key", s: true }, { k: "Project ID", s: false }], status: "disconnected", popular: true },
    { id: "anthropic", name: "Claude", cat: "ia", icon: "◎", color: "#C15F3C", desc: "Claude Opus, Sonnet, Haiku", keys: [{ k: "API Key", s: true }], status: "disconnected" },
    { id: "elevenlabs", name: "ElevenLabs", cat: "ia", icon: "♪", color: "#9333EA", desc: "Text-to-speech premium y clonación", keys: [{ k: "API Key", s: true }, { k: "Voice ID", s: false }], status: "disconnected" },
    { id: "replicate", name: "Replicate", cat: "ia", icon: "⬡", color: "#0066FF", desc: "Imagen, video y modelos open source", keys: [{ k: "API Token", s: true }], status: "disconnected" },
    { id: "stabilityai", name: "Stability AI", cat: "ia", icon: "◈", color: "#FF6B9D", desc: "Stable Diffusion, generación imagen", keys: [{ k: "API Key", s: true }], status: "disconnected" },

    // Comunicación
    { id: "whatsapp", name: "WhatsApp", cat: "comunicacion", icon: "⬤", color: "#25D366", desc: "Mensajes, grupos y notificaciones", keys: [{ k: "Phone Number ID", s: false }, { k: "Access Token", s: true }, { k: "Webhook Secret", s: true }], status: "disconnected", popular: true },
    { id: "telegram", name: "Telegram", cat: "comunicacion", icon: "▲", color: "#2AABEE", desc: "Bot para comandos y alertas", keys: [{ k: "Bot Token", s: true }, { k: "Chat ID", s: false }], status: "disconnected", popular: true },
    { id: "slack", name: "Slack", cat: "comunicacion", icon: "◈", color: "#E01E5A", desc: "Notificaciones a canales de equipo", keys: [{ k: "Bot Token", s: true }, { k: "Webhook URL", s: false }], status: "disconnected" },
    { id: "discord", name: "Discord", cat: "comunicacion", icon: "⬟", color: "#5865F2", desc: "Servidor Discord y comandos", keys: [{ k: "Bot Token", s: true }, { k: "Guild ID", s: false }], status: "disconnected" },
    { id: "twilio", name: "Twilio", cat: "comunicacion", icon: "◉", color: "#F22F46", desc: "SMS, llamadas y WhatsApp Business", keys: [{ k: "Account SID", s: false }, { k: "Auth Token", s: true }, { k: "Phone Number", s: false }], status: "disconnected" },

    // Email & Calendario
    { id: "gmail", name: "Gmail", cat: "email", icon: "✉", color: "#EA4335", desc: "Leer, enviar y clasificar emails", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }, { k: "Refresh Token", s: true }], status: "disconnected", popular: true },
    { id: "outlook", name: "Outlook", cat: "email", icon: "✉", color: "#0078D4", desc: "Email corporativo Microsoft 365", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }, { k: "Tenant ID", s: false }], status: "disconnected" },
    { id: "gcal", name: "Google Calendar", cat: "email", icon: "◷", color: "#4285F4", desc: "Eventos, reuniones y recordatorios", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }], status: "disconnected" },
    { id: "sendgrid", name: "SendGrid", cat: "email", icon: "↗", color: "#1A82E2", desc: "Envío masivo y transaccional", keys: [{ k: "API Key", s: true }], status: "disconnected" },

    // Productividad
    { id: "notion", name: "Notion", cat: "productividad", icon: "▣", color: "#FFFFFF", desc: "Bases de datos, docs y wikis", keys: [{ k: "Integration Token", s: true }, { k: "Database ID", s: false }], status: "disconnected", popular: true },
    { id: "gdrive", name: "Google Drive", cat: "productividad", icon: "△", color: "#34A853", desc: "Almacenamiento y documentos", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }], status: "disconnected", popular: true },
    { id: "gsheets", name: "Google Sheets", cat: "productividad", icon: "▦", color: "#0F9D58", desc: "Hojas de cálculo automatizadas", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }], status: "disconnected" },
    { id: "airtable", name: "Airtable", cat: "productividad", icon: "⊞", color: "#FCB400", desc: "Base de datos visual y colaborativa", keys: [{ k: "API Key", s: true }, { k: "Base ID", s: false }], status: "disconnected" },
    { id: "jira", name: "Jira", cat: "productividad", icon: "◑", color: "#0052CC", desc: "Tickets, sprints y gestión ágil", keys: [{ k: "Domain", s: false }, { k: "Email", s: false }, { k: "API Token", s: true }], status: "disconnected" },
    { id: "github", name: "GitHub", cat: "productividad", icon: "⬡", color: "#E6EDF3", desc: "Repos, PRs, issues y CI/CD", keys: [{ k: "Personal Access Token", s: true }], status: "disconnected" },

    // Automatización
    { id: "n8n", name: "n8n", cat: "automatizacion", icon: "⚡", color: "#EA4B71", desc: "Flujos y automatizaciones avanzadas", keys: [{ k: "Instance URL", s: false }, { k: "API Key", s: true }], status: "disconnected", popular: true },
    { id: "zapier", name: "Zapier", cat: "automatizacion", icon: "↻", color: "#FF4A00", desc: "Automatización sin código", keys: [{ k: "Webhook URL", s: false }], status: "disconnected" },
    { id: "make", name: "Make", cat: "automatizacion", icon: "◎", color: "#6D00CC", desc: "Scenarios visuales complejos", keys: [{ k: "API Key", s: true }, { k: "Team ID", s: false }], status: "disconnected" },

    // Web & Búsqueda
    { id: "serper", name: "Serper", cat: "web", icon: "⊙", color: "#1E90FF", desc: "Google Search API en tiempo real", keys: [{ k: "API Key", s: true }], status: "disconnected", popular: true },
    { id: "tavily", name: "Tavily", cat: "web", icon: "◎", color: "#6366F1", desc: "Búsqueda optimizada para agentes IA", keys: [{ k: "API Key", s: true }], status: "disconnected" },
    { id: "firecrawl", name: "Firecrawl", cat: "web", icon: "◈", color: "#FF6B35", desc: "Crawling y scraping inteligente", keys: [{ k: "API Key", s: true }], status: "disconnected" },

    // CRM & Pagos
    { id: "hubspot", name: "HubSpot", cat: "crm", icon: "⬟", color: "#FF7A59", desc: "CRM, contactos y automatización", keys: [{ k: "Access Token", s: true }, { k: "Portal ID", s: false }], status: "disconnected" },
    { id: "stripe", name: "Stripe", cat: "crm", icon: "◆", color: "#635BFF", desc: "Pagos, suscripciones y facturación", keys: [{ k: "Secret Key", s: true }, { k: "Webhook Secret", s: true }], status: "disconnected" },
    { id: "salesforce", name: "Salesforce", cat: "crm", icon: "☁", color: "#00A1E0", desc: "CRM empresarial completo", keys: [{ k: "Client ID", s: false }, { k: "Client Secret", s: true }, { k: "Instance URL", s: false }], status: "disconnected" },

    // Infraestructura
    { id: "supabase", name: "Supabase", cat: "infra", icon: "⬡", color: "#3ECF8E", desc: "DB, Auth, Storage y Realtime", keys: [{ k: "Project URL", s: false }, { k: "Anon Key", s: true }, { k: "Service Role Key", s: true }], status: "disconnected", popular: true },
    { id: "aws", name: "AWS S3", cat: "infra", icon: "◫", color: "#FF9900", desc: "Almacenamiento cloud escalable", keys: [{ k: "Access Key ID", s: false }, { k: "Secret Access Key", s: true }, { k: "Bucket", s: false }], status: "disconnected" },
    { id: "vercel", name: "Vercel", cat: "infra", icon: "△", color: "#FFFFFF", desc: "Deploy y hosting de frontends", keys: [{ k: "API Token", s: true }, { k: "Team ID", s: false }], status: "disconnected" },
];

const CATS = [
    { id: "all", label: "Todas", sym: "⬡" },
    { id: "ia", label: "Modelos IA", sym: "◆" },
    { id: "comunicacion", label: "Comunicación", sym: "⬤" },
    { id: "email", label: "Email & Cal.", sym: "✉" },
    { id: "productividad", label: "Productividad", sym: "▣" },
    { id: "automatizacion", label: "Automatización", sym: "⚡" },
    { id: "web", label: "Web & Búsqueda", sym: "⊙" },
    { id: "crm", label: "CRM & Pagos", sym: "◆" },
    { id: "infra", label: "Infraestructura", sym: "◫" },
];

// Jarvis messages that simulate real intelligence
const JARVIS_MESSAGES = [
    { type: "info", text: "Sistema de credenciales inicializado. Todas las conexiones están monitorizadas." },
    { type: "warn", text: "WhatsApp no conectado. Jarvis no puede enviar notificaciones móviles." },
    { type: "warn", text: "Serper API desconectada. Las búsquedas en tiempo real están deshabilitadas." },
    { type: "info", text: "Esperando configuración inicial de Vault." },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function JarvisConnections() {
    const router = useRouter();
    const [cat, setCat] = useState("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<any>(null);
    const [onlyConn, setOnlyConn] = useState(false);
    const [statuses, setStatuses] = useState(Object.fromEntries(INTEGRATIONS.map(i => [i.id, i.status])));
    const [formVals, setFormVals] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [jarvisLog, setJarvisLog] = useState(JARVIS_MESSAGES);
    const [logVisible, setLogVisible] = useState(true);
    const [pulse, setPulse] = useState<string | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    const connected = Object.keys(statuses).filter(id => statuses[id] === "connected");
    const total = INTEGRATIONS.length;

    const filtered = INTEGRATIONS.filter(i => {
        if (cat !== "all" && i.cat !== cat) return false;
        if (onlyConn && statuses[i.id] !== "connected") return false;
        if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.desc.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleConnect = async () => {
        if (!selected) return;

        setSaving(true);

        // Prepare payload
        const keysPayload = selected.keys.map((k: any, idx: number) => ({
            key_name: k.k,
            value: formVals[idx] || ""
        }));

        try {
            const res = await fetch('/api/credentials/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    integration_id: selected.id,
                    keys: keysPayload
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al guardar credenciales')
            }

            setStatuses(p => ({ ...p, [selected.id]: "connected" }));
            setSaved(true);
            setSaving(false);
            setPulse(selected.id);
            setJarvisLog(p => [{
                type: "success",
                text: `${selected.name} conectado y cifrado en Vault. Jarvis ahora tiene acceso a esta integración.`
            }, ...p]);
            setTimeout(() => { setSaved(false); setSelected(null); setPulse(null); }, 1200);

        } catch (error: any) {
            console.error(error);
            setSaving(false);
            setJarvisLog(p => [{
                type: "warn",
                text: `Error al conectar ${selected?.name || 'Integración'}: ${error.message || 'Error desconocido'}`
            }, ...p]);
        }

    };

    const handleDisconnect = (id: string, name: string) => {
        setStatuses(p => ({ ...p, [id]: "disconnected" }));
        setJarvisLog(p => [{
            type: "warn",
            text: `${name} desconectado. Las funciones dependientes quedarán pausadas.`
        }, ...p]);
        setSelected(null);
    };

    // Fetch existing connections on mount
    useEffect(() => {
        async function fetchStatuses() {
            try {
                const res = await fetch('/api/credentials/status');
                if (res.ok) {
                    const data = await res.json();
                    if (data.connected_ids && Array.isArray(data.connected_ids)) {
                        const newStatuses = { ...Object.fromEntries(INTEGRATIONS.map(i => [i.id, "disconnected"])) };
                        data.connected_ids.forEach((id: string) => {
                            newStatuses[id] = "connected";
                        });
                        setStatuses(newStatuses);
                    }
                }
            } catch (error) {
                console.error('Error fetching connection statuses:', error);
            }
        }
        fetchStatuses();
    }, []);

    // Scroll log to top on new message
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = 0;
    }, [jarvisLog]);

    const isConn = (id: string) => statuses[id] === "connected";

    return (
        <div style={{
            minHeight: "100vh", background: "#080810",
            fontFamily: "'Courier New', 'Monaco', monospace",
            color: "#C8C8E0", overflow: "hidden",
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0D0D1A; }
        ::-webkit-scrollbar-thumb { background: #2D2D5E; border-radius: 2px; }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow {
          0%,100% { box-shadow: 0 0 8px currentColor; }
          50% { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .int-card { transition: all 0.2s; animation: fadeIn 0.3s ease; }
        .int-card:hover { transform: translateY(-3px); }
        .cat-btn { transition: all 0.15s; }
        .cat-btn:hover { color: #E0E0FF !important; }
      `}</style>

            {/* Scanline overlay */}
            <div style={{
                position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1000,
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
            }} />

            {/* ── TOP BAR ── */}
            <div style={{
                borderBottom: "1px solid #1A1A3E",
                padding: "0 28px",
                height: 56,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "linear-gradient(90deg, #0A0A18 0%, #080810 100%)",
                position: "sticky", top: 0, zIndex: 50,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {/* Logo */}
                    <div onClick={() => router.push('/')} style={{ cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "3px", color: "#7B7BFF" }}>
                        JARVIS<span style={{ color: "#3A3A7E" }}>::</span><span style={{ color: "#4A4A9E", fontWeight: 400 }}>CONNECTIONS</span>
                    </div>
                    <div style={{ width: 1, height: 20, background: "#1A1A3E" }} />
                    {/* Status indicators */}
                    <div style={{ display: "flex", gap: 16, fontSize: 11, fontFamily: "'Space Mono', monospace" }}>
                        {[
                            { label: "ACTIVAS", val: connected.length, col: "#4ADE80" },
                            { label: "DISPONIBLES", val: total - connected.length, col: "#6B6B9E" },
                            { label: "TOTAL", val: total, col: "#7B7BFF" },
                        ].map(s => (
                            <div key={s.label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span style={{ color: s.col, fontWeight: 700 }}>{s.val}</span>
                                <span style={{ color: "#3A3A6E" }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Jarvis status */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        border: "1px solid #1E1E4E", borderRadius: 4,
                        padding: "5px 12px", fontSize: 11,
                        fontFamily: "'Space Mono', monospace",
                    }}>
                        <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#4ADE80",
                            display: "inline-block",
                            animation: "blink 2s infinite",
                            boxShadow: "0 0 6px #4ADE80",
                        }} />
                        <span style={{ color: "#4A4A8E" }}>JARVIS </span>
                        <span style={{ color: "#4ADE80" }}>ONLINE</span>
                    </div>
                    <button
                        onClick={() => setLogVisible(p => !p)}
                        style={{
                            background: "transparent", border: "1px solid #1E1E4E", borderRadius: 4,
                            color: logVisible ? "#7B7BFF" : "#3A3A6E",
                            padding: "5px 12px", cursor: "pointer", fontSize: 11,
                            fontFamily: "'Space Mono', monospace", transition: "all 0.2s",
                        }}>
                        {logVisible ? "▼ LOG" : "▶ LOG"}
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>

                {/* ── SIDEBAR ── */}
                <div style={{
                    width: 200, borderRight: "1px solid #1A1A3E",
                    padding: "20px 0", flexShrink: 0,
                    background: "#06060E", display: "flex", flexDirection: "column",
                }}>
                    <div style={{ padding: "0 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 9, letterSpacing: "2px", color: "#2A2A5E", marginBottom: 10, fontFamily: "'Space Mono', monospace" }}>
                            CATEGORÍAS
                        </div>
                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#3A3A6E", fontSize: 11 }}>⊙</span>
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="buscar..."
                                style={{
                                    width: "100%", background: "#0D0D1A",
                                    border: "1px solid #1A1A3E", borderRadius: 4,
                                    padding: "7px 8px 7px 24px", color: "#8888CC",
                                    fontSize: 11, outline: "none",
                                    fontFamily: "'Space Mono', monospace",
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {CATS.map(c => {
                            const count = c.id === "all" ? INTEGRATIONS.length : INTEGRATIONS.filter(i => i.cat === c.id).length;
                            const connCount = c.id === "all" ? connected.length : connected.map(id => INTEGRATIONS.find(i => i.id === id)!).filter(i => i && i.cat === c.id).length;
                            const active = cat === c.id;
                            return (
                                <button key={c.id} className="cat-btn" onClick={() => setCat(c.id)}
                                    style={{
                                        width: "100%", textAlign: "left",
                                        padding: "9px 16px",
                                        background: active ? "rgba(123,123,255,0.08)" : "transparent",
                                        border: "none", borderLeft: active ? "2px solid #7B7BFF" : "2px solid transparent",
                                        color: active ? "#A0A0FF" : "#4A4A7E",
                                        fontSize: 11, cursor: "pointer",
                                        fontFamily: "'Space Mono', monospace",
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                    }}>
                                    <span>{c.sym} {c.label}</span>
                                    <span style={{
                                        fontSize: 10, color: connCount > 0 ? "#4ADE80" : "#2A2A5E",
                                    }}>{connCount}/{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Only connected toggle */}
                    <div style={{ padding: "16px", borderTop: "1px solid #1A1A3E" }}>
                        <button onClick={() => setOnlyConn(p => !p)}
                            style={{
                                width: "100%", padding: "7px",
                                background: onlyConn ? "rgba(74,222,128,0.08)" : "transparent",
                                border: `1px solid ${onlyConn ? "rgba(74,222,128,0.3)" : "#1A1A3E"}`,
                                borderRadius: 4, color: onlyConn ? "#4ADE80" : "#3A3A6E",
                                fontSize: 10, cursor: "pointer",
                                fontFamily: "'Space Mono', monospace",
                            }}>
                            {onlyConn ? "● SOLO ACTIVAS" : "○ TODAS"}
                        </button>
                    </div>
                </div>

                {/* ── MAIN GRID ── */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                    {/* Category header */}
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "baseline",
                        marginBottom: 20,
                    }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#E0E0FF", letterSpacing: "-0.5px" }}>
                            {CATS.find(c => c.id === cat)?.label || "Todas las conexiones"}
                        </div>
                        <div style={{ fontSize: 10, color: "#3A3A6E", fontFamily: "'Space Mono', monospace" }}>
                            {filtered.length} integraciones
                        </div>
                    </div>

                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: "60px 0", color: "#2A2A5E", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
                            NO_RESULTS_FOUND
                        </div>
                    )}

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 12,
                    }}>
                        {filtered.map((intg, idx) => {
                            const conn = isConn(intg.id);
                            const isPulsing = pulse === intg.id;
                            return (
                                <div key={intg.id} className="int-card"
                                    onClick={() => { setSelected(intg); setFormVals({}); setSaved(false); }}
                                    style={{
                                        background: conn ? "rgba(74,222,128,0.03)" : "#0D0D1A",
                                        border: conn ? "1px solid rgba(74,222,128,0.2)" : "1px solid #1A1A3E",
                                        borderRadius: 6, padding: "16px",
                                        cursor: "pointer", position: "relative", overflow: "hidden",
                                        animationDelay: `${idx * 0.04}s`,
                                    }}>

                                    {/* Top accent line */}
                                    <div style={{
                                        position: "absolute", top: 0, left: 0, right: 0, height: 2,
                                        background: conn ? `linear-gradient(90deg, ${intg.color}, transparent)` : "transparent",
                                        transition: "all 0.3s",
                                    }} />

                                    {isPulsing && (
                                        <div style={{
                                            position: "absolute", inset: 0,
                                            background: `radial-gradient(circle, ${intg.color}22 0%, transparent 70%)`,
                                            animation: "glow 0.6s ease",
                                        }} />
                                    )}

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 4,
                                                background: `${intg.color}15`,
                                                border: `1px solid ${intg.color}30`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 16, color: intg.color,
                                                fontFamily: "monospace",
                                            }}>{intg.icon}</div>
                                            <div>
                                                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, color: conn ? "#E0E0FF" : "#8888AA" }}>
                                                    {intg.name}
                                                </div>
                                                <div style={{ fontSize: 9, color: "#3A3A6E", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
                                                    {intg.keys.length} CREDENCIAL{intg.keys.length > 1 ? "ES" : ""}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            fontSize: 9, fontWeight: 700, letterSpacing: "1px",
                                            padding: "3px 7px", borderRadius: 3,
                                            fontFamily: "'Space Mono', monospace",
                                            background: conn ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                                            color: conn ? "#4ADE80" : "#3A3A6E",
                                            border: conn ? "1px solid rgba(74,222,128,0.2)" : "1px solid #1A1A3E",
                                        }}>
                                            {conn ? "● ON" : "○ OFF"}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: 11, color: "#5A5A8E", lineHeight: 1.6, marginBottom: 12, fontFamily: "'Space Mono', monospace" }}>
                                        {intg.desc}
                                    </div>

                                    {/* Key names */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {intg.keys.map(k => (
                                            <span key={k.k} style={{
                                                fontSize: 9, padding: "2px 6px", borderRadius: 3,
                                                background: "#13131F", color: "#3A3A6E",
                                                border: "1px solid #1A1A3E",
                                                fontFamily: "'Space Mono', monospace",
                                            }}>{k.k}</span>
                                        ))}
                                    </div>

                                    {intg.popular && !conn && (
                                        <div style={{
                                            position: "absolute", top: 12, right: 12,
                                            fontSize: 8, color: "#F59E0B", letterSpacing: "1px",
                                            fontFamily: "'Space Mono', monospace",
                                        }}>★ POP</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── JARVIS LOG ── */}
                {logVisible && (
                    <div style={{
                        width: 280, borderLeft: "1px solid #1A1A3E",
                        background: "#06060E", display: "flex", flexDirection: "column",
                        flexShrink: 0,
                    }}>
                        <div style={{
                            padding: "14px 16px", borderBottom: "1px solid #1A1A3E",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                            <div style={{ fontSize: 9, letterSpacing: "2px", color: "#7B7BFF", fontFamily: "'Space Mono', monospace" }}>
                                ◆ JARVIS LOG
                            </div>
                            <span style={{ fontSize: 9, color: "#2A2A5E", fontFamily: "'Space Mono', monospace" }}>
                                {jarvisLog.length} eventos
                            </span>
                        </div>

                        <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                            {jarvisLog.map((msg, i) => (
                                <div key={i} style={{
                                    marginBottom: 10, padding: "10px",
                                    background: "#0D0D1A", borderRadius: 4,
                                    borderLeft: `2px solid ${msg.type === "success" ? "#4ADE80" : msg.type === "warn" ? "#FBBF24" : "#7B7BFF"}`,
                                    animation: "fadeIn 0.3s ease",
                                }}>
                                    <div style={{
                                        fontSize: 8, letterSpacing: "1px", marginBottom: 4,
                                        color: msg.type === "success" ? "#4ADE80" : msg.type === "warn" ? "#FBBF24" : "#7B7BFF",
                                        fontFamily: "'Space Mono', monospace",
                                    }}>
                                        {msg.type === "success" ? "✓ OK" : msg.type === "warn" ? "⚠ WARN" : "ℹ INFO"}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#6A6A9E", lineHeight: 1.6, fontFamily: "'Space Mono', monospace" }}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Prompt de Jarvis */}
                        <div style={{ padding: "12px", borderTop: "1px solid #1A1A3E" }}>
                            <div style={{ fontSize: 8, color: "#2A2A5E", marginBottom: 6, letterSpacing: "1px", fontFamily: "'Space Mono', monospace" }}>
                                JARVIS DETECTA QUE FALTA:
                            </div>
                            {INTEGRATIONS.filter(i => !isConn(i.id) && i.popular).slice(0, 3).map(i => (
                                <div key={i.id}
                                    onClick={() => setSelected(i)}
                                    style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        padding: "7px 8px", marginBottom: 4,
                                        background: "#0D0D1A", borderRadius: 4,
                                        border: "1px solid #1A1A3E", cursor: "pointer",
                                        transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = "#2A2A6E"}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "#1A1A3E"}
                                >
                                    <span style={{ fontSize: 10, color: "#5A5A9E", fontFamily: "'Space Mono', monospace" }}>
                                        {i.icon} {i.name}
                                    </span>
                                    <span style={{ fontSize: 8, color: "#FBBF24", fontFamily: "'Space Mono', monospace" }}>CONECTAR →</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── MODAL ── */}
            {selected && (
                <div onClick={() => !saving && setSelected(null)}
                    style={{
                        position: "fixed", inset: 0,
                        background: "rgba(0,0,0,0.85)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 200, backdropFilter: "blur(6px)",
                    }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{
                            background: "#0D0D1A",
                            border: "1px solid #2A2A5E",
                            borderRadius: 8, padding: "32px",
                            width: 460, maxWidth: "90vw",
                            boxShadow: "0 0 60px rgba(123,123,255,0.15), 0 25px 60px rgba(0,0,0,0.8)",
                            position: "relative", overflow: "hidden",
                        }}>

                        {/* Top accent */}
                        <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: 2,
                            background: `linear-gradient(90deg, ${selected.color}, transparent)`,
                        }} />

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 6,
                                    background: `${selected.color}15`,
                                    border: `1px solid ${selected.color}40`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 24, color: selected.color,
                                }}>{selected.icon}</div>
                                <div>
                                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "#E0E0FF" }}>
                                        {selected.name}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#4A4A8E", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                                        {selected.keys.length} CREDENCIAL{selected.keys.length > 1 ? "ES" : ""} REQUERIDA{selected.keys.length > 1 ? "S" : ""}
                                    </div>
                                </div>
                            </div>
                            {isConn(selected.id) && (
                                <span style={{
                                    fontSize: 9, padding: "4px 9px", borderRadius: 3,
                                    background: "rgba(74,222,128,0.1)", color: "#4ADE80",
                                    border: "1px solid rgba(74,222,128,0.2)",
                                    fontFamily: "'Space Mono', monospace",
                                }}>● CONECTADA</span>
                            )}
                        </div>

                        {/* Jarvis note */}
                        <div style={{
                            background: "rgba(123,123,255,0.06)",
                            border: "1px solid rgba(123,123,255,0.15)",
                            borderRadius: 4, padding: "10px 14px",
                            marginBottom: 24, fontSize: 10, color: "#7070CC",
                            fontFamily: "'Space Mono', monospace", lineHeight: 1.7,
                        }}>
                            ◆ JARVIS: Las credenciales se cifran con pgcrypto antes de guardarse en Supabase. Solo Jarvis puede descifrarlas en tiempo de ejecución.
                        </div>

                        {/* Fields */}
                        <div style={{ marginBottom: 24 }}>
                            {selected.keys.map((k: any, idx: number) => (
                                <div key={k.k} style={{ marginBottom: 14 }}>
                                    <label style={{
                                        fontSize: 9, color: "#4A4A8E", letterSpacing: "1.5px",
                                        display: "block", marginBottom: 6,
                                        fontFamily: "'Space Mono', monospace",
                                    }}>
                                        {k.k.toUpperCase()} {k.s && <span style={{ color: "#FBBF24" }}>★ SECRETO</span>}
                                    </label>
                                    <input
                                        type={k.s ? "password" : "text"}
                                        placeholder={`${k.k}...`}
                                        value={formVals[idx] || ""}
                                        onChange={e => setFormVals(p => ({ ...p, [idx]: e.target.value }))}
                                        style={{
                                            width: "100%", background: "#080810",
                                            border: "1px solid #1A1A3E", borderRadius: 4,
                                            padding: "10px 12px", color: "#A0A0D0",
                                            fontSize: 12, outline: "none",
                                            fontFamily: "'Space Mono', monospace",
                                            letterSpacing: k.s ? "2px" : "normal",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                            {isConn(selected.id) ? (
                                <>
                                    <button onClick={() => setSelected(null)} style={{
                                        flex: 1, padding: "12px", borderRadius: 4,
                                        background: "transparent", border: "1px solid #1A1A3E",
                                        color: "#4A4A8E", cursor: "pointer", fontSize: 11,
                                        fontFamily: "'Space Mono', monospace",
                                    }}>CERRAR</button>
                                    <button onClick={() => handleDisconnect(selected.id, selected.name)} style={{
                                        flex: 1, padding: "12px", borderRadius: 4,
                                        background: "rgba(239,68,68,0.08)",
                                        border: "1px solid rgba(239,68,68,0.2)",
                                        color: "#EF4444", cursor: "pointer", fontSize: 11,
                                        fontFamily: "'Space Mono', monospace",
                                    }}>✕ DESCONECTAR</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setSelected(null)} style={{
                                        flex: 1, padding: "12px", borderRadius: 4,
                                        background: "transparent", border: "1px solid #1A1A3E",
                                        color: "#4A4A8E", cursor: "pointer", fontSize: 11,
                                        fontFamily: "'Space Mono', monospace",
                                    }}>CANCELAR</button>
                                    <button onClick={handleConnect} disabled={saving || saved} style={{
                                        flex: 2, padding: "12px", borderRadius: 4,
                                        background: saved ? "rgba(74,222,128,0.15)" :
                                            saving ? "#13131F" :
                                                `linear-gradient(135deg, ${selected.color}33, ${selected.color}15)`,
                                        border: `1px solid ${saved ? "rgba(74,222,128,0.4)" : saving ? "#1A1A3E" : `${selected.color}50`}`,
                                        color: saved ? "#4ADE80" : saving ? "#4A4A8E" : selected.color,
                                        cursor: saving || saved ? "default" : "pointer",
                                        fontSize: 11, fontWeight: 700,
                                        fontFamily: "'Space Mono', monospace",
                                        letterSpacing: "1px", transition: "all 0.2s",
                                    }}>
                                        {saved ? "✓ CONECTADO" : saving ? "◌ CIFRANDO..." : `◆ CONECTAR ${selected.name.toUpperCase()}`}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
