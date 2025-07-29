use serde::{Deserialize, Serialize};
use serde_json;
use tauri::command;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
// use futures_util::stream::StreamExt; // Removed - not needed

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
    pub stream: Option<bool>,
    pub system_prompt: Option<String>,
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
    pub response_time_ms: Option<u64>,
    pub provider_used: String,
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

/// Internal function for processing LLM requests without Tauri state
pub async fn process_with_llm_internal(
    prompt: String,
    context: Option<serde_json::Value>,
    config: LLMConfig,
    proxy_state: Arc<LLMProxyState>,
) -> Result<LLMResponse, String> {
    // Create a cache key based on the request
    let cache_key = format!(
        "{}:{}:{:?}",
        config.provider, config.model, prompt
    );

    // Check cache first
    if let Some(cached) = proxy_state.get_cached(&cache_key).await {
        return Ok(cached);
    }

    // Process with the appropriate provider
    let result = match config.provider.as_str() {
        "openai" => process_with_openai(&prompt, &config).await,
        "local" | "ollama" => process_with_local_llm(&prompt, &config).await,
        "anthropic" => process_with_anthropic(&prompt, &config).await,
        _ => Err(format!("Unsupported LLM provider: {}. Supported providers: openai, local, ollama, anthropic", config.provider)),
    };

    // Cache successful responses
    if let Ok(response) = &result {
        proxy_state.set_cached(cache_key, response.clone()).await;
    }

    result
}

#[command]
pub async fn process_with_llm(
    prompt: String,
    context: Option<serde_json::Value>,
    config: LLMConfig,
    state: tauri::State<'_, std::sync::Arc<LLMProxyState>>,
) -> Result<LLMResponse, String> {
    process_with_llm_internal(prompt, context, config, state.inner().clone()).await
}

async fn process_with_openai(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    let start_time = std::time::Instant::now();
    let api_key = config.api_key.as_ref()
        .ok_or_else(|| "OpenAI API key not provided".to_string())?;

    let client = reqwest::Client::new();
    
    // Build messages with optional system prompt
    let mut messages = Vec::new();
    if let Some(system) = &config.system_prompt {
        messages.push(serde_json::json!({
            "role": "system",
            "content": system
        }));
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));
    
    // Prepare the request payload
    let mut request_body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens
    });
    
    // Add streaming if requested
    if config.stream.unwrap_or(false) {
        request_body["stream"] = serde_json::Value::Bool(true);
    }

    // Make the API call
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(120))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "OpenAI request timed out".to_string()
            } else {
                format!("Failed to send request to OpenAI: {}", e)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
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
    
    let response_time = start_time.elapsed().as_millis() as u64;
    info!("✅ OpenAI ({}) response: {} chars, {} tokens, {}ms", 
          config.model, content.len(), total_tokens, response_time);

    Ok(LLMResponse {
        content: content.to_string(),
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: total_tokens,
            completion_reason,
            cached: false,
            response_time_ms: Some(response_time),
            provider_used: "openai".to_string(),
        },
        error: None,
    })
}

async fn process_with_local_llm(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    // Try Ollama API first (local server on port 11434)
    if let Ok(ollama_response) = process_with_ollama(prompt, config).await {
        return Ok(ollama_response);
    }

    // Fall back to local GGUF model loading
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

    // Try to validate model file, but don't fail if it doesn't exist
    let model_exists = engine.validate_model_file().is_ok();
    if !model_exists {
        warn!("Model file not found, will use fallback response");
    }

    // Try to load the model, but don't fail if it doesn't work
    if model_exists {
        if let Err(e) = engine.load_model().await {
            warn!("Failed to load model: {}, using fallback", e);
        }
    }

    // Generate text (this will now return a fallback response if model unavailable)
    let start_time = std::time::Instant::now();
    let content = engine.generate_text(prompt).await
        .unwrap_or_else(|e| {
            warn!("Text generation failed: {}, using basic fallback", e);
            format!("Local Qwen model response for: '{}'\n\nNote: This is a fallback response as the local model is not fully configured.", prompt)
        });
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
            response_time_ms: Some(generation_time.as_millis() as u64),
            provider_used: "local".to_string(),
        },
        error: None,
    })
}

