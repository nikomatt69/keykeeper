use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::enhanced_types::*;
use crate::llm_wrapper::{LLMEngine, LLMConfig};
use crate::template_engine::EnhancedTemplateEngine;
use crate::framework_detector::FrameworkDetector;

/// Simple configuration data for documentation generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationData {
    pub provider: Option<String>,
    pub template_id: Option<String>,
    pub project_name: Option<String>,
    pub description: Option<String>,
    pub features: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Default for ConfigurationData {
    fn default() -> Self {
        Self {
            provider: None,
            template_id: None,
            project_name: None,
            description: None,
            features: Vec::new(),
            metadata: HashMap::new(),
        }
    }
}

/// Detected framework information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedFramework {
    pub name: String,
    pub version: Option<String>,
    pub confidence: f64,
    pub package_manager: Option<String>,
    pub config_files: Vec<String>,
}

/// Documentation generation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocsConfig {
    /// Output format for documentation
    pub output_format: DocumentationFormat,
    /// Include code examples
    pub include_examples: bool,
    /// Include API reference
    pub include_api_reference: bool,
    /// Include setup guides
    pub include_setup_guides: bool,
    /// Include troubleshooting
    pub include_troubleshooting: bool,
    /// Documentation style
    pub style: DocumentationStyle,
    /// Target audience level
    pub audience_level: AudienceLevel,
    /// Custom template path
    pub custom_template_path: Option<PathBuf>,
    /// Language for documentation
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentationFormat {
    Markdown,
    Html,
    Pdf,
    Json,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentationStyle {
    Technical,
    Beginner,
    Reference,
    Tutorial,
    API,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudienceLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

impl Default for DocsConfig {
    fn default() -> Self {
        Self {
            output_format: DocumentationFormat::Markdown,
            include_examples: true,
            include_api_reference: true,
            include_setup_guides: true,
            include_troubleshooting: true,
            style: DocumentationStyle::Technical,
            audience_level: AudienceLevel::Intermediate,
            custom_template_path: None,
            language: "en".to_string(),
        }
    }
}

/// Documentation section structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationSection {
    pub title: String,
    pub content: String,
    pub code_examples: Vec<CodeExample>,
    pub subsections: Vec<DocumentationSection>,
    pub order: usize,
}

/// Code example structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeExample {
    pub title: String,
    pub language: String,
    pub code: String,
    pub description: String,
    pub is_runnable: bool,
}

/// Generated documentation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedDocumentation {
    pub title: String,
    pub description: String,
    pub sections: Vec<DocumentationSection>,
    pub metadata: DocumentationMetadata,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

/// Documentation metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationMetadata {
    pub version: String,
    pub framework: Option<String>,
    pub provider: Option<String>,
    pub template: Option<String>,
    pub tags: Vec<String>,
    pub author: String,
    pub license: Option<String>,
}

/// Template documentation structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateDocumentation {
    pub template_id: String,
    pub name: String,
    pub description: String,
    pub usage_guide: String,
    pub parameters: Vec<TemplateParameter>,
    pub examples: Vec<CodeExample>,
    pub compatibility: Vec<String>,
    pub changelog: Vec<ChangelogEntry>,
}

/// Template parameter documentation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateParameter {
    pub name: String,
    pub param_type: String,
    pub description: String,
    pub required: bool,
    pub default_value: Option<String>,
    pub examples: Vec<String>,
}

/// Changelog entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangelogEntry {
    pub version: String,
    pub date: chrono::DateTime<chrono::Utc>,
    pub changes: Vec<String>,
    pub breaking_changes: Vec<String>,
}

/// Documentation generation statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocsGenerationStats {
    pub total_sections: usize,
    pub total_examples: usize,
    pub generation_time_ms: u64,
    pub llm_calls: usize,
    pub template_usage: HashMap<String, usize>,
}

/// Main documentation generator
pub struct DocumentationGenerator {
    llm_engine: Arc<RwLock<Option<LLMEngine>>>,
    template_engine: Arc<RwLock<EnhancedTemplateEngine>>,
    framework_detector: Arc<RwLock<FrameworkDetector>>,
    config: Arc<RwLock<DocsConfig>>,
    stats: Arc<RwLock<DocsGenerationStats>>,
}

impl DocumentationGenerator {
    /// Create a new documentation generator
    pub fn new() -> Self {
        use crate::template_engine::TemplateEngineConfig;
        
        Self {
            llm_engine: Arc::new(RwLock::new(None)),
            template_engine: Arc::new(RwLock::new(EnhancedTemplateEngine::new(TemplateEngineConfig::default()))),
            framework_detector: Arc::new(RwLock::new(FrameworkDetector::new())),
            config: Arc::new(RwLock::new(DocsConfig::default())),
            stats: Arc::new(RwLock::new(DocsGenerationStats {
                total_sections: 0,
                total_examples: 0,
                generation_time_ms: 0,
                llm_calls: 0,
                template_usage: HashMap::new(),
            })),
        }
    }

    /// Initialize the LLM engine for intelligent documentation generation
    pub async fn initialize_llm(&self, config: LLMConfig) -> Result<()> {
        let engine = LLMEngine::new(config)?;
        let mut llm_guard = self.llm_engine.write().await;
        *llm_guard = Some(engine);
        info!("Documentation generator LLM engine initialized successfully");
        Ok(())
    }

    /// Set documentation configuration
    pub async fn set_config(&self, config: DocsConfig) -> Result<()> {
        let mut config_guard = self.config.write().await;
        *config_guard = config;
        Ok(())
    }

