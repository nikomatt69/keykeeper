use crate::api_generator::{ApiGeneratorService, TemplateSuggestion, CacheStats};
use crate::enhanced_types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{command, State, Window, Manager, Emitter};
use tokio::sync::Mutex;
use tracing::{debug, info, warn, error};
use uuid::Uuid;

/// State for enhanced API generator
pub struct EnhancedApiState {
    pub service: Arc<Mutex<ApiGeneratorService>>,
    /// Active generation sessions for progress tracking
    pub active_sessions: Arc<Mutex<HashMap<String, GenerationSession>>>,
}

impl EnhancedApiState {
    pub fn new() -> Self {
        Self {
            service: Arc::new(Mutex::new(ApiGeneratorService::new())),
            active_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Generation session for tracking progress
#[derive(Debug, Clone)]
pub struct GenerationSession {
    pub id: String,
    pub provider_id: String,
    pub status: GenerationStatus,
    pub progress: GenerationProgress,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub window_label: Option<String>,
}

/// Generation status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GenerationStatus {
    Starting,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

/// Generate enhanced configuration with progress streaming
#[command]
pub async fn generate_enhanced_configuration(
    request: EnhancedGenerationRequest,
    window: Window,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<EnhancedGenerationResult, String> {
    info!("Starting enhanced configuration generation for provider: {}", request.provider_id);

    // Create session
    let session_id = Uuid::new_v4().to_string();
    let session = GenerationSession {
        id: session_id.clone(),
        provider_id: request.provider_id.clone(),
        status: GenerationStatus::Starting,
        progress: GenerationProgress {
            current_step: "Initializing".to_string(),
            progress: 0,
            total_steps: 8,
            current_step_number: 1,
            status_message: "Starting generation process".to_string(),
            has_error: false,
            error_message: None,
            eta_seconds: Some(30),
        },
        started_at: chrono::Utc::now(),
        window_label: Some(window.label().to_string()),
    };

    // Register session
    {
        let mut sessions = enhanced_api_state.active_sessions.lock().await;
        sessions.insert(session_id.clone(), session);
    }

    // Create progress callback
    let session_id_clone = session_id.clone();
    let window_clone = window.clone();
    let sessions_clone = Arc::clone(&enhanced_api_state.active_sessions);
    
    let progress_callback = Box::new(move |progress: GenerationProgress| {
        let session_id = session_id_clone.clone();
        let window = window_clone.clone();
        let sessions = Arc::clone(&sessions_clone);
        
        tokio::spawn(async move {
            // Update session progress
            {
                let mut sessions_guard = sessions.lock().await;
                if let Some(session) = sessions_guard.get_mut(&session_id) {
                    session.progress = progress.clone();
                    session.status = if progress.has_error {
                        GenerationStatus::Failed
                    } else if progress.progress >= 100 {
                        GenerationStatus::Completed
                    } else {
                        GenerationStatus::InProgress
                    };
                }
            }
            
            // Emit progress event to frontend
            if let Err(e) = window.emit("generation_progress", &progress) {
                warn!("Failed to emit progress event: {}", e);
            }
        });
    });

    // Generate configuration
    let service = enhanced_api_state.service.lock().await;
    let result = service
        .generate_enhanced_configuration(request, Some(progress_callback))
        .await;

    // Update session status
    {
        let mut sessions = enhanced_api_state.active_sessions.lock().await;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.status = match &result {
                Ok(_) => GenerationStatus::Completed,
                Err(_) => GenerationStatus::Failed,
            };
        }
    }

    // Emit completion event
    let completion_event = GenerationCompletionEvent {
        session_id: session_id.clone(),
        success: result.is_ok(),
        error_message: result.as_ref().err().map(|e| e.to_string()),
        duration_seconds: chrono::Utc::now()
            .signed_duration_since(chrono::Utc::now())
            .num_seconds() as u32,
    };

    if let Err(e) = window.emit("generation_completed", &completion_event) {
        warn!("Failed to emit completion event: {}", e);
    }

    // Clean up session after a delay
    let sessions_cleanup = Arc::clone(&enhanced_api_state.active_sessions);
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(300)).await; // 5 minutes
        let mut sessions = sessions_cleanup.lock().await;
        sessions.remove(&session_id);
    });

    result.map_err(|e| {
        error!("Enhanced configuration generation failed: {}", e);
        e.to_string()
    })
}

