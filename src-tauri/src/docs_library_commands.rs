use crate::docs_manager::DocumentationManager;
use crate::documentation_library::*;
use crate::api_generator::ApiProvider;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// State management for documentation library
pub struct DocumentationLibraryState {
    pub docs_manager: Arc<RwLock<DocumentationManager>>,
}

impl DocumentationLibraryState {
    pub fn new(docs_manager: DocumentationManager) -> Self {
        Self {
            docs_manager: Arc::new(RwLock::new(docs_manager)),
        }
    }

    /// Create a new DocumentationLibraryState with an Arc-wrapped DocumentationManager
    /// This method shares the same DocumentationManager instance across different state holders
    pub fn new_with_shared_manager(docs_manager: Arc<RwLock<DocumentationManager>>) -> Self {
        Self {
            docs_manager,
        }
    }
}

/// Request to add documentation from URL
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDocumentationRequest {
    pub provider_id: String,
    pub provider_name: String,
    pub provider_category: String,
    pub docs_url: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub version: Option<String>,
}

/// Documentation library info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationLibraryInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub provider_id: Option<String>,
    pub url: String,
    pub version: String,
    pub language: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub total_chunks: usize,
    pub status: String,
    pub content_hash: String,
}

/// Documentation chunk info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationChunkInfo {
    pub id: String,
    pub library_id: String,
    pub chunk_index: usize,
    pub title: String,
    pub content: String,
    pub section_path: Vec<String>,
    pub word_count: usize,
    pub content_type: String,
    pub importance_score: f32,
    pub keywords: Vec<String>,
    pub created_at: String,
}

/// Search request for documentation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchDocumentationLibraryRequest {
    pub query: String,
    pub library_ids: Option<Vec<String>>,
    pub provider_ids: Option<Vec<String>>,
    pub content_types: Option<Vec<String>>,
    pub section_filter: Option<Vec<String>>,
    pub min_similarity: Option<f32>,
    pub max_results: Option<usize>,
    pub include_metadata: Option<bool>,
    pub boost_recent: Option<bool>,
}

/// Documentation search result for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationSearchResultInfo {
    pub chunk_id: String,
    pub library_id: String,
    pub title: String,
    pub content: String,
    pub section_path: Vec<String>,
    pub similarity_score: f32,
    pub relevance_score: f32,
    pub content_type: String,
    pub url: Option<String>,
    pub word_count: usize,
    pub importance_score: f32,
    pub keywords: Vec<String>,
}

/// Library statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStatistics {
    pub total_libraries: usize,
    pub total_chunks: usize,
    pub total_embeddings: usize,
    pub libraries_by_provider: HashMap<String, usize>,
    pub chunks_by_content_type: HashMap<String, usize>,
    pub average_chunk_size: f32,
    pub last_updated: String,
}

/// Manual documentation input
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddManualDocumentationRequest {
    pub provider_id: String,
    pub provider_name: String,
    pub title: String,
    pub content: String,
    pub section_path: Vec<String>,
    pub content_type: String,
    pub tags: Vec<String>,
    pub importance_score: Option<f32>,
}

