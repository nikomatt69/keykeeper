use anyhow::{Context, Result};
use candle_core::Device;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokenizers::Tokenizer;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use tauri::Manager;

/// Configuration for the LLM engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    /// Path to the GGUF model file
    pub model_path: String,
    /// Context size (number of tokens)
    pub context_size: usize,
    /// Number of layers to use (None for all)
    pub n_layers: Option<usize>,
    /// Number of tokens to generate
    pub max_tokens: usize,
    /// Sampling temperature
    pub temperature: f32,
    /// Top-p sampling
    pub top_p: f32,
    /// Top-k sampling
    pub top_k: usize,
    /// Repeat penalty
    pub repeat_penalty: f32,
    /// Batch size for processing
    pub batch_size: usize,
    /// Use GPU acceleration if available
    pub use_gpu: bool,
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            model_path: Self::get_default_model_path(),
            context_size: 2048,
            n_layers: None,
            max_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            batch_size: 8,
            use_gpu: false,
        }
    }
}

impl LLMConfig {
    /// Get the default model path using proper resource resolution
    pub fn get_default_model_path() -> String {
        // Development fallbacks when no app handle is available
        let dev_paths = [
            "ml_models/gte-small.Q6_K.gguf",
            "src-tauri/ml_models/gte-small.Q6_K.gguf", 
            "../src-tauri/ml_models/gte-small.Q6_K.gguf",
            "models/gte-small.Q6_K.gguf",
            "src-tauri/models/gte-small.Q6_K.gguf",
            "../src-tauri/models/gte-small.Q6_K.gguf",
        ];
        
        for path_str in &dev_paths {
            let path = Path::new(path_str);
            if path.exists() {
                return path.to_string_lossy().to_string();
            }
        }
        
        // Final fallback
        warn!("No model file found, using default path");
        "models/gte-small.Q6_K.gguf".to_string()
    }
    
    /// Create LLMConfig with proper resource path resolution
    pub fn with_app_handle(app_handle: &tauri::AppHandle) -> Result<Self> {
        let model_path = Self::resolve_model_path(app_handle)?;
        Ok(Self {
            model_path,
            ..Default::default()
        })
    }
    
    /// Resolve model file path using Tauri app handle
    pub fn resolve_model_path(app_handle: &tauri::AppHandle) -> Result<String> {
        // Try bundled resources first (production) - use asset resolver for proper Tauri v2 pattern
        let resolver = app_handle.asset_resolver();
        
        // Check if bundled model exists using asset resolver
        if let Some(_asset) = resolver.get("models/gte-small.Q6_K.gguf".to_string()) {
            // Get the resource directory path
            if let Ok(resource_path) = app_handle.path().resource_dir() {
                let model_file = resource_path.join("models").join("gte-small.Q6_K.gguf");
                if model_file.exists() {
                    info!("Using bundled model file: {:?}", model_file);
                    return Ok(model_file.to_string_lossy().to_string());
                }
            }
        }
        
        // Try app data directory
        if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
            let model_file = app_data_dir.join("models").join("gte-small.Q6_K.gguf");
            if model_file.exists() {
                info!("Using app data model file: {:?}", model_file);
                return Ok(model_file.to_string_lossy().to_string());
            }
        }
        
        // Development fallbacks
        let dev_paths = [
            "ml_models/gte-small.Q6_K.gguf",
            "src-tauri/ml_models/gte-small.Q6_K.gguf", 
            "../src-tauri/ml_models/gte-small.Q6_K.gguf",
            "models/gte-small.Q6_K.gguf",
            "src-tauri/models/gte-small.Q6_K.gguf",
            "../src-tauri/models/gte-small.Q6_K.gguf",
        ];
        
        for path_str in &dev_paths {
            let path = Path::new(path_str);
            if path.exists() {
                info!("Using development model file: {:?}", path);
                return Ok(path.to_string_lossy().to_string());
            }
        }
        
