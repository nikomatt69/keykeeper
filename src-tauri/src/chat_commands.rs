use crate::chat_engine::{ChatEngine, ChatRequest, ChatResponse, IntegrationGenerationRequest};
use crate::documentation_library::{
    ChatSession, ChatSessionStatus, DocumentationLibrary, DocumentationSearchResult,
    UserPreferences, DetailLevel, GenerationContext, IntegrationGeneration
};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::env;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// State management for chat functionality
pub struct ChatEngineState {
    pub chat_engine: Arc<RwLock<ChatEngine>>,
    pub llm_proxy_state: Arc<crate::llm_proxy::LLMProxyState>,
}

impl ChatEngineState {
    pub fn new(chat_engine: ChatEngine, llm_proxy_state: Arc<crate::llm_proxy::LLMProxyState>) -> Self {
        Self {
            chat_engine: Arc::new(RwLock::new(chat_engine)),
            llm_proxy_state,
        }
    }
    
    pub fn new_with_default_proxy(chat_engine: ChatEngine) -> Self {
        Self {
            chat_engine: Arc::new(RwLock::new(chat_engine)),
            llm_proxy_state: Arc::new(crate::llm_proxy::LLMProxyState::default()),
        }
    }
}

/// Request to create a new chat session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatSessionRequest {
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub context_libraries: Vec<String>,
}

/// Response containing chat session details
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatSessionResponse {
    pub session_id: String,
    pub title: String,
    pub created_at: String,
}

/// Request to send a chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatMessageRequest {
    pub session_id: String,
    pub message: String,
    pub context_libraries: Vec<String>,
    pub user_preferences: ChatUserPreferences,
    pub generation_context: Option<ChatGenerationContext>,
    pub include_code_generation: bool,
}

/// User preferences for chat (frontend-friendly)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatUserPreferences {
    pub preferred_language: String,
    pub preferred_framework: String,
    pub code_style: String,
    pub detail_level: String, // "minimal", "standard", "comprehensive", "expert"
    pub include_examples: bool,
    pub include_tests: bool,
    pub security_focused: bool,
}

/// Generation context for chat (frontend-friendly)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGenerationContext {
    pub target_framework: String,
    pub target_language: String,
    pub project_context: Option<String>,
    pub existing_code: Option<String>,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
}

/// Chat message for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageResponse {
    pub id: String,
    pub role: String, // "user", "assistant", "system"
    pub content: String,
    pub timestamp: String,
    pub context_chunks: Vec<String>,
    pub generated_code: Option<GeneratedCodeResponse>,
    pub metadata: Option<ChatMessageMetadata>,
}

/// Generated code response for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedCodeResponse {
    pub language: String,
    pub framework: String,
    pub code_blocks: Vec<CodeBlockResponse>,
    pub dependencies: Vec<String>,
    pub configuration: std::collections::HashMap<String, String>,
    pub test_cases: Option<String>,
    pub documentation: Option<String>,
}

/// Code block response for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeBlockResponse {
    pub filename: String,
    pub content: String,
    pub description: String,
    pub file_type: String,
}

/// Chat message metadata for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageMetadata {
    pub token_count: Option<usize>,
    pub processing_time_ms: Option<u64>,
    pub context_relevance: Option<f32>,
    pub confidence_score: Option<f32>,
    pub search_queries: Vec<String>,
}

/// Chat session summary for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionSummary {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub message_count: usize,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
    pub context_libraries: Vec<String>,
}

/// Documentation search request for chat context
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchDocumentationRequest {
    pub query: String,
    pub provider_id: Option<String>,
    pub content_types: Option<Vec<String>>,
    pub max_results: Option<usize>,
    pub min_similarity: Option<f32>,
}

/// Integration generation request for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateIntegrationRequest {
    pub session_id: String,
    pub provider_name: String,
    pub framework: String,
    pub language: String,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
    pub project_context: Option<String>,
    pub existing_code: Option<String>,
}

// ===== TAURI COMMANDS =====

/// Create a new chat session
#[tauri::command]
pub async fn create_chat_session(
    request: CreateChatSessionRequest,
    chat_state: State<'_, ChatEngineState>,
) -> Result<CreateChatSessionResponse, String> {
    info!("Creating new chat session for user: {}", request.user_id);
    
    let chat_engine = chat_state.chat_engine.read().await;
    let doc_manager = chat_engine.doc_manager();
    
    match doc_manager.create_chat_session(
        request.user_id,
        request.title.clone(),
        request.description,
        request.context_libraries,
    ).await {
        Ok(session_id) => {
            info!("✅ Created chat session: {}", session_id);
            Ok(CreateChatSessionResponse {
                session_id,
                title: request.title,
                created_at: chrono::Utc::now().to_rfc3339(),
            })
        }
        Err(e) => {
            error!("❌ Failed to create chat session: {}", e);
            Err(format!("Failed to create chat session: {}", e))
        }
    }
}

