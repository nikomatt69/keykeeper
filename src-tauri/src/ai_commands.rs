use crate::ai_enhanced_detector::{AIEnhancedDetector, AIProjectAnalysis};
use crate::contextual_suggestions::{
    ContextualSuggestionsEngine, ContextualSuggestions, SmartTemplateMatchingRequest,
    SmartTemplateMatchingResult,
};
use crate::enhanced_api_commands::GenerationSession;
use crate::llm_proxy::LLMResponse;
use crate::llm_wrapper::LLMEngine;
use crate::template_engine::EnhancedTemplateEngine;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// State for AI-enhanced features
pub struct AIState {
    /// AI-enhanced detector instance
    pub detector: Arc<AIEnhancedDetector>,
    /// Contextual suggestions engine
    pub suggestions_engine: Arc<ContextualSuggestionsEngine>,
    /// LLM engine for direct AI processing
    pub llm_engine: Arc<RwLock<Option<LLMEngine>>>,
    /// Template engine for template operations
    pub template_engine: Arc<EnhancedTemplateEngine>,
    /// Cache for project analyses
    pub analysis_cache: Arc<RwLock<HashMap<String, AIProjectAnalysis>>>,
}

impl AIState {
    pub fn new(
        llm_engine: Arc<RwLock<Option<LLMEngine>>>,
        template_engine: Arc<EnhancedTemplateEngine>,
    ) -> Self {
        let detector = Arc::new(AIEnhancedDetector::new(llm_engine.clone()));
        let suggestions_engine = Arc::new(ContextualSuggestionsEngine::new(
            llm_engine.clone(),
            template_engine.clone(),
        ));

        Self {
            detector,
            suggestions_engine,
            llm_engine,
            template_engine,
            analysis_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Request for AI project analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeProjectRequest {
    /// Path to the project directory
    pub project_path: String,
    /// Whether to use cached analysis if available
    pub use_cache: Option<bool>,
    /// Force re-analysis even if cache exists
    pub force_refresh: Option<bool>,
}

/// Response for AI project analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeProjectResponse {
    /// Success status
    pub success: bool,
    /// Analysis results
    pub analysis: Option<AIProjectAnalysis>,
    /// Error message if analysis failed
    pub error: Option<String>,
    /// Whether result came from cache
    pub from_cache: bool,
    /// Analysis duration in milliseconds
    pub duration_ms: u64,
}

/// Request for contextual suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualSuggestionsRequest {
    /// Path to the project directory
    pub project_path: String,
    /// Project analysis to base suggestions on (optional)
    pub project_analysis: Option<AIProjectAnalysis>,
    /// Types of suggestions to include
    pub suggestion_types: Option<Vec<String>>,
    /// Maximum number of suggestions per type
    pub max_suggestions: Option<usize>,
}

/// Response for contextual suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualSuggestionsResponse {
    /// Success status
    pub success: bool,
    /// Contextual suggestions
    pub suggestions: Option<ContextualSuggestions>,
    /// Error message if failed
    pub error: Option<String>,
    /// Generation duration in milliseconds
    pub duration_ms: u64,
}

/// Request for code quality analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityAnalysisRequest {
    /// Path to the project directory
    pub project_path: String,
    /// Specific files to analyze (optional)
    pub target_files: Option<Vec<String>>,
    /// Analysis depth (basic, detailed, comprehensive)
    pub analysis_depth: Option<String>,
}

/// Response for code quality analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityAnalysisResponse {
    /// Success status
    pub success: bool,
    /// Quality analysis results
    pub analysis: Option<Value>,
    /// Error message if failed
    pub error: Option<String>,
    /// Analysis duration in milliseconds
    pub duration_ms: u64,
}

/// Request for contextual documentation generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualDocumentationRequest {
    /// Path to the project directory
    pub project_path: String,
    /// Type of documentation to generate
    pub doc_type: String,
    /// Target files or modules
    pub target: Option<String>,
    /// Documentation style/format
    pub style: Option<String>,
    /// Include code examples
    pub include_examples: Option<bool>,
}

/// Response for contextual documentation generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualDocumentationResponse {
    /// Success status
    pub success: bool,
    /// Generated documentation
    pub documentation: Option<String>,
    /// Documentation metadata
    pub metadata: Option<HashMap<String, Value>>,
    /// Error message if failed
    pub error: Option<String>,
    /// Generation duration in milliseconds
    pub duration_ms: u64,
}

