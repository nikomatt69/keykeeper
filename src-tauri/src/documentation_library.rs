use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Core documentation library types and database schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationLibrary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub provider_id: Option<String>,
    pub url: String,
    pub version: String,
    pub language: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub content_hash: String,
    pub total_chunks: usize,
    pub status: DocumentationStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentationStatus {
    Pending,
    Processing,
    Indexed,
    Failed,
    Outdated,
}

/// Individual chunks of documentation with embeddings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationChunk {
    pub id: String,
    pub library_id: String,
    pub chunk_index: usize,
    pub title: String,
    pub content: String,
    pub section_path: Vec<String>, // Hierarchical path: ["API", "Authentication", "OAuth"]
    pub metadata: ChunkMetadata,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMetadata {
    pub word_count: usize,
    pub content_type: ContentType,
    pub importance_score: f32,
    pub keywords: Vec<String>,
    pub related_chunks: Vec<String>,
    pub source_url: Option<String>,
    pub line_numbers: Option<(usize, usize)>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    Overview,
    Tutorial,
    Reference,
    Example,
    Configuration,
    Troubleshooting,
    Migration,
    Changelog,
}

/// Vector embeddings storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationEmbedding {
    pub chunk_id: String,
    pub embedding: Vec<f32>,
    pub model_name: String,
    pub embedding_version: String,
    pub created_at: DateTime<Utc>,
}

/// Search result with similarity scoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationSearchResult {
    pub chunk_id: String,
    pub library_id: String,
    pub title: String,
    pub content: String,
    pub section_path: Vec<String>,
    pub similarity_score: f32,
    pub relevance_score: f32,
    pub content_type: ContentType,
    pub metadata: ChunkMetadata,
    pub url: Option<String>,
}

/// Chat session management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub context_libraries: Vec<String>, // Library IDs to use as context
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_count: usize,
    pub status: ChatSessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChatSessionStatus {
    Active,
    Archived,
    Deleted,
}

/// Individual chat messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: MessageRole,
    pub content: String,
    pub context_chunks: Vec<String>, // Chunk IDs used for context
    pub metadata: MessageMetadata,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMetadata {
    pub token_count: Option<usize>,
    pub processing_time_ms: Option<u64>,
    pub context_relevance: Option<f32>,
    pub generated_code: Option<GeneratedCode>,
    pub search_queries: Vec<String>,
    pub confidence_score: Option<f32>,
}