/// Send a chat message and get response
#[tauri::command]
pub async fn send_chat_message(
    request: SendChatMessageRequest,
    chat_state: State<'_, ChatEngineState>,
) -> Result<ChatResponse, String> {
    info!("Processing chat message for session: {}", request.session_id);
    
    let chat_engine = chat_state.chat_engine.read().await;
    
    // Convert frontend preferences to internal format
    let user_preferences = UserPreferences {
        preferred_language: request.user_preferences.preferred_language,
        preferred_framework: request.user_preferences.preferred_framework,
        code_style: request.user_preferences.code_style,
        detail_level: match request.user_preferences.detail_level.as_str() {
            "minimal" => DetailLevel::Minimal,
            "standard" => DetailLevel::Standard,
            "comprehensive" => DetailLevel::Comprehensive,
            "expert" => DetailLevel::Expert,
            _ => DetailLevel::Standard,
        },
        include_examples: request.user_preferences.include_examples,
        include_tests: request.user_preferences.include_tests,
        security_focused: request.user_preferences.security_focused,
    };
    
    let generation_context = request.generation_context.map(|ctx| GenerationContext {
        target_framework: ctx.target_framework,
        target_language: ctx.target_language,
        project_context: ctx.project_context,
        existing_code: ctx.existing_code,
        requirements: ctx.requirements,
        constraints: ctx.constraints,
    });
    
    // Create chat request
    let chat_request = ChatRequest {
        session_id: request.session_id,
        user_message: request.message,
        context_libraries: request.context_libraries,
        user_preferences,
        generation_context,
        include_code_generation: request.include_code_generation,
    };
    
    match chat_engine.process_chat(chat_request).await {
        Ok(response) => {
            info!("✅ Generated chat response");
            Ok(response)
        }
        Err(e) => {
            error!("❌ Failed to process chat message: {}", e);
            Err(format!("Failed to process chat message: {}", e))
        }
    }
}

/// Get chat session messages
#[tauri::command]
pub async fn get_chat_messages(
    session_id: String,
    chat_state: State<'_, ChatEngineState>,
) -> Result<Vec<ChatMessageResponse>, String> {
    debug!("Retrieving messages for session: {}", session_id);
    
    let chat_engine = chat_state.chat_engine.read().await;
    let doc_manager = chat_engine.doc_manager();
    
    match doc_manager.get_chat_messages(&session_id).await {
        Ok(messages) => {
            let response_messages = messages.into_iter().map(|msg| {
                ChatMessageResponse {
                    id: msg.id,
                    role: match msg.role {
                        crate::documentation_library::MessageRole::User => "user".to_string(),
                        crate::documentation_library::MessageRole::Assistant => "assistant".to_string(),
                        crate::documentation_library::MessageRole::System => "system".to_string(),
                    },
                    content: msg.content,
                    timestamp: msg.created_at.to_rfc3339(),
                    context_chunks: msg.context_chunks,
                    generated_code: msg.metadata.generated_code.map(|code| GeneratedCodeResponse {
                        language: code.language,
                        framework: code.framework,
                        code_blocks: code.code_blocks.into_iter().map(|block| CodeBlockResponse {
                            filename: block.filename,
                            content: block.content,
                            description: block.description,
                            file_type: format!("{:?}", block.file_type),
                        }).collect(),
                        dependencies: code.dependencies,
                        configuration: code.configuration,
                        test_cases: code.test_cases,
                        documentation: code.documentation,
                    }),
                    metadata: Some(ChatMessageMetadata {
                        token_count: msg.metadata.token_count,
                        processing_time_ms: msg.metadata.processing_time_ms,
                        context_relevance: msg.metadata.context_relevance,
                        confidence_score: msg.metadata.confidence_score,
                        search_queries: msg.metadata.search_queries,
                    }),
                }
            }).collect();
            
            Ok(response_messages)
        }
        Err(e) => {
            error!("❌ Failed to get chat messages: {}", e);
            Err(format!("Failed to get chat messages: {}", e))
        }
    }
}

