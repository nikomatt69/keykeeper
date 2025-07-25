use anyhow::{Context, Result};
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use hf_hub::api::tokio::Api;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokenizers::Tokenizer;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use tauri::Manager;

/// Configuration for ML models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLConfig {
    pub model_cache_path: PathBuf,
    pub embedding_model: String,
    pub max_sequence_length: usize,
    pub batch_size: usize,
    // LLM.rs integration options
    pub use_llm_backend: bool,
    pub llm_model_path: Option<String>,
    pub llm_config: Option<crate::llm_wrapper::LLMConfig>,
}

impl Default for MLConfig {
    fn default() -> Self {
        Self {
            model_cache_path: Self::get_default_model_path(),
            embedding_model: "sentence-transformers/all-MiniLM-L6-v2".to_string(),
            max_sequence_length: 256,
            batch_size: 32,
            use_llm_backend: false,
            llm_model_path: None,
            llm_config: None,
        }
    }
}

impl MLConfig {
    /// Get the default model path using Tauri's resource directory
    pub fn get_default_model_path() -> PathBuf {
        // Development fallbacks when no app handle is available
        let dev_paths = [
            "ml_models",
            "src-tauri/ml_models", 
            "../src-tauri/ml_models",
            "./ml_models",
            "models",
            "src-tauri/models",
            "../src-tauri/models",
        ];
        
        for path_str in &dev_paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                return path;
            }
        }
        
        // Final fallback - create in app data directory
        warn!("No existing model directory found, using fallback path");
        PathBuf::from("ml_models")
    }
    
    /// Create MLConfig with proper resource path resolution
    pub fn with_app_handle(app_handle: &tauri::AppHandle) -> Result<Self> {
        let model_path = Self::resolve_model_path(app_handle)?;
        Ok(Self {
            model_cache_path: model_path,
            ..Default::default()
        })
    }
    
    /// Resolve model path using Tauri app handle for resource resolution
    pub fn resolve_model_path(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
        // Try bundled resources first (production) - use asset resolver for proper Tauri v2 pattern
        let resolver = app_handle.asset_resolver();
        
        // Check if bundled model exists using asset resolver
        if let Some(_asset) = resolver.get("models/gte-small.Q6_K.gguf".to_string()) {
            // Get the resource directory path
            if let Ok(resource_path) = app_handle.path().resource_dir() {
                let models_path = resource_path.join("models");
                if models_path.exists() {
                    info!("Using bundled models directory: {:?}", models_path);
                    return Ok(models_path);
                }
            }
        }
        
        // Try app data directory
        if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
            let models_path = app_data_dir.join("models");
            // Create directory if it doesn't exist
            if let Err(e) = std::fs::create_dir_all(&models_path) {
                warn!("Failed to create app data models directory: {}", e);
            } else {
                info!("Using app data models directory: {:?}", models_path);
                return Ok(models_path);
            }
        }
        
        // Development fallbacks
        let dev_paths = [
            "ml_models",
            "src-tauri/ml_models", 
            "../src-tauri/ml_models",
            "models",
            "src-tauri/models",
            "../src-tauri/models",
        ];
        
        for path_str in &dev_paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                info!("Using development models directory: {:?}", path);
                return Ok(path);
            }
        }
        
        Err(anyhow::anyhow!(
            "Could not resolve models directory path. This may indicate:\n\
            1. Missing bundled resources in production build\n\
            2. No writable app data directory\n\
            3. Missing development model files\n\
            \n\
            Expected locations:\n\
            - Bundled: [app]/resources/models/\n\
            - App data: [app_data]/models/\n\
            - Development: ./ml_models/, ./models/, etc.\n\
            \n\
            Please ensure the model files are properly bundled or available in development."
        ))
    }
    /// Validate the ML configuration
    pub fn validate(&self) -> Result<()> {
        // Check batch size is reasonable
        if self.batch_size == 0 {
            return Err(anyhow::anyhow!("Batch size must be greater than 0"));
        }
        if self.batch_size > 256 {
            warn!("Large batch size ({}) may cause memory issues", self.batch_size);
        }

        // Check sequence length is reasonable
        if self.max_sequence_length == 0 {
            return Err(anyhow::anyhow!("Max sequence length must be greater than 0"));
        }
        if self.max_sequence_length > 8192 {
            warn!("Very large sequence length ({}) may cause performance issues", self.max_sequence_length);
        }

        // Validate LLM configuration if using LLM backend
        if self.use_llm_backend {
            if let Some(llm_config) = &self.llm_config {
                llm_config.validate()?;
            } else {
                return Err(anyhow::anyhow!(
                    "LLM backend enabled but no LLM configuration provided"
                ));
            }

            if let Some(model_path) = &self.llm_model_path {
                let path = std::path::Path::new(model_path);
                if !path.exists() {
                    warn!("LLM model path does not exist: {}", model_path);
                }
            }
        }

        // Check embedding model name is reasonable
        if self.embedding_model.is_empty() {
            return Err(anyhow::anyhow!("Embedding model name cannot be empty"));
        }

        // Create model cache directory if it doesn't exist
        if !self.model_cache_path.exists() {
            std::fs::create_dir_all(&self.model_cache_path)
                .context("Failed to create model cache directory")?;
        }

        Ok(())
    }

    /// Get recommended configuration for different use cases
    pub fn for_lightweight_usage() -> Self {
        Self {
            batch_size: 16,
            max_sequence_length: 128,
            use_llm_backend: false,
            ..Default::default()
        }
    }

    pub fn for_full_llm_usage(model_path: String) -> Self {
        Self {
            use_llm_backend: true,
            llm_model_path: Some(model_path.clone()),
            llm_config: Some(crate::llm_wrapper::LLMConfig {
                model_path,
                context_size: 4096,
                ..Default::default()
            }),
            ..Default::default()
        }
    }
    
    /// Create config for full LLM usage with proper path resolution
    pub fn for_full_llm_usage_with_app(app_handle: &tauri::AppHandle) -> Result<Self> {
        let resolver = app_handle.asset_resolver();
        
        // First check if bundled resource exists
        if let Some(_asset) = resolver.get("models/gte-small.Q6_K.gguf".to_string()) {
            let models_path = Self::resolve_model_path(app_handle)?;
            let model_file = models_path.join("gte-small.Q6_K.gguf");
            
            if model_file.exists() {
                let model_path_str = model_file.to_string_lossy().to_string();
                return Ok(Self {
                    model_cache_path: models_path,
                    use_llm_backend: true,
                    llm_model_path: Some(model_path_str.clone()),
                    llm_config: Some(crate::llm_wrapper::LLMConfig {
                        model_path: model_path_str,
                        context_size: 4096,
                        ..Default::default()
                    }),
                    ..Default::default()
                });
            }
        }
        
        // Fallback to regular path resolution
        let models_path = Self::resolve_model_path(app_handle)?;
        let model_file = models_path.join("gte-small.Q6_K.gguf");
        
        if !model_file.exists() {
            return Err(anyhow::anyhow!(
                "Model file not found at {:?}. Please ensure the model is properly bundled or available in development.", 
                model_file
            ));
        }
        
        let model_path_str = model_file.to_string_lossy().to_string();
        Ok(Self {
            model_cache_path: models_path,
            use_llm_backend: true,
            llm_model_path: Some(model_path_str.clone()),
            llm_config: Some(crate::llm_wrapper::LLMConfig {
                model_path: model_path_str,
                context_size: 4096,
                ..Default::default()
            }),
            ..Default::default()
        })
    }
}

