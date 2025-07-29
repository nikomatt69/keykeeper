// Chat System Types
import type { DocumentationChunk } from './documentation';
export interface ChatSession {
  id: string;
  session_name?: string;
  context_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    documentation_context?: string[];
    integration_request?: IntegrationRequest;
    code_blocks?: CodeBlock[];
    thinking_process?: string;
  };
  timestamp: string;
}

export interface ChatResponse {
  message: ChatMessage;
  documentation_used: DocumentationChunk[];
  code_generated?: CodeBlock[];
  suggested_actions?: SuggestedAction[];
}

export interface SendMessageRequest {
  session_id: string;
  message: string;
  include_docs_context?: boolean;
  context_override?: Record<string, any>;
}

export interface DocumentationSearchForChatRequest {
  session_id: string;
  query: string;
  provider_filter?: string;
  limit?: number;
}

export interface DocumentationSearchForChatResponse {
  chunks: DocumentationChunk[];
  query_analysis: {
    intent: string;
    key_concepts: string[];
    provider_mentioned?: string;
    framework_mentioned?: string;
  };
}

// Integration Generation Types
export interface IntegrationRequest {
  session_id: string;
  provider_id: string;
  framework: string;
  requirements: string[];
  project_context?: ProjectContext;
}

export interface GenerateIntegrationRequest {
  session_id: string;
  provider_name: string;
  framework: string;
  language: string;
  requirements: string[];
  constraints?: string[];
}

export interface ProjectContext {
  name?: string;
  framework: string;
  language: string;
  package_manager?: 'npm' | 'yarn' | 'pnpm';
  existing_dependencies?: string[];
  environment?: 'development' | 'production' | 'testing';
}

export interface CodeBlock {
  id: string;
  filename: string;
  language: string;
  content: string;
  description?: string;
  file_type: 'config' | 'component' | 'service' | 'type' | 'test' | 'documentation';
  dependencies?: string[];
}

export interface IntegrationGenerationResult {
  id: string;
  session_id: string;
  provider_id: string;
  framework: string;
  generated_files: CodeBlock[];
  setup_instructions: string[];
  dependencies: string[];
  environment_variables: Array<{
    key: string;
    description: string;
    example?: string;
    required: boolean;
  }>;
  documentation_urls: string[];
  status: 'generated' | 'error';
  error?: string;
}

export interface SuggestedAction {
  id: string;
  type: 'generate_integration' | 'search_docs' | 'add_documentation' | 'clarify_requirements';
  title: string;
  description: string;
  action_data?: Record<string, any>;
}

// Chat Export Types
export interface ChatExportRequest {
  session_id: string;
  format: 'json' | 'markdown' | 'text';
  include_code: boolean;
  include_metadata: boolean;
}

export interface ChatExportResult {
  content: string;
  filename: string;
  format: string;
  size_bytes: number;
}

// Chat Session Management
export interface CreateChatSessionRequest {
  session_name?: string;
  context?: {
    provider_id?: string;
    project_context?: ProjectContext;
    initial_message?: string;
  };
}

export interface ChatSessionSummary {
  id: string;
  session_name?: string;
  message_count: number;
  last_message_at?: string;
  providers_discussed: string[];
  integrations_generated: number;
  created_at: string;
}