/// Get user's chat sessions
#[tauri::command]
pub async fn get_user_chat_sessions(
    user_id: String,
    chat_state: State<'_, ChatEngineState>,
) -> Result<Vec<ChatSessionSummary>, String> {
    debug!("Retrieving chat sessions for user: {}", user_id);
    
    let chat_engine = chat_state.chat_engine.read().await;
    let doc_manager = chat_engine.doc_manager();
    
    match doc_manager.get_user_chat_sessions(&user_id).await {
        Ok(sessions) => {
            let session_summaries = sessions.into_iter().map(|session| {
                ChatSessionSummary {
                    id: session.id,
                    title: session.title,
                    description: session.description,
                    message_count: session.message_count,
                    created_at: session.created_at.to_rfc3339(),
                    updated_at: session.updated_at.to_rfc3339(),
                    status: match session.status {
                        ChatSessionStatus::Active => "active".to_string(),
                        ChatSessionStatus::Archived => "archived".to_string(),
                        ChatSessionStatus::Deleted => "deleted".to_string(),
                    },
                    context_libraries: session.context_libraries,
                }
            }).collect();
            
            Ok(session_summaries)
        }
        Err(e) => {
            error!("❌ Failed to get user chat sessions: {}", e);
            Err(format!("Failed to get user chat sessions: {}", e))
        }
    }
}

/// Search documentation for chat context
#[tauri::command]
pub async fn search_documentation_for_chat(
    request: SearchDocumentationRequest,
    chat_state: State<'_, ChatEngineState>,
) -> Result<Vec<DocumentationSearchResult>, String> {
    debug!("Searching documentation for chat: {}", request.query);
    
    let chat_engine = chat_state.chat_engine.read().await;
    
    // Generate embedding for search (placeholder implementation)
    let query_embedding = vec![0.0; 384]; // This would be generated by the ML engine
    
    // Build search parameters
    let search_params = crate::documentation_library::VectorSearchParams {
        query: request.query.clone(),
        library_ids: None, // Could be filtered by provider
        content_types: request.content_types.and_then(|types| {
            Some(types.into_iter().filter_map(|t| {
                match t.as_str() {
                    "overview" => Some(crate::documentation_library::ContentType::Overview),
                    "tutorial" => Some(crate::documentation_library::ContentType::Tutorial),
                    "reference" => Some(crate::documentation_library::ContentType::Reference),
                    "example" => Some(crate::documentation_library::ContentType::Example),
                    "configuration" => Some(crate::documentation_library::ContentType::Configuration),
                    "troubleshooting" => Some(crate::documentation_library::ContentType::Troubleshooting),
                    _ => None,
                }
            }).collect())
        }),
        min_similarity: request.min_similarity.unwrap_or(0.6),
        max_results: request.max_results.unwrap_or(10),
        include_metadata: true,
        boost_recent: false,
        section_filter: None,
    };
    
    match chat_engine.doc_manager().vector_search(search_params, query_embedding).await {
        Ok(results) => {
            info!("Found {} documentation results", results.len());
            Ok(results)
        }
        Err(e) => {
            error!("❌ Failed to search documentation: {}", e);
            Err(format!("Failed to search documentation: {}", e))
        }
    }
}

/// Generate complete integration
#[tauri::command]
pub async fn generate_integration(
    request: GenerateIntegrationRequest,
    chat_state: State<'_, ChatEngineState>,
) -> Result<IntegrationGeneration, String> {
    info!("Generating integration for provider: {}", request.provider_name);
    
    let chat_engine = chat_state.chat_engine.read().await;
    
    let generation_request = IntegrationGenerationRequest {
        session_id: request.session_id,
        provider_name: request.provider_name,
        framework: request.framework,
        language: request.language,
        requirements: request.requirements,
        constraints: request.constraints,
        project_context: request.project_context,
        existing_code: request.existing_code,
    };
    
    match chat_engine.generate_integration(generation_request).await {
        Ok(integration) => {
            info!("✅ Generated integration successfully");
            
            // Store the integration in the documentation library
            if let Err(e) = chat_engine.doc_manager().store_integration_generation(integration.clone()).await {
                warn!("Failed to store integration generation: {}", e);
            }
            
            Ok(integration)
        }
        Err(e) => {
            error!("❌ Failed to generate integration: {}", e);
            Err(format!("Failed to generate integration: {}", e))
        }
    }
}

/// Archive a chat session
#[tauri::command]
pub async fn archive_chat_session(
    session_id: String,
    chat_state: State<'_, ChatEngineState>,
) -> Result<bool, String> {
    info!("Archiving chat session: {}", session_id);
    
    // This would update the session status to Archived
    // For now, we'll just return success
    Ok(true)
}

