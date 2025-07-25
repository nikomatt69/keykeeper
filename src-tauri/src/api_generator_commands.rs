use crate::api_generator::{
    ApiGeneratorService, GenerationRequest, GeneratedConfig, DocScrapingResult, ApiProvider
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, State};
use tokio::sync::Mutex;

/// State for the API Generator Service
pub struct ApiGeneratorState {
    pub service: Arc<Mutex<ApiGeneratorService>>,
}

impl ApiGeneratorState {
    pub fn new() -> Self {
        Self {
            service: Arc::new(Mutex::new(ApiGeneratorService::new())),
        }
    }
}

/// Get all available API providers
#[command]
pub async fn get_api_providers(
    app_state: State<'_, crate::AppState>
) -> Result<Vec<ApiProvider>, String> {
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    let providers = service.get_providers();
    Ok(providers)
}

/// Scrape documentation for an API provider
#[command]
pub async fn scrape_api_documentation(
    providerId: String,
    docsUrl: String,
    app_state: State<'_, crate::AppState>
) -> Result<DocScrapingResult, String> {
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    
    service.scrape_documentation(&providerId, &docsUrl)
        .await
        .map_err(|e| format!("Failed to scrape documentation: {}", e))
}

/// Generate API configuration from a provider and environment variables
#[command]
pub async fn generate_api_configuration(
    request: GenerationRequest,
    app_state: State<'_, crate::AppState>
) -> Result<GeneratedConfig, String> {
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    
    service.generate_configuration(request)
        .await
        .map_err(|e| format!("Failed to generate configuration: {}", e))
}

/// Detect API providers from environment variable name
#[command]
pub async fn detect_provider_from_env(
    env_var_name: String,
    app_state: State<'_, crate::AppState>
) -> Result<Option<DetectionResult>, String> {
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    let providers = service.get_providers();
    
    for provider in providers {
        // Check exact match
        if provider.env_patterns.contains(&env_var_name) {
            return Ok(Some(DetectionResult {
                provider,
                confidence: 0.9,
                matched_patterns: vec![env_var_name.clone()],
                detected_env_vars: vec![env_var_name],
            }));
        }
        
        // Check pattern match
        for pattern in &provider.key_patterns.clone() {
            if env_var_name.contains(pattern) {
                return Ok(Some(DetectionResult {
                    provider,
                    confidence: 0.7,
                    matched_patterns: vec![pattern.clone()],
                    detected_env_vars: vec![env_var_name.clone()],
                }));
            }
        }
    }
    
    Ok(None)
}

/// Generate configuration specifically for Better Auth
#[command]
pub async fn generate_better_auth_config(
    env_vars: std::collections::HashMap<String, String>,
    features: Vec<String>,
    app_state: State<'_, crate::AppState>
) -> Result<GeneratedConfig, String> {
    let request = GenerationRequest {
        provider_id: "better-auth".to_string(),
        env_vars,
        features,
        framework: "nextjs".to_string(),
        output_path: "./".to_string(),
    };
    
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    service.generate_configuration(request)
        .await
        .map_err(|e| format!("Failed to generate Better Auth configuration: {}", e))
}

/// Generate configuration for OpenAI
#[command]
pub async fn generate_openai_config(
    env_vars: std::collections::HashMap<String, String>,
    app_state: State<'_, crate::AppState>
) -> Result<GeneratedConfig, String> {
    let request = GenerationRequest {
        provider_id: "openai".to_string(),
        env_vars,
        features: vec![],
        framework: "nextjs".to_string(),
        output_path: "./".to_string(),
    };
    
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    service.generate_configuration(request)
        .await
        .map_err(|e| format!("Failed to generate OpenAI configuration: {}", e))
}

/// Get provider-specific configuration templates
#[command]
pub async fn get_provider_templates(
    provider_id: String,
    app_state: State<'_, crate::AppState>
) -> Result<Vec<crate::api_generator::ConfigTemplate>, String> {
    let api_generator = app_state.api_generator.lock().await;
    let service = api_generator.service.lock().await;
    let providers = service.get_providers();
    
    if let Some(provider) = providers.iter().find(|p| p.id == provider_id) {
        Ok(provider.config_templates.clone())
    } else {
        Err(format!("Provider {} not found", provider_id))
    }
}

/// Preview generated configuration without creating files
#[command]
pub async fn preview_generated_config(
    request: GenerationRequest,
    app_state: State<'_, crate::AppState>
) -> Result<GeneratedConfig, String> {
    // This is the same as generate_api_configuration for now
    // In the future, we might want different behavior for preview
    generate_api_configuration(request, app_state).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionResult {
    pub provider: ApiProvider,
    pub confidence: f64,
    pub matched_patterns: Vec<String>,
    pub detected_env_vars: Vec<String>,
}