    /// Generate comprehensive project documentation
    pub async fn generate_project_documentation(
        &self,
        project_path: &Path,
        config_data: &ConfigurationData,
    ) -> Result<GeneratedDocumentation> {
        let start_time = std::time::Instant::now();
        let config = self.config.read().await.clone();

        info!("Generating project documentation for: {:?}", project_path);

        // Detect framework and analyze project structure
        let framework_detector = self.framework_detector.read().await;
        let detection_results = framework_detector.detect_framework(project_path.to_string_lossy().as_ref()).await?;
        
        // Convert to our DetectedFramework format (take the highest confidence result)
        let detected_framework = if !detection_results.is_empty() {
            let best_match = detection_results.iter()
                .max_by(|a, b| a.confidence.partial_cmp(&b.confidence).unwrap_or(std::cmp::Ordering::Equal));
            
            best_match.map(|result| DetectedFramework {
                name: result.framework.clone(),
                version: result.version.clone(),
                confidence: result.confidence,
                package_manager: None, // Not provided by FrameworkDetectionResult
                config_files: Vec::new(), // We could extract this from evidence
            })
        } else {
            None
        };

        // Generate documentation sections
        let mut sections = Vec::new();

        // 1. Project Overview Section
        sections.push(self.generate_overview_section(project_path, config_data, detected_framework.as_ref()).await?);

        // 2. Setup and Installation Section
        if config.include_setup_guides {
            sections.push(self.generate_setup_section(config_data, detected_framework.as_ref()).await?);
        }

        // 3. API Reference Section
        if config.include_api_reference {
            sections.push(self.generate_api_reference_section(config_data).await?);
        }

        // 4. Configuration Section
        sections.push(self.generate_configuration_section(config_data).await?);

        // 5. Usage Examples Section
        if config.include_examples {
            sections.push(self.generate_usage_examples_section(config_data, detected_framework.as_ref()).await?);
        }

        // 6. Deployment Section
        sections.push(self.generate_deployment_section(config_data, detected_framework.as_ref()).await?);

        // 7. Troubleshooting Section
        if config.include_troubleshooting {
            sections.push(self.generate_troubleshooting_section(config_data, detected_framework.as_ref()).await?);
        }

        // Create metadata
        let metadata = DocumentationMetadata {
            version: "1.0.0".to_string(),
            framework: detected_framework.as_ref().map(|f| f.name.clone()),
            provider: config_data.provider.clone(),
            template: config_data.template_id.clone(),
            tags: self.generate_tags(config_data, detected_framework.as_ref()),
            author: "KeyKeeper Documentation Generator".to_string(),
            license: None,
        };

        let documentation = GeneratedDocumentation {
            title: format!("{} Documentation", config_data.project_name.as_deref().unwrap_or("Project")),
            description: self.generate_project_description(config_data, detected_framework.as_ref()).await?,
            sections,
            metadata,
            generated_at: chrono::Utc::now(),
        };

        // Update statistics
        let generation_time = start_time.elapsed().as_millis() as u64;
        self.update_stats(documentation.sections.len(), generation_time).await;

        Ok(documentation)
    }

    /// Generate API documentation
    pub async fn generate_api_documentation(
        &self,
        config_data: &ConfigurationData,
        api_spec: Option<&serde_json::Value>,
    ) -> Result<GeneratedDocumentation> {
        let start_time = std::time::Instant::now();
        info!("Generating API documentation for provider: {:?}", config_data.provider);

        let mut sections = Vec::new();

        // 1. API Overview
        sections.push(self.generate_api_overview_section(config_data, api_spec).await?);

        // 2. Authentication
        sections.push(self.generate_authentication_section(config_data).await?);

        // 3. Endpoints Reference
        sections.push(self.generate_endpoints_section(config_data, api_spec).await?);

        // 4. Error Handling
        sections.push(self.generate_error_handling_section(config_data).await?);

        // 5. Rate Limiting
        sections.push(self.generate_rate_limiting_section(config_data).await?);

        // 6. SDK Examples
        sections.push(self.generate_sdk_examples_section(config_data).await?);

        let metadata = DocumentationMetadata {
            version: "1.0.0".to_string(),
            framework: None,
            provider: config_data.provider.clone(),
            template: None,
            tags: vec!["api".to_string(), "reference".to_string()],
            author: "KeyKeeper Documentation Generator".to_string(),
            license: None,
        };

        let documentation = GeneratedDocumentation {
            title: format!("{} API Documentation", 
                config_data.provider.as_deref().unwrap_or("API")),
            description: "Comprehensive API reference and usage guide".to_string(),
            sections,
            metadata,
            generated_at: chrono::Utc::now(),
        };

        let generation_time = start_time.elapsed().as_millis() as u64;
        self.update_stats(documentation.sections.len(), generation_time).await;

        Ok(documentation)
    }

