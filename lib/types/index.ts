// Export all types for easy importing
export * from './documentation';
export * from './chat';

// Re-export existing types that might be used together
// export type { ApiProvider } from './api'; // TODO: Create api.ts
// export type { GenerationContext, EnhancedConfigTemplate } from './enhanced'; // TODO: Create enhanced.ts
export * from './enhanced-templates';

// Combined types for cross-functionality
export interface DocsAndChatContext {
  provider?: any; // TODO: Replace with ApiProvider when api.ts is created
  selected_docs?: string[];
  active_chat_session?: string;
  generation_context?: any; // TODO: Replace with GenerationContext when enhanced.ts is created
}

export interface UnifiedSearchResult {
  type: 'documentation' | 'chat_history' | 'integration';
  id: string;
  title: string;
  content_preview: string;
  relevance_score: number;
  metadata?: Record<string, any>;
}