/// Generated integration code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedCode {
    pub language: String,
    pub framework: String,
    pub code_blocks: Vec<CodeBlock>,
    pub dependencies: Vec<String>,
    pub configuration: HashMap<String, String>,
    pub test_cases: Option<String>,
    pub documentation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeBlock {
    pub filename: String,
    pub content: String,
    pub description: String,
    pub file_type: CodeFileType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodeFileType {
    Configuration,
    Component,
    Service,
    Utility,
    Type,
    Test,
    Documentation,
}

/// Integration generation history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationGeneration {
    pub id: String,
    pub session_id: String,
    pub provider_name: String,
    pub framework: String,
    pub language: String,
    pub user_requirements: String,
    pub generated_code: GeneratedCode,
    pub context_chunks: Vec<String>,
    pub generation_metadata: GenerationMetadata,
    pub created_at: DateTime<Utc>,
    pub status: GenerationStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationMetadata {
    pub template_used: Option<String>,
    pub llm_model: String,
    pub context_tokens: usize,
    pub generation_tokens: usize,
    pub quality_score: Option<f32>,
    pub user_feedback: Option<UserFeedback>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFeedback {
    pub rating: u8, // 1-5 stars
    pub comments: Option<String>,
    pub improvement_suggestions: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GenerationStatus {
    Success,
    Partial,
    Failed,
    UserModified,
}

/// Vector search parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchParams {
    pub query: String,
    pub library_ids: Option<Vec<String>>,
    pub content_types: Option<Vec<ContentType>>,
    pub min_similarity: f32,
    pub max_results: usize,
    pub include_metadata: bool,
    pub boost_recent: bool,
    pub section_filter: Option<Vec<String>>,
}

impl Default for VectorSearchParams {
    fn default() -> Self {
        Self {
            query: String::new(),
            library_ids: None,
            content_types: None,
            min_similarity: 0.7,
            max_results: 10,
            include_metadata: true,
            boost_recent: false,
            section_filter: None,
        }
    }
}

/// Chat context building
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub relevant_chunks: Vec<DocumentationSearchResult>,
    pub previous_messages: Vec<ChatMessage>,
    pub user_preferences: UserPreferences,
    pub generation_context: Option<GenerationContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_language: String,
    pub preferred_framework: String,
    pub code_style: String,
    pub detail_level: DetailLevel,
    pub include_examples: bool,
    pub include_tests: bool,
    pub security_focused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DetailLevel {
    Minimal,
    Standard,
    Comprehensive,
    Expert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationContext {
    pub target_framework: String,
    pub target_language: String,
    pub project_context: Option<String>,
    pub existing_code: Option<String>,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
}

/// In-memory storage manager
pub struct DocumentationLibraryManager {
    libraries: Arc<RwLock<HashMap<String, DocumentationLibrary>>>,
    chunks: Arc<RwLock<HashMap<String, DocumentationChunk>>>,
    embeddings: Arc<RwLock<HashMap<String, DocumentationEmbedding>>>,
    chat_sessions: Arc<RwLock<HashMap<String, ChatSession>>>,
    chat_messages: Arc<RwLock<HashMap<String, Vec<ChatMessage>>>>, // session_id -> messages
    integration_history: Arc<RwLock<HashMap<String, IntegrationGeneration>>>,
    
    // Indexes for fast lookups
    library_by_provider: Arc<RwLock<HashMap<String, Vec<String>>>>, // provider_id -> library_ids
    chunks_by_library: Arc<RwLock<HashMap<String, Vec<String>>>>, // library_id -> chunk_ids
    sessions_by_user: Arc<RwLock<HashMap<String, Vec<String>>>>, // user_id -> session_ids
}

impl DocumentationLibraryManager {
    pub fn new() -> Self {
        Self {
            libraries: Arc::new(RwLock::new(HashMap::new())),
            chunks: Arc::new(RwLock::new(HashMap::new())),
            embeddings: Arc::new(RwLock::new(HashMap::new())),
            chat_sessions: Arc::new(RwLock::new(HashMap::new())),
            chat_messages: Arc::new(RwLock::new(HashMap::new())),
            integration_history: Arc::new(RwLock::new(HashMap::new())),
            library_by_provider: Arc::new(RwLock::new(HashMap::new())),
            chunks_by_library: Arc::new(RwLock::new(HashMap::new())),
            sessions_by_user: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a new documentation library
    pub async fn add_library(&self, mut library: DocumentationLibrary) -> Result<String> {
        library.id = Uuid::new_v4().to_string();
        library.created_at = Utc::now();
        library.updated_at = Utc::now();
        
        let library_id = library.id.clone();
        
        // Store library
        self.libraries.write().await.insert(library_id.clone(), library.clone());
        
        // Update indexes
        if let Some(provider_id) = &library.provider_id {
            let mut provider_index = self.library_by_provider.write().await;
            provider_index.entry(provider_id.clone())
                .or_insert_with(Vec::new)
                .push(library_id.clone());
        }
        
        // Initialize chunks index
        self.chunks_by_library.write().await.insert(library_id.clone(), Vec::new());
        
        Ok(library_id)
    }

    /// Add a documentation chunk with embedding
    pub async fn add_chunk_with_embedding(
        &self,
        mut chunk: DocumentationChunk,
        embedding: Vec<f32>,
        model_name: String,
    ) -> Result<String> {
        chunk.id = Uuid::new_v4().to_string();
        chunk.created_at = Utc::now();
        
        let chunk_id = chunk.id.clone();
        let library_id = chunk.library_id.clone();
        
        // Store chunk
        self.chunks.write().await.insert(chunk_id.clone(), chunk);
        
        // Store embedding
        let doc_embedding = DocumentationEmbedding {
            chunk_id: chunk_id.clone(),
            embedding,
            model_name,
            embedding_version: "1.0".to_string(),
            created_at: Utc::now(),
        };
        self.embeddings.write().await.insert(chunk_id.clone(), doc_embedding);
        
        // Update library chunks index
        self.chunks_by_library.write().await
            .entry(library_id)
            .or_insert_with(Vec::new)
            .push(chunk_id.clone());
        
        Ok(chunk_id)
    }

    /// Vector similarity search
    pub async fn vector_search(&self, params: VectorSearchParams, query_embedding: Vec<f32>) -> Result<Vec<DocumentationSearchResult>> {
        let embeddings = self.embeddings.read().await;
        let chunks = self.chunks.read().await;
        
        let mut results = Vec::new();
        
        for (chunk_id, embedding) in embeddings.iter() {
            // Filter by library if specified
            if let Some(ref library_ids) = params.library_ids {
                if let Some(chunk) = chunks.get(chunk_id) {
                    if !library_ids.contains(&chunk.library_id) {
                        continue;
                    }
                }
            }
            
            // Calculate cosine similarity
            let similarity = self.cosine_similarity(&query_embedding, &embedding.embedding);
            
            if similarity >= params.min_similarity {
                if let Some(chunk) = chunks.get(chunk_id) {
                    // Filter by content type if specified
                    if let Some(ref content_types) = params.content_types {
                        if !content_types.contains(&chunk.metadata.content_type) {
                            continue;
                        }
                    }
                    
                    // Filter by section if specified
                    if let Some(ref section_filter) = params.section_filter {
                        let matches_section = section_filter.iter().any(|filter| {
                            chunk.section_path.iter().any(|section| {
                                section.to_lowercase().contains(&filter.to_lowercase())
                            })
                        });
                        if !matches_section {
                            continue;
                        }
                    }
                    
                    let relevance_score = if params.boost_recent {
                        let hours_ago = (Utc::now() - chunk.created_at).num_hours() as f32;
                        let recency_boost = (-hours_ago / (24.0 * 7.0)).exp() * 0.1; // Week decay
                        similarity + recency_boost
                    } else {
                        similarity
                    };
                    
                    results.push(DocumentationSearchResult {
                        chunk_id: chunk_id.clone(),
                        library_id: chunk.library_id.clone(),
                        title: chunk.title.clone(),
                        content: chunk.content.clone(),
                        section_path: chunk.section_path.clone(),
                        similarity_score: similarity,
                        relevance_score,
                        content_type: chunk.metadata.content_type.clone(),
                        metadata: chunk.metadata.clone(),
                        url: chunk.metadata.source_url.clone(),
                    });
                }
            }
        }
        
        // Sort by relevance score (highest first)
        results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        
        // Limit results
        results.truncate(params.max_results);
        
        Ok(results)
    }

    /// Create a new chat session
    pub async fn create_chat_session(
        &self,
        user_id: String,
        title: String,
        description: Option<String>,
        context_libraries: Vec<String>,
    ) -> Result<String> {
        let session_id = Uuid::new_v4().to_string();
        
        let session = ChatSession {
            id: session_id.clone(),
            user_id: user_id.clone(),
            title,
            description,
            context_libraries,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            message_count: 0,
            status: ChatSessionStatus::Active,
        };
        
        // Store session
        self.chat_sessions.write().await.insert(session_id.clone(), session);
        
        // Initialize messages
        self.chat_messages.write().await.insert(session_id.clone(), Vec::new());
        
        // Update user sessions index
        self.sessions_by_user.write().await
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(session_id.clone());
        
        Ok(session_id)
    }

    /// Add message to chat session
    pub async fn add_chat_message(&self, mut message: ChatMessage) -> Result<String> {
        message.id = Uuid::new_v4().to_string();
        message.created_at = Utc::now();
        
        let message_id = message.id.clone();
        let session_id = message.session_id.clone();
        
        // Add message to session
        if let Some(messages) = self.chat_messages.write().await.get_mut(&session_id) {
            messages.push(message);
            
            // Update session message count and timestamp
            if let Some(session) = self.chat_sessions.write().await.get_mut(&session_id) {
                session.message_count = messages.len();
                session.updated_at = Utc::now();
            }
        } else {
            return Err(anyhow!("Chat session not found: {}", session_id));
        }
        
        Ok(message_id)
    }

    /// Get chat session messages
    pub async fn get_chat_messages(&self, session_id: &str) -> Result<Vec<ChatMessage>> {
        let messages = self.chat_messages.read().await;
        
        let chat_messages = messages.get(session_id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .collect::<Vec<_>>();
            
        Ok(chat_messages)
    }

    /// Store integration generation result
    pub async fn store_integration_generation(&self, mut generation: IntegrationGeneration) -> Result<String> {
        generation.id = Uuid::new_v4().to_string();
        generation.created_at = Utc::now();
        
        let generation_id = generation.id.clone();
        
        self.integration_history.write().await.insert(generation_id.clone(), generation);
        
        Ok(generation_id)
    }

    /// Get libraries by provider
    pub async fn get_libraries_by_provider(&self, provider_id: &str) -> Result<Vec<DocumentationLibrary>> {
        let provider_index = self.library_by_provider.read().await;
        let libraries = self.libraries.read().await;
        
        let mut result = Vec::new();
        
        if let Some(library_ids) = provider_index.get(provider_id) {
            for library_id in library_ids {
                if let Some(library) = libraries.get(library_id) {
                    result.push(library.clone());
                }
            }
        }
        
        Ok(result)
    }

    /// Get user chat sessions
    pub async fn get_user_chat_sessions(&self, user_id: &str) -> Result<Vec<ChatSession>> {
        let user_index = self.sessions_by_user.read().await;
        let sessions = self.chat_sessions.read().await;
        
        let mut result = Vec::new();
        
        if let Some(session_ids) = user_index.get(user_id) {
            for session_id in session_ids {
                if let Some(session) = sessions.get(session_id) {
                    if matches!(session.status, ChatSessionStatus::Active) {
                        result.push(session.clone());
                    }
                }
            }
        }
        
        // Sort by updated_at (most recent first)
        result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        
        Ok(result)
    }

    /// Calculate cosine similarity between two vectors
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }
        
        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }
        
        dot_product / (norm_a * norm_b)
    }

    /// Get library statistics
    pub async fn get_library_stats(&self) -> Result<HashMap<String, usize>> {
        let libraries = self.libraries.read().await;
        let chunks_index = self.chunks_by_library.read().await;
        let embeddings = self.embeddings.read().await;
        
        let mut stats = HashMap::new();
        stats.insert("total_libraries".to_string(), libraries.len());
        stats.insert("total_chunks".to_string(), chunks_index.values().map(|v| v.len()).sum());
        stats.insert("total_embeddings".to_string(), embeddings.len());
        
        Ok(stats)
    }
}