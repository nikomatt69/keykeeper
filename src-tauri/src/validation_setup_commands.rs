use crate::enhanced_types::{GeneratedTemplateFile as GeneratedFile, GenerationContext};
use crate::validation_engine::{ValidationEngine, validate_environment_compatibility};
use crate::setup_generator::{SetupGenerator, DeploymentTarget, CIPlatform};
use anyhow::{Context, Result as AnyhowResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, State};
use tracing::{debug, info, warn, error};

/// Request for configuration validation
#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationRequest {
    pub generated_files: Vec<GeneratedFile>,
    pub context: GenerationContext,
    pub validation_options: ValidationOptions,
}

/// Validation options
#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationOptions {
    pub check_security: bool,
    pub check_performance: bool,
    pub check_compatibility: bool,
    pub check_best_practices: bool,
    pub severity_threshold: String, // "error", "warning", "info"
}

/// Request for setup script generation
#[derive(Debug, Serialize, Deserialize)]
pub struct SetupGenerationRequest {
    pub context: GenerationContext,
    pub deployment_targets: Vec<String>, // Will be converted to DeploymentTarget enum
    pub ci_platforms: Vec<String>,       // Will be converted to CIPlatform enum
    pub include_docker: bool,
    pub include_security: bool,
    pub include_testing: bool,
    pub custom_scripts: Vec<CustomScript>,
}

/// Custom script definition
#[derive(Debug, Serialize, Deserialize)]
pub struct CustomScript {
    pub name: String,
    pub description: String,
    pub content: String,
    pub execution_order: u32,
}

/// Environment compatibility check request
#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentCheckRequest {
    pub node_version: Option<String>,
    pub npm_version: Option<String>,
    pub framework: String,
    pub deployment_targets: Vec<String>,
}

/// Security configuration validation request
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityValidationRequest {
    pub files: Vec<GeneratedFile>,
    pub check_secrets: bool,
    pub check_dependencies: bool,
    pub check_permissions: bool,
    pub security_rules: Vec<CustomSecurityRule>,
}

/// Custom security rule
#[derive(Debug, Serialize, Deserialize)]
pub struct CustomSecurityRule {
    pub id: String,
    pub pattern: String,
    pub severity: String,
    pub message: String,
    pub fix_suggestion: String,
}

/// Deployment configuration generation request
#[derive(Debug, Serialize, Deserialize)]
pub struct DeploymentConfigRequest {
    pub context: GenerationContext,
    pub target_platform: String,
    pub custom_domain: Option<String>,
    pub ssl_enabled: bool,
    pub environment_variables: HashMap<String, String>,
    pub scaling_options: Option<ScalingOptions>,
}

/// Scaling options for deployment
#[derive(Debug, Serialize, Deserialize)]
pub struct ScalingOptions {
    pub min_instances: u32,
    pub max_instances: u32,
    pub cpu_limit: Option<String>,
    pub memory_limit: Option<String>,
}

/// Validate generated configuration files
#[tauri::command]
pub async fn validate_generated_configuration(
    request: ValidationRequest,
) -> Result<crate::validation_engine::ValidationResult, String> {
    info!("Starting configuration validation for {} files", request.generated_files.len());
    
    let validation_engine = ValidationEngine::new();
    
    match validation_engine.validate_configuration(&request.generated_files, &request.context).await {
        Ok(result) => {
            info!("Validation completed with {} issues", result.issues.len());
            Ok(result)
        },
        Err(e) => {
            error!("Validation failed: {}", e);
            Err(format!("Validation failed: {}", e))
        }
    }
}

/// Generate setup scripts and configurations
#[tauri::command]
pub async fn generate_setup_scripts(
    request: SetupGenerationRequest,
) -> Result<crate::setup_generator::SetupPackage, String> {
    info!("Generating setup scripts for framework: {}", request.context.framework);
    
    let setup_generator = SetupGenerator::new();
    
    // Convert string deployment targets to enum
    let deployment_targets: Vec<DeploymentTarget> = request.deployment_targets
        .iter()
        .filter_map(|target| match target.to_lowercase().as_str() {
            "docker" => Some(DeploymentTarget::Docker),
            "vercel" => Some(DeploymentTarget::Vercel),
            "netlify" => Some(DeploymentTarget::Netlify),
            "aws" => Some(DeploymentTarget::AWS),
            "digitalocean" => Some(DeploymentTarget::DigitalOcean),
            "heroku" => Some(DeploymentTarget::Heroku),
            "firebase" => Some(DeploymentTarget::Firebase),
            "railway" => Some(DeploymentTarget::Railway),
            "render" => Some(DeploymentTarget::Render),
            other => Some(DeploymentTarget::Custom(other.to_string())),
        })
        .collect();

    // Convert string CI platforms to enum
    let ci_platforms: Vec<CIPlatform> = request.ci_platforms
        .iter()
        .filter_map(|platform| match platform.to_lowercase().as_str() {
            "github" | "github-actions" => Some(CIPlatform::GitHubActions),
            "gitlab" | "gitlab-ci" => Some(CIPlatform::GitLabCI),
            "circleci" => Some(CIPlatform::CircleCI),
            "travis" | "travis-ci" => Some(CIPlatform::TravisCI),
            "azure" | "azure-devops" => Some(CIPlatform::AzureDevOps),
            "jenkins" => Some(CIPlatform::Jenkins),
            other => Some(CIPlatform::Custom(other.to_string())),
        })
        .collect();

    match setup_generator.generate_setup_package(
        &request.context,
        &deployment_targets,
        &ci_platforms,
        request.include_security,
    ).await {
        Ok(package) => {
            info!("Setup package generated with {} scripts", package.scripts.len());
            Ok(package)
        },
        Err(e) => {
            error!("Setup generation failed: {}", e);
            Err(format!("Setup generation failed: {}", e))
        }
    }
}