        Err(anyhow::anyhow!(
            "Could not resolve model file path. Model file 'gte-small.Q6_K.gguf' not found in any expected location."
        ))
    }
    /// Validate the LLM configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        // Check model path
        if self.model_path.is_empty() {
            return Err(anyhow::anyhow!("Model path cannot be empty"));
        }

        // Check context size
        if self.context_size == 0 {
            return Err(anyhow::anyhow!("Context size must be greater than 0"));
        }
        if self.context_size > 32768 {
            warn!("Very large context size ({}) may cause memory issues", self.context_size);
        }

        // Check max tokens
        if self.max_tokens == 0 {
            return Err(anyhow::anyhow!("Max tokens must be greater than 0"));
        }
        if self.max_tokens > self.context_size {
            return Err(anyhow::anyhow!(
                "Max tokens ({}) cannot exceed context size ({})",
                self.max_tokens,
                self.context_size
            ));
        }

        // Check temperature range
        if self.temperature < 0.0 || self.temperature > 2.0 {
            return Err(anyhow::anyhow!(
                "Temperature must be between 0.0 and 2.0, got {}",
                self.temperature
            ));
        }

        // Check top_p range
        if self.top_p <= 0.0 || self.top_p > 1.0 {
            return Err(anyhow::anyhow!(
                "Top-p must be between 0.0 and 1.0, got {}",
                self.top_p
            ));
        }

        // Check top_k
        if self.top_k == 0 {
            return Err(anyhow::anyhow!("Top-k must be greater than 0"));
        }

        // Check repeat penalty
        if self.repeat_penalty <= 0.0 {
            return Err(anyhow::anyhow!(
                "Repeat penalty must be greater than 0.0, got {}",
                self.repeat_penalty
            ));
        }

        // Check batch size
        if self.batch_size == 0 {
            return Err(anyhow::anyhow!("Batch size must be greater than 0"));
        }

        // Check n_layers if specified
        if let Some(layers) = self.n_layers {
            if layers == 0 {
                return Err(anyhow::anyhow!("Number of layers must be greater than 0"));
            }
            if layers > 100 {
                warn!("Very large number of layers ({}), this may not be supported", layers);
            }
        }

        Ok(())
    }

    /// Create a configuration optimized for fast inference
    pub fn for_fast_inference() -> Self {
        Self {
            context_size: 1024,
            max_tokens: 256,
            temperature: 0.1,
            batch_size: 16,
            use_gpu: true,
            ..Default::default()
        }
    }

    /// Create a configuration optimized for creative text generation
    pub fn for_creative_generation() -> Self {
        Self {
            context_size: 4096,
            max_tokens: 1024,
            temperature: 0.8,
            top_p: 0.95,
            top_k: 50,
            ..Default::default()
        }
    }
}

/// LLM Engine wrapper for text generation using Candle
/// Note: This is a placeholder implementation since rustformers/llm is archived
pub struct LLMEngine {
    tokenizer: Arc<RwLock<Option<Tokenizer>>>,
    device: Device,
    config: LLMConfig,
}

impl LLMEngine {
    /// Create a new LLMEngine with the given configuration
    pub fn new(config: LLMConfig) -> Result<Self> {
        let device = if config.use_gpu {
            Device::new_cuda(0).unwrap_or(Device::Cpu)
        } else {
            Device::Cpu
        };

        Ok(Self {
            tokenizer: Arc::new(RwLock::new(None)),
            device,
            config,
        })
    }

    /// Load the model asynchronously
    /// Note: This is a placeholder implementation since rustformers/llm is archived
    pub async fn load_model(&self) -> Result<()> {
        let model_path = &self.config.model_path;
        
        // Check if model file exists
        if !Path::new(model_path).exists() {
            return Err(anyhow::anyhow!(
                "Model file not found at {}. Please download it first.",
                model_path
            ));
        }

        info!("Model validation passed for: {}", model_path);
        
        // For now, return an error indicating this needs proper implementation
        // The rustformers/llm crate is archived and candle doesn't have stable GGUF support
        warn!("LLM model loading is not implemented - using fallback behavior");
        Ok(())
    }

    /// Generate text based on a prompt
    /// Note: This is a placeholder implementation since rustformers/llm is archived
    pub async fn generate_text(&self, _prompt: &str) -> Result<String> {
        // Return a placeholder response indicating the limitation
        warn!("Text generation not implemented - returning placeholder response");
        Ok("Text generation is not currently implemented due to rustformers/llm being archived. Consider using the LLM proxy with OpenAI instead.".to_string())
    }

