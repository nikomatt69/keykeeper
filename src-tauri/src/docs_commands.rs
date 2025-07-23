use crate::docs_manager::{DocumentationManager, ApiDocumentation, DocSearchResult};
use crate::api_generator::{ApiGeneratorService, ApiProvider};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, State};
use tokio::sync::Mutex;

/// State for the Documentation Manager
pub struct DocsManagerState {
    pub manager: Arc<Mutex<DocumentationManager>>,
}

impl DocsManagerState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(DocumentationManager::new())),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddDocumentationRequest {
    pub provider_id: String,
    pub docs_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchDocsRequest {
    pub query: String,
    pub provider_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Add documentation for an API provider
#[command]
pub async fn add_provider_documentation(
    request: AddDocumentationRequest,
    docs_state: State<'_, DocsManagerState>,
    api_state: State<'_, crate::api_generator_commands::ApiGeneratorState>,
) -> Result<DocsResponse, String> {
    let mut docs_manager = docs_state.manager.lock().await;
    let api_service = api_state.service.lock().await;
    
    // Get the provider information
    let providers = api_service.get_providers();
    let provider = providers
        .iter()
        .find(|p| p.id == request.provider_id)
        .ok_or_else(|| format!("Provider {} not found", request.provider_id))?;
    
    match docs_manager.add_documentation(provider, &request.docs_url).await {
        Ok(documentation) => Ok(DocsResponse {
            success: true,
            message: format!("Documentation added for {}", provider.name),
            data: Some(serde_json::to_value(&documentation).unwrap()),
        }),
        Err(e) => Ok(DocsResponse {
            success: false,
            message: format!("Failed to add documentation: {}", e),
            data: None,
        }),
    }
}

/// Get documentation for a specific provider
#[command]
pub async fn get_provider_documentation(
    provider_id: String,
    docs_state: State<'_, DocsManagerState>,
) -> Result<DocsResponse, String> {
    let docs_manager = docs_state.manager.lock().await;
    let docs = docs_manager.get_provider_documentation(&provider_id);
    
    Ok(DocsResponse {
        success: true,
        message: format!("Found {} documentation(s) for provider", docs.len()),
        data: Some(serde_json::to_value(&docs).unwrap()),
    })
}

/// Search documentation content
#[command]
pub async fn search_documentation(
    request: SearchDocsRequest,
    docs_state: State<'_, DocsManagerState>,
) -> Result<Vec<DocSearchResult>, String> {
    let docs_manager = docs_state.manager.lock().await;
    let results = docs_manager.search_documentation(&request.query, request.provider_id.as_deref());
    
    Ok(results)
}

/// Get specific documentation by ID
#[command]
pub async fn get_documentation_by_id(
    doc_id: String,
    docs_state: State<'_, DocsManagerState>,
) -> Result<DocsResponse, String> {
    let docs_manager = docs_state.manager.lock().await;
    
    if let Some(doc) = docs_manager.get_documentation(&doc_id) {
        Ok(DocsResponse {
            success: true,
            message: "Documentation found".to_string(),
            data: Some(serde_json::to_value(doc).unwrap()),
        })
    } else {
        Ok(DocsResponse {
            success: false,
            message: "Documentation not found".to_string(),
            data: None,
        })
    }
}

/// Update documentation for a provider
#[command]
pub async fn update_provider_documentation(
    provider_id: String,
    docs_url: String,
    docs_state: State<'_, DocsManagerState>,
) -> Result<DocsResponse, String> {
    let mut docs_manager = docs_state.manager.lock().await;
    
    match docs_manager.update_documentation(&provider_id, &docs_url).await {
        Ok(()) => Ok(DocsResponse {
            success: true,
            message: format!("Documentation updated for provider {}", provider_id),
            data: None,
        }),
        Err(e) => Ok(DocsResponse {
            success: false,
            message: format!("Failed to update documentation: {}", e),
            data: None,
        }),
    }
}

/// Remove documentation for a provider
#[command]
pub async fn remove_provider_documentation(
    provider_id: String,
    docs_state: State<'_, DocsManagerState>,
) -> Result<DocsResponse, String> {
    let mut docs_manager = docs_state.manager.lock().await;
    
    match docs_manager.remove_documentation(&provider_id) {
        Ok(()) => Ok(DocsResponse {
            success: true,
            message: format!("Documentation removed for provider {}", provider_id),
            data: None,
        }),
        Err(e) => Ok(DocsResponse {
            success: false,
            message: format!("Failed to remove documentation: {}", e),
            data: None,
        }),
    }
}

/// Get all providers that have documentation
#[command]
pub async fn get_indexed_providers(
    docs_state: State<'_, DocsManagerState>,
) -> Result<Vec<String>, String> {
    let docs_manager = docs_state.manager.lock().await;
    Ok(docs_manager.get_indexed_providers())
}

/// Auto-add documentation for all known providers
#[command]
pub async fn auto_index_provider_docs(
    docs_state: State<'_, DocsManagerState>,
    api_state: State<'_, crate::api_generator_commands::ApiGeneratorState>,
) -> Result<DocsResponse, String> {
    let mut docs_manager = docs_state.manager.lock().await;
    let api_service = api_state.service.lock().await;
    
    let providers = api_service.get_providers();
    let mut success_count = 0;
    let mut error_count = 0;
    let mut errors = Vec::new();
    
    for provider in providers {
        if !provider.docs_url.is_empty() {
            match docs_manager.add_documentation(&provider, &provider.docs_url).await {
                Ok(_) => success_count += 1,
                Err(e) => {
                    error_count += 1;
                    errors.push(format!("{}: {}", provider.name, e));
                }
            }
        }
    }
    
    let message = if error_count == 0 {
        format!("Successfully indexed documentation for {} providers", success_count)
    } else {
        format!(
            "Indexed {} providers successfully, {} failed. Errors: {}",
            success_count,
            error_count,
            errors.join("; ")
        )
    };
    
    Ok(DocsResponse {
        success: error_count == 0,
        message,
        data: Some(serde_json::json!({
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors
        })),
    })
}

/// Get documentation suggestions based on current context
#[command]
pub async fn get_context_documentation_suggestions(
    provider_ids: Vec<String>,
    context_keywords: Vec<String>,
    docs_state: State<'_, DocsManagerState>,
) -> Result<Vec<DocSearchResult>, String> {
    let docs_manager = docs_state.manager.lock().await;
    let mut all_results = Vec::new();
    
    for provider_id in provider_ids {
        for keyword in &context_keywords {
            let results = docs_manager.search_documentation(keyword, Some(&provider_id));
            all_results.extend(results);
        }
    }
    
    // Deduplicate and sort by relevance
    all_results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
    all_results.dedup_by(|a, b| a.doc_id == b.doc_id && a.section_id == b.section_id);
    all_results.truncate(10); // Return top 10 suggestions
    
    Ok(all_results)
}