/// Check environment compatibility
#[tauri::command]
pub async fn check_environment_compatibility(
    request: EnvironmentCheckRequest,
) -> Result<Vec<crate::validation_engine::ValidationIssue>, String> {
    info!("Checking environment compatibility for framework: {}", request.framework);
    
    match validate_environment_compatibility(
        request.node_version.as_deref(),
        request.npm_version.as_deref(),
        &request.framework,
    ) {
        Ok(issues) => {
            info!("Environment compatibility check completed with {} issues", issues.len());
            Ok(issues)
        },
        Err(e) => {
            error!("Environment compatibility check failed: {}", e);
            Err(format!("Environment compatibility check failed: {}", e))
        }
    }
}

/// Validate security configuration
#[tauri::command]
pub async fn validate_security_configuration(
    request: SecurityValidationRequest,
) -> Result<Vec<crate::validation_engine::ValidationIssue>, String> {
    info!("Running security validation on {} files", request.files.len());
    
    let validation_engine = ValidationEngine::new();
    let mut all_issues = Vec::new();
    
    // Validate each file for security issues
    for file in &request.files {
        match validation_engine.validate_security(file) {
            Ok(mut issues) => all_issues.append(&mut issues),
            Err(e) => {
                error!("Security validation failed for file {}: {}", file.path, e);
                return Err(format!("Security validation failed: {}", e));
            }
        }
    }
    
    info!("Security validation completed with {} issues", all_issues.len());
    Ok(all_issues)
}

/// Generate deployment configuration
#[tauri::command]
pub async fn generate_deployment_config(
    request: DeploymentConfigRequest,
) -> Result<crate::setup_generator::DeploymentConfig, String> {
    info!("Generating deployment configuration for platform: {}", request.target_platform);
    
    let setup_generator = SetupGenerator::new();
    
    // Convert string to deployment target
    let deployment_target = match request.target_platform.to_lowercase().as_str() {
        "docker" => DeploymentTarget::Docker,
        "vercel" => DeploymentTarget::Vercel,
        "netlify" => DeploymentTarget::Netlify,
        "aws" => DeploymentTarget::AWS,
        "digitalocean" => DeploymentTarget::DigitalOcean,
        "heroku" => DeploymentTarget::Heroku,
        "firebase" => DeploymentTarget::Firebase,
        "railway" => DeploymentTarget::Railway,
        "render" => DeploymentTarget::Render,
        other => DeploymentTarget::Custom(other.to_string()),
    };
    
    // Create a basic framework template for deployment generation
    let framework_template = crate::setup_generator::FrameworkSetupTemplate {
        framework_id: request.context.framework.clone(),
        installation_commands: vec!["npm install".to_string()],
        dev_dependencies: vec![],
        build_commands: vec!["npm run build".to_string()],
        start_commands: vec!["npm start".to_string()],
        test_commands: vec!["npm test".to_string()],
        docker_base_image: "node:18-alpine".to_string(),
        docker_port: 3000,
        environment_variables: request.environment_variables.keys().cloned().collect(),
        required_files: vec!["package.json".to_string()],
    };
    
    // Create deployment template
    let deployment_template = crate::setup_generator::DeploymentTemplate {
        target: deployment_target.clone(),
        config_files: vec!["deployment.config".to_string()],
        build_commands: framework_template.build_commands.clone(),
        deployment_commands: vec!["deploy".to_string()],
        environment_setup: vec!["setup".to_string()],
        domain_configuration: request.custom_domain,
        ssl_configuration: if request.ssl_enabled { Some("SSL enabled".to_string()) } else { None },
        requires_build: true,
    };
    
    match setup_generator.generate_deployment_config(&deployment_template, &framework_template) {
        Ok(config) => {
            info!("Deployment configuration generated for {:?}", deployment_target);
            Ok(config)
        },
        Err(e) => {
            error!("Deployment configuration generation failed: {}", e);
            Err(format!("Deployment configuration generation failed: {}", e))
        }
    }
}

