// ============================================================
// Tipos TypeScript Base - Oficina Brezan IA
// ============================================================

export type ModelType =
    | 'GPT-4o'
    | 'GPT-4o-mini'
    | 'Claude-3.5'
    | 'Gemini-1.5'
    | 'Gemini-Flash'
    | 'Gemini-Pro'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'paused'
export type EmploymentStatus = 'active' | 'fired' | 'promoted'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface AvatarConfig {
    color: string
    icon: string
    gradient: string
}

export interface Agent {
    id: string
    user_id?: string | null
    name: string
    role: string
    model_type: ModelType
    system_prompt: string | null
    status: AgentStatus
    employment_status?: EmploymentStatus
    creation_reason?: string | null
    performance_score?: number
    last_message?: string | null
    collaboration_with?: string | null
    avatar_url?: string | null
    avatar_config: AvatarConfig
    created_at: string
}

export interface Task {
    id: string
    user_id?: string | null
    title: string
    description: string | null
    assigned_agent_id: string | null
    status: TaskStatus
    result: string | null
    chain_of_command?: string[] // Array de UUIDs de agentes
    current_step_index?: number
    created_at: string
}

export interface SharedContext {
    id: string
    user_id?: string | null
    task_id: string | null
    data: Record<string, unknown>
    sender_agent_id: string | null
    created_by?: string | null // alias frontend legacy
    timestamp: string
    created_at: string
    // Joined relations (optional)
    agent?: Agent
    task?: Task
}

export interface ArchitectResponse {
    model_type: ModelType
    system_prompt: string
    suggested_name: string
    suggested_role: string
}