/// Context information for ML analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub active_app: Option<String>,
    pub file_path: Option<String>,
    pub file_extension: Option<String>,
    pub project_type: Option<String>,
    pub language: Option<String>,
    pub content_snippet: Option<String>,
}

/// ML prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLPrediction {
    pub api_key_suggestions: Vec<KeySuggestion>,
    pub context_confidence: f32,
    pub usage_prediction: UsagePrediction,
    pub security_score: SecurityScore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeySuggestion {
    pub key_id: String,
    pub confidence: f32,
    pub reason: String,
    pub suggested_format: KeyFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyFormat {
    Plain,
    EnvironmentVariable,
    ProcessEnv,
    ConfigFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsagePrediction {
    pub frequency_score: f32,
    pub recency_score: f32,
    pub context_match_score: f32,
    pub predicted_next_usage: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScore {
    pub risk_level: RiskLevel,
    pub confidence: f32,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Local ML Engine for KeyKeeper
pub struct MLEngine {
    config: MLConfig,
    device: Device,
    embedding_model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
    usage_patterns: Arc<RwLock<HashMap<String, Vec<UsagePattern>>>>,
    context_embeddings: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    // LLM.rs integration
    llm_engine: Option<crate::llm_wrapper::LLMEngine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UsagePattern {
    key_id: String,
    context: ContextInfo,
    timestamp: chrono::DateTime<chrono::Utc>,
    success: bool,
}

impl MLEngine {
    /// Create new ML Engine instance
    pub async fn new(config: MLConfig) -> Result<Self> {
        info!("Initializing ML Engine with config: {:?}", config);
        
        // Validate configuration first
        config.validate()
            .context("ML Engine configuration validation failed")?;
        
        let device = Device::Cpu;
        
        // Create cache directory if it doesn't exist (already done in validation, but double-check)
        tokio::fs::create_dir_all(&config.model_cache_path)
            .await
            .context("Failed to create model cache directory")?;

        Ok(Self {
            config,
            device,
            embedding_model: None,
            tokenizer: None,
            usage_patterns: Arc::new(RwLock::new(HashMap::new())),
            context_embeddings: Arc::new(RwLock::new(HashMap::new())),
            llm_engine: None,
        })
    }

    /// Initialize and load ML models
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Loading embedding model: {}", self.config.embedding_model);
        
        // Download and load the embedding model
        self.load_embedding_model().await?;
        
        // Initialize LLM engine if configured
        if self.config.use_llm_backend {
            if let Some(llm_config) = &self.config.llm_config {
                info!("Initializing LLM engine with config: {:?}", llm_config);
                match self.initialize_llm_engine(llm_config.clone()).await {
                    Ok(llm_engine) => {
                        self.llm_engine = Some(llm_engine);
                        info!("✅ LLM engine initialized successfully");
                    },
                    Err(e) => {
                        warn!("❌ Failed to initialize LLM engine: {}", e);
                        warn!("Continuing with embedding-only mode");
                        // Don't fail initialization if LLM fails - fall back to embedding mode
                    }
                }
            } else {
                warn!("LLM backend requested but no LLM config provided");
            }
        }
        
        info!("ML Engine initialized successfully");
        Ok(())
    }

    /// Initialize LLM engine with error handling
    async fn initialize_llm_engine(&self, llm_config: crate::llm_wrapper::LLMConfig) -> Result<crate::llm_wrapper::LLMEngine> {
        // Validate model file first
        let engine = crate::llm_wrapper::LLMEngine::new(llm_config)?;
        
        // Check if model file exists before attempting to load
        if let Err(e) = engine.validate_model_file() {
            return Err(anyhow::anyhow!("LLM model validation failed: {}", e));
        }
        
        // Attempt to load the model
        engine.load_model().await
            .context("Failed to load LLM model")?;
        
        // Verify the model is actually loaded
        if !engine.is_loaded().await {
            return Err(anyhow::anyhow!("LLM model failed to load properly"));
        }
        
        Ok(engine)
    }

    /// Load embedding model from HuggingFace Hub
    async fn load_embedding_model(&mut self) -> Result<()> {
        let api = Api::new()?;
        let repo = api.model(self.config.embedding_model.clone());
        
        // Download tokenizer
        let tokenizer_path = repo.get("tokenizer.json").await?;
        let tokenizer = Tokenizer::from_file(tokenizer_path)
            .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;
        
        // Download model config
        let config_path = repo.get("config.json").await?;
        let config_content = tokio::fs::read_to_string(config_path).await?;
        let config: Config = serde_json::from_str(&config_content)?;
        
        // Download model weights
        let weights_path = repo.get("model.safetensors").await?;
        let vb = unsafe { VarBuilder::from_mmaped_safetensors(&[weights_path], candle_core::DType::F32, &self.device)? };
        
        // Initialize model
        let model = BertModel::load(vb, &config)?;
        
        self.embedding_model = Some(model);
        self.tokenizer = Some(tokenizer);
        
        info!("Embedding model loaded successfully");
        Ok(())
    }

    /// Analyze context and provide ML-powered suggestions
    pub async fn analyze_context(&self, context: ContextInfo, available_keys: Vec<String>) -> Result<MLPrediction> {
        debug!("Analyzing context: {:?}", context);
        
        // Generate embeddings for current context
        let context_embedding = self.generate_context_embedding(&context).await?;
        
        // Get usage patterns for available keys
        let usage_patterns = self.usage_patterns.read().await;
        
        // Calculate suggestions based on similarity and usage patterns
        let mut suggestions = Vec::new();
        
        for key_id in available_keys {
            let confidence = self.calculate_key_confidence(&key_id, &context_embedding, &usage_patterns).await?;
            
            if confidence > 0.1 { // Only include suggestions with reasonable confidence
                suggestions.push(KeySuggestion {
                    key_id: key_id.clone(),
                    confidence,
                    reason: self.generate_suggestion_reason(&context, confidence),
                    suggested_format: self.determine_key_format(&context),
                });
            }
        }
        
        // Sort by confidence
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        
        // Calculate context confidence
        let context_confidence = self.calculate_context_confidence(&context);
        
        // Generate usage prediction
        let usage_prediction = self.predict_usage_patterns(&context, &usage_patterns).await;
        
        // Calculate security score
        let security_score = self.calculate_security_score(&context);
        
        Ok(MLPrediction {
            api_key_suggestions: suggestions,
            context_confidence,
            usage_prediction,
            security_score,
        })
    }

    /// Generate embedding for context
    async fn generate_context_embedding(&self, context: &ContextInfo) -> Result<Vec<f32>> {
        let model = self.embedding_model.as_ref()
            .context("Embedding model not loaded")?;
        let tokenizer = self.tokenizer.as_ref()
            .context("Tokenizer not loaded")?;

        // Create context string from available information
        let context_text = self.context_to_text(context);
        
        // Tokenize
        let encoding = tokenizer.encode(context_text, true)
            .map_err(|e| anyhow::anyhow!("Failed to encode context: {}", e))?;
        
        let token_ids = encoding.get_ids();
        let token_type_ids = vec![0u32; token_ids.len()];
        
        // Convert to tensors
        let token_ids = Tensor::new(token_ids, &self.device)?
            .unsqueeze(0)?; // Add batch dimension
        let token_type_ids = Tensor::new(token_type_ids.as_slice(), &self.device)?
            .unsqueeze(0)?;
        
        // Generate embeddings
        let output = model.forward(&token_ids, &token_type_ids, None)?;
        
        // Pool embeddings (mean pooling)
        let embeddings = output.mean(1)?;
        let embeddings: Vec<f32> = embeddings.to_vec1()?;
        
        Ok(embeddings)
    }

    /// Convert context info to text for embedding
    fn context_to_text(&self, context: &ContextInfo) -> String {
        let mut parts = Vec::new();
        
        if let Some(app) = &context.active_app {
            parts.push(format!("app: {}", app));
        }
        
        if let Some(ext) = &context.file_extension {
            parts.push(format!("file extension: {}", ext));
        }
        
        if let Some(project_type) = &context.project_type {
            parts.push(format!("project type: {}", project_type));
        }
        
        if let Some(language) = &context.language {
            parts.push(format!("language: {}", language));
        }
        
        parts.join(", ")
    }

    /// Calculate confidence score for a specific key
    async fn calculate_key_confidence(
        &self, 
        key_id: &str, 
        context_embedding: &[f32], 
        usage_patterns: &HashMap<String, Vec<UsagePattern>>
    ) -> Result<f32> {
        // Base confidence from usage frequency
        let usage_score = if let Some(patterns) = usage_patterns.get(key_id) {
            (patterns.len() as f32).ln() / 10.0 // Log scale, max ~0.5
        } else {
            0.0
        };
        
        // Context similarity score (simplified - in production would use stored embeddings)
        let context_score = 0.5; // Placeholder - would calculate actual similarity
        
        // Recency score
        let recency_score = if let Some(patterns) = usage_patterns.get(key_id) {
            if let Some(latest) = patterns.iter().max_by_key(|p| p.timestamp) {
                let hours_ago = (chrono::Utc::now() - latest.timestamp).num_hours() as f32;
                (-hours_ago / 168.0).exp() // Decay over a week
            } else {
                0.0
            }
        } else {
            0.0
        };
        
        // Combine scores
        let confidence = (usage_score + context_score + recency_score) / 3.0;
        Ok(confidence.min(1.0))
    }

    /// Generate human-readable reason for suggestion
    fn generate_suggestion_reason(&self, context: &ContextInfo, confidence: f32) -> String {
        match confidence {
            c if c > 0.8 => "Frequently used in similar contexts".to_string(),
            c if c > 0.6 => "Recently used in this project".to_string(),
            c if c > 0.4 => "Matches current environment type".to_string(),
            _ => "Available for this context".to_string(),
        }
    }

    /// Determine appropriate key format based on context
    fn determine_key_format(&self, context: &ContextInfo) -> KeyFormat {
        match context.file_extension.as_deref() {
            Some("env") => KeyFormat::EnvironmentVariable,
            Some("js") | Some("ts") => KeyFormat::ProcessEnv,
            Some("json") | Some("yaml") | Some("yml") => KeyFormat::ConfigFile,
            _ => KeyFormat::Plain,
        }
    }

    /// Calculate confidence in context analysis
    fn calculate_context_confidence(&self, context: &ContextInfo) -> f32 {
        let mut score = 0.0;
        let mut factors = 0;
        
        if context.active_app.is_some() {
            score += 0.3;
            factors += 1;
        }
        
        if context.file_extension.is_some() {
            score += 0.4;
            factors += 1;
        }
        
        if context.project_type.is_some() {
            score += 0.3;
            factors += 1;
        }
        
        if factors > 0 {
            score / factors as f32
        } else {
            0.0
        }
    }

    /// Predict usage patterns
    async fn predict_usage_patterns(
        &self, 
        context: &ContextInfo, 
        usage_patterns: &HashMap<String, Vec<UsagePattern>>
    ) -> UsagePrediction {
        // Simplified prediction logic
        UsagePrediction {
            frequency_score: 0.5,
            recency_score: 0.5,
            context_match_score: 0.5,
            predicted_next_usage: Some(chrono::Utc::now() + chrono::Duration::hours(1)),
        }
    }

    /// Calculate security score for context
    fn calculate_security_score(&self, context: &ContextInfo) -> SecurityScore {
        let mut risk_factors = Vec::new();
        let mut risk_score = 0.0;
        
        // Check for potentially risky contexts
        if let Some(app) = &context.active_app {
            if app.contains("browser") || app.contains("chrome") || app.contains("firefox") {
                risk_score += 0.3;
                risk_factors.push("Web browser context detected".to_string());
            }
        }
        
        if let Some(path) = &context.file_path {
            if path.contains("/tmp") || path.contains("temp") {
                risk_score += 0.4;
                risk_factors.push("Temporary file location".to_string());
            }
        }
        
        let risk_level = match risk_score {
            s if s > 0.7 => RiskLevel::Critical,
            s if s > 0.5 => RiskLevel::High,
            s if s > 0.3 => RiskLevel::Medium,
            _ => RiskLevel::Low,
        };
        
        SecurityScore {
            risk_level,
            confidence: 0.8,
            reasons: risk_factors,
        }
    }

    /// Record usage pattern for learning
    pub async fn record_usage(&self, key_id: String, context: ContextInfo, success: bool) -> Result<()> {
        let pattern = UsagePattern {
            key_id: key_id.clone(),
            context,
            timestamp: chrono::Utc::now(),
            success,
        };
        
        let key_id_for_lookup = key_id.clone();
        let mut patterns = self.usage_patterns.write().await;
        patterns.entry(key_id).or_insert_with(Vec::new).push(pattern);
        
        // Keep only recent patterns (last 1000 per key)
        if let Some(key_patterns) = patterns.get_mut(&key_id_for_lookup) {
            if key_patterns.len() > 1000 {
                key_patterns.drain(0..(key_patterns.len() - 1000));
            }
        }
        
        Ok(())
    }

    /// Get usage statistics
    pub async fn get_usage_stats(&self) -> Result<HashMap<String, usize>> {
        let patterns = self.usage_patterns.read().await;
        let stats = patterns.iter()
            .map(|(key_id, patterns)| (key_id.clone(), patterns.len()))
            .collect();
        Ok(stats)
    }

    /// Generate documentation for an API provider using LLM
    pub async fn generate_documentation(&self, provider: &str, context: &str) -> Result<String> {
        // Try LLM generation if available
        if let Some(llm_engine) = &self.llm_engine {
            // Check if model is still loaded
            if llm_engine.is_loaded().await {
                let prompt = format!(
                    "Generate comprehensive API documentation for the {} provider. \n\nContext: {}\n\nInclude:\n1. Overview and description\n2. Authentication methods\n3. Common endpoints and usage examples\n4. Configuration examples\n5. Best practices\n\nDocumentation:",
                    provider, context
                );
                
                match llm_engine.generate_text(&prompt).await {
                    Ok(doc) => {
                        info!("✅ Generated documentation for {} using LLM", provider);
                        return Ok(doc);
                    },
                    Err(e) => {
                        warn!("❌ LLM documentation generation failed for {}: {}", provider, e);
                    }
                }
            } else {
                warn!("LLM engine not loaded, cannot generate documentation");
            }
        }
        
        // Fallback to template-based documentation
        warn!("Using template fallback for {} documentation", provider);
        Ok(self.generate_template_documentation(provider))
    }

    /// Generate usage examples for an API key using LLM
    pub async fn generate_usage_examples(&self, provider: &str, api_key_format: &str) -> Result<Vec<String>> {
        // Try LLM generation if available
        if let Some(llm_engine) = &self.llm_engine {
            if llm_engine.is_loaded().await {
                let prompt = format!(
                    "Generate 3 practical code examples for using the {} API with the key format: {}.\n\nProvide examples in different programming languages (Python, JavaScript, curl) showing:\n1. Basic API call\n2. Authentication setup\n3. Error handling\n\nExamples:",
                    provider, api_key_format
                );
                
                match llm_engine.generate_text(&prompt).await {
                    Ok(examples_text) => {
                        info!("✅ Generated usage examples for {} using LLM", provider);
                        // Parse the generated text into individual examples
                        let examples: Vec<String> = examples_text
                            .split("```")
                            .filter(|s| !s.trim().is_empty())
                            .map(|s| s.trim().to_string())
                            .collect();
                        
                        // Ensure we have at least some examples
                        if !examples.is_empty() {
                            return Ok(examples);
                        }
                    }
                    Err(e) => {
                        warn!("❌ LLM example generation failed for {}: {}", provider, e);
                    }
                }
            }
        }
        
        // Fallback to template examples
        warn!("Using template fallback for {} usage examples", provider);
        Ok(self.generate_template_examples(provider))
    }

    /// Generate configuration template using LLM
    pub async fn generate_config_template(&self, provider: &str, environment: &str) -> Result<String> {
        // Try LLM generation if available
        if let Some(llm_engine) = &self.llm_engine {
            if llm_engine.is_loaded().await {
                let prompt = format!(
                    "Generate a configuration template for {} API in {} environment.\n\nInclude:\n1. Environment variables setup\n2. Configuration file examples\n3. Security best practices\n4. Common settings\n\nTemplate:",
                    provider, environment
                );
                
                match llm_engine.generate_text(&prompt).await {
                    Ok(config) => {
                        info!("✅ Generated config template for {} using LLM", provider);
                        return Ok(config);
                    },
                    Err(e) => {
                        warn!("❌ LLM config generation failed for {}: {}", provider, e);
                    }
                }
            }
        }
        
        // Fallback to template config
        warn!("Using template fallback for {} config", provider);
        Ok(self.generate_template_config(provider, environment))
    }

    // Fallback template methods
    fn generate_template_documentation(&self, provider: &str) -> String {
        format!(
            "# {} API Documentation\n\n## Overview\nDocumentation for {} API integration.\n\n## Authentication\nRefer to the official {} documentation for authentication details.\n\n## Usage\nPlease check the official documentation for usage examples.",
            provider, provider, provider
        )
    }

    fn generate_template_examples(&self, provider: &str) -> Vec<String> {
        vec![
            format!("# {} Python Example\nimport requests\n\napi_key = 'your_api_key'\nresponse = requests.get('https://api.{}.com/endpoint', headers={{'Authorization': f'Bearer {{api_key}}'}})", provider, provider.to_lowercase()),
            format!("// {} JavaScript Example\nconst apiKey = 'your_api_key';\nfetch('https://api.{}.com/endpoint', {{\n  headers: {{'Authorization': `Bearer ${{apiKey}}`}}\n}}).then(response => response.json())", provider, provider.to_lowercase()),
            format!("# {} cURL Example\ncurl -H \"Authorization: Bearer your_api_key\" https://api.{}.com/endpoint", provider, provider.to_lowercase())
        ]
    }

    fn generate_template_config(&self, provider: &str, environment: &str) -> String {
        format!(
            "# {} Configuration - {} Environment\n\n{}_API_KEY=your_api_key_here\n{}_BASE_URL=https://api.{}.com\n{}_TIMEOUT=30\n\n# Add to your .env file",
            provider, environment, 
            provider.to_uppercase(), 
            provider.to_uppercase(), 
            provider.to_lowercase(),
            provider.to_uppercase()
        )
    }
}