// Documentation Library Types
export interface DocumentationLibrary {
  id: string;
  provider_id: string;
  title: string;
  url?: string;
  content: string;
  content_type: 'scraped' | 'manual' | 'llm_generated';
  metadata?: Record<string, any>;
  language: string;
  version?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentationChunk {
  id: string;
  doc_id: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
  metadata?: {
    section_title?: string;
    section_path?: string;
    content_type?: 'tutorial' | 'reference' | 'example' | 'explanation';
    importance_score?: number;
    keywords?: string[];
  };
  similarity_score?: number;
}

export interface DocumentationSearchResult {
  chunk: DocumentationChunk;
  library: DocumentationLibrary;
  similarity_score: number;
  preview: string;
}

export interface DocumentationImportRequest {
  provider_id: string;
  title: string;
  url?: string;
  content: string;
  content_type: 'scraped' | 'manual' | 'llm_generated';
  metadata?: Record<string, any>;
}

export interface DocumentationLibraryStats {
  total_documents: number;
  total_chunks: number;
  providers: Array<{
    provider_id: string;
    provider_name: string;
    document_count: number;
  }>;
  content_types: Record<string, number>;
  last_updated: string;
}

export interface BulkImportResult {
  imported_count: number;
  failed_count: number;
  errors: string[];
  imported_docs: string[];
}

// URL Validation Types
export interface UrlValidationResult {
  is_valid: boolean;
  url: string;
  title?: string;
  description?: string;
  estimated_size?: number;
  content_type?: string;
  error?: string;
}