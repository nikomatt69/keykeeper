use crate::ml_engine_simple::{ContextInfo, MLEngine, MLConfig, MLPrediction};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{command, State, AppHandle, Manager};
use tracing::{info, warn, error};

#[derive(Debug, Serialize, Deserialize)]
pub struct MLInitRequest {
    pub config: Option<MLConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MLAnalysisRequest {
    pub context: ContextInfo,
    pub available_keys: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MLUsageRecord {
    pub key_id: String,
    pub context: ContextInfo,
    pub success: bool,
}

/// Initialize ML Engine
#[command]
pub async fn initialize_ml_engine(
    config: Option<MLConfig>,
    app_handle: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    // Use app handle to resolve proper paths if no config provided
    let config = match config {
        Some(cfg) => cfg,
        None => {
            // Create config with proper path resolution
            MLConfig::with_app_handle(&app_handle)
                .map_err(|e| format!("Failed to create ML config with app handle: {}", e))?
        }
    };
    
    // Validate configuration first
    if let Err(e) = config.validate() {
        error!("ML Engine configuration validation failed: {}", e);
        return Err(format!(
            "ML Engine configuration validation failed: {}. This could indicate missing model files or invalid paths. Try running 'diagnose_ml_setup' command for more details.", 
            e
        ));
    }
    
    // Create new ML engine
    let mut ml_engine = MLEngine::new(config.clone())
        .await
        .map_err(|e| {
            error!("Failed to create ML engine: {}", e);
            format!(
                "Failed to create ML engine: {}. Model cache path: {:?}. Check if the directory exists and is writable.", 
                e, config.model_cache_path
            )
        })?;
    
    // Initialize the engine (load models)
    ml_engine
        .initialize()
        .await
        .map_err(|e| {
            error!("Failed to initialize ML engine: {}", e);
            // Provide more specific error messages
            if e.to_string().contains("model validation failed") {
                format!(
                    "Model validation failed: {}. Please check if the model file exists and is valid. Expected model path: {:?}. Run 'diagnose_ml_setup' for detailed diagnostics.", 
                    e, config.model_cache_path
                )
            } else if e.to_string().contains("Failed to load") {
                format!(
                    "Failed to load model: {}. The model might be corrupted or incompatible. Try re-downloading or check the model file integrity.", 
                    e
                )
            } else {
                format!(
                    "Failed to initialize ML engine: {}. This could be due to missing dependencies, insufficient memory, or corrupted model files. Check the logs for more details.", 
                    e
                )
            }
        })?;
    
    // Store in app state
    {
        let mut engine_lock = app_state.ml_engine.lock().await;
        *engine_lock = Some(ml_engine);
    }
    
    info!("✅ ML Engine initialized successfully with model cache path: {:?}", config.model_cache_path);
    Ok("ML Engine initialized successfully".to_string())
}

/// Get ML-powered context analysis and suggestions
#[command]
pub async fn analyze_context_ml(
    app_state: State<'_, AppState>,
    request: MLAnalysisRequest,
) -> Result<MLPrediction, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            engine
                .analyze_context(request.context, request.available_keys)
                .await
                .map_err(|e| format!("ML analysis failed: {}", e))
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Record usage for ML learning
#[command]
pub async fn record_ml_usage(
    app_state: State<'_, AppState>,
    record: MLUsageRecord,
) -> Result<String, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            engine
                .record_usage(record.key_id, record.context, record.success)
                .await
                .map_err(|e| format!("Failed to record usage: {}", e))?;
            Ok("Usage recorded successfully".to_string())
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Get ML usage statistics
#[command]
pub async fn get_ml_stats(app_state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            let stats = engine
                .get_usage_stats()
                .await
                .map_err(|e| format!("Failed to get stats: {}", e))?;
            Ok(serde_json::to_value(stats).unwrap())
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Check if ML engine is initialized and ready
#[command]
pub async fn check_ml_status(app_state: State<'_, AppState>) -> Result<bool, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    Ok(engine_lock.is_some())
}

/// Reinitialize ML Engine with new config
#[command]
pub async fn reinitialize_ml_engine(
    config: Option<MLConfig>,
    app_handle: AppHandle,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    // First, clear existing engine
    {
        let mut engine_lock = app_state.ml_engine.lock().await;
        *engine_lock = None;
    }
    
    // Then initialize new one with proper path resolution
    initialize_ml_engine(config, app_handle, app_state).await
}

/// Get current ML configuration
#[command]
pub async fn get_ml_config(
    app_handle: AppHandle,
    app_state: State<'_, AppState>
) -> Result<MLConfig, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(_engine) => {
            // Return config with proper path resolution
            MLConfig::with_app_handle(&app_handle)
                .map_err(|e| format!("Failed to get ML config: {}", e))
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Smart context detection helper
#[command]
pub async fn detect_context() -> Result<ContextInfo, String> {
    // This would integrate with OS APIs to detect current context
    // For now, return a mock context
    Ok(ContextInfo {
        active_app: Some("VSCode".to_string()),
        file_path: None,
        file_extension: Some("ts".to_string()),
        project_type: Some("node".to_string()),
        language: Some("typescript".to_string()),
        content_snippet: None,
    })
}

/// Generate documentation using LLM engine
#[command]
pub async fn generate_documentation(
    provider: String,
    context: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            engine
                .generate_documentation(&provider, &context)
                .await
                .map_err(|e| format!("Documentation generation failed: {}", e))
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Generate usage examples using LLM engine
#[command]
pub async fn generate_usage_examples(
    provider: String,
    api_key_format: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            engine
                .generate_usage_examples(&provider, &api_key_format)
                .await
                .map_err(|e| format!("Usage examples generation failed: {}", e))
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Generate configuration template using LLM engine
#[command]
pub async fn generate_config_template(
    provider: String,
    environment: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(engine) => {
            engine
                .generate_config_template(&provider, &environment)
                .await
                .map_err(|e| format!("Config template generation failed: {}", e))
        }
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Get configuration recommendations based on context
#[command]
pub async fn get_config_recommendations(
    context: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(_engine) => {
            // For now, return some basic recommendations based on context
            let recommendations = vec![
                "Configure environment variables in .env file".to_string(),
                "Set up proper API key management".to_string(),
                "Enable type-safe configuration validation".to_string(),
                "Configure development and production environments".to_string(),
            ];
            Ok(recommendations)
        },
        None => Err("ML Engine not initialized".to_string()),
    }
}

/// Diagnostic command to check model file paths and availability
#[command]
pub async fn diagnose_ml_setup(
    app_handle: AppHandle,
) -> Result<serde_json::Value, String> {
    use std::collections::HashMap;
    let mut diagnostic = HashMap::new();
    
    // Check if we can resolve resource directory
    match app_handle.path().resource_dir() {
        Ok(resource_path) => {
            diagnostic.insert("resource_dir".to_string(), serde_json::json!({
                "available": true,
                "path": resource_path.to_string_lossy().to_string()
            }));
            
            let models_dir = resource_path.join("models");
            diagnostic.insert("bundled_models_dir".to_string(), serde_json::json!({
                "exists": models_dir.exists(),
                "path": models_dir.to_string_lossy().to_string()
            }));
            
            let model_file = models_dir.join("Qwen3-0.6B.Q2_K.gguf");
            diagnostic.insert("bundled_model_file".to_string(), serde_json::json!({
                "exists": model_file.exists(),
                "path": model_file.to_string_lossy().to_string()
            }));
        },
        Err(e) => {
            diagnostic.insert("resource_dir".to_string(), serde_json::json!({
                "available": false,
                "error": e.to_string()
            }));
        }
    }
    
    // Check app data directory
    match app_handle.path().app_data_dir() {
        Ok(app_data_path) => {
            diagnostic.insert("app_data_dir".to_string(), serde_json::json!({
                "available": true,
                "path": app_data_path.to_string_lossy().to_string()
            }));
        },
        Err(e) => {
            diagnostic.insert("app_data_dir".to_string(), serde_json::json!({
                "available": false,
                "error": e.to_string()
            }));
        }
    }
    
    // Check development paths
    let dev_paths = [
        "ml_models/Qwen3-0.6B.Q2_K.gguf",
        "src-tauri/ml_models/Qwen3-0.6B.Q2_K.gguf", 
        "../src-tauri/ml_models/Qwen3-0.6B.Q2_K.gguf",
        "models/Qwen3-0.6B.Q2_K.gguf",
        "src-tauri/models/Qwen3-0.6B.Q2_K.gguf",
        "../src-tauri/models/Qwen3-0.6B.Q2_K.gguf",
    ];
    
    let mut dev_diagnostics = Vec::new();
    for path_str in &dev_paths {
        let path = std::path::Path::new(path_str);
        dev_diagnostics.push(serde_json::json!({
            "path": path_str,
            "exists": path.exists(),
            "is_file": path.is_file()
        }));
    }
    diagnostic.insert("development_paths".to_string(), serde_json::Value::Array(dev_diagnostics));
    
    // Try to resolve using our config methods
    match MLConfig::with_app_handle(&app_handle) {
        Ok(config) => {
            diagnostic.insert("resolved_config".to_string(), serde_json::json!({
                "success": true,
                "model_cache_path": config.model_cache_path.to_string_lossy().to_string()
            }));
        },
        Err(e) => {
            diagnostic.insert("resolved_config".to_string(), serde_json::json!({
                "success": false,
                "error": e.to_string()
            }));
        }
    }
    
    Ok(serde_json::Value::Object(diagnostic.into_iter().collect()))
}