/// Analyze project with AI-enhanced detection
#[tauri::command]
pub async fn analyze_project_with_ai(
    app_handle: AppHandle,
    request: AnalyzeProjectRequest,
) -> Result<AnalyzeProjectResponse, String> {
    let start_time = std::time::Instant::now();
    info!("Starting AI project analysis for: {}", request.project_path);

    let ai_state = app_handle.state::<AIState>();
    let use_cache = request.use_cache.unwrap_or(true);
    let force_refresh = request.force_refresh.unwrap_or(false);

    // Check cache first if enabled
    if use_cache && !force_refresh {
        let cache = ai_state.analysis_cache.read().await;
        if let Some(cached_analysis) = cache.get(&request.project_path) {
            info!("Returning cached analysis for: {}", request.project_path);
            return Ok(AnalyzeProjectResponse {
                success: true,
                analysis: Some(cached_analysis.clone()),
                error: None,
                from_cache: true,
                duration_ms: start_time.elapsed().as_millis() as u64,
            });
        }
    }

    // Perform AI analysis
    match ai_state.detector.analyze_project_with_ai(&request.project_path).await {
        Ok(analysis) => {
            // Cache the result
            let mut cache = ai_state.analysis_cache.write().await;
            cache.insert(request.project_path.clone(), analysis.clone());
            
            info!("AI project analysis completed successfully for: {}", request.project_path);
            Ok(AnalyzeProjectResponse {
                success: true,
                analysis: Some(analysis),
                error: None,
                from_cache: false,
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
        Err(e) => {
            error!("AI project analysis failed: {}", e);
            Ok(AnalyzeProjectResponse {
                success: false,
                analysis: None,
                error: Some(e.to_string()),
                from_cache: false,
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
    }
}

/// Get contextual suggestions for a project
#[tauri::command]
pub async fn get_contextual_suggestions(
    app_handle: AppHandle,
    request: ContextualSuggestionsRequest,
) -> Result<ContextualSuggestionsResponse, String> {
    let start_time = std::time::Instant::now();
    info!("Generating contextual suggestions for: {}", request.project_path);

    let ai_state = app_handle.state::<AIState>();

    // Get or use provided project analysis
    let project_analysis = if let Some(analysis) = request.project_analysis {
        analysis
    } else {
        // Try to get from cache or perform analysis
        let cache = ai_state.analysis_cache.read().await;
        if let Some(cached_analysis) = cache.get(&request.project_path) {
            cached_analysis.clone()
        } else {
            // Need to perform analysis first
            match ai_state.detector.analyze_project_with_ai(&request.project_path).await {
                Ok(analysis) => {
                    // Cache the result
                    drop(cache);
                    let mut cache = ai_state.analysis_cache.write().await;
                    cache.insert(request.project_path.clone(), analysis.clone());
                    analysis
                }
                Err(e) => {
                    error!("Failed to analyze project for suggestions: {}", e);
                    return Ok(ContextualSuggestionsResponse {
                        success: false,
                        suggestions: None,
                        error: Some(format!("Failed to analyze project: {}", e)),
                        duration_ms: start_time.elapsed().as_millis() as u64,
                    });
                }
            }
        }
    };

    // Generate suggestions
    match ai_state.suggestions_engine.get_contextual_suggestions(
        &request.project_path,
        &project_analysis,
    ).await {
        Ok(mut suggestions) => {
            // Filter suggestions by type if specified
            if let Some(types) = &request.suggestion_types {
                suggestions = filter_suggestions_by_type(suggestions, types);
            }

            // Limit suggestions if specified
            if let Some(max) = request.max_suggestions {
                suggestions = limit_suggestions(suggestions, max);
            }

            info!("Contextual suggestions generated successfully for: {}", request.project_path);
            Ok(ContextualSuggestionsResponse {
                success: true,
                suggestions: Some(suggestions),
                error: None,
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
        Err(e) => {
            error!("Failed to generate contextual suggestions: {}", e);
            Ok(ContextualSuggestionsResponse {
                success: false,
                suggestions: None,
                error: Some(e.to_string()),
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
    }
}

/// Get smart template recommendations
#[tauri::command]
pub async fn get_smart_template_recommendations(
    app_handle: AppHandle,
    request: SmartTemplateMatchingRequest,
) -> Result<SmartTemplateMatchingResult, String> {
    info!("Getting smart template recommendations for: {}", request.project_path);

    let ai_state = app_handle.state::<AIState>();

    match ai_state.suggestions_engine.get_smart_template_recommendations(&request).await {
        Ok(result) => {
            info!("Smart template recommendations generated successfully");
            Ok(result)
        }
        Err(e) => {
            error!("Failed to generate smart template recommendations: {}", e);
            Err(e.to_string())
        }
    }
}

/// Analyze code quality with AI
#[tauri::command]
pub async fn analyze_code_quality_with_ai(
    app_handle: AppHandle,
    request: CodeQualityAnalysisRequest,
) -> Result<CodeQualityAnalysisResponse, String> {
    let start_time = std::time::Instant::now();
    info!("Analyzing code quality for: {}", request.project_path);

    let ai_state = app_handle.state::<AIState>();

    // First get project analysis
    let project_analysis = match ai_state.detector.analyze_project_with_ai(&request.project_path).await {
        Ok(analysis) => analysis,
        Err(e) => {
            error!("Failed to analyze project for code quality: {}", e);
            return Ok(CodeQualityAnalysisResponse {
                success: false,
                analysis: None,
                error: Some(format!("Failed to analyze project: {}", e)),
                duration_ms: start_time.elapsed().as_millis() as u64,
            });
        }
    };

    // Extract code quality information
    let quality_analysis = serde_json::to_value(&project_analysis.code_quality)
        .map_err(|e| format!("Failed to serialize quality analysis: {}", e))?;

    info!("Code quality analysis completed for: {}", request.project_path);
    Ok(CodeQualityAnalysisResponse {
        success: true,
        analysis: Some(quality_analysis),
        error: None,
        duration_ms: start_time.elapsed().as_millis() as u64,
    })
}

/// Generate contextual documentation
#[tauri::command]
pub async fn generate_contextual_documentation(
    app_handle: AppHandle,
    request: ContextualDocumentationRequest,
) -> Result<ContextualDocumentationResponse, String> {
    let start_time = std::time::Instant::now();
    info!("Generating contextual documentation for: {} (type: {})", 
          request.project_path, request.doc_type);

    let ai_state = app_handle.state::<AIState>();

    // Check if LLM is available
    let llm_available = {
        let llm_guard = ai_state.llm_engine.read().await;
        llm_guard.is_some()
    };
    
    if !llm_available {
        return Ok(ContextualDocumentationResponse {
            success: false,
            documentation: None,
            metadata: None,
            error: Some("LLM not available for documentation generation".to_string()),
            duration_ms: start_time.elapsed().as_millis() as u64,
        });
    }

    // Get project analysis for context
    let project_analysis = match ai_state.detector.analyze_project_with_ai(&request.project_path).await {
        Ok(analysis) => analysis,
        Err(e) => {
            warn!("Could not get full project analysis, using basic approach: {}", e);
            // Continue with basic documentation generation
            return generate_basic_documentation(&request, start_time).await;
        }
    };

    // Build documentation prompt
    let prompt = build_documentation_prompt(&request, &project_analysis).await
        .map_err(|e| format!("Failed to build documentation prompt: {}", e))?;

    // Generate documentation using LLM
    let response_result = {
        let llm_guard = ai_state.llm_engine.read().await;
        if let Some(llm) = llm_guard.as_ref() {
            llm.generate_text(&prompt).await
        } else {
            Err(anyhow::anyhow!("LLM not available"))
        }
    };
    
    match response_result {
        Ok(response_text) => {
            let documentation = extract_documentation_from_response(&response_text)
                .unwrap_or_else(|| response_text.clone());

            let metadata = create_documentation_metadata(&request, &project_analysis);

            info!("Contextual documentation generated successfully");
            Ok(ContextualDocumentationResponse {
                success: true,
                documentation: Some(documentation),
                metadata: Some(metadata),
                error: None,
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
        Err(e) => {
            error!("Failed to generate documentation with LLM: {}", e);
            Ok(ContextualDocumentationResponse {
                success: false,
                documentation: None,
                metadata: None,
                error: Some(e.to_string()),
                duration_ms: start_time.elapsed().as_millis() as u64,
            })
        }
    }
}

/// Check if AI features are available
#[tauri::command]
pub async fn check_ai_features_status(app_handle: AppHandle) -> Result<HashMap<String, bool>, String> {
    let ai_state = app_handle.state::<AIState>();
    let llm_guard = ai_state.llm_engine.read().await;
    
    let mut status = HashMap::new();
    status.insert("llm_available".to_string(), llm_guard.is_some());
    status.insert("ai_detection_available".to_string(), true);
    status.insert("contextual_suggestions_available".to_string(), true);
    status.insert("smart_templates_available".to_string(), true);
    status.insert("code_quality_analysis_available".to_string(), llm_guard.is_some());
    status.insert("documentation_generation_available".to_string(), llm_guard.is_some());
    
    Ok(status)
}

/// Clear AI analysis cache
#[tauri::command]
pub async fn clear_ai_analysis_cache(app_handle: AppHandle) -> Result<bool, String> {
    let ai_state = app_handle.state::<AIState>();
    let mut cache = ai_state.analysis_cache.write().await;
    let cache_size = cache.len();
    cache.clear();
    
    info!("Cleared AI analysis cache ({} entries)", cache_size);
    Ok(true)
}

/// Get AI analysis cache statistics
#[tauri::command]
pub async fn get_ai_cache_stats(app_handle: AppHandle) -> Result<HashMap<String, Value>, String> {
    let ai_state = app_handle.state::<AIState>();
    let cache = ai_state.analysis_cache.read().await;
    
    let mut stats = HashMap::new();
    stats.insert("cache_size".to_string(), Value::Number(cache.len().into()));
    stats.insert("cached_projects".to_string(), 
                 Value::Array(cache.keys().map(|k| Value::String(k.clone())).collect()));
    
    Ok(stats)
}

// Helper functions

/// Filter suggestions by type
fn filter_suggestions_by_type(
    mut suggestions: ContextualSuggestions, 
    types: &[String]
) -> ContextualSuggestions {
    if !types.contains(&"templates".to_string()) {
        suggestions.template_recommendations.clear();
    }
    if !types.contains(&"code_improvements".to_string()) {
        suggestions.code_improvements.clear();
    }
    if !types.contains(&"documentation".to_string()) {
        suggestions.documentation_suggestions.clear();
    }
    if !types.contains(&"security".to_string()) {
        suggestions.security_recommendations.clear();
    }
    if !types.contains(&"performance".to_string()) {
        suggestions.performance_suggestions.clear();
    }
    if !types.contains(&"testing".to_string()) {
        suggestions.testing_suggestions.clear();
    }
    if !types.contains(&"architecture".to_string()) {
        suggestions.architecture_recommendations.clear();
    }
    
    suggestions
}

/// Limit the number of suggestions
fn limit_suggestions(mut suggestions: ContextualSuggestions, max: usize) -> ContextualSuggestions {
    suggestions.template_recommendations.truncate(max);
    suggestions.code_improvements.truncate(max);
    suggestions.documentation_suggestions.truncate(max);
    suggestions.security_recommendations.truncate(max);
    suggestions.performance_suggestions.truncate(max);
    suggestions.testing_suggestions.truncate(max);
    suggestions.architecture_recommendations.truncate(max);
    
    suggestions
}

/// Build documentation generation prompt
async fn build_documentation_prompt(
    request: &ContextualDocumentationRequest,
    project_analysis: &AIProjectAnalysis,
) -> Result<String> {
    let mut prompt = String::new();
    
    prompt.push_str("You are an expert technical writer. Generate comprehensive documentation based on the project analysis.\n\n");
    
    // Project context
    prompt.push_str("## PROJECT CONTEXT\n");
    for framework in &project_analysis.frameworks {
        prompt.push_str(&format!("- Framework: {} (confidence: {:.2})\n", 
                               framework.name, framework.hybrid_confidence));
    }
    
    // Documentation request
    prompt.push_str(&format!("\n## DOCUMENTATION REQUEST\n"));
    prompt.push_str(&format!("Type: {}\n", request.doc_type));
    if let Some(target) = &request.target {
        prompt.push_str(&format!("Target: {}\n", target));
    }
    if let Some(style) = &request.style {
        prompt.push_str(&format!("Style: {}\n", style));
    }
    
    // Quality context
    prompt.push_str("\n## CODE QUALITY CONTEXT\n");
    let quality = &project_analysis.code_quality;
    prompt.push_str(&format!("Overall Score: {:.2}\n", quality.overall_score));
    prompt.push_str(&format!("Documentation Score: {:.2}\n", quality.documentation));
    
    // Request specific documentation
    prompt.push_str("\n## GENERATION REQUEST\n");
    match request.doc_type.as_str() {
        "README" => {
            prompt.push_str("Generate a comprehensive README.md file that includes:\n");
            prompt.push_str("- Project overview and purpose\n");
            prompt.push_str("- Installation instructions\n");
            prompt.push_str("- Usage examples\n");
            prompt.push_str("- API documentation (if applicable)\n");
            prompt.push_str("- Contributing guidelines\n");
            prompt.push_str("- License information\n");
        }
        "API" => {
            prompt.push_str("Generate API documentation that includes:\n");
            prompt.push_str("- Endpoint descriptions\n");
            prompt.push_str("- Request/response examples\n");
            prompt.push_str("- Authentication requirements\n");
            prompt.push_str("- Error handling\n");
        }
        "comments" => {
            prompt.push_str("Generate inline code comments and documentation strings for:\n");
            prompt.push_str("- Function descriptions\n");
            prompt.push_str("- Parameter explanations\n");
            prompt.push_str("- Return value descriptions\n");
            prompt.push_str("- Usage examples\n");
        }
        _ => {
            prompt.push_str(&format!("Generate {} documentation appropriate for this project.\n", request.doc_type));
        }
    }
    
    if request.include_examples.unwrap_or(false) {
        prompt.push_str("\nInclude practical code examples and usage scenarios.\n");
    }
    
    prompt.push_str("\nProvide clear, well-structured documentation in Markdown format.\n");
    
    Ok(prompt)
}

/// Extract documentation from LLM response
fn extract_documentation_from_response(content: &str) -> Option<String> {
    // Look for markdown block
    if let Some(start) = content.find("```markdown") {
        if let Some(end) = content[start..].find("```") {
            let doc_start = start + 11; // Skip "```markdown"
            let doc_end = start + end;
            return Some(content[doc_start..doc_end].trim().to_string());
        }
    }
    
    // Look for any content after "documentation:" or similar
    if let Some(start) = content.find("# ") {
        return Some(content[start..].trim().to_string());
    }
    
    None
}

/// Create documentation metadata
fn create_documentation_metadata(
    request: &ContextualDocumentationRequest,
    project_analysis: &AIProjectAnalysis,
) -> HashMap<String, Value> {
    let mut metadata = HashMap::new();
    
    metadata.insert("doc_type".to_string(), Value::String(request.doc_type.clone()));
    metadata.insert("generated_at".to_string(), 
                   Value::String(chrono::Utc::now().to_rfc3339()));
    metadata.insert("project_frameworks".to_string(),
                   Value::Array(project_analysis.frameworks.iter()
                       .map(|f| Value::String(f.framework.clone()))
                       .collect()));
    metadata.insert("quality_score".to_string(),
                   Value::Number(serde_json::Number::from_f64(project_analysis.code_quality.overall_score)
                       .unwrap_or_else(|| serde_json::Number::from(0))));
    
    metadata
}

/// Generate basic documentation when AI is not available
async fn generate_basic_documentation(
    request: &ContextualDocumentationRequest,
    start_time: std::time::Instant,
) -> Result<ContextualDocumentationResponse, String> {
    let basic_doc = match request.doc_type.as_str() {
        "README" => generate_basic_readme(&request.project_path),
        "API" => "# API Documentation\n\nPlease refer to the source code for API details.".to_string(),
        _ => format!("# {} Documentation\n\nDocumentation content would be generated here.", request.doc_type),
    };
    
    Ok(ContextualDocumentationResponse {
        success: true,
        documentation: Some(basic_doc),
        metadata: Some(HashMap::new()),
        error: None,
        duration_ms: start_time.elapsed().as_millis() as u64,
    })
}

/// Generate basic README content
fn generate_basic_readme(project_path: &str) -> String {
    let project_name = std::path::Path::new(project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Project");
    
    format!(
        "# {}\n\n## Overview\n\nThis is a {} project.\n\n## Installation\n\n```bash\n# Add installation instructions here\n```\n\n## Usage\n\n```bash\n# Add usage examples here\n```\n\n## Contributing\n\nContributions are welcome! Please read the contributing guidelines before submitting a pull request.\n\n## License\n\nThis project is licensed under the MIT License - see the LICENSE file for details.\n",
        project_name, project_name
    )
}