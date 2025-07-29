use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Enhanced template file structure supporting multi-file generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateFile {
    /// Unique identifier for the template file
    pub id: String,
    /// Display name for the file
    pub name: String,
    /// Description of what this file does
    pub description: String,
    /// File type (typescript, javascript, json, yaml, etc.)
    pub file_type: String,
    /// Target file path relative to project root
    pub file_path: String,
    /// Template content with variable substitution
    pub template_content: String,
    /// Programming language for syntax highlighting
    pub language: String,
    /// Whether this file is required for the provider to work
    pub is_required: bool,
    /// Files that this template depends on
    pub dependencies: Vec<String>,
    /// Framework-specific variants of this template
    pub framework_variants: HashMap<String, String>,
    /// Conditional logic for when this file should be included
    pub conditions: Vec<String>,
    /// Category of the file (config, client, server, middleware, etc.)
    pub category: String,
    /// Priority for ordering files during generation
    pub priority: i32,
}

/// Framework compatibility information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkCompatibility {
    /// Framework identifier (nextjs, react, vue, express, etc.)
    pub framework: String,
    /// Compatibility level (full, partial, minimal, unsupported)
    pub compatibility_level: String,
    /// Confidence score for framework detection (0.0 to 1.0)
    pub confidence: f64,
    /// Framework-specific configuration options
    pub config_overrides: HashMap<String, serde_json::Value>,
    /// Additional dependencies needed for this framework
    pub additional_dependencies: Vec<String>,
    /// Setup instructions specific to this framework
    pub setup_instructions: Vec<String>,
    /// Known limitations or issues with this framework
    pub limitations: Vec<String>,
}

/// Context for template generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationContext {
    /// Target framework being used
    pub framework: String,
    /// Environment variables available
    pub env_vars: HashMap<String, String>,
    /// Features requested by user
    pub requested_features: Vec<String>,
    /// Output directory path
    pub output_path: String,
    /// Project-specific settings
    pub project_settings: HashMap<String, serde_json::Value>,
    /// User preferences for code generation
    pub user_preferences: UserPreferences,
    /// Existing files in the project (to avoid conflicts)
    pub existing_files: Vec<String>,
    /// Package.json content if available
    pub package_json: Option<serde_json::Value>,
    /// TypeScript configuration if available
    pub tsconfig: Option<serde_json::Value>,
}

/// User preferences for code generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    /// Preferred code style (typescript, javascript)
    pub code_style: String,
    /// Whether to use semicolons
    pub use_semicolons: bool,
    /// Indentation preference (spaces, tabs)
    pub indentation: String,
    /// Number of spaces for indentation
    pub indent_size: u8,
    /// Whether to generate TypeScript types
    pub generate_types: bool,
    /// Whether to include JSDoc comments
    pub include_jsdoc: bool,
    /// Preferred import style (default, named, namespace)
    pub import_style: String,
    /// Whether to use async/await or promises
    pub use_async_await: bool,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            code_style: "typescript".to_string(),
            use_semicolons: true,
            indentation: "spaces".to_string(),
            indent_size: 2,
            generate_types: true,
            include_jsdoc: true,
            import_style: "named".to_string(),
            use_async_await: true,
        }
    }
}

/// Enhanced configuration template with multi-file support
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnhancedConfigTemplate {
    /// Base template information
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: Option<String>,
    
    /// Provider information
    pub provider_id: String,
    pub provider_name: String,
    pub provider_category: String,
    
    /// Template files that make up this configuration
    pub template_files: Vec<TemplateFile>,
    
    /// Framework compatibility matrix
    pub framework_compatibility: Vec<FrameworkCompatibility>,
    
    /// Environment variables
    pub required_env_vars: Vec<String>,
    pub optional_env_vars: Vec<String>,
    pub env_var_descriptions: HashMap<String, String>,
    
    /// Dependencies
    pub dependencies: Vec<String>,
    pub dev_dependencies: Vec<String>,
    pub peer_dependencies: Vec<String>,
    
    /// Template inheritance
    pub extends: Option<String>,
    pub overrides: HashMap<String, serde_json::Value>,
    
    /// Features and variants
    pub supported_features: Vec<String>,
    pub feature_combinations: HashMap<String, Vec<String>>,
    
    /// Setup and usage information
    pub setup_instructions: Vec<String>,
    pub usage_examples: Vec<CodeExample>,
    pub next_steps: Vec<String>,
    
    /// Metadata
    pub tags: Vec<String>,
    pub difficulty_level: String, // beginner, intermediate, advanced
    pub estimated_setup_time: String, // "5 minutes", "30 minutes", etc.
    pub documentation_links: Vec<DocumentationLink>,
    
    /// Validation rules
    pub validation_rules: Vec<ValidationRule>,
    
    /// AI-enhanced features
    pub llm_context: Option<LLMContext>,
}

/// Code example for template usage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeExample {
    pub title: String,
    pub description: String,
    pub language: String,
    pub code: String,
    pub filename: Option<String>,
    pub category: String,
}