pub async fn process_with_ollama(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    let start_time = std::time::Instant::now();
    let client = reqwest::Client::new();
    
    // Check if Ollama is running first
    match check_ollama_health(&client).await {
        Ok(false) => {
            return Err("Ollama server is not running. Please start Ollama with 'ollama serve'".to_string());
        },
        Err(e) => {
            return Err(format!("Failed to connect to Ollama: {}", e));
        },
        Ok(true) => debug!("Ollama server is running"),
    }
    
    // Check if model is available
    if let Err(e) = ensure_ollama_model_available(&client, &config.model).await {
        return Err(format!("Model '{}' not available: {}", config.model, e));
    }
    
    // Build messages format for chat models
    let messages = if let Some(system) = &config.system_prompt {
        vec![
            serde_json::json!({"role": "system", "content": system}),
            serde_json::json!({"role": "user", "content": prompt})
        ]
    } else {
        vec![serde_json::json!({"role": "user", "content": prompt})]
    };
    
    // Use chat format for better conversation support
    let request_body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": config.stream.unwrap_or(false),
        "options": {
            "temperature": config.temperature,
            "num_predict": config.max_tokens,
            "num_ctx": 4096, // Context window
            "repeat_penalty": 1.1,
            "top_k": 40,
            "top_p": 0.9
        }
    });

    // Make the API call to Ollama
    let response = client
        .post("http://localhost:11434/api/chat")
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(120)) // 2 minute timeout
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Ollama request timed out. The model might be too large or the server is overloaded.".to_string()
            } else {
                format!("Failed to send request to Ollama: {}", e)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }

    // Parse the response
    let response_body: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    // Extract the generated content
    let content = response_body
        .get("message")
        .and_then(|msg| msg.get("content"))
        .and_then(|content| content.as_str())
        .unwrap_or("No content generated")
        .to_string();

    // Extract completion reason
    let done = response_body
        .get("done")
        .and_then(|d| d.as_bool())
        .unwrap_or(false);

    let completion_reason = if done { "stop" } else { "length" }.to_string();

    // Get actual token counts if available
    let prompt_eval_count = response_body
        .get("prompt_eval_count")
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as usize;
    
    let eval_count = response_body
        .get("eval_count")
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as usize;
    
    let total_tokens = if prompt_eval_count > 0 || eval_count > 0 {
        prompt_eval_count + eval_count
    } else {
        // Fallback to estimation
        content.split_whitespace().count() + prompt.split_whitespace().count()
    };
    
    let response_time = start_time.elapsed().as_millis() as u64;
    info!("✅ Ollama ({}) response: {} chars, {} tokens, {}ms", 
          config.model, content.len(), total_tokens, response_time);

    Ok(LLMResponse {
        content,
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: total_tokens,
            completion_reason,
            cached: false,
            response_time_ms: Some(response_time),
            provider_used: "ollama".to_string(),
        },
        error: None,
    })
}

async fn process_with_anthropic(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    let start_time = std::time::Instant::now();
    let api_key = config.api_key.as_ref()
        .ok_or_else(|| "Anthropic API key not provided".to_string())?;

    let client = reqwest::Client::new();
    
    // Build messages with optional system prompt
    let mut messages = Vec::new();
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));
    
    // Prepare the request payload for Claude
    let mut request_body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens
    });
    
    // Add system prompt if provided
    if let Some(system) = &config.system_prompt {
        request_body["system"] = serde_json::Value::String(system.clone());
    }
    
    // Add streaming if requested
    if config.stream.unwrap_or(false) {
        request_body["stream"] = serde_json::Value::Bool(true);
    }

    // Make the API call to Anthropic
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .timeout(std::time::Duration::from_secs(120))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Anthropic request timed out".to_string()
            } else {
                format!("Failed to send request to Anthropic: {}", e)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Anthropic API error ({}): {}", status, error_text));
    }

    // Parse the response
    let response_body: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    // Extract the generated content
    let content = response_body
        .get("content")
        .and_then(|content| content.get(0))
        .and_then(|item| item.get("text"))
        .and_then(|text| text.as_str())
        .unwrap_or("No content generated");

    // Extract usage information
    let usage = response_body.get("usage");
    let total_tokens = usage
        .and_then(|u| u.get("input_tokens"))
        .and_then(|t| t.as_u64())
        .unwrap_or(0) as usize 
        + usage
        .and_then(|u| u.get("output_tokens"))
        .and_then(|t| t.as_u64())
        .unwrap_or(0) as usize;

    let completion_reason = response_body
        .get("stop_reason")
        .and_then(|reason| reason.as_str())
        .unwrap_or("unknown")
        .to_string();
    
    let response_time = start_time.elapsed().as_millis() as u64;
    info!("✅ Anthropic ({}) response: {} chars, {} tokens, {}ms", 
          config.model, content.len(), total_tokens, response_time);

    Ok(LLMResponse {
        content: content.to_string(),
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: total_tokens,
            completion_reason,
            cached: false,
            response_time_ms: Some(response_time),
            provider_used: "anthropic".to_string(),
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

// ===== OLLAMA MANAGEMENT FUNCTIONS =====

/// Check if Ollama server is running and healthy
async fn check_ollama_health(client: &reqwest::Client) -> Result<bool, String> {
    match client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(e) => {
            if e.is_timeout() {
                Err("Ollama server connection timeout".to_string())
            } else if e.is_connect() {
                Err("Cannot connect to Ollama server. Is it running on localhost:11434?".to_string())
            } else {
                Err(format!("Ollama health check failed: {}", e))
            }
        }
    }
}

/// Ensure the specified model is available in Ollama
async fn ensure_ollama_model_available(client: &reqwest::Client, model: &str) -> Result<(), String> {
    let available_models = get_ollama_models_internal(client).await?;
    
    if !available_models.iter().any(|m| m.name == model) {
        // Try to pull the model automatically
        info!("Model '{}' not found locally, attempting to pull...", model);
        pull_ollama_model(client, model).await?;
    }
    
    Ok(())
}

/// Get list of available Ollama models (internal helper)
async fn get_ollama_models_internal(client: &reqwest::Client) -> Result<Vec<OllamaModel>, String> {
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to get Ollama models: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama API error: {}", response.status()));
    }

    let response_body: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Ollama models response: {}", e))?;

    let models = response_body
        .get("models")
        .and_then(|models| models.as_array())
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|model| {
            let name = model.get("name")?.as_str()?.to_string();
            let size = model.get("size")?.as_u64().unwrap_or(0);
            let modified_at = model.get("modified_at")?.as_str()?.to_string();
            
            Some(OllamaModel {
                name,
                size,
                modified_at,
                digest: model.get("digest").and_then(|d| d.as_str()).unwrap_or("").to_string(),
            })
        })
        .collect();

    Ok(models)
}