/// Delete a chat session
#[tauri::command]
pub async fn delete_chat_session(
    session_id: String,
    chat_state: State<'_, ChatEngineState>,
) -> Result<bool, String> {
    info!("Deleting chat session: {}", session_id);
    
    // This would update the session status to Deleted or remove it entirely
    // For now, we'll just return success
    Ok(true)
}

/// Get chat engine statistics
#[tauri::command]
pub async fn get_chat_statistics(
    chat_state: State<'_, ChatEngineState>,
) -> Result<std::collections::HashMap<String, usize>, String> {
    debug!("Retrieving chat statistics");
    
    let chat_engine = chat_state.chat_engine.read().await;
    
    match chat_engine.doc_manager().get_library_stats().await {
        Ok(stats) => Ok(stats),
        Err(e) => {
            error!("❌ Failed to get chat statistics: {}", e);
            Err(format!("Failed to get chat statistics: {}", e))
        }
    }
}

/// Update user preferences for a session
#[tauri::command]
pub async fn update_session_preferences(
    session_id: String,
    preferences: ChatUserPreferences,
    chat_state: State<'_, ChatEngineState>,
) -> Result<bool, String> {
    info!("Updating preferences for session: {}", session_id);
    
    // This would update the session's user preferences
    // For now, we'll just return success
    Ok(true)
}

/// Get available documentation libraries
#[tauri::command]
pub async fn get_available_documentation_libraries(
    chat_state: State<'_, ChatEngineState>,
) -> Result<Vec<DocumentationLibrary>, String> {
    debug!("Retrieving available documentation libraries");
    
    // This would return all available documentation libraries
    // For now, return an empty list
    Ok(vec![])
}

/// Configure LLM provider for chat
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMProviderConfig {
    pub provider: String, // "openai", "anthropic", "ollama"
    pub model: String,
    pub api_key: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<usize>,
}

#[tauri::command]
pub async fn configure_llm_provider(
    config: LLMProviderConfig,
    chat_state: State<'_, ChatEngineState>,
) -> Result<bool, String> {
    info!("Configuring LLM provider: {}", config.provider);
    
    // Store the configuration (in a real app, this would be persisted)
    // For now, we'll just validate the configuration
    match config.provider.as_str() {
        "openai" => {
            if config.api_key.is_none() {
                return Err("OpenAI API key is required".to_string());
            }
            // Set environment variable for this session
            if let Some(api_key) = &config.api_key {
                std::env::set_var("OPENAI_API_KEY", api_key);
            }
        },
        "anthropic" => {
            if config.api_key.is_none() {
                return Err("Anthropic API key is required".to_string());
            }
            // Set environment variable for this session
            if let Some(api_key) = &config.api_key {
                std::env::set_var("ANTHROPIC_API_KEY", api_key);
            }
        },
        "ollama" => {
            // No API key required for Ollama
            info!("Ollama configuration set for model: {}", config.model);
        },
        "local" => {
            // No API key required for local model
            info!("Local Qwen model configuration set: {}", config.model);
        },
        _ => {
            return Err(format!("Unsupported provider: {}", config.provider));
        }
    }
    
    info!("✅ LLM provider {} configured successfully", config.provider);
    Ok(true)
}

/// Test LLM connection
#[tauri::command]
pub async fn test_llm_connection(
    provider: String,
    chat_state: State<'_, ChatEngineState>,
) -> Result<String, String> {
    info!("Testing LLM connection for provider: {}", provider);
    
    use crate::llm_proxy::{LLMConfig as ProxyConfig, process_with_llm_internal};
    
    let test_prompt = "Hello! This is a test message. Please respond with 'Test successful' if you receive this.";
    
    let config = match provider.as_str() {
        "openai" => {
            let api_key = std::env::var("OPENAI_API_KEY")
                .map_err(|_| "OpenAI API key not found in environment".to_string())?;
            ProxyConfig {
                provider: "openai".to_string(),
                model: "gpt-4o-mini".to_string(),
                temperature: 0.1,
                max_tokens: 50,
                api_key: Some(api_key),
                stream: Some(false),
                system_prompt: None,
            }
        },
        "anthropic" => {
            let api_key = std::env::var("ANTHROPIC_API_KEY")
                .map_err(|_| "Anthropic API key not found in environment".to_string())?;
            ProxyConfig {
                provider: "anthropic".to_string(),
                model: "claude-sonnet-4-20250514".to_string(),
                temperature: 0.1,
                max_tokens: 50,
                api_key: Some(api_key),
                stream: Some(false),
                system_prompt: None,
            }
        },
        "ollama" => {
            ProxyConfig {
                provider: "ollama".to_string(),
                model: "llama3.2".to_string(),
                temperature: 0.1,
                max_tokens: 50,
                api_key: None,
                stream: Some(false),
                system_prompt: None,
            }
        },
        "local" => {
            ProxyConfig {
                provider: "local".to_string(),
                model: "/Volumes/SSD/dev/projects/keykeeper/src-tauri/models/Qwen3-0.6B.Q2_K.gguf".to_string(),
                temperature: 0.1,
                max_tokens: 50,
                api_key: None,
                stream: Some(false),
                system_prompt: None,
            }
        },
        _ => return Err(format!("Unsupported provider: {}", provider)),
    };
    
    match process_with_llm_internal(test_prompt.to_string(), None, config, chat_state.llm_proxy_state.clone()).await {
        Ok(response) => {
            info!("✅ LLM connection test successful for {}", provider);
            Ok(format!("Connection successful! Response: {}", response.content))
        },
        Err(e) => {
            error!("❌ LLM connection test failed for {}: {}", provider, e);
            Err(format!("Connection failed: {}", e))
        }
    }
}