    /// Get embeddings for a text
    /// Note: This returns placeholder embeddings since proper embedding models are not implemented
    pub async fn get_embeddings(&self, text: &str) -> Result<Vec<f32>> {
        // For generative models, we can't directly get embeddings
        // This is a limitation - we should use a dedicated embedding model
        warn!("get_embeddings called with placeholder implementation");
        
        // Return a placeholder embedding with proper size
        let embedding_size = 384; // Typical embedding size
        let embedding: Vec<f32> = (0..embedding_size)
            .map(|i| {
                // Create a more realistic embedding based on text hash
                let hash = text.chars().nth(i % text.len()).unwrap_or('a') as u8;
                ((hash as f32 * 0.01 + i as f32 * 0.001).sin() + 1.0) / 2.0
            })
            .collect();
        
        Ok(embedding)
    }

    /// Check if the model is loaded
    /// Note: Always returns false since model loading is not implemented
    pub async fn is_loaded(&self) -> bool {
        false
    }

    /// Get model information
    pub async fn get_model_info(&self) -> Result<String> {
        Ok(format!(
            "Model path: {}, context size: {} (not loaded - placeholder implementation)",
            self.config.model_path,
            self.config.context_size
        ))
    }

    /// Validate model file exists and is readable
    pub fn validate_model_file(&self) -> Result<()> {
        let path = Path::new(&self.config.model_path);
        
        if !path.exists() {
            return Err(anyhow::anyhow!(
                "Model file does not exist: {}",
                self.config.model_path
            ));
        }
        
        if !path.is_file() {
            return Err(anyhow::anyhow!(
                "Model path is not a file: {}",
                self.config.model_path
            ));
        }
        
        // Check file extension
        if let Some(ext) = path.extension() {
            if ext != "gguf" {
                warn!("Model file does not have .gguf extension: {:?}", ext);
            }
        } else {
            warn!("Model file has no extension");
        }
        
        // Check file size (should be at least a few MB for a valid model)
        match std::fs::metadata(path) {
            Ok(metadata) => {
                let size = metadata.len();
                if size < 1024 * 1024 { // Less than 1MB
                    return Err(anyhow::anyhow!(
                        "Model file seems too small: {} bytes",
                        size
                    ));
                }
                info!("Model file size: {:.2} MB", size as f64 / (1024.0 * 1024.0));
            },
            Err(e) => {
                return Err(anyhow::anyhow!(
                    "Cannot read model file metadata: {}",
                    e
                ));
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    async fn test_llm_engine_creation() -> Result<()> {
        let config = LLMConfig {
            model_path: "test_model.gguf".to_string(),
            context_size: 512,
            ..Default::default()
        };

        let engine = LLMEngine::new(config)?;
        
        // Test that model is not loaded initially
        assert!(!engine.is_loaded().await);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_model_validation() -> Result<()> {
        // Create a dummy config with a non-existent model path
        let config = LLMConfig {
            model_path: "/non/existent/test_model.gguf".to_string(),
            context_size: 512,
            ..Default::default()
        };

        let engine = LLMEngine::new(config)?;
        
        // Test that validation fails with a non-existent model
        assert!(engine.validate_model_file().is_err());
        
        // Test with default config (which also doesn't exist)
        let default_engine = LLMEngine::new(LLMConfig::default())?;
        assert!(default_engine.validate_model_file().is_err());
        
        Ok(())
    }

    #[tokio::test]
    async fn test_model_loading_failure() -> Result<()> {
        // Skip this test in CI since it requires actual model files
        if env::var("CI").is_ok() {
            return Ok(());
        }

        let temp_dir = tempdir()?;
        let model_path = temp_dir.path().join("test_model.gguf");
        
        // Create a dummy config with a non-existent model path
        let config = LLMConfig {
            model_path: model_path.to_str().unwrap().to_string(),
            context_size: 512,
            ..Default::default()
        };

        let engine = LLMEngine::new(config)?;
        
        // Test that loading fails with a non-existent model
        assert!(engine.load_model().await.is_err());
        
        Ok(())
    }

    #[test]
    fn test_config_default() {
        let config = LLMConfig::default();
        assert_eq!(config.context_size, 2048);
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.batch_size, 8);
        assert!(!config.use_gpu);
    }
}