/// Documentation link
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationLink {
    pub title: String,
    pub url: String,
    pub description: String,
    pub link_type: String, // "official", "tutorial", "example", "reference"
}

/// Validation rule for template generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationRule {
    pub rule_type: String, // "env_var", "file_exists", "dependency", "framework"
    pub condition: String,
    pub error_message: String,
    pub warning_message: Option<String>,
    pub auto_fix: Option<String>,
}

/// LLM context for AI-enhanced generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMContext {
    /// System prompt for the LLM
    pub system_prompt: String,
    /// Context about the provider and its usage
    pub provider_context: String,
    /// Best practices and recommendations
    pub best_practices: Vec<String>,
    /// Common pitfalls to avoid
    pub common_pitfalls: Vec<String>,
    /// Security considerations
    pub security_notes: Vec<String>,
}

/// Request for enhanced template generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnhancedGenerationRequest {
    /// Provider identifier
    pub provider_id: String,
    /// Template ID to use (optional, will auto-select if not provided)
    pub template_id: Option<String>,
    /// Generation context
    pub context: GenerationContext,
    /// Features to enable
    pub features: Vec<String>,
    /// Whether to use LLM enhancement
    pub use_llm_enhancement: bool,
    /// Custom template overrides
    pub template_overrides: HashMap<String, String>,
    /// Whether to generate only a preview
    pub preview_only: bool,
}

/// Result of enhanced template generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnhancedGenerationResult {
    /// Generated files
    pub files: Vec<GeneratedTemplateFile>,
    /// Dependencies to install
    pub dependencies: Vec<String>,
    pub dev_dependencies: Vec<String>,
    /// Setup instructions
    pub setup_instructions: Vec<String>,
    /// Next steps for the user
    pub next_steps: Vec<String>,
    /// Validation results
    pub validation_results: Vec<ValidationResult>,
    /// Warnings and recommendations
    pub warnings: Vec<String>,
    pub recommendations: Vec<String>,
    /// Template metadata
    pub template_info: TemplateInfo,
}

/// Generated template file with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedTemplateFile {
    /// File path relative to project root
    pub path: String,
    /// Generated content
    pub content: String,
    /// File type for proper handling
    pub file_type: String,
    /// Programming language
    pub language: String,
    /// Whether the file already exists (for conflict resolution)
    pub exists: bool,
    /// Category of the file
    pub category: String,
    /// Whether this file is required
    pub is_required: bool,
    /// File size in bytes
    pub size: usize,
    /// Checksum for change detection
    pub checksum: String,
    /// Creation context
    pub created_by_template: String,
    pub created_at: String,
}

/// Validation result for a generated template
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    /// Validation rule that was checked
    pub rule_id: String,
    /// Whether validation passed
    pub passed: bool,
    /// Error message if validation failed
    pub error_message: Option<String>,
    /// Warning message
    pub warning_message: Option<String>,
    /// Suggested fix
    pub suggested_fix: Option<String>,
    /// Severity level
    pub severity: String, // "error", "warning", "info"
}

/// Template information and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    /// Template that was used
    pub template_id: String,
    pub template_name: String,
    pub template_version: String,
    /// Provider information
    pub provider_id: String,
    pub provider_name: String,
    /// Framework compatibility
    pub framework: String,
    pub compatibility_level: String,
    /// Features that were enabled
    pub enabled_features: Vec<String>,
    /// Generation timestamp
    pub generated_at: String,
    /// LLM enhancement used
    pub llm_enhanced: bool,
}

/// Progress update for streaming generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProgress {
    /// Current step being performed
    pub current_step: String,
    /// Progress percentage (0-100)
    pub progress: u8,
    /// Total number of steps
    pub total_steps: u8,
    /// Current step number
    pub current_step_number: u8,
    /// Detailed status message
    pub status_message: String,
    /// Whether an error occurred
    pub has_error: bool,
    /// Error message if any
    pub error_message: Option<String>,
    /// Estimated time remaining in seconds
    pub eta_seconds: Option<u32>,
}

/// Framework detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkDetectionResult {
    /// Detected framework
    pub framework: String,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f64,
    /// Evidence that led to this detection
    pub evidence: Vec<DetectionEvidence>,
    /// Framework version if detected
    pub version: Option<String>,
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Evidence for framework detection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionEvidence {
    /// Type of evidence (file, dependency, pattern, etc.)
    pub evidence_type: String,
    /// What was found
    pub value: String,
    /// Confidence contribution of this evidence
    pub confidence_weight: f64,
    /// Source location of the evidence
    pub source: String,
}

/// Template validation and combination result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateValidationResult {
    /// Whether the template combination is valid
    pub is_valid: bool,
    /// Validation errors
    pub errors: Vec<String>,
    /// Validation warnings
    pub warnings: Vec<String>,
    /// Suggestions for fixing issues
    pub suggestions: Vec<String>,
    /// Compatible frameworks
    pub compatible_frameworks: Vec<String>,
    /// Missing requirements
    pub missing_requirements: Vec<String>,
}