/// Bulk documentation import
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkImportRequest {
    pub provider_id: String,
    pub provider_name: String,
    pub documents: Vec<BulkDocumentEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDocumentEntry {
    pub title: String,
    pub content: String,
    pub url: Option<String>,
    pub section_path: Vec<String>,
    pub content_type: String,
    pub tags: Vec<String>,
}

// ===== TAURI COMMANDS =====

/// Add documentation from a URL
#[tauri::command]
pub async fn add_documentation_from_url(
    request: AddDocumentationRequest,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<String, String> {
    info!("Adding documentation for provider: {} from {}", request.provider_name, request.docs_url);
    
    let docs_manager = docs_state.docs_manager.read().await;
    
    // Create ApiProvider from request
    let provider = ApiProvider {
        id: request.provider_id,
        name: request.provider_name,
        description: request.description.unwrap_or_default(),
        key_patterns: vec![], // Not needed for documentation
        env_patterns: vec![], // Not needed for documentation
        docs_url: request.docs_url.clone(),
        setup_type: "api".to_string(),
        category: request.provider_category,
        dependencies: vec![],
        config_templates: vec![],
    };
    
    match docs_manager.add_documentation_enhanced(&provider, &request.docs_url).await {
        Ok(library_id) => {
            info!("✅ Successfully added documentation library: {}", library_id);
            Ok(library_id)
        }
        Err(e) => {
            error!("❌ Failed to add documentation: {}", e);
            Err(format!("Failed to add documentation: {}", e))
        }
    }
}

/// Add manual documentation content
#[tauri::command]
pub async fn add_manual_documentation(
    request: AddManualDocumentationRequest,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<String, String> {
    info!("Adding manual documentation for provider: {}", request.provider_name);
    
    let docs_manager = docs_state.docs_manager.read().await;
    let doc_library = docs_manager.get_doc_library();
    
    // Create or find existing library for this provider
    let libraries = doc_library.get_libraries_by_provider(&request.provider_id).await
        .map_err(|e| format!("Failed to get libraries: {}", e))?;
    
    let library_id = if let Some(existing_library) = libraries.first() {
        existing_library.id.clone()
    } else {
        // Create new library
        let library = DocumentationLibrary {
            id: String::new(),
            name: format!("{} Documentation", request.provider_name),
            description: format!("Manual documentation for {}", request.provider_name),
            provider_id: Some(request.provider_id.clone()),
            url: "manual".to_string(),
            version: "1.0".to_string(),
            language: "en".to_string(),
            tags: request.tags.clone(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            content_hash: format!("{:x}", md5::compute(&request.content)),
            total_chunks: 1,
            status: DocumentationStatus::Indexed,
        };
        
        doc_library.add_library(library).await
            .map_err(|e| format!("Failed to create library: {}", e))?
    };
    
    // Create documentation chunk
    let content_type = match request.content_type.as_str() {
        "overview" => ContentType::Overview,
        "tutorial" => ContentType::Tutorial,
        "reference" => ContentType::Reference,
        "example" => ContentType::Example,
        "configuration" => ContentType::Configuration,
        "troubleshooting" => ContentType::Troubleshooting,
        "migration" => ContentType::Migration,
        "changelog" => ContentType::Changelog,
        _ => ContentType::Overview,
    };
    
    let metadata = ChunkMetadata {
        word_count: request.content.split_whitespace().count(),
        content_type,
        importance_score: request.importance_score.unwrap_or(0.7),
        keywords: request.tags.clone(),
        related_chunks: Vec::new(),
        source_url: None,
        line_numbers: None,
    };
    
    let chunk = DocumentationChunk {
        id: String::new(),
        library_id: library_id.clone(),
        chunk_index: 0,
        title: request.title,
        content: request.content.clone(),
        section_path: request.section_path,
        metadata,
        created_at: chrono::Utc::now(),
    };
    
    // Generate embedding for chunk
    let embedding = docs_manager.generate_hash_based_embedding(&request.content);
    
    match doc_library.add_chunk_with_embedding(chunk, embedding, "manual_entry".to_string()).await {
        Ok(chunk_id) => {
            info!("✅ Successfully added manual documentation chunk: {}", chunk_id);
            Ok(chunk_id)
        }
        Err(e) => {
            error!("❌ Failed to add manual documentation: {}", e);
            Err(format!("Failed to add manual documentation: {}", e))
        }
    }
}

/// Search documentation library
#[tauri::command]
pub async fn search_documentation_library(
    request: SearchDocumentationLibraryRequest,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<Vec<DocumentationSearchResultInfo>, String> {
    debug!("Searching documentation library: {}", request.query);
    
    let docs_manager = docs_state.docs_manager.read().await;
    
    // Convert content types
    let content_types = request.content_types.map(|types| {
        types.into_iter().filter_map(|t| {
            match t.as_str() {
                "overview" => Some(ContentType::Overview),
                "tutorial" => Some(ContentType::Tutorial),
                "reference" => Some(ContentType::Reference),
                "example" => Some(ContentType::Example),
                "configuration" => Some(ContentType::Configuration),
                "troubleshooting" => Some(ContentType::Troubleshooting),
                "migration" => Some(ContentType::Migration),
                "changelog" => Some(ContentType::Changelog),
                _ => None,
            }
        }).collect()
    });
    
    match docs_manager.search_documentation_enhanced(
        &request.query,
        request.provider_ids.as_ref().and_then(|ids| ids.first().map(|s| s.as_str())),
        content_types,
        request.max_results,
    ).await {
        Ok(results) => {
            let response_results: Vec<DocumentationSearchResultInfo> = results.into_iter().map(|result| {
                DocumentationSearchResultInfo {
                    chunk_id: result.chunk_id,
                    library_id: result.library_id,
                    title: result.title,
                    content: result.content,
                    section_path: result.section_path,
                    similarity_score: result.similarity_score,
                    relevance_score: result.relevance_score,
                    content_type: format!("{:?}", result.content_type),
                    url: result.url,
                    word_count: result.metadata.word_count,
                    importance_score: result.metadata.importance_score,
                    keywords: result.metadata.keywords,
                }
            }).collect();
            
            info!("Found {} documentation search results", response_results.len());
            Ok(response_results)
        }
        Err(e) => {
            error!("❌ Failed to search documentation: {}", e);
            Err(format!("Failed to search documentation: {}", e))
        }
    }
}

/// Get all documentation libraries
#[tauri::command]
pub async fn get_documentation_libraries(
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<Vec<DocumentationLibraryInfo>, String> {
    debug!("Retrieving all documentation libraries");
    
    let docs_manager = docs_state.docs_manager.read().await;
    let doc_library = docs_manager.get_doc_library();
    
    // This would need to be implemented in DocumentationLibraryManager
    // For now, return empty list
    Ok(vec![])
}

/// Get documentation library by ID
#[tauri::command]
pub async fn get_documentation_library(
    library_id: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<Option<DocumentationLibraryInfo>, String> {
    debug!("Retrieving documentation library: {}", library_id);
    
    // This would retrieve a specific library by ID
    // For now, return None
    Ok(None)
}

/// Get chunks for a documentation library
#[tauri::command]
pub async fn get_library_chunks(
    library_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<Vec<DocumentationChunkInfo>, String> {
    debug!("Retrieving chunks for library: {}", library_id);
    
    // This would retrieve chunks for a specific library with pagination
    // For now, return empty list
    Ok(vec![])
}

/// Update documentation library
#[tauri::command]
pub async fn update_documentation_library(
    library_id: String,
    name: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    info!("Updating documentation library: {}", library_id);
    
    // This would update library metadata
    // For now, return success
    Ok(true)
}

/// Delete documentation library
#[tauri::command]
pub async fn delete_documentation_library(
    library_id: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    info!("Deleting documentation library: {}", library_id);
    
    // This would delete a library and all its chunks
    // For now, return success
    Ok(true)
}

/// Refresh documentation from URL
#[tauri::command]
pub async fn refresh_documentation_library(
    library_id: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    info!("Refreshing documentation library: {}", library_id);
    
    // This would re-scrape and update documentation from the original URL
    // For now, return success
    Ok(true)
}

/// Get library statistics
#[tauri::command]
pub async fn get_library_statistics(
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<LibraryStatistics, String> {
    debug!("Retrieving library statistics");
    
    let docs_manager = docs_state.docs_manager.read().await;
    
    match docs_manager.get_library_statistics().await {
        Ok(stats) => {
            Ok(LibraryStatistics {
                total_libraries: stats.get("total_libraries").copied().unwrap_or(0),
                total_chunks: stats.get("total_chunks").copied().unwrap_or(0),
                total_embeddings: stats.get("total_embeddings").copied().unwrap_or(0),
                libraries_by_provider: HashMap::new(), // Would be calculated from actual data
                chunks_by_content_type: HashMap::new(), // Would be calculated from actual data
                average_chunk_size: 0.0, // Would be calculated from actual data
                last_updated: chrono::Utc::now().to_rfc3339(),
            })
        }
        Err(e) => {
            error!("❌ Failed to get library statistics: {}", e);
            Err(format!("Failed to get library statistics: {}", e))
        }
    }
}

/// Bulk import documentation
#[tauri::command]
pub async fn bulk_import_documentation(
    request: BulkImportRequest,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<String, String> {
    info!("Bulk importing {} documents for provider: {}", request.documents.len(), request.provider_name);
    
    let docs_manager = docs_state.docs_manager.read().await;
    let doc_library = docs_manager.get_doc_library();
    
    // Create library for bulk import
    let library = DocumentationLibrary {
        id: String::new(),
        name: format!("{} Documentation (Bulk Import)", request.provider_name),
        description: format!("Bulk imported documentation for {}", request.provider_name),
        provider_id: Some(request.provider_id.clone()),
        url: "bulk_import".to_string(),
        version: "1.0".to_string(),
        language: "en".to_string(),
        tags: vec!["bulk_import".to_string()],
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        content_hash: format!("{:x}", md5::compute(&format!("{:?}", request.documents))),
        total_chunks: request.documents.len(),
        status: DocumentationStatus::Processing,
    };
    
    let library_id = doc_library.add_library(library).await
        .map_err(|e| format!("Failed to create library: {}", e))?;
    
    let mut successful_imports = 0;
    
    for (index, doc) in request.documents.iter().enumerate() {
        let content_type = match doc.content_type.as_str() {
            "overview" => ContentType::Overview,
            "tutorial" => ContentType::Tutorial,
            "reference" => ContentType::Reference,
            "example" => ContentType::Example,
            "configuration" => ContentType::Configuration,
            "troubleshooting" => ContentType::Troubleshooting,
            "migration" => ContentType::Migration,
            "changelog" => ContentType::Changelog,
            _ => ContentType::Overview,
        };
        
        let metadata = ChunkMetadata {
            word_count: doc.content.split_whitespace().count(),
            content_type,
            importance_score: 0.7,
            keywords: doc.tags.clone(),
            related_chunks: Vec::new(),
            source_url: doc.url.clone(),
            line_numbers: None,
        };
        
        let chunk = DocumentationChunk {
            id: String::new(),
            library_id: library_id.clone(),
            chunk_index: index,
            title: doc.title.clone(),
            content: doc.content.clone(),
            section_path: doc.section_path.clone(),
            metadata,
            created_at: chrono::Utc::now(),
        };
        
        // Generate embedding for chunk
        let embedding = docs_manager.generate_hash_based_embedding(&doc.content);
        
        match doc_library.add_chunk_with_embedding(chunk, embedding, "bulk_import".to_string()).await {
            Ok(_) => {
                successful_imports += 1;
            }
            Err(e) => {
                warn!("Failed to import document {}: {}", doc.title, e);
            }
        }
    }
    
    info!("✅ Successfully imported {}/{} documents", successful_imports, request.documents.len());
    Ok(library_id)
}

/// Export documentation library
#[tauri::command]
pub async fn export_documentation_library(
    library_id: String,
    format: String, // "json", "markdown", "csv"
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<String, String> {
    info!("Exporting documentation library {} as {}", library_id, format);
    
    // This would export the library in the requested format
    // For now, return a placeholder
    match format.as_str() {
        "json" => Ok(r#"{"library_id": "placeholder", "chunks": []}"#.to_string()),
        "markdown" => Ok(format!("# Documentation Library Export\n\nLibrary ID: {}\n\n", library_id)),
        "csv" => Ok("title,content,section_path,content_type\n".to_string()),
        _ => Err(format!("Unsupported export format: {}", format))
    }
}

/// Get documentation chunk by ID
#[tauri::command]
pub async fn get_documentation_chunk(
    chunk_id: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<Option<DocumentationChunkInfo>, String> {
    debug!("Retrieving documentation chunk: {}", chunk_id);
    
    // This would retrieve a specific chunk by ID
    // For now, return None
    Ok(None)
}

/// Update documentation chunk
#[tauri::command]
pub async fn update_documentation_chunk(
    chunk_id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    importance_score: Option<f32>,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    info!("Updating documentation chunk: {}", chunk_id);
    
    // This would update chunk content and regenerate embeddings
    // For now, return success
    Ok(true)
}

/// Delete documentation chunk
#[tauri::command]
pub async fn delete_documentation_chunk(
    chunk_id: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    info!("Deleting documentation chunk: {}", chunk_id);
    
    // This would delete a specific chunk
    // For now, return success
    Ok(true)
}

/// Validate documentation URL before adding
#[tauri::command]
pub async fn validate_documentation_url(
    url: String,
    docs_state: State<'_, DocumentationLibraryState>,
) -> Result<bool, String> {
    debug!("Validating documentation URL: {}", url);
    
    let docs_manager = docs_state.docs_manager.read().await;
    
    // Try to fetch the URL to validate it's accessible
    match docs_manager.scrape_documentation_content(&url).await {
        Ok(content) => {
            if content.trim().is_empty() {
                Ok(false)
            } else {
                Ok(true)
            }
        }
        Err(_) => Ok(false)
    }
}