/// Detect project framework with confidence scoring
#[command]
pub async fn detect_project_framework(
    project_path: String,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Vec<FrameworkDetectionResult>, String> {
    info!("Detecting framework in project: {}", project_path);

    let service = enhanced_api_state.service.lock().await;
    service
        .detect_project_framework(&project_path)
        .await
        .map_err(|e| {
            error!("Framework detection failed: {}", e);
            e.to_string()
        })
}

/// Validate template combination for compatibility
#[command]
pub async fn validate_template_combination(
    provider_id: String,
    template_id: Option<String>,
    framework: String,
    features: Vec<String>,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<TemplateValidationResult, String> {
    info!("Validating template combination for provider: {}, framework: {}", provider_id, framework);

    let service = enhanced_api_state.service.lock().await;
    service
        .validate_template_combination(&provider_id, template_id.as_deref(), &framework, &features)
        .await
        .map_err(|e| {
            error!("Template validation failed: {}", e);
            e.to_string()
        })
}

/// Preview generated files without creating them
#[command]
pub async fn preview_generated_files(
    request: EnhancedGenerationRequest,
    window: Window,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<EnhancedGenerationResult, String> {
    info!("Generating preview for provider: {}", request.provider_id);

    // Create preview session
    let session_id = Uuid::new_v4().to_string();
    let session = GenerationSession {
        id: session_id.clone(),
        provider_id: request.provider_id.clone(),
        status: GenerationStatus::Starting,
        progress: GenerationProgress {
            current_step: "Initializing preview".to_string(),
            progress: 0,
            total_steps: 6,
            current_step_number: 1,
            status_message: "Starting preview generation".to_string(),
            has_error: false,
            error_message: None,
            eta_seconds: Some(15),
        },
        started_at: chrono::Utc::now(),
        window_label: Some(window.label().to_string()),
    };

    // Register session
    {
        let mut sessions = enhanced_api_state.active_sessions.lock().await;
        sessions.insert(session_id.clone(), session);
    }

    // Create progress callback for preview
    let session_id_clone = session_id.clone();
    let window_clone = window.clone();
    let sessions_clone = Arc::clone(&enhanced_api_state.active_sessions);
    
    let progress_callback = Box::new(move |mut progress: GenerationProgress| {
        // Adjust progress for preview (faster, fewer steps)
        progress.status_message = format!("Preview: {}", progress.status_message);
        progress.total_steps = 6;
        
        let session_id = session_id_clone.clone();
        let window = window_clone.clone();
        let sessions = Arc::clone(&sessions_clone);
        
        tokio::spawn(async move {
            // Update session progress
            {
                let mut sessions_guard = sessions.lock().await;
                if let Some(session) = sessions_guard.get_mut(&session_id) {
                    session.progress = progress.clone();
                    session.status = if progress.has_error {
                        GenerationStatus::Failed
                    } else if progress.progress >= 100 {
                        GenerationStatus::Completed
                    } else {
                        GenerationStatus::InProgress
                    };
                }
            }
            
            // Emit progress event
            if let Err(e) = window.emit("preview_progress", &progress) {
                warn!("Failed to emit preview progress event: {}", e);
            }
        });
    });

    let service = enhanced_api_state.service.lock().await;
    let result = service
        .preview_generated_files(request, Some(progress_callback))
        .await;

    // Update session status
    {
        let mut sessions = enhanced_api_state.active_sessions.lock().await;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.status = match &result {
                Ok(_) => GenerationStatus::Completed,
                Err(_) => GenerationStatus::Failed,
            };
        }
    }

    // Emit preview completion event
    let completion_event = PreviewCompletionEvent {
        session_id: session_id.clone(),
        success: result.is_ok(),
        error_message: result.as_ref().err().map(|e| e.to_string()),
        file_count: result.as_ref().map(|r| r.files.len()).unwrap_or(0),
    };

    if let Err(e) = window.emit("preview_completed", &completion_event) {
        warn!("Failed to emit preview completion event: {}", e);
    }

    result.map_err(|e| {
        error!("Preview generation failed: {}", e);
        e.to_string()
    })
}

/// Get template suggestions based on environment variables
#[command]
pub async fn get_template_suggestions(
    env_vars: HashMap<String, String>,
    project_path: Option<String>,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Vec<TemplateSuggestion>, String> {
    info!("Getting template suggestions for {} environment variables", env_vars.len());

    let service = enhanced_api_state.service.lock().await;
    service
        .get_template_suggestions(&env_vars, project_path.as_deref())
        .await
        .map_err(|e| {
            error!("Template suggestions failed: {}", e);
            e.to_string()
        })
}

/// Register a custom template
#[command]
pub async fn register_custom_template(
    template: EnhancedConfigTemplate,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<(), String> {
    info!("Registering custom template: {}", template.id);

    let service = enhanced_api_state.service.lock().await;
    service
        .register_custom_template(template)
        .await
        .map_err(|e| {
            error!("Custom template registration failed: {}", e);
            e.to_string()
        })
}

/// Get generation session status
#[command]
pub async fn get_generation_session_status(
    session_id: String,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Option<GenerationSessionStatus>, String> {
    debug!("Getting status for session: {}", session_id);

    let sessions = enhanced_api_state.active_sessions.lock().await;
    if let Some(session) = sessions.get(&session_id) {
        Ok(Some(GenerationSessionStatus {
            id: session.id.clone(),
            provider_id: session.provider_id.clone(),
            status: session.status.clone(),
            progress: session.progress.clone(),
            started_at: session.started_at.to_rfc3339(),
            duration_seconds: chrono::Utc::now()
                .signed_duration_since(session.started_at)
                .num_seconds() as u32,
        }))
    } else {
        Ok(None)
    }
}

/// Cancel an active generation session
#[command]
pub async fn cancel_generation_session(
    session_id: String,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<bool, String> {
    info!("Cancelling generation session: {}", session_id);

    let mut sessions = enhanced_api_state.active_sessions.lock().await;
    if let Some(session) = sessions.get_mut(&session_id) {
        session.status = GenerationStatus::Cancelled;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get all active generation sessions
#[command]
pub async fn get_active_generation_sessions(
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Vec<GenerationSessionStatus>, String> {
    debug!("Getting all active generation sessions");

    let sessions = enhanced_api_state.active_sessions.lock().await;
    let active_sessions: Vec<GenerationSessionStatus> = sessions
        .values()
        .map(|session| GenerationSessionStatus {
            id: session.id.clone(),
            provider_id: session.provider_id.clone(),
            status: session.status.clone(),
            progress: session.progress.clone(),
            started_at: session.started_at.to_rfc3339(),
            duration_seconds: chrono::Utc::now()
                .signed_duration_since(session.started_at)
                .num_seconds() as u32,
        })
        .collect();

    Ok(active_sessions)
}

/// Clear generation cache
#[command]
pub async fn clear_generation_cache(
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<(), String> {
    info!("Clearing generation cache");

    let service = enhanced_api_state.service.lock().await;
    service.clear_cache().await;
    Ok(())
}

/// Get cache statistics
#[command]
pub async fn get_cache_statistics(
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<CacheStats, String> {
    debug!("Getting cache statistics");

    let service = enhanced_api_state.service.lock().await;
    Ok(service.get_cache_stats().await)
}

/// Batch validate multiple template combinations
#[command]
pub async fn batch_validate_templates(
    requests: Vec<TemplateValidationRequest>,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Vec<TemplateValidationResult>, String> {
    info!("Batch validating {} template combinations", requests.len());

    let service = enhanced_api_state.service.lock().await;
    let mut results = Vec::new();

    for request in requests {
        let result = service
            .validate_template_combination(
                &request.provider_id,
                request.template_id.as_deref(),
                &request.framework,
                &request.features,
            )
            .await
            .unwrap_or_else(|e| TemplateValidationResult {
                is_valid: false,
                errors: vec![e.to_string()],
                warnings: vec![],
                suggestions: vec![],
                compatible_frameworks: vec![],
                missing_requirements: vec![],
            });
        
        results.push(result);
    }

    Ok(results)
}

/// Get framework compatibility matrix for a provider
#[command]
pub async fn get_provider_framework_compatibility(
    provider_id: String,
    enhanced_api_state: State<'_, EnhancedApiState>,
) -> Result<Vec<FrameworkCompatibilityInfo>, String> {
    info!("Getting framework compatibility for provider: {}", provider_id);

    // This would typically query the template engine for compatibility information
    // For now, return a basic compatibility matrix
    let frameworks = vec!["nextjs", "react", "vue", "express", "nestjs", "svelte", "angular"];
    let mut compatibility_info = Vec::new();

    for framework in frameworks {
        let compatibility_level = match (provider_id.as_str(), framework) {
            ("better-auth", "nextjs") => "full",
            ("better-auth", "react") => "partial",
            ("openai", _) => "full",
            ("stripe", "nextjs") | ("stripe", "react") => "full",
            ("supabase", _) => "full",
            _ => "minimal",
        };

        compatibility_info.push(FrameworkCompatibilityInfo {
            framework: framework.to_string(),
            compatibility_level: compatibility_level.to_string(),
            confidence: match compatibility_level {
                "full" => 0.9,
                "partial" => 0.7,
                "minimal" => 0.4,
                _ => 0.1,
            },
            supported_features: vec![], // Would be populated from actual templates
            limitations: vec![],
            additional_dependencies: vec![],
        });
    }

    Ok(compatibility_info)
}

// Event types for frontend communication

/// Generation completion event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationCompletionEvent {
    pub session_id: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub duration_seconds: u32,
}

/// Preview completion event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCompletionEvent {
    pub session_id: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub file_count: usize,
}

/// Generation session status for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationSessionStatus {
    pub id: String,
    pub provider_id: String,
    pub status: GenerationStatus,
    pub progress: GenerationProgress,
    pub started_at: String,
    pub duration_seconds: u32,
}

/// Template validation request for batch operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateValidationRequest {
    pub provider_id: String,
    pub template_id: Option<String>,
    pub framework: String,
    pub features: Vec<String>,
}

/// Framework compatibility information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkCompatibilityInfo {
    pub framework: String,
    pub compatibility_level: String,
    pub confidence: f64,
    pub supported_features: Vec<String>,
    pub limitations: Vec<String>,
    pub additional_dependencies: Vec<String>,
}