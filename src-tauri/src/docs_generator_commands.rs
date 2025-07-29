use crate::docs_generator::{
    DocumentationGenerator, DocsConfig, DocumentationFormat, DocumentationStyle, 
    AudienceLevel, GeneratedDocumentation, TemplateDocumentation, DocsGenerationStats,
    ConfigurationData, DetectedFramework
};
use crate::enhanced_types::*;
use crate::llm_wrapper::LLMConfig;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{command, State};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// State for the Documentation Generator
pub struct DocsGeneratorState {
    pub generator: Arc<RwLock<DocumentationGenerator>>,
}

impl DocsGeneratorState {
    pub fn new() -> Self {
        Self {
            generator: Arc::new(RwLock::new(DocumentationGenerator::new())),
        }
    }
}

/// Request to generate project documentation
#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateProjectDocumentationRequest {
    pub project_path: String,
    pub config_data: ConfigurationData,
    pub docs_config: Option<DocsConfig>,
}

/// Request to generate API documentation
#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateApiDocumentationRequest {
    pub config_data: ConfigurationData,
    pub api_spec: Option<serde_json::Value>,
    pub docs_config: Option<DocsConfig>,
}

/// Request to generate setup guide
#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateSetupGuideRequest {
    pub config_data: ConfigurationData,
    pub framework: Option<DetectedFramework>,
    pub docs_config: Option<DocsConfig>,
}

/// Request to generate deployment guide
#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateDeploymentGuideRequest {
    pub config_data: ConfigurationData,
    pub framework: Option<DetectedFramework>,
    pub docs_config: Option<DocsConfig>,
}

/// Request to generate template documentation
#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateTemplateDocumentationRequest {
    pub template_id: String,
    pub template_data: serde_json::Value,
}

/// Request to export documentation
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportDocumentationRequest {
    pub documentation: GeneratedDocumentation,
    pub output_path: String,
    pub format: DocumentationFormat,
}

/// Initialize documentation generator LLM
#[derive(Debug, Serialize, Deserialize)]
pub struct InitializeDocsLLMRequest {
    pub llm_config: LLMConfig,
}

/// Response for documentation operations
#[derive(Debug, Serialize, Deserialize)]
pub struct DocsResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub message: String,
}

impl<T> DocsResponse<T> {
    pub fn success(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            message: message.into(),
        }
    }

    pub fn error(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
            message: "Operation failed".to_string(),
        }
    }
}

