use serde::{Deserialize, Serialize};
use serde_json;
use tauri::command;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMRequest {
    pub prompt: String,
    pub context: Option<serde_json::Value>,
    pub config: LLMConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMConfig {
    pub provider: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: usize,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMResponse {
    pub content: String,
    pub metadata: LLMMetadata,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMMetadata {
    pub model: String,
    pub tokens: usize,
    pub completion_reason: String,
    pub cached: bool,
}

struct LLMCacheEntry {
    response: LLMResponse,
    expires_at: u64,
}

pub struct LLMProxyState {
    cache: RwLock<HashMap<String, LLMCacheEntry>>,
    cache_duration_seconds: u64,
}

impl Default for LLMProxyState {
    fn default() -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
            cache_duration_seconds: 24 * 60 * 60, // 24 hours
        }
    }
}

impl LLMProxyState {
    pub fn with_cache_duration(duration_seconds: u64) -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
            cache_duration_seconds: duration_seconds,
        }
    }

    async fn get_cached(&self, key: &str) -> Option<LLMResponse> {
        let cache = self.cache.read().await;
        if let Some(entry) = cache.get(key) {
            if entry.expires_at > current_timestamp() {
                return Some(entry.response.clone());
            }
        }
        None
    }

    async fn set_cached(&self, key: String, response: LLMResponse) {
        let mut cache = self.cache.write().await;
        let entry = LLMCacheEntry {
            response,
            expires_at: current_timestamp() + self.cache_duration_seconds,
        };
        cache.insert(key, entry);
    }

    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[command]
pub async fn process_with_llm(
    prompt: String,
    context: Option<serde_json::Value>,
    config: LLMConfig,
    state: tauri::State<'_, std::sync::Arc<LLMProxyState>>,
) -> Result<LLMResponse, String> {
    // Create a cache key based on the request
    let cache_key = format!(
        "{}:{}:{:?}",
        config.provider, config.model, prompt
    );

    // Check cache first
    if let Some(cached) = state.get_cached(&cache_key).await {
        return Ok(cached);
    }

    // Process with the appropriate provider
    let result = match config.provider.as_str() {
        "openai" => process_with_openai(&prompt, &config).await,
        "local" => process_with_local_llm(&prompt, &config).await,
        _ => Err(format!("Unsupported LLM provider: {}", config.provider)),
    };

    // Cache successful responses
    if let Ok(response) = &result {
        state.set_cached(cache_key, response.clone()).await;
    }

    result
}

async fn process_with_openai(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    let api_key = config.api_key.as_ref()
        .ok_or_else(|| "OpenAI API key not provided".to_string())?;

    let client = reqwest::Client::new();
    
    // Prepare the request payload
    let request_body = serde_json::json!({
        "model": config.model,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens
    });

    // Make the API call
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to OpenAI: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }

    // Parse the response
    let response_body: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    // Extract the generated content
    let content = response_body
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .unwrap_or("No content generated");

    // Extract usage information
    let usage = response_body.get("usage");
    let total_tokens = usage
        .and_then(|u| u.get("total_tokens"))
        .and_then(|t| t.as_u64())
        .unwrap_or(0) as usize;

    let completion_reason = response_body
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("finish_reason"))
        .and_then(|reason| reason.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(LLMResponse {
        content: content.to_string(),
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: total_tokens,
            completion_reason,
            cached: false,
        },
        error: None,
    })
}

async fn process_with_local_llm(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    use crate::llm_wrapper::{LLMEngine, LLMConfig as WrapperConfig};
    
    // Convert proxy config to wrapper config
    let wrapper_config = WrapperConfig {
        model_path: config.model.clone(), // In local mode, model field contains the path
        context_size: 2048,
        n_layers: None,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        batch_size: 8,
        use_gpu: false,
    };

    // Create and initialize LLM engine
    let engine = LLMEngine::new(wrapper_config)
        .map_err(|e| format!("Failed to create LLM engine: {}", e))?;

    // Validate model file first
    engine.validate_model_file()
        .map_err(|e| format!("Model validation failed: {}", e))?;

    // Load the model
    engine.load_model().await
        .map_err(|e| format!("Failed to load model: {}", e))?;

    // Generate text
    let start_time = std::time::Instant::now();
    let content = engine.generate_text(prompt).await
        .map_err(|e| format!("Text generation failed: {}", e))?;
    let generation_time = start_time.elapsed();

    // Estimate token count (rough approximation)
    let estimated_tokens = content.split_whitespace().count() + prompt.split_whitespace().count();

    Ok(LLMResponse {
        content,
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: estimated_tokens,
            completion_reason: "stop".to_string(),
            cached: false,
        },
        error: None,
    })
}

#[command]
pub async fn clear_llm_cache(
    state: tauri::State<'_, std::sync::Arc<LLMProxyState>>,
) -> Result<(), String> {
    state.clear_cache().await;
    Ok(())
}

#[command]
pub async fn get_llm_cache_stats(
    state: tauri::State<'_, std::sync::Arc<LLMProxyState>>,
) -> Result<usize, String> {
    let cache = state.cache.read().await;
    Ok(cache.len())
}

#[command]
pub async fn is_llm_engine_loaded(
    app_state: tauri::State<'_, crate::AppState>,
) -> Result<bool, String> {
    let ml_engine_guard = app_state.ml_engine.lock().await;
    Ok(ml_engine_guard.is_some())
}
