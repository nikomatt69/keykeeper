use crate::enhanced_types::*;
use crate::framework_detector::{FrameworkDetector, FrameworkDetectionRule};
use crate::template_inheritance::{TemplateInheritanceResolver, InheritanceConfig};
use crate::llm_wrapper::LLMEngine;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, info, warn, error};
use uuid::Uuid;

/// Enhanced template engine for multi-file framework integration
pub struct EnhancedTemplateEngine {
    /// Template registry with all available templates
    template_registry: Arc<RwLock<HashMap<String, EnhancedConfigTemplate>>>,
    /// Framework detector for automatic framework detection
    framework_detector: Arc<FrameworkDetector>,
    /// Template inheritance resolver
    inheritance_resolver: Arc<Mutex<TemplateInheritanceResolver>>,
    /// LLM engine for AI-enhanced generation
    llm_engine: Arc<Mutex<Option<LLMEngine>>>,
    /// Configuration for template inheritance
    inheritance_config: InheritanceConfig,
}

/// Template engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateEngineConfig {
    /// Enable LLM enhancement
    pub enable_llm_enhancement: bool,
    /// Maximum number of concurrent template generations
    pub max_concurrent_generations: usize,
    /// Template validation strictness
    pub validation_strictness: ValidationStrictness,
    /// Cache templates in memory
    pub enable_template_caching: bool,
    /// Maximum template file size in bytes
    pub max_template_file_size: usize,
}

/// Validation strictness levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationStrictness {
    /// Only validate critical errors
    Loose,
    /// Validate errors and important warnings
    Normal,
    /// Validate everything including style issues
    Strict,
}

impl Default for TemplateEngineConfig {
    fn default() -> Self {
        Self {
            enable_llm_enhancement: false,
            max_concurrent_generations: 4,
            validation_strictness: ValidationStrictness::Normal,
            enable_template_caching: true,
            max_template_file_size: 1024 * 1024, // 1MB
        }
    }
}

impl EnhancedTemplateEngine {
    /// Create a new enhanced template engine
    pub fn new(config: TemplateEngineConfig) -> Self {
        Self {
            template_registry: Arc::new(RwLock::new(HashMap::new())),
            framework_detector: Arc::new(FrameworkDetector::new()),
            inheritance_resolver: Arc::new(Mutex::new(TemplateInheritanceResolver::new())),
            llm_engine: Arc::new(Mutex::new(None)),
            inheritance_config: InheritanceConfig::default(),
        }
    }

    /// Initialize the LLM engine
    pub async fn initialize_llm(&self, llm_engine: LLMEngine) -> Result<()> {
        let mut llm_guard = self.llm_engine.lock().await;
        *llm_guard = Some(llm_engine);
        info!("LLM engine initialized for enhanced template generation");
        Ok(())
    }

    /// Register a template in the registry
    pub async fn register_template(&self, template: EnhancedConfigTemplate) -> Result<()> {
        let template_id = template.id.clone();
        
        // Validate template
        self.validate_template(&template).await?;
        
        // Register with inheritance resolver if it has a parent
        if template.extends.is_some() {
            let mut resolver = self.inheritance_resolver.lock().await;
            resolver.register_base_template(template.clone());
        }

        // Add to registry
        let mut registry = self.template_registry.write().await;
        registry.insert(template_id.clone(), template);
        
        info!("Registered template: {}", template_id);
        Ok(())
    }

