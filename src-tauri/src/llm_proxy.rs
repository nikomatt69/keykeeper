use serde::{Deserialize, Serialize};
use tauri::command;
use std::sync::Mutex;
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
    // TODO: Implement actual OpenAI API call
    // This is a placeholder implementation
    Ok(LLMResponse {
        content: format!("Processed with OpenAI ({}): {}", config.model, prompt),
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: prompt.len() / 4, // Rough estimate
            completion_reason: "length".to_string(),
            cached: false,
        },
        error: None,
    })
}

async fn process_with_local_llm(
    prompt: &str,
    config: &LLMConfig,
) -> Result<LLMResponse, String> {
    
    Ok(LLMResponse {
        content: format!("Processed with local LLM ({}): {}", config.model, prompt),
        metadata: LLMMetadata {
            model: config.model.clone(),
            tokens: prompt.len() / 4, // Rough estimate
            completion_reason: "length".to_string(),
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