    /// Generate setup guide
    pub async fn generate_setup_guide(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<GeneratedDocumentation> {
        let start_time = std::time::Instant::now();
        info!("Generating setup guide");

        let mut sections = Vec::new();

        // 1. Prerequisites
        sections.push(self.generate_prerequisites_section(config_data, framework).await?);

        // 2. Installation Steps
        sections.push(self.generate_installation_section(config_data, framework).await?);

        // 3. Configuration Steps
        sections.push(self.generate_configuration_steps_section(config_data, framework).await?);

        // 4. Verification
        sections.push(self.generate_verification_section(config_data, framework).await?);

        // 5. Next Steps
        sections.push(self.generate_next_steps_section(config_data, framework).await?);

        let metadata = DocumentationMetadata {
            version: "1.0.0".to_string(),
            framework: framework.map(|f| f.name.clone()),
            provider: config_data.provider.clone(),
            template: None,
            tags: vec!["setup".to_string(), "guide".to_string(), "installation".to_string()],
            author: "KeyKeeper Documentation Generator".to_string(),
            license: None,
        };

        let documentation = GeneratedDocumentation {
            title: "Setup Guide".to_string(),
            description: "Step-by-step setup and configuration guide".to_string(),
            sections,
            metadata,
            generated_at: chrono::Utc::now(),
        };

        let generation_time = start_time.elapsed().as_millis() as u64;
        self.update_stats(documentation.sections.len(), generation_time).await;

        Ok(documentation)
    }

    /// Generate deployment guide
    pub async fn generate_deployment_guide(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<GeneratedDocumentation> {
        let start_time = std::time::Instant::now();
        info!("Generating deployment guide");

        let mut sections = Vec::new();

        // 1. Deployment Overview
        sections.push(self.generate_deployment_overview_section(config_data, framework).await?);

        // 2. Environment Setup
        sections.push(self.generate_environment_setup_section(config_data, framework).await?);

        // 3. Build Process
        sections.push(self.generate_build_process_section(config_data, framework).await?);

        // 4. Platform-specific Deployment
        sections.push(self.generate_platform_deployment_section(config_data, framework).await?);

        // 5. Monitoring and Maintenance
        sections.push(self.generate_monitoring_section(config_data, framework).await?);

        let metadata = DocumentationMetadata {
            version: "1.0.0".to_string(),
            framework: framework.map(|f| f.name.clone()),
            provider: config_data.provider.clone(),
            template: None,
            tags: vec!["deployment".to_string(), "production".to_string(), "devops".to_string()],
            author: "KeyKeeper Documentation Generator".to_string(),
            license: None,
        };

        let documentation = GeneratedDocumentation {
            title: "Deployment Guide".to_string(),
            description: "Comprehensive deployment and production setup guide".to_string(),
            sections,
            metadata,
            generated_at: chrono::Utc::now(),
        };

        let generation_time = start_time.elapsed().as_millis() as u64;
        self.update_stats(documentation.sections.len(), generation_time).await;

        Ok(documentation)
    }

    /// Generate template documentation
    pub async fn generate_template_documentation(
        &self,
        template_id: &str,
        template_data: &serde_json::Value,
    ) -> Result<TemplateDocumentation> {
        info!("Generating template documentation for: {}", template_id);

        let template_engine = self.template_engine.read().await;
        
        // Extract template information
        let name = template_data.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(template_id)
            .to_string();

        let description = template_data.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Template description not available")
            .to_string();

        // Generate usage guide using LLM if available
        let usage_guide = self.generate_template_usage_guide(template_id, template_data).await?;

        // Extract parameters
        let parameters = self.extract_template_parameters(template_data)?;

        // Generate examples
        let examples = self.generate_template_examples(template_id, template_data).await?;

        // Generate compatibility information
        let compatibility = self.generate_template_compatibility(template_data);

        // Generate changelog (placeholder for now)
        let changelog = vec![
            ChangelogEntry {
                version: "1.0.0".to_string(),
                date: chrono::Utc::now(),
                changes: vec!["Initial template release".to_string()],
                breaking_changes: vec![],
            }
        ];

        Ok(TemplateDocumentation {
            template_id: template_id.to_string(),
            name,
            description,
            usage_guide,
            parameters,
            examples,
            compatibility,
            changelog,
        })
    }

    /// Export documentation to file
    pub async fn export_documentation(
        &self,
        documentation: &GeneratedDocumentation,
        output_path: &Path,
        format: DocumentationFormat,
    ) -> Result<PathBuf> {
        match format {
            DocumentationFormat::Markdown => {
                self.export_to_markdown(documentation, output_path).await
            }
            DocumentationFormat::Html => {
                self.export_to_html(documentation, output_path).await
            }
            DocumentationFormat::Json => {
                self.export_to_json(documentation, output_path).await
            }
            DocumentationFormat::Pdf => {
                // For now, export as markdown and suggest conversion
                warn!("PDF export not yet implemented, exporting as Markdown");
                self.export_to_markdown(documentation, output_path).await
            }
        }
    }

    /// Get documentation generation statistics
    pub async fn get_stats(&self) -> DocsGenerationStats {
        self.stats.read().await.clone()
    }

    // Private helper methods

    async fn generate_overview_section(
        &self,
        project_path: &Path,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        
        content.push_str(&format!(
            "# {}\n\n",
            config_data.project_name.as_deref().unwrap_or("Project")
        ));

        if let Some(description) = &config_data.description {
            content.push_str(&format!("{}\n\n", description));
        }

        if let Some(fw) = framework {
            content.push_str(&format!("**Framework:** {}\n", fw.name));
            content.push_str(&format!("**Version:** {}\n", fw.version.as_deref().unwrap_or("Unknown")));
        }

        if let Some(provider) = &config_data.provider {
            content.push_str(&format!("**API Provider:** {}\n", provider));
        }

        content.push_str("\n## Features\n\n");
        content.push_str("- API integration with secure key management\n");
        content.push_str("- Framework-specific implementation\n");
        content.push_str("- Production-ready configuration\n");
        content.push_str("- Comprehensive error handling\n");

        Ok(DocumentationSection {
            title: "Overview".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 1,
        })
    }

    async fn generate_setup_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Setup and Installation\n\n");

        // Prerequisites
        content.push_str("## Prerequisites\n\n");
        if let Some(fw) = framework {
            content.push_str(&format!("- {} (version {} or later)\n", fw.name, fw.version.as_deref().unwrap_or("latest")));
        }
        content.push_str("- Node.js (version 16 or later)\n");
        content.push_str("- Package manager (npm, yarn, or pnpm)\n\n");

        // Installation steps
        content.push_str("## Installation\n\n");
        content.push_str("1. Install dependencies:\n\n");

        examples.push(CodeExample {
            title: "Install Dependencies".to_string(),
            language: "bash".to_string(),
            code: "npm install".to_string(),
            description: "Install all required dependencies".to_string(),
            is_runnable: true,
        });

        // Environment setup
        content.push_str("2. Set up environment variables:\n\n");
        
        if let Some(provider) = &config_data.provider {
            examples.push(CodeExample {
                title: "Environment Configuration".to_string(),
                language: "bash".to_string(),
                code: format!("# .env file\n{}=your_api_key_here", 
                    self.get_api_key_env_name(provider)),
                description: "Configure API keys and environment variables".to_string(),
                is_runnable: false,
            });
        }

        Ok(DocumentationSection {
            title: "Setup and Installation".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 2,
        })
    }

    async fn generate_api_reference_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# API Reference\n\n");

        if let Some(provider) = &config_data.provider {
            content.push_str(&format!("This section covers the {} API integration.\n\n", provider));

            // Generate basic usage example
            examples.push(self.generate_api_usage_example(provider).await?);
        }

        Ok(DocumentationSection {
            title: "API Reference".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 3,
        })
    }

    async fn generate_configuration_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Configuration\n\n");
        content.push_str("This section covers all configuration options for your project.\n\n");

        // Generate configuration example
        if let Ok(config_json) = serde_json::to_string_pretty(config_data) {
            examples.push(CodeExample {
                title: "Configuration File".to_string(),
                language: "json".to_string(),
                code: config_json,
                description: "Complete configuration example".to_string(),
                is_runnable: false,
            });
        }

