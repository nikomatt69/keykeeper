use crate::ml_engine_simple::{ContextInfo, MLEngine, MLConfig, MLPrediction};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{command, State};
use tokio::sync::Mutex;
use std::sync::Arc;

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
    app_state: State<'_, AppState>,
    request: MLInitRequest,
) -> Result<String, String> {
    let config = request.config.unwrap_or_default();
    
    // Create new ML engine
    let mut ml_engine = MLEngine::new(config)
        .await
        .map_err(|e| format!("Failed to create ML engine: {}", e))?;
    
    // Initialize the engine (load models)
    ml_engine
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize ML engine: {}", e))?;
    
    // Store in app state
    {
        let mut engine_lock = app_state.ml_engine.lock().await;
        *engine_lock = Some(ml_engine);
    }
    
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
    app_state: State<'_, AppState>,
    request: MLInitRequest,
) -> Result<String, String> {
    // First, clear existing engine
    {
        let mut engine_lock = app_state.ml_engine.lock().await;
        *engine_lock = None;
    }
    
    // Then initialize new one
    initialize_ml_engine(app_state, request).await
}

/// Get current ML configuration
#[command]
pub async fn get_ml_config(app_state: State<'_, AppState>) -> Result<MLConfig, String> {
    let engine_lock = app_state.ml_engine.lock().await;
    
    match engine_lock.as_ref() {
        Some(_engine) => {
            // For now return default config - in production would store actual config
            Ok(MLConfig::default())
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

