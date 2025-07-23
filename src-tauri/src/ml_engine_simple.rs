use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Configuration for ML models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLConfig {
    pub model_cache_path: PathBuf,
    pub max_suggestions: usize,
    pub learning_rate: f32,
    pub similarity_threshold: f32,
}

impl Default for MLConfig {
    fn default() -> Self {
        Self {
            model_cache_path: PathBuf::from("./ml_models"),
            max_suggestions: 5,
            learning_rate: 0.1,
            similarity_threshold: 0.3,
        }
    }
}

/// Context information for ML analysis
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

/// Simplified ML Engine for KeyKeeper using rule-based approach with learning
pub struct MLEngine {
    config: MLConfig,
    usage_patterns: Arc<RwLock<HashMap<String, Vec<UsagePattern>>>>,
    context_similarity: Arc<RwLock<HashMap<String, ContextVector>>>,
    key_preferences: Arc<RwLock<HashMap<String, KeyPreferences>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsagePattern {
    pub key_id: String,
    pub context: ContextInfo,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub success: bool,
    pub confidence_feedback: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextVector {
    pub app_weight: f32,
    pub file_ext_weight: f32,
    pub project_type_weight: f32,
    pub language_weight: f32,
    pub usage_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPreferences {
    pub preferred_contexts: Vec<ContextInfo>,
    pub success_rate: f32,
    pub total_uses: u32,
    pub last_used: chrono::DateTime<chrono::Utc>,
}

impl MLEngine {
    /// Create new simplified ML Engine instance
    pub async fn new(config: MLConfig) -> Result<Self> {
        info!("Initializing Simplified ML Engine with config: {:?}", config);
        
        // Create cache directory if it doesn't exist
        tokio::fs::create_dir_all(&config.model_cache_path)
            .await
            .context("Failed to create model cache directory")?;

        Ok(Self {
            config,
            usage_patterns: Arc::new(RwLock::new(HashMap::new())),
            context_similarity: Arc::new(RwLock::new(HashMap::new())),
            key_preferences: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Initialize ML engine (load existing patterns if available)
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Loading existing ML patterns...");
        
        // Try to load existing patterns from storage
        if let Err(e) = self.load_patterns_from_disk().await {
            warn!("Could not load existing patterns: {}", e);
            info!("Starting with fresh ML patterns");
        }
        
        info!("Simplified ML Engine initialized successfully");
        Ok(())
    }

    /// Analyze context and provide ML-powered suggestions
    pub async fn analyze_context(
        &self, 
        context: ContextInfo, 
        available_keys: Vec<String>
    ) -> Result<MLPrediction> {
        debug!("Analyzing context: {:?}", context);
        
        let usage_patterns = self.usage_patterns.read().await;
        let key_preferences = self.key_preferences.read().await;
        
        let mut suggestions = Vec::new();
        
        // Analyze each available key for relevance to current context
        for key_id in available_keys {
            let confidence = self.calculate_key_confidence(
                &key_id, 
                &context, 
                &usage_patterns, 
                &key_preferences
            ).await;
            
            if confidence > self.config.similarity_threshold {
                suggestions.push(KeySuggestion {
                    key_id: key_id.clone(),
                    confidence,
                    reason: self.generate_suggestion_reason(&context, &key_id, confidence, &key_preferences),
                    suggested_format: self.determine_key_format(&context),
                });
            }
        }
        
        // Sort by confidence (highest first)
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        
        // Limit to max suggestions
        suggestions.truncate(self.config.max_suggestions);
        
        // Calculate overall context confidence
        let context_confidence = self.calculate_context_confidence(&context, &usage_patterns).await;
        
        // Generate usage prediction
        let usage_prediction = self.predict_usage_patterns(&context, &key_preferences).await;
        
        // Calculate security score
        let security_score = self.calculate_security_score(&context);
        
        Ok(MLPrediction {
            api_key_suggestions: suggestions,
            context_confidence,
            usage_prediction,
            security_score,
        })
    }

    /// Calculate confidence score for a specific key given context
    async fn calculate_key_confidence(
        &self,
        key_id: &str,
        context: &ContextInfo,
        usage_patterns: &HashMap<String, Vec<UsagePattern>>,
        key_preferences: &HashMap<String, KeyPreferences>,
    ) -> f32 {
        let mut confidence = 0.0;
        
        // Base frequency score
        if let Some(patterns) = usage_patterns.get(key_id) {
            let frequency_score = (patterns.len() as f32).ln() / 10.0;
            confidence += frequency_score * 0.3;
        }
        
        // Recency score
        if let Some(prefs) = key_preferences.get(key_id) {
            let hours_since_last_use = (chrono::Utc::now() - prefs.last_used).num_hours() as f32;
            let recency_score = (-hours_since_last_use / 168.0).exp(); // Decay over a week
            confidence += recency_score * 0.2;
            
            // Success rate score
            confidence += prefs.success_rate * 0.2;
        }
        
        // Context similarity score
        let similarity_score = self.calculate_context_similarity(context, key_id, usage_patterns);
        confidence += similarity_score * 0.3;
        
        confidence.min(1.0)
    }

    /// Calculate similarity between current context and historical usage
    fn calculate_context_similarity(
        &self,
        current_context: &ContextInfo,
        key_id: &str,
        usage_patterns: &HashMap<String, Vec<UsagePattern>>,
    ) -> f32 {
        if let Some(patterns) = usage_patterns.get(key_id) {
            let mut total_similarity = 0.0;
            let mut count = 0;
            
            for pattern in patterns.iter().rev().take(10) { // Look at last 10 uses
                let similarity = self.context_similarity_score(current_context, &pattern.context);
                total_similarity += similarity;
                count += 1;
            }
            
            if count > 0 {
                total_similarity / count as f32
            } else {
                0.0
            }
        } else {
            0.0
        }
    }

    /// Calculate similarity between two contexts
    fn context_similarity_score(&self, ctx1: &ContextInfo, ctx2: &ContextInfo) -> f32 {
        let mut score = 0.0;
        let mut factors = 0;
        
        // App similarity
        if let (Some(app1), Some(app2)) = (&ctx1.active_app, &ctx2.active_app) {
            if app1 == app2 {
                score += 1.0;
            } else if app1.to_lowercase().contains(&app2.to_lowercase()) || 
                     app2.to_lowercase().contains(&app1.to_lowercase()) {
                score += 0.7;
            }
            factors += 1;
        }
        
        // File extension similarity
        if let (Some(ext1), Some(ext2)) = (&ctx1.file_extension, &ctx2.file_extension) {
            if ext1 == ext2 {
                score += 1.0;
            }
            factors += 1;
        }
        
        // Project type similarity
        if let (Some(proj1), Some(proj2)) = (&ctx1.project_type, &ctx2.project_type) {
            if proj1 == proj2 {
                score += 1.0;
            }
            factors += 1;
        }
        
        // Language similarity
        if let (Some(lang1), Some(lang2)) = (&ctx1.language, &ctx2.language) {
            if lang1 == lang2 {
                score += 1.0;
            }
            factors += 1;
        }
        
        if factors > 0 {
            score / factors as f32
        } else {
            0.0
        }
    }

    /// Generate human-readable reason for suggestion
    fn generate_suggestion_reason(
        &self,
        context: &ContextInfo,
        key_id: &str,
        confidence: f32,
        key_preferences: &HashMap<String, KeyPreferences>,
    ) -> String {
        if let Some(prefs) = key_preferences.get(key_id) {
            if confidence > 0.8 {
                format!("Frequently used in similar contexts ({:.0}% success rate)", prefs.success_rate * 100.0)
            } else if confidence > 0.6 {
                "Recently used in this type of project".to_string()
            } else if confidence > 0.4 {
                "Matches current file type or environment".to_string()
            } else {
                "Available for this context".to_string()
            }
        } else {
            "New key for this context".to_string()
        }
    }

    /// Determine appropriate key format based on context
    fn determine_key_format(&self, context: &ContextInfo) -> KeyFormat {
        match context.file_extension.as_deref() {
            Some("env") => KeyFormat::EnvironmentVariable,
            Some("js") | Some("ts") | Some("jsx") | Some("tsx") => KeyFormat::ProcessEnv,
            Some("json") | Some("yaml") | Some("yml") | Some("toml") => KeyFormat::ConfigFile,
            _ => KeyFormat::Plain,
        }
    }

    /// Calculate confidence in context analysis
    async fn calculate_context_confidence(
        &self,
        context: &ContextInfo,
        usage_patterns: &HashMap<String, Vec<UsagePattern>>,
    ) -> f32 {
        let mut score = 0.0;
        let mut factors = 0;
        
        // Context completeness
        if context.active_app.is_some() {
            score += 0.25;
            factors += 1;
        }
        
        if context.file_extension.is_some() {
            score += 0.35;
            factors += 1;
        }
        
        if context.project_type.is_some() {
            score += 0.25;
            factors += 1;
        }
        
        if context.language.is_some() {
            score += 0.15;
            factors += 1;
        }
        
        // Historical data availability
        let historical_contexts = usage_patterns.values()
            .flat_map(|patterns| patterns.iter())
            .filter(|p| self.context_similarity_score(context, &p.context) > 0.5)
            .count();
        
        if historical_contexts > 5 {
            score += 0.3;
        } else if historical_contexts > 0 {
            score += 0.1;
        }
        
        if factors > 0 {
            (score / factors as f32).min(1.0)
        } else {
            0.0
        }
    }

    /// Predict usage patterns based on historical data
    async fn predict_usage_patterns(
        &self,
        _context: &ContextInfo,
        key_preferences: &HashMap<String, KeyPreferences>,
    ) -> UsagePrediction {
        let mut frequency_score = 0.0;
        let mut recency_score = 0.0;
        let mut context_match_count = 0;
        
        for prefs in key_preferences.values() {
            // Check how well current context matches preferred contexts
            for pref_context in &prefs.preferred_contexts {
                let similarity = self.context_similarity_score(_context, pref_context);
                if similarity > 0.5 {
                    frequency_score += prefs.total_uses as f32 / 100.0;
                    let hours_ago = (chrono::Utc::now() - prefs.last_used).num_hours() as f32;
                    recency_score += (-hours_ago / 24.0).exp();
                    context_match_count += 1;
                }
            }
        }
        
        let context_match_score = if context_match_count > 0 {
            (context_match_count as f32 / key_preferences.len() as f32).min(1.0)
        } else {
            0.0
        };
        
        // Predict next usage (simplified heuristic)
        let predicted_next_usage = if context_match_score > 0.5 {
            Some(chrono::Utc::now() + chrono::Duration::minutes(30))
        } else if context_match_score > 0.3 {
            Some(chrono::Utc::now() + chrono::Duration::hours(2))
        } else {
            None
        };
        
        UsagePrediction {
            frequency_score: (frequency_score / 10.0).min(1.0),
            recency_score: (recency_score / context_match_count as f32).min(1.0),
            context_match_score,
            predicted_next_usage,
        }
    }

    /// Calculate security score for context
    fn calculate_security_score(&self, context: &ContextInfo) -> SecurityScore {
        let mut risk_factors = Vec::new();
        let mut risk_score = 0.0;
        
        // Check for potentially risky contexts
        if let Some(app) = &context.active_app {
            let app_lower = app.to_lowercase();
            if app_lower.contains("browser") || app_lower.contains("chrome") || 
               app_lower.contains("firefox") || app_lower.contains("safari") {
                risk_score += 0.4;
                risk_factors.push("Web browser context detected".to_string());
            }
            
            if app_lower.contains("terminal") || app_lower.contains("cmd") || 
               app_lower.contains("powershell") {
                risk_score += 0.2;
                risk_factors.push("Command line interface detected".to_string());
            }
        }
        
        if let Some(path) = &context.file_path {
            let path_lower = path.to_lowercase();
            if path_lower.contains("/tmp") || path_lower.contains("temp") || 
               path_lower.contains("\\temp") {
                risk_score += 0.3;
                risk_factors.push("Temporary file location".to_string());
            }
            
            if path_lower.contains("downloads") || path_lower.contains("desktop") {
                risk_score += 0.2;
                risk_factors.push("Public folder location".to_string());
            }
        }
        
        // File extension risk assessment
        if let Some(ext) = &context.file_extension {
            match ext.as_str() {
                "sh" | "bat" | "cmd" | "ps1" => {
                    risk_score += 0.3;
                    risk_factors.push("Script file detected".to_string());
                }
                "log" | "txt" => {
                    risk_score += 0.1;
                    risk_factors.push("Plain text file - keys may be visible".to_string());
                }
                _ => {}
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
            confidence: 0.85,
            reasons: risk_factors,
        }
    }

    /// Record usage pattern for learning
    pub async fn record_usage(&self, key_id: String, context: ContextInfo, success: bool) -> Result<()> {
        let pattern = UsagePattern {
            key_id: key_id.clone(),
            context: context.clone(),
            timestamp: chrono::Utc::now(),
            success,
            confidence_feedback: None,
        };
        
        // Update usage patterns
        {
            let mut patterns = self.usage_patterns.write().await;
            patterns.entry(key_id.clone()).or_insert_with(Vec::new).push(pattern);
            
            // Keep only recent patterns (last 100 per key)
            if let Some(key_patterns) = patterns.get_mut(&key_id) {
                if key_patterns.len() > 100 {
                    key_patterns.drain(0..(key_patterns.len() - 100));
                }
            }
        }
        
        // Update key preferences
        {
            let mut preferences = self.key_preferences.write().await;
            let prefs = preferences.entry(key_id).or_insert_with(|| KeyPreferences {
                preferred_contexts: Vec::new(),
                success_rate: 0.0,
                total_uses: 0,
                last_used: chrono::Utc::now(),
            });
            
            prefs.total_uses += 1;
            prefs.last_used = chrono::Utc::now();
            
            // Update success rate (running average)
            let success_value = if success { 1.0 } else { 0.0 };
            prefs.success_rate = ((prefs.success_rate * (prefs.total_uses - 1) as f32) + success_value) 
                / prefs.total_uses as f32;
            
            // Add context to preferred contexts if successful and not already present
            if success {
                let similar_exists = prefs.preferred_contexts.iter()
                    .any(|ctx| self.context_similarity_score(&context, ctx) > 0.8);
                
                if !similar_exists {
                    prefs.preferred_contexts.push(context);
                    
                    // Keep only most recent 10 preferred contexts
                    if prefs.preferred_contexts.len() > 10 {
                        prefs.preferred_contexts.remove(0);
                    }
                }
            }
        }
        
        // Periodically save patterns to disk
        if let Err(e) = self.save_patterns_to_disk().await {
            warn!("Failed to save ML patterns: {}", e);
        }
        
        Ok(())
    }

    /// Load patterns from disk storage
    async fn load_patterns_from_disk(&self) -> Result<()> {
        let patterns_file = self.config.model_cache_path.join("usage_patterns.json");
        let preferences_file = self.config.model_cache_path.join("key_preferences.json");
        
        if patterns_file.exists() {
            let content = tokio::fs::read_to_string(patterns_file).await?;
            let patterns: HashMap<String, Vec<UsagePattern>> = serde_json::from_str(&content)?;
            *self.usage_patterns.write().await = patterns;
        }
        
        if preferences_file.exists() {
            let content = tokio::fs::read_to_string(preferences_file).await?;
            let preferences: HashMap<String, KeyPreferences> = serde_json::from_str(&content)?;
            *self.key_preferences.write().await = preferences;
        }
        
        Ok(())
    }

    /// Save patterns to disk storage
    async fn save_patterns_to_disk(&self) -> Result<()> {
        let patterns_file = self.config.model_cache_path.join("usage_patterns.json");
        let preferences_file = self.config.model_cache_path.join("key_preferences.json");
        
        let patterns = self.usage_patterns.read().await;
        let content = serde_json::to_string_pretty(&*patterns)?;
        tokio::fs::write(patterns_file, content).await?;
        
        let preferences = self.key_preferences.read().await;
        let content = serde_json::to_string_pretty(&*preferences)?;
        tokio::fs::write(preferences_file, content).await?;
        
        Ok(())
    }

    /// Get usage statistics
    pub async fn get_usage_stats(&self) -> Result<HashMap<String, serde_json::Value>> {
        let patterns = self.usage_patterns.read().await;
        let preferences = self.key_preferences.read().await;
        
        let mut stats = HashMap::new();
        
        for (key_id, key_patterns) in patterns.iter() {
            let mut key_stats = serde_json::Map::new();
            key_stats.insert("usage_count".to_string(), serde_json::Value::Number(
                serde_json::Number::from(key_patterns.len())
            ));
            
            let success_count = key_patterns.iter().filter(|p| p.success).count();
            let success_rate = if key_patterns.len() > 0 {
                success_count as f64 / key_patterns.len() as f64
            } else {
                0.0
            };
            key_stats.insert("success_rate".to_string(), serde_json::Value::Number(
                serde_json::Number::from_f64(success_rate).unwrap_or(serde_json::Number::from(0))
            ));
            
            if let Some(prefs) = preferences.get(key_id) {
                key_stats.insert("last_used".to_string(), serde_json::Value::String(
                    prefs.last_used.to_rfc3339()
                ));
                key_stats.insert("preferred_contexts_count".to_string(), serde_json::Value::Number(
                    serde_json::Number::from(prefs.preferred_contexts.len())
                ));
            }
            
            stats.insert(key_id.clone(), serde_json::Value::Object(key_stats));
        }
        
        Ok(stats)
    }
}