        Ok(DocumentationSection {
            title: "Configuration".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 4,
        })
    }

    async fn generate_usage_examples_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Usage Examples\n\n");
        content.push_str("This section provides practical examples of using the generated configuration.\n\n");

        // Generate framework-specific examples
        if let Some(fw) = framework {
            examples.extend(self.generate_framework_examples(&fw.name, config_data).await?);
        }

        Ok(DocumentationSection {
            title: "Usage Examples".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 5,
        })
    }

    async fn generate_deployment_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Deployment\n\n");
        content.push_str("This section covers deployment strategies and best practices.\n\n");

        // Build command
        examples.push(CodeExample {
            title: "Build for Production".to_string(),
            language: "bash".to_string(),
            code: "npm run build".to_string(),
            description: "Build the project for production deployment".to_string(),
            is_runnable: true,
        });

        // Framework-specific deployment
        if let Some(fw) = framework {
            examples.extend(self.generate_deployment_examples(&fw.name).await?);
        }

        Ok(DocumentationSection {
            title: "Deployment".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 6,
        })
    }

    async fn generate_troubleshooting_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();

        content.push_str("# Troubleshooting\n\n");
        content.push_str("Common issues and their solutions.\n\n");

        content.push_str("## Common Issues\n\n");
        content.push_str("### API Key Issues\n");
        content.push_str("- Ensure your API key is correctly set in environment variables\n");
        content.push_str("- Check that the API key has the required permissions\n");
        content.push_str("- Verify the API key format matches the provider's requirements\n\n");

        content.push_str("### Connection Issues\n");
        content.push_str("- Check your internet connection\n");
        content.push_str("- Verify API endpoint URLs are correct\n");
        content.push_str("- Check for any firewall or proxy restrictions\n\n");

        if let Some(fw) = framework {
            content.push_str(&format!("### {} Specific Issues\n", fw.name));
            content.push_str(&self.generate_framework_troubleshooting(&fw.name));
        }

        Ok(DocumentationSection {
            title: "Troubleshooting".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 7,
        })
    }

    // Additional helper methods for API documentation

    async fn generate_api_overview_section(
        &self,
        config_data: &ConfigurationData,
        api_spec: Option<&serde_json::Value>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();

        content.push_str("# API Overview\n\n");
        
        if let Some(provider) = &config_data.provider {
            content.push_str(&format!("This documentation covers the {} API integration.\n\n", provider));
        }

        if let Some(spec) = api_spec {
            if let Some(info) = spec.get("info") {
                if let Some(description) = info.get("description").and_then(|v| v.as_str()) {
                    content.push_str(&format!("{}\n\n", description));
                }
            }
        }

        Ok(DocumentationSection {
            title: "API Overview".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 1,
        })
    }

    async fn generate_authentication_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Authentication\n\n");
        content.push_str("This section covers authentication methods and setup.\n\n");

        if let Some(provider) = &config_data.provider {
            let auth_example = self.generate_auth_example(provider).await?;
            examples.push(auth_example);
        }

        Ok(DocumentationSection {
            title: "Authentication".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 2,
        })
    }

    async fn generate_endpoints_section(
        &self,
        config_data: &ConfigurationData,
        api_spec: Option<&serde_json::Value>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# API Endpoints\n\n");
        content.push_str("Available API endpoints and their usage.\n\n");

        // Generate examples from API spec if available
        if let Some(spec) = api_spec {
            examples.extend(self.generate_endpoint_examples(spec).await?);
        }

        Ok(DocumentationSection {
            title: "API Endpoints".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 3,
        })
    }

    async fn generate_error_handling_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Error Handling\n\n");
        content.push_str("This section covers error handling patterns and best practices.\n\n");

        examples.push(CodeExample {
            title: "Error Handling Example".to_string(),
            language: "javascript".to_string(),
            code: r#"try {
  const response = await apiClient.makeRequest();
  return response.data;
} catch (error) {
  if (error.response) {
    // API error response
    console.error('API Error:', error.response.status, error.response.data);
  } else if (error.request) {
    // Network error
    console.error('Network Error:', error.message);
  } else {
    // Other error
    console.error('Error:', error.message);
  }
  throw error;
}"#.to_string(),
            description: "Comprehensive error handling pattern".to_string(),
            is_runnable: false,
        });

        Ok(DocumentationSection {
            title: "Error Handling".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 4,
        })
    }

    async fn generate_rate_limiting_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Rate Limiting\n\n");
        content.push_str("Understanding and handling API rate limits.\n\n");

        examples.push(CodeExample {
            title: "Rate Limiting Handler".to_string(),
            language: "javascript".to_string(),
            code: r#"const rateLimitHandler = {
  async makeRequest(requestFn, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }
};"#.to_string(),
            description: "Rate limiting handler with exponential backoff".to_string(),
            is_runnable: false,
        });

        Ok(DocumentationSection {
            title: "Rate Limiting".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 5,
        })
    }

    async fn generate_sdk_examples_section(
        &self,
        config_data: &ConfigurationData,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# SDK Examples\n\n");
        content.push_str("Code examples using the generated SDK.\n\n");

        if let Some(provider) = &config_data.provider {
            examples.extend(self.generate_sdk_examples(provider).await?);
        }

        Ok(DocumentationSection {
            title: "SDK Examples".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 6,
        })
    }

    // Template documentation helpers

    async fn generate_template_usage_guide(
        &self,
        template_id: &str,
        template_data: &serde_json::Value,
    ) -> Result<String> {
        let mut guide = String::new();
        
        guide.push_str("## Usage\n\n");
        guide.push_str(&format!("To use the `{}` template:\n\n", template_id));
        guide.push_str("1. Select the template in the generator\n");
        guide.push_str("2. Configure the required parameters\n");
        guide.push_str("3. Generate the configuration\n");
        guide.push_str("4. Review and customize as needed\n\n");

        // Add LLM-generated content if available
        if let Some(llm) = self.llm_engine.read().await.as_ref() {
            let prompt = format!(
                "Generate a detailed usage guide for the template '{}' with data: {}",
                template_id,
                serde_json::to_string_pretty(template_data)?
            );
            
            if let Ok(llm_content) = llm.generate_text(&prompt).await {
                guide.push_str("## Detailed Guide\n\n");
                guide.push_str(&llm_content);
                guide.push_str("\n\n");
                
                // Update LLM usage stats
                let mut stats = self.stats.write().await;
                stats.llm_calls += 1;
            }
        }

        Ok(guide)
    }

    fn extract_template_parameters(
        &self,
        template_data: &serde_json::Value,
    ) -> Result<Vec<TemplateParameter>> {
        let mut parameters = Vec::new();

        if let Some(params) = template_data.get("parameters").and_then(|v| v.as_object()) {
            for (name, param_data) in params {
                let param = TemplateParameter {
                    name: name.clone(),
                    param_type: param_data.get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("string")
                        .to_string(),
                    description: param_data.get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("No description available")
                        .to_string(),
                    required: param_data.get("required")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    default_value: param_data.get("default")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    examples: param_data.get("examples")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default(),
                };
                parameters.push(param);
            }
        }

        Ok(parameters)
    }

    async fn generate_template_examples(
        &self,
        template_id: &str,
        template_data: &serde_json::Value,
    ) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        // Basic usage example
        examples.push(CodeExample {
            title: "Basic Usage".to_string(),
            language: "json".to_string(),
            code: format!(r#"{{
  "template": "{}",
  "parameters": {{
    "example_param": "example_value"
  }}
}}"#, template_id),
            description: "Basic template usage configuration".to_string(),
            is_runnable: false,
        });

        // Advanced usage example
        if let Some(advanced_example) = template_data.get("advanced_example") {
            examples.push(CodeExample {
                title: "Advanced Usage".to_string(),
                language: "json".to_string(),
                code: serde_json::to_string_pretty(advanced_example)?,
                description: "Advanced template configuration with all options".to_string(),
                is_runnable: false,
            });
        }

        Ok(examples)
    }

    fn generate_template_compatibility(&self, template_data: &serde_json::Value) -> Vec<String> {
        let mut compatibility = Vec::new();

        if let Some(compat) = template_data.get("compatibility").and_then(|v| v.as_array()) {
            for item in compat {
                if let Some(framework) = item.as_str() {
                    compatibility.push(framework.to_string());
                }
            }
        }

        if compatibility.is_empty() {
            compatibility.push("Universal".to_string());
        }

        compatibility
    }

    // Export methods

    async fn export_to_markdown(
        &self,
        documentation: &GeneratedDocumentation,
        output_path: &Path,
    ) -> Result<PathBuf> {
        let mut markdown = String::new();

        // Title and description
        markdown.push_str(&format!("# {}\n\n", documentation.title));
        markdown.push_str(&format!("{}\n\n", documentation.description));

        // Metadata
        markdown.push_str("## Metadata\n\n");
        markdown.push_str(&format!("- **Version:** {}\n", documentation.metadata.version));
        if let Some(framework) = &documentation.metadata.framework {
            markdown.push_str(&format!("- **Framework:** {}\n", framework));
        }
        if let Some(provider) = &documentation.metadata.provider {
            markdown.push_str(&format!("- **Provider:** {}\n", provider));
        }
        markdown.push_str(&format!("- **Generated:** {}\n\n", documentation.generated_at.format("%Y-%m-%d %H:%M:%S UTC")));

        // Table of contents
        markdown.push_str("## Table of Contents\n\n");
        for section in &documentation.sections {
            markdown.push_str(&format!("- [{}](#{})\n", section.title, 
                section.title.to_lowercase().replace(' ', "-")));
        }
        markdown.push_str("\n");

        // Sections
        for section in &documentation.sections {
            markdown.push_str(&section.content);
            markdown.push_str("\n");

            // Code examples
            for example in &section.code_examples {
                markdown.push_str(&format!("### {}\n\n", example.title));
                markdown.push_str(&format!("{}\n\n", example.description));
                markdown.push_str(&format!("```{}\n{}\n```\n\n", example.language, example.code));
            }
        }

        let file_path = output_path.join("README.md");
        fs::write(&file_path, markdown).await?;
        
        info!("Documentation exported to: {:?}", file_path);
        Ok(file_path)
    }

    async fn export_to_html(
        &self,
        documentation: &GeneratedDocumentation,
        output_path: &Path,
    ) -> Result<PathBuf> {
        // For now, convert markdown to basic HTML
        let markdown_path = self.export_to_markdown(documentation, output_path).await?;
        let markdown_content = fs::read_to_string(&markdown_path).await?;
        
        let html = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        code {{ background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }}
        pre {{ background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }}
    </style>
</head>
<body>
    <div id="content">
        <!-- Markdown content would be converted to HTML here -->
        <pre>{}</pre>
    </div>
</body>
</html>"#, documentation.title, html_escape(&markdown_content));

        let file_path = output_path.join("documentation.html");
        fs::write(&file_path, html).await?;
        
        info!("HTML documentation exported to: {:?}", file_path);
        Ok(file_path)
    }

    async fn export_to_json(
        &self,
        documentation: &GeneratedDocumentation,
        output_path: &Path,
    ) -> Result<PathBuf> {
        let json = serde_json::to_string_pretty(documentation)?;
        let file_path = output_path.join("documentation.json");
        fs::write(&file_path, json).await?;
        
        info!("JSON documentation exported to: {:?}", file_path);
        Ok(file_path)
    }

    // Utility methods

    async fn generate_project_description(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<String> {
        let mut description = String::new();

        if let Some(desc) = &config_data.description {
            description = desc.clone();
        } else {
            description = "A project with API integration and secure configuration management.".to_string();
        }

        // Enhance with LLM if available
        if let Some(llm) = self.llm_engine.read().await.as_ref() {
            let prompt = format!(
                "Generate a comprehensive project description for a {} project using {} API. Current description: {}",
                framework.as_ref().map(|f| f.name.as_str()).unwrap_or("web"),
                config_data.provider.as_deref().unwrap_or("external"),
                description
            );
            
            if let Ok(enhanced) = llm.generate_text(&prompt).await {
                description = enhanced;
                
                // Update stats
                let mut stats = self.stats.write().await;
                stats.llm_calls += 1;
            }
        }

        Ok(description)
    }

    fn generate_tags(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Vec<String> {
        let mut tags = vec!["api".to_string(), "configuration".to_string()];

        if let Some(provider) = &config_data.provider {
            tags.push(provider.clone());
        }

        if let Some(fw) = framework {
            tags.push(fw.name.clone());
        }

        tags.push("keykeeper".to_string());
        tags.push("generated".to_string());

        tags
    }

    fn get_api_key_env_name(&self, provider: &str) -> String {
        match provider.to_lowercase().as_str() {
            "openai" => "OPENAI_API_KEY".to_string(),
            "anthropic" => "ANTHROPIC_API_KEY".to_string(),
            "google" => "GOOGLE_API_KEY".to_string(),
            "azure" => "AZURE_API_KEY".to_string(),
            _ => format!("{}_API_KEY", provider.to_uppercase()),
        }
    }

    async fn generate_api_usage_example(&self, provider: &str) -> Result<CodeExample> {
        let code = match provider.to_lowercase().as_str() {
            "openai" => r#"import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateText(prompt) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-3.5-turbo',
  });
  
  return completion.choices[0].message.content;
}"#,
            "anthropic" => r#"import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateText(prompt) {
  const message = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return message.content[0].text;
}"#,
            _ => &format!(r#"// Basic API usage for {}
const apiClient = new {}Client({{
  apiKey: process.env.{}_API_KEY,
}});

async function makeRequest() {{
  return await apiClient.request({{
    // Request parameters
  }});
}}"#, provider, provider, provider.to_uppercase()),
        };

        Ok(CodeExample {
            title: format!("{} API Usage", provider),
            language: "javascript".to_string(),
            code: code.to_string(),
            description: format!("Basic usage example for {} API", provider),
            is_runnable: false,
        })
    }

    async fn generate_framework_examples(
        &self,
        framework: &str,
        config_data: &ConfigurationData,
    ) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        match framework.to_lowercase().as_str() {
            "react" => {
                examples.push(CodeExample {
                    title: "React Component Example".to_string(),
                    language: "jsx".to_string(),
                    code: r#"import React, { useState, useEffect } from 'react';
import { apiClient } from './api/client';

function ApiExample() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getData();
      setData(result);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}"#.to_string(),
                    description: "React component using the generated API client".to_string(),
                    is_runnable: false,
                });
            }
            "vue" => {
                examples.push(CodeExample {
                    title: "Vue Component Example".to_string(),
                    language: "vue".to_string(),
                    code: r#"<template>
  <div>
    <button @click="fetchData" :disabled="loading">
      {{ loading ? 'Loading...' : 'Fetch Data' }}
    </button>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>

<script>
import { ref } from 'vue';
import { apiClient } from './api/client';

export default {
  setup() {
    const data = ref(null);
    const loading = ref(false);

    const fetchData = async () => {
      loading.value = true;
      try {
        const result = await apiClient.getData();
        data.value = result;
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        loading.value = false;
      }
    };

    return {
      data,
      loading,
      fetchData,
    };
  },
};
</script>"#.to_string(),
                    description: "Vue component using the generated API client".to_string(),
                    is_runnable: false,
                });
            }
            "angular" => {
                examples.push(CodeExample {
                    title: "Angular Service Example".to_string(),
                    language: "typescript".to_string(),
                    code: r#"import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiKey = process.env['API_KEY'];
  private baseUrl = 'https://api.example.com';

  constructor(private http: HttpClient) {}

  getData(): Observable<any> {
    return this.http.get(`${this.baseUrl}/data`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
}"#.to_string(),
                    description: "Angular service for API integration".to_string(),
                    is_runnable: false,
                });
            }
            _ => {
                examples.push(CodeExample {
                    title: "Basic Usage".to_string(),
                    language: "javascript".to_string(),
                    code: "// Framework-specific example not available".to_string(),
                    description: "Generic usage example".to_string(),
                    is_runnable: false,
                });
            }
        }

        Ok(examples)
    }

    async fn generate_deployment_examples(&self, framework: &str) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        match framework.to_lowercase().as_str() {
            "react" => {
                examples.push(CodeExample {
                    title: "Vercel Deployment".to_string(),
                    language: "json".to_string(),
                    code: r#"{
  "name": "my-react-app",
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "env": {
    "API_KEY": "@api-key"
  }
}"#.to_string(),
                    description: "Vercel configuration for React deployment".to_string(),
                    is_runnable: false,
                });
            }
            "vue" => {
                examples.push(CodeExample {
                    title: "Netlify Deployment".to_string(),
                    language: "toml".to_string(),
                    code: r#"[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block""#.to_string(),
                    description: "Netlify configuration for Vue deployment".to_string(),
                    is_runnable: false,
                });
            }
            _ => {
                examples.push(CodeExample {
                    title: "Docker Deployment".to_string(),
                    language: "dockerfile".to_string(),
                    code: r#"FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]"#.to_string(),
                    description: "Docker configuration for deployment".to_string(),
                    is_runnable: false,
                });
            }
        }

        Ok(examples)
    }

    fn generate_framework_troubleshooting(&self, framework: &str) -> String {
        match framework.to_lowercase().as_str() {
            "react" => "- Check React version compatibility\n- Ensure hooks are used correctly\n- Verify component state management\n\n".to_string(),
            "vue" => "- Check Vue version compatibility\n- Verify composition API usage\n- Check reactive state updates\n\n".to_string(),
            "angular" => "- Check Angular version compatibility\n- Verify dependency injection\n- Check service registration\n\n".to_string(),
            _ => "- Check framework documentation\n- Verify configuration files\n- Check dependency versions\n\n".to_string(),
        }
    }

    async fn generate_auth_example(&self, provider: &str) -> Result<CodeExample> {
        let code = match provider.to_lowercase().as_str() {
            "openai" => r#"// OpenAI Authentication
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID, // optional
});

