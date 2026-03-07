export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    tool_name: string;
    agent_id: string;
    duration_ms: number;
    tokens_used?: number;
}

export interface Tool {
    name: string;
    description: string;
    input_schema: any;
    execute(params: any): Promise<ToolResult>;
}

export * as ApiGateway from './api-gateway/index';
export * as WebSearch from './web-search/index';
export * as FileManager from './file-manager/index';
export * as CodeExecutor from './code-executor/index';
export * as WebBrowser from './web-browser/index';
export * as DataAnalyzer from './data-analyzer/index';
export * as EmailManager from './email-manager/index';
export * as Communications from './communications/index';
