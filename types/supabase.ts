// ============================================================
// Tipos TypeScript para las tablas de Supabase - Oficina Brezan IA
// Generados manualmente — sincronizar con el esquema SQL
// ============================================================

export type ModelType =
    | 'GPT-4o'
    | 'GPT-4o-mini'
    | 'Claude-3.5'
    | 'Gemini-1.5'
    | 'Gemini-Flash'
    | 'Gemini-Pro'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'paused'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'

// ─── agents ────────────────────────────────────────────────
export interface Agent {
    id: string
    user_id: string | null
    name: string
    role: string
    model_type: ModelType
    system_prompt: string | null
    status: AgentStatus
    avatar_url: string | null
    avatar_config: AvatarConfig
    created_at: string
}

export interface AvatarConfig {
    color: string
    icon: string
    gradient: string
}

// ─── tasks ─────────────────────────────────────────────────
export interface Task {
    id: string
    user_id: string | null
    title: string
    description: string | null
    assigned_agent_id: string | null
    status: TaskStatus
    result: string | null
    created_at: string
}

// ─── shared_context ────────────────────────────────────────
export interface SharedContext {
    id: string
    user_id: string | null
    task_id: string | null
    data: Record<string, unknown>
    sender_agent_id: string | null
    timestamp: string
    // Joined (opcional)
    agent?: Pick<Agent, 'id' | 'name' | 'role'>
    task?: Pick<Task, 'id' | 'title'>
}

// ─── token_usage ───────────────────────────────────────────
export interface TokenUsage {
    id: string
    user_id: string | null
    agent_id: string | null
    model: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    timestamp: string
    // Joined (opcional)
    agent?: Pick<Agent, 'id' | 'name' | 'model_type'>
}

// ─── system_settings ───────────────────────────────────────
export interface SystemSetting {
    key: string
    value: any
    updated_at: string
}

// ─── Vista: agent_cost_summary ─────────────────────────────
export interface AgentCostSummary {
    agent_id: string
    agent_name: string
    model_type: ModelType
    total_calls: number
    total_input_tokens: number
    total_output_tokens: number
    total_cost_usd: number
    last_used_at: string | null
}

// ─── Database helper type (Supabase client generic) ────────
export interface Database {
    public: {
        Tables: {
            agents: {
                Row: Agent
                Insert: Omit<Agent, 'id' | 'created_at'>
                Update: Partial<Omit<Agent, 'id' | 'created_at'>>
            }
            tasks: {
                Row: Task
                Insert: Omit<Task, 'id' | 'created_at'>
                Update: Partial<Omit<Task, 'id' | 'created_at'>>
            }
            shared_context: {
                Row: SharedContext
                Insert: Omit<SharedContext, 'id' | 'timestamp' | 'agent' | 'task'>
                Update: Partial<Omit<SharedContext, 'id' | 'agent' | 'task'>>
            }
            token_usage: {
                Row: TokenUsage
                Insert: Omit<TokenUsage, 'id' | 'timestamp' | 'agent'>
                Update: never
            }
        }
        Views: {
            agent_cost_summary: {
                Row: AgentCostSummary
            }
        }
    }
}