// Verify authentication
async function testAuth() {
  try {
    const models = await openai.models.list();
    console.log('Authentication successful');
    return models;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}"#,
            "anthropic" => r#"// Anthropic Authentication
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Verify authentication
async function testAuth() {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    console.log('Authentication successful');
    return message;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}"#,
            _ => &format!(r#"// {} Authentication
const client = new {}Client({{
  apiKey: process.env.{}_API_KEY,
  // Additional auth options
}});

// Verify authentication
async function testAuth() {{
  try {{
    const response = await client.authenticate();
    console.log('Authentication successful');
    return response;
  }} catch (error) {{
    console.error('Authentication failed:', error);
    throw error;
  }}
}}"#, provider, provider, provider.to_uppercase()),
        };

        Ok(CodeExample {
            title: "Authentication Setup".to_string(),
            language: "javascript".to_string(),
            code: code.to_string(),
            description: format!("Authentication setup for {} API", provider),
            is_runnable: false,
        })
    }

    async fn generate_endpoint_examples(
        &self,
        api_spec: &serde_json::Value,
    ) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        // Extract endpoints from OpenAPI spec
        if let Some(paths) = api_spec.get("paths").and_then(|v| v.as_object()) {
            for (path, methods) in paths.iter().take(3) { // Limit to first 3 endpoints
                if let Some(methods_obj) = methods.as_object() {
                    for (method, operation) in methods_obj.iter().take(1) { // Take first method
                        let summary = operation.get("summary")
                            .and_then(|v| v.as_str())
                            .unwrap_or("API Operation");

                        let example_code = format!(r#"// {} {}
const response = await fetch('{}', {{
  method: '{}',
  headers: {{
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
  }},
  // body: JSON.stringify(requestData), // for POST/PUT requests
}});

const data = await response.json();
console.log(data);"#, 
                            method.to_uppercase(), 
                            path,
                            path,
                            method.to_uppercase()
                        );

                        examples.push(CodeExample {
                            title: summary.to_string(),
                            language: "javascript".to_string(),
                            code: example_code,
                            description: format!("{} {} endpoint usage", method.to_uppercase(), path),
                            is_runnable: false,
                        });
                    }
                }
            }
        }

        Ok(examples)
    }

    async fn generate_sdk_examples(&self, provider: &str) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        // Generate common SDK patterns
        examples.push(CodeExample {
            title: "SDK Initialization".to_string(),
            language: "javascript".to_string(),
            code: format!(r#"import {{ {}Client }} from './{}-sdk';

const client = new {}Client({{
  apiKey: process.env.{}_API_KEY,
  timeout: 30000,
  retryAttempts: 3,
}});"#, 
                provider, 
                provider.to_lowercase(),
                provider,
                provider.to_uppercase()
            ),
            description: "Initialize the SDK client with configuration".to_string(),
            is_runnable: false,
        });

        examples.push(CodeExample {
            title: "Async Operations".to_string(),
            language: "javascript".to_string(),
            code: r#"// Async operation with error handling
async function performOperation() {
  try {
    const result = await client.performAction({
      parameter1: 'value1',
      parameter2: 'value2',
    });
    
    console.log('Operation successful:', result);
    return result;
  } catch (error) {
    console.error('Operation failed:', error);
    
    // Handle specific error types
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 60000));
      return performOperation();
    }
    
    throw error;
  }
}"#.to_string(),
            description: "Async operations with proper error handling".to_string(),
            is_runnable: false,
        });

        Ok(examples)
    }

    // Additional helper methods for setup guide

    async fn generate_prerequisites_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();

        content.push_str("# Prerequisites\n\n");
        content.push_str("Before you begin, ensure you have the following:\n\n");

        // System requirements
        content.push_str("## System Requirements\n\n");
        content.push_str("- Node.js 16 or later\n");
        content.push_str("- npm, yarn, or pnpm package manager\n");
        
        if let Some(fw) = framework {
            content.push_str(&format!("- {} CLI tools\n", fw.name));
        }

        // API requirements
        content.push_str("\n## API Requirements\n\n");
        if let Some(provider) = &config_data.provider {
            content.push_str(&format!("- {} API account and API key\n", provider));
            content.push_str(&format!("- {} API access permissions\n", provider));
        }

        Ok(DocumentationSection {
            title: "Prerequisites".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 1,
        })
    }

    async fn generate_installation_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Installation\n\n");
        content.push_str("Follow these steps to install and set up your project:\n\n");

        // Package installation
        examples.push(CodeExample {
            title: "Install Dependencies".to_string(),
            language: "bash".to_string(),
            code: "npm install".to_string(),
            description: "Install all project dependencies".to_string(),
            is_runnable: true,
        });

        // Framework-specific installation
        if let Some(fw) = framework {
            examples.push(self.generate_framework_install_example(&fw.name)?);
        }

        Ok(DocumentationSection {
            title: "Installation".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 2,
        })
    }

    async fn generate_configuration_steps_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Configuration\n\n");
        content.push_str("Configure your project with the necessary settings:\n\n");

        // Environment configuration
        if let Some(provider) = &config_data.provider {
            let env_var = self.get_api_key_env_name(provider);
            examples.push(CodeExample {
                title: "Environment Variables".to_string(),
                language: "bash".to_string(),
                code: format!("# .env\n{}=your_api_key_here\nNODE_ENV=development", env_var),
                description: "Set up environment variables".to_string(),
                is_runnable: false,
            });
        }

        // Configuration file
        if let Ok(config_json) = serde_json::to_string_pretty(config_data) {
            examples.push(CodeExample {
                title: "Configuration File".to_string(),
                language: "json".to_string(),
                code: config_json,
                description: "Main configuration file".to_string(),
                is_runnable: false,
            });
        }

        Ok(DocumentationSection {
            title: "Configuration".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 3,
        })
    }

    async fn generate_verification_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Verification\n\n");
        content.push_str("Verify that everything is set up correctly:\n\n");

        // Test command
        examples.push(CodeExample {
            title: "Run Tests".to_string(),
            language: "bash".to_string(),
            code: "npm test".to_string(),
            description: "Run the test suite to verify setup".to_string(),
            is_runnable: true,
        });

        // Development server
        examples.push(CodeExample {
            title: "Start Development Server".to_string(),
            language: "bash".to_string(),
            code: "npm run dev".to_string(),
            description: "Start the development server".to_string(),
            is_runnable: true,
        });

        Ok(DocumentationSection {
            title: "Verification".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 4,
        })
    }

    async fn generate_next_steps_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();

        content.push_str("# Next Steps\n\n");
        content.push_str("Now that your project is set up, here are some next steps:\n\n");

        content.push_str("## Development\n\n");
        content.push_str("- Review the generated code and customize as needed\n");
        content.push_str("- Add your business logic and UI components\n");
        content.push_str("- Configure additional API endpoints\n");
        content.push_str("- Set up error handling and logging\n\n");

        content.push_str("## Testing\n\n");
        content.push_str("- Write unit tests for your components\n");
        content.push_str("- Set up integration tests for API calls\n");
        content.push_str("- Configure end-to-end testing\n\n");

        content.push_str("## Deployment\n\n");
        content.push_str("- Set up CI/CD pipeline\n");
        content.push_str("- Configure production environment\n");
        content.push_str("- Set up monitoring and analytics\n");

        Ok(DocumentationSection {
            title: "Next Steps".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 5,
        })
    }

    // Additional helper methods for deployment guide

    async fn generate_deployment_overview_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();

        content.push_str("# Deployment Overview\n\n");
        content.push_str("This guide covers deploying your application to production.\n\n");

        if let Some(fw) = framework {
            content.push_str(&format!("**Framework:** {}\n", fw.name));
            content.push_str(&format!("**Deployment targets:** {}\n\n", 
                self.get_framework_deployment_targets(&fw.name).join(", ")));
        }

        content.push_str("## Deployment Checklist\n\n");
        content.push_str("- [ ] Environment variables configured\n");
        content.push_str("- [ ] API keys secured\n");
        content.push_str("- [ ] Build process tested\n");
        content.push_str("- [ ] Performance optimized\n");
        content.push_str("- [ ] Security measures implemented\n");
        content.push_str("- [ ] Monitoring configured\n");

        Ok(DocumentationSection {
            title: "Deployment Overview".to_string(),
            content,
            code_examples: vec![],
            subsections: vec![],
            order: 1,
        })
    }

    async fn generate_environment_setup_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Environment Setup\n\n");
        content.push_str("Configure your production environment:\n\n");

        // Production environment variables
        if let Some(provider) = &config_data.provider {
            let env_var = self.get_api_key_env_name(provider);
            examples.push(CodeExample {
                title: "Production Environment".to_string(),
                language: "bash".to_string(),
                code: format!(r#"# Production environment variables
NODE_ENV=production
{}=your_production_api_key
DATABASE_URL=your_production_database_url
REDIS_URL=your_redis_url
LOG_LEVEL=info"#, env_var),
                description: "Production environment configuration".to_string(),
                is_runnable: false,
            });
        }

        Ok(DocumentationSection {
            title: "Environment Setup".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 2,
        })
    }

    async fn generate_build_process_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Build Process\n\n");
        content.push_str("Build your application for production:\n\n");

        // Build command
        examples.push(CodeExample {
            title: "Production Build".to_string(),
            language: "bash".to_string(),
            code: "npm run build".to_string(),
            description: "Build the application for production".to_string(),
            is_runnable: true,
        });

        // Framework-specific optimizations
        if let Some(fw) = framework {
            examples.push(self.generate_framework_build_example(&fw.name)?);
        }

        Ok(DocumentationSection {
            title: "Build Process".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 3,
        })
    }

    async fn generate_platform_deployment_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Platform Deployment\n\n");
        content.push_str("Deploy to your chosen platform:\n\n");

        // Generate platform-specific examples
        if let Some(fw) = framework {
            examples.extend(self.generate_platform_examples(&fw.name)?);
        }

        Ok(DocumentationSection {
            title: "Platform Deployment".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 4,
        })
    }

    async fn generate_monitoring_section(
        &self,
        config_data: &ConfigurationData,
        framework: Option<&DetectedFramework>,
    ) -> Result<DocumentationSection> {
        let mut content = String::new();
        let mut examples = Vec::new();

        content.push_str("# Monitoring and Maintenance\n\n");
        content.push_str("Set up monitoring for your production application:\n\n");

        content.push_str("## Health Checks\n\n");
        examples.push(CodeExample {
            title: "Health Check Endpoint".to_string(),
            language: "javascript".to_string(),
            code: r#"// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      database: 'connected',
      api: 'responsive',
      memory: process.memoryUsage(),
    }
  };
  
  res.status(200).json(healthCheck);
});"#.to_string(),
            description: "Basic health check endpoint for monitoring".to_string(),
            is_runnable: false,
        });

        content.push_str("## Logging\n\n");
        examples.push(CodeExample {
            title: "Structured Logging".to_string(),
            language: "javascript".to_string(),
            code: r#"const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;"#.to_string(),
            description: "Structured logging configuration".to_string(),
            is_runnable: false,
        });

        Ok(DocumentationSection {
            title: "Monitoring and Maintenance".to_string(),
            content,
            code_examples: examples,
            subsections: vec![],
            order: 5,
        })
    }

    // Utility helper methods

    fn generate_framework_install_example(&self, framework: &str) -> Result<CodeExample> {
        let (title, code, description) = match framework.to_lowercase().as_str() {
            "react" => (
                "React Development Tools",
                "npx create-react-app --version\nnpm install --save-dev @testing-library/react",
                "Install React development dependencies"
            ),
            "vue" => (
                "Vue CLI Tools",
                "npm install -g @vue/cli\nvue --version",
                "Install Vue CLI and verify installation"
            ),
            "angular" => (
                "Angular CLI Tools",
                "npm install -g @angular/cli\nng version",
                "Install Angular CLI and verify installation"
            ),
            _ => (
                "Framework Tools",
                "# Install framework-specific tools as needed",
                "Framework-specific installation steps"
            ),
        };

        Ok(CodeExample {
            title: title.to_string(),
            language: "bash".to_string(),
            code: code.to_string(),
            description: description.to_string(),
            is_runnable: true,
        })
    }

    fn get_framework_deployment_targets(&self, framework: &str) -> Vec<String> {
        match framework.to_lowercase().as_str() {
            "react" => vec![
                "Vercel".to_string(),
                "Netlify".to_string(),
                "AWS S3 + CloudFront".to_string(),
                "GitHub Pages".to_string(),
            ],
            "vue" => vec![
                "Netlify".to_string(),
                "Vercel".to_string(),
                "Firebase Hosting".to_string(),
                "Surge.sh".to_string(),
            ],
            "angular" => vec![
                "Firebase Hosting".to_string(),
                "AWS S3 + CloudFront".to_string(),
                "Azure Static Web Apps".to_string(),
                "GitHub Pages".to_string(),
            ],
            _ => vec![
                "Docker".to_string(),
                "Heroku".to_string(),
                "DigitalOcean".to_string(),
                "AWS".to_string(),
            ],
        }
    }

    fn generate_framework_build_example(&self, framework: &str) -> Result<CodeExample> {
        let (title, code, description) = match framework.to_lowercase().as_str() {
            "react" => (
                "React Production Build",
                r#"# Optimize for production
npm run build

# Analyze bundle size
npx react-scripts build --analyze

# Serve locally to test
npx serve -s build"#,
                "Build and optimize React application for production"
            ),
            "vue" => (
                "Vue Production Build",
                r#"# Build for production
npm run build

# Analyze bundle
npm run build -- --report

# Preview build
npm run preview"#,
                "Build and optimize Vue application for production"
            ),
            "angular" => (
                "Angular Production Build",
                r#"# Build for production
ng build --prod

# Analyze bundle
ng build --prod --source-map
npx webpack-bundle-analyzer dist/*/stats.json"#,
                "Build and optimize Angular application for production"
            ),
            _ => (
                "Generic Build",
                "npm run build",
                "Build application for production"
            ),
        };

        Ok(CodeExample {
            title: title.to_string(),
            language: "bash".to_string(),
            code: code.to_string(),
            description: description.to_string(),
            is_runnable: true,
        })
    }

    fn generate_platform_examples(&self, framework: &str) -> Result<Vec<CodeExample>> {
        let mut examples = Vec::new();

        // Vercel example
        examples.push(CodeExample {
            title: "Vercel Deployment".to_string(),
            language: "json".to_string(),
            code: r#"{
  "name": "my-app",
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "API_KEY": "@api-key"
  }
}"#.to_string(),
            description: "Vercel deployment configuration".to_string(),
            is_runnable: false,
        });

        // Docker example
        examples.push(CodeExample {
            title: "Docker Deployment".to_string(),
            language: "dockerfile".to_string(),
            code: r#"FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]"#.to_string(),
            description: "Multi-stage Docker build for production deployment".to_string(),
            is_runnable: false,
        });

        Ok(examples)
    }

    async fn update_stats(&self, sections: usize, generation_time: u64) {
        let mut stats = self.stats.write().await;
        stats.total_sections += sections;
        stats.generation_time_ms += generation_time;
    }
}

// Utility function for HTML escaping
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}