/// Initialize the documentation generator LLM
#[command]
pub async fn initialize_docs_llm(
    request: InitializeDocsLLMRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<()>, String> {
    info!("Initializing documentation generator LLM");

    let generator = state.generator.read().await;
    
    match generator.initialize_llm(request.llm_config).await {
        Ok(_) => {
            info!("Documentation generator LLM initialized successfully");
            Ok(DocsResponse::success((), "LLM initialized successfully"))
        }
        Err(e) => {
            error!("Failed to initialize documentation generator LLM: {}", e);
            Ok(DocsResponse::error(format!("Failed to initialize LLM: {}", e)))
        }
    }
}

/// Generate comprehensive project documentation
#[command]
pub async fn generate_project_documentation(
    request: GenerateProjectDocumentationRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<GeneratedDocumentation>, String> {
    info!("Generating project documentation for: {}", request.project_path);

    let generator = state.generator.read().await;
    
    // Set configuration if provided
    if let Some(config) = request.docs_config {
        if let Err(e) = generator.set_config(config).await {
            error!("Failed to set documentation config: {}", e);
            return Ok(DocsResponse::error(format!("Failed to set config: {}", e)));
        }
    }

    let project_path = PathBuf::from(&request.project_path);
    
    match generator.generate_project_documentation(&project_path, &request.config_data).await {
        Ok(documentation) => {
            info!("Project documentation generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "Project documentation generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate project documentation: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate documentation: {}", e)))
        }
    }
}

/// Generate API documentation
#[command]
pub async fn generate_api_documentation(
    request: GenerateApiDocumentationRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<GeneratedDocumentation>, String> {
    info!("Generating API documentation for provider: {:?}", request.config_data.provider);

    let generator = state.generator.read().await;
    
    // Set configuration if provided
    if let Some(config) = request.docs_config {
        if let Err(e) = generator.set_config(config).await {
            error!("Failed to set documentation config: {}", e);
            return Ok(DocsResponse::error(format!("Failed to set config: {}", e)));
        }
    }

    match generator.generate_api_documentation(&request.config_data, request.api_spec.as_ref()).await {
        Ok(documentation) => {
            info!("API documentation generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "API documentation generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate API documentation: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate API documentation: {}", e)))
        }
    }
}

/// Generate setup guide
#[command]
pub async fn generate_setup_guide(
    request: GenerateSetupGuideRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<GeneratedDocumentation>, String> {
    info!("Generating setup guide");

    let generator = state.generator.read().await;
    
    // Set configuration if provided
    if let Some(config) = request.docs_config {
        if let Err(e) = generator.set_config(config).await {
            error!("Failed to set documentation config: {}", e);
            return Ok(DocsResponse::error(format!("Failed to set config: {}", e)));
        }
    }

    match generator.generate_setup_guide(&request.config_data, request.framework.as_ref()).await {
        Ok(documentation) => {
            info!("Setup guide generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "Setup guide generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate setup guide: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate setup guide: {}", e)))
        }
    }
}

/// Generate deployment guide
#[command]
pub async fn generate_deployment_guide(
    request: GenerateDeploymentGuideRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<GeneratedDocumentation>, String> {
    info!("Generating deployment guide");

    let generator = state.generator.read().await;
    
    // Set configuration if provided
    if let Some(config) = request.docs_config {
        if let Err(e) = generator.set_config(config).await {
            error!("Failed to set documentation config: {}", e);
            return Ok(DocsResponse::error(format!("Failed to set config: {}", e)));
        }
    }

    match generator.generate_deployment_guide(&request.config_data, request.framework.as_ref()).await {
        Ok(documentation) => {
            info!("Deployment guide generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "Deployment guide generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate deployment guide: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate deployment guide: {}", e)))
        }
    }
}

/// Generate template documentation
#[command]
pub async fn generate_template_documentation(
    request: GenerateTemplateDocumentationRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<TemplateDocumentation>, String> {
    info!("Generating template documentation for: {}", request.template_id);

    let generator = state.generator.read().await;

    match generator.generate_template_documentation(&request.template_id, &request.template_data).await {
        Ok(documentation) => {
            info!("Template documentation generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "Template documentation generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate template documentation: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate template documentation: {}", e)))
        }
    }
}

/// Export documentation to file
#[command]
pub async fn export_documentation(
    request: ExportDocumentationRequest,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<String>, String> {
    info!("Exporting documentation to: {}", request.output_path);

    let generator = state.generator.read().await;
    let output_path = PathBuf::from(&request.output_path);

    match generator.export_documentation(&request.documentation, &output_path, request.format).await {
        Ok(exported_path) => {
            let path_str = exported_path.to_string_lossy().to_string();
            info!("Documentation exported successfully to: {}", path_str);
            Ok(DocsResponse::success(
                path_str,
                "Documentation exported successfully"
            ))
        }
        Err(e) => {
            error!("Failed to export documentation: {}", e);
            Ok(DocsResponse::error(format!("Failed to export documentation: {}", e)))
        }
    }
}

/// Set documentation generator configuration
#[command]
pub async fn set_docs_generator_config(
    config: DocsConfig,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<()>, String> {
    info!("Setting documentation generator configuration");

    let generator = state.generator.read().await;

    match generator.set_config(config).await {
        Ok(_) => {
            info!("Documentation generator configuration set successfully");
            Ok(DocsResponse::success((), "Configuration set successfully"))
        }
        Err(e) => {
            error!("Failed to set documentation generator configuration: {}", e);
            Ok(DocsResponse::error(format!("Failed to set configuration: {}", e)))
        }
    }
}

/// Get documentation generation statistics
#[command]
pub async fn get_docs_generation_stats(
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<DocsGenerationStats>, String> {
    let generator = state.generator.read().await;
    let stats = generator.get_stats().await;
    
    Ok(DocsResponse::success(stats, "Statistics retrieved successfully"))
}

/// Generate documentation with AI enhancement
#[command]
pub async fn generate_enhanced_documentation(
    project_path: String,
    config_data: ConfigurationData,
    enhancement_options: DocumentationEnhancementOptions,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<GeneratedDocumentation>, String> {
    info!("Generating AI-enhanced documentation for: {}", project_path);

    let generator = state.generator.read().await;
    
    // Configure documentation with enhancement options
    let docs_config = DocsConfig {
        output_format: enhancement_options.format.unwrap_or(DocumentationFormat::Markdown),
        include_examples: enhancement_options.include_examples.unwrap_or(true),
        include_api_reference: enhancement_options.include_api_reference.unwrap_or(true),
        include_setup_guides: enhancement_options.include_setup_guides.unwrap_or(true),
        include_troubleshooting: enhancement_options.include_troubleshooting.unwrap_or(true),
        style: enhancement_options.style.unwrap_or(DocumentationStyle::Technical),
        audience_level: enhancement_options.audience_level.unwrap_or(AudienceLevel::Intermediate),
        custom_template_path: enhancement_options.custom_template_path.map(PathBuf::from),
        language: enhancement_options.language.unwrap_or_else(|| "en".to_string()),
    };

    if let Err(e) = generator.set_config(docs_config).await {
        error!("Failed to set documentation config: {}", e);
        return Ok(DocsResponse::error(format!("Failed to set config: {}", e)));
    }

    let project_path_buf = PathBuf::from(&project_path);
    
    match generator.generate_project_documentation(&project_path_buf, &config_data).await {
        Ok(documentation) => {
            info!("Enhanced documentation generated successfully");
            Ok(DocsResponse::success(
                documentation,
                "Enhanced documentation generated successfully"
            ))
        }
        Err(e) => {
            error!("Failed to generate enhanced documentation: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate enhanced documentation: {}", e)))
        }
    }
}

/// Generate batch documentation for multiple configurations
#[command]
pub async fn generate_batch_documentation(
    requests: Vec<GenerateProjectDocumentationRequest>,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<Vec<GeneratedDocumentation>>, String> {
    info!("Generating batch documentation for {} projects", requests.len());

    let generator = state.generator.read().await;
    let mut results = Vec::new();
    let mut errors = Vec::new();

    for request in requests {
        // Set configuration if provided
        if let Some(config) = request.docs_config {
            if let Err(e) = generator.set_config(config).await {
                errors.push(format!("Config error for {}: {}", request.project_path, e));
                continue;
            }
        }

        let project_path = PathBuf::from(&request.project_path);
        
        match generator.generate_project_documentation(&project_path, &request.config_data).await {
            Ok(documentation) => {
                results.push(documentation);
            }
            Err(e) => {
                errors.push(format!("Generation error for {}: {}", request.project_path, e));
            }
        }
    }

    if !errors.is_empty() {
        warn!("Batch documentation generation completed with errors: {:?}", errors);
    }

    let results_count = results.len();
    let errors_count = errors.len();

    info!("Batch documentation generation completed: {} successful, {} errors", 
        results_count, errors_count);

    Ok(DocsResponse::success(
        results,
        format!("Batch generation completed: {} successful, {} errors", results_count, errors_count)
    ))
}

/// Get available documentation templates
#[command]
pub async fn get_documentation_templates(
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<Vec<DocumentationTemplate>>, String> {
    let templates = vec![
        DocumentationTemplate {
            id: "comprehensive".to_string(),
            name: "Comprehensive Documentation".to_string(),
            description: "Complete documentation with all sections".to_string(),
            sections: vec![
                "overview".to_string(),
                "setup".to_string(),
                "api_reference".to_string(),
                "configuration".to_string(),
                "examples".to_string(),
                "deployment".to_string(),
                "troubleshooting".to_string(),
            ],
            target_audience: AudienceLevel::Intermediate,
            estimated_length: "Long".to_string(),
        },
        DocumentationTemplate {
            id: "quick_start".to_string(),
            name: "Quick Start Guide".to_string(),
            description: "Essential documentation for quick setup".to_string(),
            sections: vec![
                "overview".to_string(),
                "setup".to_string(),
                "basic_usage".to_string(),
            ],
            target_audience: AudienceLevel::Beginner,
            estimated_length: "Short".to_string(),
        },
        DocumentationTemplate {
            id: "api_reference".to_string(),
            name: "API Reference".to_string(),
            description: "Detailed API documentation".to_string(),
            sections: vec![
                "api_overview".to_string(),
                "authentication".to_string(),
                "endpoints".to_string(),
                "error_handling".to_string(),
                "rate_limiting".to_string(),
                "sdk_examples".to_string(),
            ],
            target_audience: AudienceLevel::Advanced,
            estimated_length: "Medium".to_string(),
        },
        DocumentationTemplate {
            id: "deployment_guide".to_string(),
            name: "Deployment Guide".to_string(),
            description: "Production deployment documentation".to_string(),
            sections: vec![
                "deployment_overview".to_string(),
                "environment_setup".to_string(),
                "build_process".to_string(),
                "platform_deployment".to_string(),
                "monitoring".to_string(),
            ],
            target_audience: AudienceLevel::Advanced,
            estimated_length: "Medium".to_string(),
        },
    ];

    Ok(DocsResponse::success(templates, "Documentation templates retrieved successfully"))
}

/// Validate documentation content
#[command]
pub async fn validate_documentation_content(
    documentation: GeneratedDocumentation,
    validation_rules: DocumentationValidationRules,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<DocumentationValidationResult>, String> {
    info!("Validating documentation content");

    let mut issues = Vec::new();
    let mut warnings = Vec::new();
    let mut suggestions = Vec::new();

    // Check minimum content requirements
    if validation_rules.require_title && documentation.title.trim().is_empty() {
        issues.push("Documentation title is required but empty".to_string());
    }

    if validation_rules.require_description && documentation.description.trim().is_empty() {
        issues.push("Documentation description is required but empty".to_string());
    }

    if validation_rules.min_sections > 0 && documentation.sections.len() < validation_rules.min_sections {
        issues.push(format!(
            "Documentation requires at least {} sections, found {}",
            validation_rules.min_sections,
            documentation.sections.len()
        ));
    }

    // Check for code examples if required
    if validation_rules.require_code_examples {
        let total_examples: usize = documentation.sections.iter()
            .map(|s| s.code_examples.len())
            .sum();
        
        if total_examples == 0 {
            warnings.push("No code examples found in documentation".to_string());
        }
    }

    // Check section content quality
    for section in &documentation.sections {
        if section.content.trim().is_empty() {
            issues.push(format!("Section '{}' has empty content", section.title));
        }

        if validation_rules.min_section_length > 0 && 
           section.content.len() < validation_rules.min_section_length {
            warnings.push(format!(
                "Section '{}' content is shorter than recommended ({} chars)",
                section.title,
                validation_rules.min_section_length
            ));
        }
    }

    // Generate suggestions
    if documentation.sections.len() < 5 {
        suggestions.push("Consider adding more sections for comprehensive coverage".to_string());
    }

    let total_examples: usize = documentation.sections.iter()
        .map(|s| s.code_examples.len())
        .sum();
    
    if total_examples < 3 {
        suggestions.push("Adding more code examples would improve documentation quality".to_string());
    }

    let validation_result = DocumentationValidationResult {
        is_valid: issues.is_empty(),
        issues,
        warnings,
        suggestions,
        quality_score: calculate_quality_score(&documentation),
        completeness_score: calculate_completeness_score(&documentation, &validation_rules),
    };

    Ok(DocsResponse::success(validation_result, "Documentation validation completed"))
}

/// Generate documentation preview
#[command]
pub async fn generate_documentation_preview(
    config_data: ConfigurationData,
    preview_options: DocumentationPreviewOptions,
    state: State<'_, DocsGeneratorState>,
) -> Result<DocsResponse<DocumentationPreview>, String> {
    info!("Generating documentation preview");

    let generator = state.generator.read().await;

    // Generate a minimal documentation for preview
    let docs_config = DocsConfig {
        output_format: DocumentationFormat::Markdown,
        include_examples: preview_options.include_examples,
        include_api_reference: preview_options.include_api_reference,
        include_setup_guides: preview_options.include_setup_guides,
        include_troubleshooting: false, // Skip for preview
        style: DocumentationStyle::Technical,
        audience_level: AudienceLevel::Intermediate,
        custom_template_path: None,
        language: "en".to_string(),
    };

    if let Err(e) = generator.set_config(docs_config).await {
        error!("Failed to set preview config: {}", e);
        return Ok(DocsResponse::error(format!("Failed to set preview config: {}", e)));
    }

    // Create a temporary path for preview generation
    let temp_path = std::env::temp_dir().join("docs_preview");

    match generator.generate_project_documentation(&temp_path, &config_data).await {
        Ok(documentation) => {
            let preview = DocumentationPreview {
                title: documentation.title.clone(),
                description: documentation.description.clone(),
                section_count: documentation.sections.len(),
                example_count: documentation.sections.iter()
                    .map(|s| s.code_examples.len())
                    .sum(),
                estimated_length: estimate_documentation_length(&documentation),
                table_of_contents: documentation.sections.iter()
                    .map(|s| s.title.clone())
                    .collect(),
                sample_content: documentation.sections.first()
                    .map(|s| s.content.chars().take(500).collect::<String>() + "...")
                    .unwrap_or_default(),
            };

            Ok(DocsResponse::success(preview, "Documentation preview generated successfully"))
        }
        Err(e) => {
            error!("Failed to generate documentation preview: {}", e);
            Ok(DocsResponse::error(format!("Failed to generate preview: {}", e)))
        }
    }
}

// Supporting types for additional commands

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationEnhancementOptions {
    pub format: Option<DocumentationFormat>,
    pub include_examples: Option<bool>,
    pub include_api_reference: Option<bool>,
    pub include_setup_guides: Option<bool>,
    pub include_troubleshooting: Option<bool>,
    pub style: Option<DocumentationStyle>,
    pub audience_level: Option<AudienceLevel>,
    pub custom_template_path: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub sections: Vec<String>,
    pub target_audience: AudienceLevel,
    pub estimated_length: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationValidationRules {
    pub require_title: bool,
    pub require_description: bool,
    pub min_sections: usize,
    pub min_section_length: usize,
    pub require_code_examples: bool,
    pub require_metadata: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationValidationResult {
    pub is_valid: bool,
    pub issues: Vec<String>,
    pub warnings: Vec<String>,
    pub suggestions: Vec<String>,
    pub quality_score: f64,
    pub completeness_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationPreviewOptions {
    pub include_examples: bool,
    pub include_api_reference: bool,
    pub include_setup_guides: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentationPreview {
    pub title: String,
    pub description: String,
    pub section_count: usize,
    pub example_count: usize,
    pub estimated_length: String,
    pub table_of_contents: Vec<String>,
    pub sample_content: String,
}

// Helper functions

fn calculate_quality_score(documentation: &GeneratedDocumentation) -> f64 {
    let mut score = 0.0;
    let mut factors = 0;

    // Title and description
    if !documentation.title.trim().is_empty() {
        score += 10.0;
    }
    factors += 1;

    if !documentation.description.trim().is_empty() {
        score += 10.0;
    }
    factors += 1;

    // Sections
    let section_count = documentation.sections.len() as f64;
    score += (section_count / 7.0) * 30.0; // Normalize to 30 points for 7+ sections
    factors += 1;

    // Code examples
    let example_count: usize = documentation.sections.iter()
        .map(|s| s.code_examples.len())
        .sum();
    score += (example_count as f64 / 10.0) * 25.0; // Normalize to 25 points for 10+ examples
    factors += 1;

    // Content length
    let total_content_length: usize = documentation.sections.iter()
        .map(|s| s.content.len())
        .sum();
    if total_content_length > 5000 {
        score += 25.0;
    } else {
        score += (total_content_length as f64 / 5000.0) * 25.0;
    }
    factors += 1;

    (score / factors as f64).min(100.0)
}

fn calculate_completeness_score(
    documentation: &GeneratedDocumentation,
    rules: &DocumentationValidationRules,
) -> f64 {
    let mut score = 0.0;
    let mut total_checks = 0;

    // Required elements
    if rules.require_title {
        if !documentation.title.trim().is_empty() {
            score += 1.0;
        }
        total_checks += 1;
    }

    if rules.require_description {
        if !documentation.description.trim().is_empty() {
            score += 1.0;
        }
        total_checks += 1;
    }

    if rules.min_sections > 0 {
        if documentation.sections.len() >= rules.min_sections {
            score += 1.0;
        }
        total_checks += 1;
    }

    if rules.require_code_examples {
        let has_examples = documentation.sections.iter()
            .any(|s| !s.code_examples.is_empty());
        if has_examples {
            score += 1.0;
        }
        total_checks += 1;
    }

    if total_checks == 0 {
        100.0
    } else {
        (score / total_checks as f64) * 100.0
    }
}

fn estimate_documentation_length(documentation: &GeneratedDocumentation) -> String {
    let total_content_length: usize = documentation.sections.iter()
        .map(|s| s.content.len())
        .sum();

    let example_length: usize = documentation.sections.iter()
        .flat_map(|s| &s.code_examples)
        .map(|e| e.code.len() + e.description.len())
        .sum();

    let total_length = total_content_length + example_length;

    match total_length {
        0..=2000 => "Short".to_string(),
        2001..=8000 => "Medium".to_string(),
        8001..=20000 => "Long".to_string(),
        _ => "Very Long".to_string(),
    }
}