    /// Generate enhanced configuration
    pub async fn generate_enhanced_configuration(
        &self,
        request: EnhancedGenerationRequest,
        progress_callback: Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<EnhancedGenerationResult> {
        info!("Starting enhanced template generation for provider: {}", request.provider_id);

        // Send initial progress
        if let Some(callback) = &progress_callback {
            callback(GenerationProgress {
                current_step: "Initializing generation".to_string(),
                progress: 0,
                total_steps: 8,
                current_step_number: 1,
                status_message: "Starting template generation process".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(30),
            });
        }

        // Step 1: Detect framework if not specified
        let framework = if request.context.framework.is_empty() {
            self.detect_framework(&request.context.output_path, &progress_callback).await?
        } else {
            request.context.framework.clone()
        };

        // Step 2: Find appropriate template
        let template = self.find_template(&request.provider_id, &request.template_id, &framework, &progress_callback).await?;

        // Step 3: Resolve template inheritance
        let resolved_template = self.resolve_template_inheritance(&template, &progress_callback).await?;

        // Step 4: Validate template compatibility
        self.validate_template_compatibility(&resolved_template, &request, &progress_callback).await?;

        // Step 5: Generate files
        let generated_files = self.generate_template_files(&resolved_template, &request, &progress_callback).await?;

        // Step 6: Apply LLM enhancement if requested
        let enhanced_files = if request.use_llm_enhancement {
            self.apply_llm_enhancement(&generated_files, &resolved_template, &request, &progress_callback).await?
        } else {
            generated_files
        };

        // Step 7: Validate generated content
        let validation_results = self.validate_generated_content(&enhanced_files, &resolved_template, &progress_callback).await?;

        // Step 8: Prepare final result
        if let Some(callback) = &progress_callback {
            callback(GenerationProgress {
                current_step: "Finalizing result".to_string(),
                progress: 100,
                total_steps: 8,
                current_step_number: 8,
                status_message: "Template generation completed successfully".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(0),
            });
        }

        let result = EnhancedGenerationResult {
            files: enhanced_files,
            dependencies: resolved_template.dependencies.clone(),
            dev_dependencies: resolved_template.dev_dependencies.clone(),
            setup_instructions: resolved_template.setup_instructions.clone(),
            next_steps: resolved_template.next_steps.clone(),
            validation_results,
            warnings: Vec::new(),
            recommendations: self.generate_recommendations(&resolved_template, &framework).await,
            template_info: TemplateInfo {
                template_id: resolved_template.id.clone(),
                template_name: resolved_template.name.clone(),
                template_version: resolved_template.version.clone(),
                provider_id: resolved_template.provider_id.clone(),
                provider_name: resolved_template.provider_name.clone(),
                framework: framework.clone(),
                compatibility_level: "full".to_string(), // This should be determined dynamically
                enabled_features: request.features.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                llm_enhanced: request.use_llm_enhancement,
            },
        };

        info!("Enhanced template generation completed successfully");
        Ok(result)
    }

    /// Detect framework in project directory
    async fn detect_framework(
        &self,
        project_path: &str,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<String> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Detecting framework".to_string(),
                progress: 12,
                total_steps: 8,
                current_step_number: 1,
                status_message: format!("Analyzing project structure at {}", project_path),
                has_error: false,
                error_message: None,
                eta_seconds: Some(25),
            });
        }

        let detection_results = self.framework_detector.detect_framework(project_path).await?;
        
        if let Some(result) = detection_results.first() {
            info!("Detected framework: {} (confidence: {:.2})", result.framework, result.confidence);
            Ok(result.framework.clone())
        } else {
            warn!("No framework detected, using default 'generic'");
            Ok("generic".to_string())
        }
    }

    /// Find appropriate template
    async fn find_template(
        &self,
        provider_id: &str,
        template_id: &Option<String>,
        framework: &str,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<EnhancedConfigTemplate> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Finding template".to_string(),
                progress: 25,
                total_steps: 8,
                current_step_number: 2,
                status_message: format!("Searching for template for provider: {}", provider_id),
                has_error: false,
                error_message: None,
                eta_seconds: Some(20),
            });
        }

        let registry = self.template_registry.read().await;

        // If specific template ID is provided, use it
        if let Some(tmpl_id) = template_id {
            if let Some(template) = registry.get(tmpl_id) {
                return Ok(template.clone());
            } else {
                return Err(anyhow::anyhow!("Template '{}' not found", tmpl_id));
            }
        }

        // Find best matching template for provider and framework
        let mut best_match: Option<&EnhancedConfigTemplate> = None;
        let mut best_score = 0.0;

        for template in registry.values() {
            if template.provider_id == provider_id {
                let score = self.calculate_template_score(template, framework);
                if score > best_score {
                    best_score = score;
                    best_match = Some(template);
                }
            }
        }

        if let Some(template) = best_match {
            Ok(template.clone())
        } else {
            Err(anyhow::anyhow!(
                "No suitable template found for provider '{}' and framework '{}'",
                provider_id,
                framework
            ))
        }
    }

    /// Calculate template compatibility score
    fn calculate_template_score(&self, template: &EnhancedConfigTemplate, framework: &str) -> f64 {
        let mut score = 1.0; // Base score

        // Check framework compatibility
        for compat in &template.framework_compatibility {
            if compat.framework == framework {
                score += match compat.compatibility_level.as_str() {
                    "full" => 3.0,
                    "partial" => 2.0,
                    "minimal" => 1.0,
                    _ => 0.0,
                };
                score += compat.confidence;
                break;
            }
        }

        // Check if template has framework-specific variants
        for file in &template.template_files {
            if file.framework_variants.contains_key(framework) {
                score += 0.5;
            }
        }

        score
    }

    /// Resolve template inheritance
    async fn resolve_template_inheritance(
        &self,
        template: &EnhancedConfigTemplate,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<EnhancedConfigTemplate> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Resolving template inheritance".to_string(),
                progress: 37,
                total_steps: 8,
                current_step_number: 3,
                status_message: "Processing template inheritance chain".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(15),
            });
        }

        let mut resolver = self.inheritance_resolver.lock().await;
        resolver.resolve_template(template, &self.inheritance_config)
    }

    /// Validate template compatibility
    async fn validate_template_compatibility(
        &self,
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<()> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Validating template compatibility".to_string(),
                progress: 50,
                total_steps: 8,
                current_step_number: 4,
                status_message: "Checking template requirements".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(12),
            });
        }

        // Check required environment variables
        for env_var in &template.required_env_vars {
            if !request.context.env_vars.contains_key(env_var) {
                return Err(anyhow::anyhow!(
                    "Required environment variable '{}' not provided",
                    env_var
                ));
            }
        }

        // Check feature compatibility
        for feature in &request.features {
            if !template.supported_features.contains(feature) {
                warn!("Feature '{}' not supported by template '{}'", feature, template.id);
            }
        }

        Ok(())
    }

    /// Generate template files
    async fn generate_template_files(
        &self,
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<Vec<GeneratedTemplateFile>> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Generating template files".to_string(),
                progress: 62,
                total_steps: 8,
                current_step_number: 5,
                status_message: format!("Processing {} template files", template.template_files.len()),
                has_error: false,
                error_message: None,
                eta_seconds: Some(10),
            });
        }

        let mut generated_files = Vec::new();
        let timestamp = chrono::Utc::now().to_rfc3339();

        for template_file in &template.template_files {
            // Check if file should be included based on conditions
            if !self.evaluate_file_conditions(template_file, request).await {
                continue;
            }

            // Get appropriate content based on framework
            let content = self.generate_file_content(template_file, template, request).await?;
            
            // Calculate file size and checksum
            let size = content.len();
            let mut hasher = Sha256::new();
            hasher.update(content.as_bytes());
            let checksum = format!("{:x}", hasher.finalize());

            // Check if file exists in project
            let file_path = Path::new(&request.context.output_path).join(&template_file.file_path);
            let exists = file_path.exists();

            generated_files.push(GeneratedTemplateFile {
                path: template_file.file_path.clone(),
                content,
                file_type: template_file.file_type.clone(),
                language: template_file.language.clone(),
                exists,
                category: template_file.category.clone(),
                is_required: template_file.is_required,
                size,
                checksum,
                created_by_template: template.id.clone(),
                created_at: timestamp.clone(),
            });
        }

        info!("Generated {} template files", generated_files.len());
        Ok(generated_files)
    }

    /// Evaluate file conditions
    async fn evaluate_file_conditions(
        &self,
        template_file: &TemplateFile,
        request: &EnhancedGenerationRequest,
    ) -> bool {
        // If no conditions, include the file
        if template_file.conditions.is_empty() {
            return true;
        }

        // Evaluate each condition
        for condition in &template_file.conditions {
            if !self.evaluate_condition(condition, request).await {
                return false;
            }
        }

        true
    }

    /// Evaluate a single condition
    async fn evaluate_condition(&self, condition: &str, request: &EnhancedGenerationRequest) -> bool {
        // Simple condition evaluation - in a real implementation, this would be more sophisticated
        match condition {
            condition if condition.starts_with("feature:") => {
                let feature = condition.strip_prefix("feature:").unwrap();
                request.features.contains(&feature.to_string())
            },
            condition if condition.starts_with("env:") => {
                let env_var = condition.strip_prefix("env:").unwrap();
                request.context.env_vars.contains_key(env_var)
            },
            condition if condition.starts_with("framework:") => {
                let framework = condition.strip_prefix("framework:").unwrap();
                request.context.framework == framework
            },
            _ => {
                warn!("Unknown condition: {}", condition);
                true
            }
        }
    }

    /// Generate content for a specific file
    async fn generate_file_content(
        &self,
        template_file: &TemplateFile,
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
    ) -> Result<String> {
        // Get framework-specific variant if available
        let base_content = if let Some(variant) = template_file.framework_variants.get(&request.context.framework) {
            variant.clone()
        } else {
            template_file.template_content.clone()
        };

        // Apply variable substitution
        let content = self.substitute_template_variables(&base_content, template, request).await?;

        // Apply any template overrides
        let final_content = if let Some(override_content) = request.template_overrides.get(&template_file.id) {
            override_content.clone()
        } else {
            content
        };

        Ok(final_content)
    }

    /// Substitute template variables
    async fn substitute_template_variables(
        &self,
        content: &str,
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
    ) -> Result<String> {
        let mut result = content.to_string();

        // Substitute environment variables
        for (key, value) in &request.context.env_vars {
            let placeholder = format!("{{{{{}}}}}", key);
            result = result.replace(&placeholder, value);
            
            // Also handle process.env.KEY format
            let env_placeholder = format!("process.env.{}", key);
            if !value.is_empty() {
                result = result.replace(&env_placeholder, &format!("\"{}\"", value));
            }
        }

        // Substitute framework-specific values
        let framework_placeholder = "{{FRAMEWORK}}";
        result = result.replace(framework_placeholder, &request.context.framework);

        // Substitute provider information
        result = result.replace("{{PROVIDER_NAME}}", &template.provider_name);
        result = result.replace("{{PROVIDER_ID}}", &template.provider_id);

        // Substitute user preferences
        if request.context.user_preferences.use_semicolons {
            // Ensure semicolons are present
            result = self.ensure_semicolons(&result);
        } else {
            // Remove semicolons
            result = self.remove_semicolons(&result);
        }

        // Handle indentation preferences
        if request.context.user_preferences.indentation == "tabs" {
            result = self.convert_to_tabs(&result, request.context.user_preferences.indent_size);
        } else {
            result = self.convert_to_spaces(&result, request.context.user_preferences.indent_size);
        }

        Ok(result)
    }

    /// Apply LLM enhancement to generated files
    async fn apply_llm_enhancement(
        &self,
        files: &[GeneratedTemplateFile],
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<Vec<GeneratedTemplateFile>> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Applying LLM enhancement".to_string(),
                progress: 75,
                total_steps: 8,
                current_step_number: 6,
                status_message: "Enhancing generated code with AI".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(8),
            });
        }

        let llm_guard = self.llm_engine.lock().await;
        if let Some(llm) = llm_guard.as_ref() {
            // Apply LLM enhancement to each file
            let mut enhanced_files = Vec::new();
            
            for file in files {
                let enhanced_content = self.enhance_file_with_llm(llm, file, template, request).await?;
                
                let mut enhanced_file = file.clone();
                enhanced_file.content = enhanced_content;
                
                // Recalculate size and checksum
                enhanced_file.size = enhanced_file.content.len();
                let mut hasher = Sha256::new();
                hasher.update(enhanced_file.content.as_bytes());
                enhanced_file.checksum = format!("{:x}", hasher.finalize());
                
                enhanced_files.push(enhanced_file);
            }
            
            Ok(enhanced_files)
        } else {
            warn!("LLM enhancement requested but no LLM engine available");
            Ok(files.to_vec())
        }
    }

    /// Enhance a single file with LLM
    async fn enhance_file_with_llm(
        &self,
        llm: &LLMEngine,
        file: &GeneratedTemplateFile,
        template: &EnhancedConfigTemplate,
        request: &EnhancedGenerationRequest,
    ) -> Result<String> {
        let llm_context = template.llm_context.as_ref();
        
        let system_prompt = if let Some(context) = llm_context {
            format!(
                "{}\n\nProvider Context: {}\n\nBest Practices:\n{}",
                context.system_prompt,
                context.provider_context,
                context.best_practices.join("\n- ")
            )
        } else {
            format!(
                "You are a code generation assistant. Enhance the following {} code for {} integration with {}.",
                file.language,
                template.provider_name,
                request.context.framework
            )
        };

        let user_prompt = format!(
            "Please enhance this {} file for better code quality, following best practices:\n\n```{}\n{}\n```\n\nFramework: {}\nFeatures: {}\n\nProvide only the enhanced code without explanations.",
            file.category,
            file.language,
            file.content,
            request.context.framework,
            request.features.join(", ")
        );

        let full_prompt = format!("{}\n\n{}", system_prompt, user_prompt);
        
        match llm.generate_text(&full_prompt).await {
            Ok(enhanced_content) => {
                // Extract code from LLM response if it's wrapped in markdown
                let cleaned_content = self.extract_code_from_llm_response(&enhanced_content, &file.language);
                Ok(cleaned_content)
            },
            Err(e) => {
                warn!("LLM enhancement failed for file {}: {}", file.path, e);
                Ok(file.content.clone()) // Return original content on failure
            }
        }
    }

    /// Extract code from LLM response
    fn extract_code_from_llm_response(&self, response: &str, language: &str) -> String {
        // Look for code blocks with language specification
        let lang_pattern = format!("```{}", language);
        if let Some(start) = response.find(&lang_pattern) {
            let code_start = start + lang_pattern.len();
            if let Some(end) = response[code_start..].find("```") {
                return response[code_start..code_start + end].trim().to_string();
            }
        }

        // Look for generic code blocks
        if let Some(start) = response.find("```") {
            let code_start = start + 3;
            // Skip language identifier if present
            let code_start = if let Some(newline) = response[code_start..].find('\n') {
                code_start + newline + 1
            } else {
                code_start
            };
            
            if let Some(end) = response[code_start..].find("```") {
                return response[code_start..code_start + end].trim().to_string();
            }
        }

        // If no code blocks found, return the response as-is
        response.trim().to_string()
    }

    /// Validate generated content
    async fn validate_generated_content(
        &self,
        files: &[GeneratedTemplateFile],
        template: &EnhancedConfigTemplate,
        progress_callback: &Option<Box<dyn Fn(GenerationProgress) + Send + Sync>>,
    ) -> Result<Vec<ValidationResult>> {
        if let Some(callback) = progress_callback {
            callback(GenerationProgress {
                current_step: "Validating generated content".to_string(),
                progress: 87,
                total_steps: 8,
                current_step_number: 7,
                status_message: "Running validation checks".to_string(),
                has_error: false,
                error_message: None,
                eta_seconds: Some(3),
            });
        }

        let mut validation_results = Vec::new();

        // Run validation rules from template
        for rule in &template.validation_rules {
            let result = self.validate_rule(rule, files, template).await;
            validation_results.push(result);
        }

        // Basic file validation
        for file in files {
            let basic_validation = self.validate_file_basic(file).await;
            validation_results.push(basic_validation);
        }

        Ok(validation_results)
    }

    /// Validate a specific rule
    async fn validate_rule(
        &self,
        rule: &ValidationRule,
        files: &[GeneratedTemplateFile],
        _template: &EnhancedConfigTemplate,
    ) -> ValidationResult {
        match rule.rule_type.as_str() {
            "file_exists" => {
                let file_exists = files.iter().any(|f| f.path == rule.condition);
                ValidationResult {
                    rule_id: format!("file_exists_{}", rule.condition),
                    passed: file_exists,
                    error_message: if !file_exists { Some(rule.error_message.clone()) } else { None },
                    warning_message: rule.warning_message.clone(),
                    suggested_fix: rule.auto_fix.clone(),
                    severity: if file_exists { "info".to_string() } else { "error".to_string() },
                }
            },
            "content_contains" => {
                let parts: Vec<&str> = rule.condition.split('|').collect();
                if parts.len() == 2 {
                    let (file_path, required_content) = (parts[0], parts[1]);
                    let file_contains = files.iter()
                        .find(|f| f.path == file_path)
                        .map(|f| f.content.contains(required_content))
                        .unwrap_or(false);
                    
                    ValidationResult {
                        rule_id: format!("content_contains_{}_{}", file_path, required_content),
                        passed: file_contains,
                        error_message: if !file_contains { Some(rule.error_message.clone()) } else { None },
                        warning_message: rule.warning_message.clone(),
                        suggested_fix: rule.auto_fix.clone(),
                        severity: if file_contains { "info".to_string() } else { "warning".to_string() },
                    }
                } else {
                    ValidationResult {
                        rule_id: "invalid_rule".to_string(),
                        passed: false,
                        error_message: Some("Invalid content_contains rule format".to_string()),
                        warning_message: None,
                        suggested_fix: None,
                        severity: "error".to_string(),
                    }
                }
            },
            _ => {
                ValidationResult {
                    rule_id: format!("unknown_rule_{}", rule.rule_type),
                    passed: true,
                    error_message: None,
                    warning_message: Some(format!("Unknown validation rule: {}", rule.rule_type)),
                    suggested_fix: None,
                    severity: "warning".to_string(),
                }
            }
        }
    }

    /// Basic file validation
    async fn validate_file_basic(&self, file: &GeneratedTemplateFile) -> ValidationResult {
        let mut issues = Vec::new();
        
        // Check file size
        if file.size > 1024 * 1024 { // 1MB
            issues.push("File is very large (>1MB)".to_string());
        }
        
        // Check for empty content
        if file.content.trim().is_empty() {
            issues.push("File content is empty".to_string());
        }
        
        // Check for syntax issues (basic)
        if file.language == "typescript" || file.language == "javascript" {
            if file.content.contains("undefined") && !file.content.contains("typeof") {
                issues.push("Potential undefined reference".to_string());
            }
        }

        ValidationResult {
            rule_id: format!("basic_validation_{}", file.path),
            passed: issues.is_empty(),
            error_message: None,
            warning_message: if issues.is_empty() { None } else { Some(issues.join("; ")) },
            suggested_fix: None,
            severity: if issues.is_empty() { "info".to_string() } else { "warning".to_string() },
        }
    }

    /// Generate recommendations based on template and framework
    async fn generate_recommendations(
        &self,
        template: &EnhancedConfigTemplate,
        framework: &str,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Framework-specific recommendations
        match framework {
            "nextjs" => {
                recommendations.push("Consider using Next.js App Router for better performance".to_string());
                recommendations.push("Add TypeScript for better type safety".to_string());
            },
            "react" => {
                recommendations.push("Consider using React 18 features like Suspense".to_string());
                recommendations.push("Use React.memo for performance optimization".to_string());
            },
            "vue" => {
                recommendations.push("Consider using Vue 3 Composition API".to_string());
                recommendations.push("Use Pinia for state management".to_string());
            },
            _ => {}
        }

        // Provider-specific recommendations
        match template.provider_category.as_str() {
            "auth" => {
                recommendations.push("Implement proper session management".to_string());
                recommendations.push("Add rate limiting for authentication endpoints".to_string());
                recommendations.push("Use HTTPS in production".to_string());
            },
            "payment" => {
                recommendations.push("Never store payment information locally".to_string());
                recommendations.push("Implement webhook verification".to_string());
                recommendations.push("Use PCI-compliant hosting".to_string());
            },
            "ai" => {
                recommendations.push("Implement proper error handling for API failures".to_string());
                recommendations.push("Add request rate limiting".to_string());
                recommendations.push("Consider caching responses where appropriate".to_string());
            },
            _ => {}
        }

        recommendations
    }

    /// Initialize built-in templates
    async fn initialize_built_in_templates(&self) -> Result<()> {
        info!("Initializing built-in templates");

        // Create Better Auth template
        let better_auth_template = self.create_better_auth_template();
        self.register_template(better_auth_template).await?;

        // Create OpenAI template
        let openai_template = self.create_openai_template();
        self.register_template(openai_template).await?;

        // Add more built-in templates as needed

        info!("Built-in templates initialized successfully");
        Ok(())
    }

    /// Create Better Auth template
    fn create_better_auth_template(&self) -> EnhancedConfigTemplate {
        // Implementation would create a comprehensive Better Auth template
        // This is a simplified version for demonstration
        EnhancedConfigTemplate {
            id: "better-auth-enhanced".to_string(),
            name: "Better Auth Enhanced Template".to_string(),
            description: "Enhanced Better Auth template with framework support".to_string(),
            version: "1.0.0".to_string(),
            author: Some("KeyKeeper".to_string()),
            provider_id: "better-auth".to_string(),
            provider_name: "Better Auth".to_string(),
            provider_category: "auth".to_string(),
            template_files: vec![
                // This would include actual template files
            ],
            framework_compatibility: vec![
                FrameworkCompatibility {
                    framework: "nextjs".to_string(),
                    compatibility_level: "full".to_string(),
                    confidence: 0.95,
                    config_overrides: HashMap::new(),
                    additional_dependencies: vec!["@next/auth".to_string()],
                    setup_instructions: vec!["Configure Next.js middleware".to_string()],
                    limitations: vec![],
                },
            ],
            required_env_vars: vec!["BETTER_AUTH_SECRET".to_string(), "BETTERAUTH_URL".to_string()],
            optional_env_vars: vec!["DATABASE_URL".to_string()],
            env_var_descriptions: HashMap::new(),
            dependencies: vec!["better-auth".to_string()],
            dev_dependencies: vec![],
            peer_dependencies: vec![],
            extends: None,
            overrides: HashMap::new(),
            supported_features: vec!["email-password".to_string(), "oauth".to_string()],
            feature_combinations: HashMap::new(),
            setup_instructions: vec!["Install Better Auth dependencies".to_string()],
            usage_examples: vec![],
            next_steps: vec!["Configure authentication providers".to_string()],
            tags: vec!["auth".to_string(), "better-auth".to_string()],
            difficulty_level: "intermediate".to_string(),
            estimated_setup_time: "15 minutes".to_string(),
            documentation_links: vec![],
            validation_rules: vec![],
            llm_context: None,
        }
    }

    /// Create OpenAI template
    fn create_openai_template(&self) -> EnhancedConfigTemplate {
        // Similar implementation for OpenAI template
        EnhancedConfigTemplate {
            id: "openai-enhanced".to_string(),
            name: "OpenAI Enhanced Template".to_string(),
            description: "Enhanced OpenAI integration template".to_string(),
            version: "1.0.0".to_string(),
            author: Some("KeyKeeper".to_string()),
            provider_id: "openai".to_string(),
            provider_name: "OpenAI".to_string(),
            provider_category: "ai".to_string(),
            template_files: vec![],
            framework_compatibility: vec![],
            required_env_vars: vec!["OPENAI_API_KEY".to_string()],
            optional_env_vars: vec!["OPENAI_BASE_URL".to_string()],
            env_var_descriptions: HashMap::new(),
            dependencies: vec!["openai".to_string()],
            dev_dependencies: vec![],
            peer_dependencies: vec![],
            extends: None,
            overrides: HashMap::new(),
            supported_features: vec!["chat".to_string(), "completions".to_string()],
            feature_combinations: HashMap::new(),
            setup_instructions: vec!["Install OpenAI SDK".to_string()],
            usage_examples: vec![],
            next_steps: vec!["Configure OpenAI client".to_string()],
            tags: vec!["ai".to_string(), "openai".to_string()],
            difficulty_level: "beginner".to_string(),
            estimated_setup_time: "5 minutes".to_string(),
            documentation_links: vec![],
            validation_rules: vec![],
            llm_context: None,
        }
    }

    /// Validate template structure
    async fn validate_template(&self, template: &EnhancedConfigTemplate) -> Result<()> {
        if template.id.is_empty() {
            return Err(anyhow::anyhow!("Template ID cannot be empty"));
        }
        
        if template.name.is_empty() {
            return Err(anyhow::anyhow!("Template name cannot be empty"));
        }
        
        if template.provider_id.is_empty() {
            return Err(anyhow::anyhow!("Provider ID cannot be empty"));
        }

        // Validate template files
        for file in &template.template_files {
            if file.id.is_empty() {
                return Err(anyhow::anyhow!("Template file ID cannot be empty"));
            }
            if file.file_path.is_empty() {
                return Err(anyhow::anyhow!("Template file path cannot be empty"));
            }
        }

        Ok(())
    }

    // Utility functions for code formatting
    fn ensure_semicolons(&self, content: &str) -> String {
        // Simple implementation - in reality, this would be more sophisticated
        content.to_string()
    }

    fn remove_semicolons(&self, content: &str) -> String {
        // Simple implementation
        content.replace(';', "")
    }

    fn convert_to_tabs(&self, content: &str, _tab_size: u8) -> String {
        // Convert spaces to tabs
        content.replace("    ", "\t")
    }

    fn convert_to_spaces(&self, content: &str, space_count: u8) -> String {
        // Convert tabs to spaces
        let spaces = " ".repeat(space_count as usize);
        content.replace('\t', &spaces)
    }
}

impl Clone for EnhancedTemplateEngine {
    fn clone(&self) -> Self {
        Self {
            template_registry: Arc::clone(&self.template_registry),
            framework_detector: Arc::clone(&self.framework_detector),
            inheritance_resolver: Arc::clone(&self.inheritance_resolver),
            llm_engine: Arc::clone(&self.llm_engine),
            inheritance_config: self.inheritance_config.clone(),
        }
    }
}