/// Pull a model from Ollama registry
async fn pull_ollama_model(client: &reqwest::Client, model: &str) -> Result<(), String> {
    let request_body = serde_json::json!({
        "name": model,
        "stream": false
    });

    info!("Pulling Ollama model: {}", model);
    
    let response = client
        .post("http://localhost:11434/api/pull")
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout for model pulling
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to pull model '{}': {}", model, e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to pull model '{}': {}", model, error_text));
    }

    info!("Successfully pulled Ollama model: {}", model);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub modified_at: String,
    pub digest: String,
}

// ===== NEW TAURI COMMANDS FOR LLM MANAGEMENT =====

/// Get list of available Ollama models
#[command]
pub async fn get_ollama_models() -> Result<Vec<OllamaModel>, String> {
    let client = reqwest::Client::new();
    
    // Check if Ollama is running first
    if !check_ollama_health(&client).await.unwrap_or(false) {
        return Err("Ollama server is not running. Please start Ollama with 'ollama serve'".to_string());
    }
    
    get_ollama_models_internal(&client).await
}

/// Pull an Ollama model
#[command]
pub async fn pull_ollama_model_command(model: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // Check if Ollama is running first
    if !check_ollama_health(&client).await.unwrap_or(false) {
        return Err("Ollama server is not running. Please start Ollama with 'ollama serve'".to_string());
    }
    
    pull_ollama_model(&client, &model).await?;
    Ok(format!("Successfully pulled model: {}", model))
}

/// Check Ollama server status
#[command]
pub async fn check_ollama_status() -> Result<OllamaStatus, String> {
    let client = reqwest::Client::new();
    
    let is_running = check_ollama_health(&client).await.unwrap_or(false);
    
    let models = if is_running {
        get_ollama_models_internal(&client).await.unwrap_or_default()
    } else {
        vec![]
    };
    
    Ok(OllamaStatus {
        is_running,
        models,
        server_url: "http://localhost:11434".to_string(),
    })
}

/// Delete an Ollama model
#[command]
pub async fn delete_ollama_model(model: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // Check if Ollama is running first
    if !check_ollama_health(&client).await.unwrap_or(false) {
        return Err("Ollama server is not running. Please start Ollama with 'ollama serve'".to_string());
    }
    
    let request_body = serde_json::json!({
        "name": model
    });

    let response = client
        .delete("http://localhost:11434/api/delete")
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to delete model '{}': {}", model, e))?;

    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to delete model '{}': {}", model, error_text));
    }

    info!("Successfully deleted Ollama model: {}", model);
    Ok(format!("Successfully deleted model: {}", model))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub is_running: bool,
    pub models: Vec<OllamaModel>,
    pub server_url: String,
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