/// Set environment variable (for API keys and configuration)
#[tauri::command]
pub async fn set_env_var(
    key: String,
    value: String,
) -> Result<bool, String> {
    info!("Setting environment variable: {}", key);
    
    // Validate the key name for security
    if key.is_empty() || key.contains(' ') || key.contains('\0') {
        return Err("Invalid environment variable key".to_string());
    }
    
    // Set the environment variable for this process
    std::env::set_var(&key, &value);
    
    // Verify it was set
    match std::env::var(&key) {
        Ok(stored_value) if stored_value == value => {
            info!("✅ Environment variable {} set successfully", key);
            Ok(true)
        }
        Ok(_) => {
            error!("❌ Environment variable {} was set but value doesn't match", key);
            Err("Failed to set environment variable correctly".to_string())
        }
        Err(e) => {
            error!("❌ Failed to set environment variable {}: {}", key, e);
            Err(format!("Failed to set environment variable: {}", e))
        }
    }
}

/// Export chat session
#[tauri::command]
pub async fn export_chat_session(
    session_id: String,
    format: String, // "json", "markdown", "text"
    chat_state: State<'_, ChatEngineState>,
) -> Result<String, String> {
    info!("Exporting chat session {} as {}", session_id, format);
    
    let chat_engine = chat_state.chat_engine.read().await;
    let doc_manager = chat_engine.doc_manager();
    
    match doc_manager.get_chat_messages(&session_id).await {
        Ok(messages) => {
            match format.as_str() {
                "json" => {
                    match serde_json::to_string_pretty(&messages) {
                        Ok(json) => Ok(json),
                        Err(e) => Err(format!("Failed to serialize to JSON: {}", e))
                    }
                }
                "markdown" => {
                    let mut markdown = format!("# Chat Session Export\n\nSession ID: {}\n\n", session_id);
                    
                    for message in messages {
                        let role = match message.role {
                            crate::documentation_library::MessageRole::User => "**User**",
                            crate::documentation_library::MessageRole::Assistant => "**Assistant**",
                            crate::documentation_library::MessageRole::System => "**System**",
                        };
                        
                        markdown.push_str(&format!(
                            "## {} - {}\n\n{}\n\n",
                            role,
                            message.created_at.format("%Y-%m-%d %H:%M:%S"),
                            message.content
                        ));
                        
                        if let Some(code) = message.metadata.generated_code {
                            markdown.push_str("### Generated Code\n\n");
                            for block in code.code_blocks {
                                markdown.push_str(&format!(
                                    "**{}** ({})\n\n```{}\n{}\n```\n\n",
                                    block.filename, block.description, 
                                    code.language.to_lowercase(), block.content
                                ));
                            }
                        }
                    }
                    
                    Ok(markdown)
                }
                "text" => {
                    let mut text = format!("Chat Session Export\nSession ID: {}\n\n", session_id);
                    
                    for message in messages {
                        let role = match message.role {
                            crate::documentation_library::MessageRole::User => "User",
                            crate::documentation_library::MessageRole::Assistant => "Assistant",
                            crate::documentation_library::MessageRole::System => "System",
                        };
                        
                        text.push_str(&format!(
                            "{} [{}]: {}\n\n",
                            role,
                            message.created_at.format("%Y-%m-%d %H:%M:%S"),
                            message.content
                        ));
                    }
                    
                    Ok(text)
                }
                _ => Err(format!("Unsupported export format: {}", format))
            }
        }
        Err(e) => {
            error!("❌ Failed to export chat session: {}", e);
            Err(format!("Failed to export chat session: {}", e))
        }
    }
}