export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
export type ProjectStatus = 'pending' | 'planning' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'busy' | 'error' | 'retired';

export interface Project {
    id: string;
    title: string;
    objective: string;
    status: ProjectStatus;
    priority: number;
    progress_pct: number;
    created_by: string;
    context?: any;
    result?: any;
    error_log?: string[];
    started_at?: string;
    completed_at?: string;
    deadline?: string;
    created_at: string;
}

export interface Task {
    id: string;
    project_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: number;
    depends_on: string[];
    assigned_agent?: string;
    tools_needed: string[];
    model_hint: 'fast' | 'smart' | 'vision' | 'code';
    input_data?: any;
    output_data?: any;
    retry_count: number;
    max_retries: number;
    timeout_ms: number;
    started_at?: string;
    completed_at?: string;
    created_at: string;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    model: string;
    status: AgentStatus;
    system_prompt: string;
    tools: string[];
    capabilities: string[];
    current_task?: string;
    tasks_done: number;
    tasks_failed: number;
    avg_duration?: number;
    performance: number;
    budget_tokens: number;
    tokens_used: number;
    created_by: string;
    retired_at?: string;
    created_at: string;
}

export interface AgentStats {
    total: number;
    active: number;
    idle: number;
    byRole: Record<string, number>;
    totalCostUSD: number; // estimado
}