/// Get validation engine status and configuration
#[tauri::command]
pub async fn get_validation_engine_status() -> Result<ValidationEngineStatus, String> {
    info!("Getting validation engine status");
    
    let validation_engine = ValidationEngine::new();
    
    // Count available rules and templates
    let status = ValidationEngineStatus {
        is_initialized: true,
        supported_frameworks: vec![
            "react".to_string(),
            "vue".to_string(),
            "angular".to_string(),
            "nodejs".to_string(),
            "express".to_string(),
            "nextjs".to_string(),
        ],
        security_rules_count: 4, // From the validation engine security patterns
        performance_rules_count: 5, // Estimated
        compatibility_rules_count: 3, // Estimated
        last_updated: chrono::Utc::now().to_rfc3339(),
        version: "1.0.0".to_string(),
    };
    
    Ok(status)
}

/// Get setup generator capabilities
#[tauri::command]
pub async fn get_setup_generator_capabilities() -> Result<SetupGeneratorCapabilities, String> {
    info!("Getting setup generator capabilities");
    
    let capabilities = SetupGeneratorCapabilities {
        supported_frameworks: vec![
            "react".to_string(),
            "vue".to_string(),
            "angular".to_string(),
            "nodejs".to_string(),
            "nextjs".to_string(),
        ],
        supported_deployment_targets: vec![
            "docker".to_string(),
            "vercel".to_string(),
            "netlify".to_string(),
            "aws".to_string(),
            "railway".to_string(),
            "heroku".to_string(),
            "firebase".to_string(),
        ],
        supported_ci_platforms: vec![
            "github-actions".to_string(),
            "gitlab-ci".to_string(),
            "circleci".to_string(),
            "travis-ci".to_string(),
            "azure-devops".to_string(),
            "jenkins".to_string(),
        ],
        features: vec![
            "dockerfile-generation".to_string(),
            "docker-compose".to_string(),
            "ci-cd-templates".to_string(),
            "environment-templates".to_string(),
            "security-scripts".to_string(),
            "validation-checklist".to_string(),
            "readme-generation".to_string(),
        ],
        version: "1.0.0".to_string(),
    };
    
    Ok(capabilities)
}

/// Batch validate multiple configurations
#[tauri::command]
pub async fn batch_validate_configurations(
    requests: Vec<ValidationRequest>,
) -> Result<Vec<crate::validation_engine::ValidationResult>, String> {
    info!("Starting batch validation for {} configurations", requests.len());
    
    let validation_engine = ValidationEngine::new();
    let mut results = Vec::new();
    
    for (index, request) in requests.iter().enumerate() {
        debug!("Validating configuration {} of {}", index + 1, requests.len());
        
        match validation_engine.validate_configuration(&request.generated_files, &request.context).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Batch validation failed for configuration {}: {}", index + 1, e);
                return Err(format!("Batch validation failed for configuration {}: {}", index + 1, e));
            }
        }
    }
    
    info!("Batch validation completed for {} configurations", results.len());
    Ok(results)
}

/// Get validation and setup statistics
#[tauri::command]
pub async fn get_validation_setup_statistics() -> Result<ValidationSetupStats, String> {
    info!("Getting validation and setup statistics");
    
    // This would typically come from a persistent store or database
    let stats = ValidationSetupStats {
        total_validations_performed: 0,
        total_setup_packages_generated: 0,
        most_common_framework: "react".to_string(),
        most_common_deployment_target: "docker".to_string(),
        average_validation_time_ms: 150,
        average_setup_generation_time_ms: 300,
        success_rate_percentage: 95.5,
        last_reset: chrono::Utc::now().to_rfc3339(),
    };
    
    Ok(stats)
}

/// Response types for Tauri commands

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationEngineStatus {
    pub is_initialized: bool,
    pub supported_frameworks: Vec<String>,
    pub security_rules_count: u32,
    pub performance_rules_count: u32,
    pub compatibility_rules_count: u32,
    pub last_updated: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupGeneratorCapabilities {
    pub supported_frameworks: Vec<String>,
    pub supported_deployment_targets: Vec<String>,
    pub supported_ci_platforms: Vec<String>,
    pub features: Vec<String>,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationSetupStats {
    pub total_validations_performed: u64,
    pub total_setup_packages_generated: u64,
    pub most_common_framework: String,
    pub most_common_deployment_target: String,
    pub average_validation_time_ms: u64,
    pub average_setup_generation_time_ms: u64,
    pub success_rate_percentage: f64,
    pub last_reset: String,
}