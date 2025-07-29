use crate::enhanced_types::{GeneratedTemplateFile as GeneratedFile, GenerationContext};
use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tracing::{debug, info, warn, error};
use regex::Regex;

/// Validation severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}

/// Validation issue with details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub severity: ValidationSeverity,
    pub code: String,
    pub message: String,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
    pub suggestion: Option<String>,
    pub category: ValidationCategory,
}

/// Categories of validation issues
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationCategory {
    Security,
    Performance,
    Compatibility,
    BestPractices,
    Dependencies,
    Configuration,
    Environment,
}

/// Complete validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub issues: Vec<ValidationIssue>,
    pub metrics: ValidationMetrics,
    pub recommendations: Vec<String>,
}

/// Validation metrics and statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMetrics {
    pub total_files_checked: u32,
    pub error_count: u32,
    pub warning_count: u32,
    pub info_count: u32,
    pub security_score: f32,
    pub performance_score: f32,
    pub compatibility_score: f32,
    pub validation_duration_ms: u64,
}

/// Framework-specific validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkValidationRules {
    pub framework_id: String,
    pub required_dependencies: Vec<String>,
    pub incompatible_dependencies: HashMap<String, Vec<String>>,
    pub required_files: Vec<String>,
    pub recommended_files: Vec<String>,
    pub security_rules: Vec<SecurityRule>,
    pub performance_rules: Vec<PerformanceRule>,
    pub configuration_rules: Vec<ConfigurationRule>,
}

/// Security validation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRule {
    pub id: String,
    pub description: String,
    pub pattern: String,
    pub severity: ValidationSeverity,
    pub category: String,
    pub fix_suggestion: String,
}

/// Performance validation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceRule {
    pub id: String,
    pub description: String,
    pub metric_type: String,
    pub threshold: f32,
    pub severity: ValidationSeverity,
    pub optimization_suggestion: String,
}

/// Configuration validation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationRule {
    pub id: String,
    pub description: String,
    pub file_path_pattern: String,
    pub required_fields: Vec<String>,
    pub deprecated_fields: Vec<String>,
    pub validation_schema: Option<Value>,
}

/// Main validation engine
pub struct ValidationEngine {
    framework_rules: HashMap<String, FrameworkValidationRules>,
    security_patterns: Vec<SecurityRule>,
    common_vulnerabilities: HashMap<String, SecurityRule>,
    dependency_graph: HashMap<String, Vec<String>>,
}

impl ValidationEngine {
    /// Create a new validation engine with default rules
    pub fn new() -> Self {
        let mut engine = Self {
            framework_rules: HashMap::new(),
            security_patterns: Vec::new(),
            common_vulnerabilities: HashMap::new(),
            dependency_graph: HashMap::new(),
        };
        
        engine.initialize_default_rules();
        engine
    }

    /// Initialize default validation rules for common frameworks
    fn initialize_default_rules(&mut self) {
        // React validation rules
        self.add_react_rules();
        
        // Vue validation rules
        self.add_vue_rules();
        
        // Angular validation rules
        self.add_angular_rules();
        
        // Node.js validation rules
        self.add_nodejs_rules();
        
        // Express validation rules
        self.add_express_rules();
        
        // Common security patterns
        self.add_security_patterns();
    }

    /// Add React-specific validation rules
    fn add_react_rules(&mut self) {
        let react_rules = FrameworkValidationRules {
            framework_id: "react".to_string(),
            required_dependencies: vec![
                "react".to_string(),
                "react-dom".to_string(),
            ],
            incompatible_dependencies: HashMap::from([
                ("react".to_string(), vec!["vue".to_string(), "@angular/core".to_string()]),
            ]),
            required_files: vec![
                "package.json".to_string(),
                "src/index.js".to_string(),
            ],
            recommended_files: vec![
                "src/App.js".to_string(),
                "public/index.html".to_string(),
                ".gitignore".to_string(),
                "README.md".to_string(),
            ],
            security_rules: vec![
                SecurityRule {
                    id: "react-xss-prevention".to_string(),
                    description: "Prevent XSS vulnerabilities in React components".to_string(),
                    pattern: r"dangerouslySetInnerHTML.*\{.*__html:.*\}".to_string(),
                    severity: ValidationSeverity::Warning,
                    category: "XSS Prevention".to_string(),
                    fix_suggestion: "Use proper React rendering or sanitize HTML content".to_string(),
                },
                SecurityRule {
                    id: "react-prop-validation".to_string(),
                    description: "Ensure proper prop validation".to_string(),
                    pattern: r"\.propTypes\s*=".to_string(),
                    severity: ValidationSeverity::Info,
                    category: "Type Safety".to_string(),
                    fix_suggestion: "Consider using TypeScript or PropTypes for better type safety".to_string(),
                },
            ],
            performance_rules: vec![
                PerformanceRule {
                    id: "react-memo-usage".to_string(),
                    description: "Optimize component re-renders with React.memo".to_string(),
                    metric_type: "component_count".to_string(),
                    threshold: 10.0,
                    severity: ValidationSeverity::Info,
                    optimization_suggestion: "Consider using React.memo for frequently re-rendering components".to_string(),
                },
            ],
            configuration_rules: vec![
                ConfigurationRule {
                    id: "react-build-config".to_string(),
                    description: "Validate React build configuration".to_string(),
                    file_path_pattern: "package.json".to_string(),
                    required_fields: vec!["scripts".to_string(), "dependencies".to_string()],
                    deprecated_fields: vec!["babel".to_string()],
                    validation_schema: None,
                },
            ],
        };
        
        self.framework_rules.insert("react".to_string(), react_rules);
    }

    /// Add Vue-specific validation rules
    fn add_vue_rules(&mut self) {
        let vue_rules = FrameworkValidationRules {
            framework_id: "vue".to_string(),
            required_dependencies: vec![
                "vue".to_string(),
            ],
            incompatible_dependencies: HashMap::from([
                ("vue".to_string(), vec!["react".to_string(), "@angular/core".to_string()]),
            ]),
            required_files: vec![
                "package.json".to_string(),
                "src/main.js".to_string(),
            ],
            recommended_files: vec![
                "src/App.vue".to_string(),
                "public/index.html".to_string(),
                "vue.config.js".to_string(),
            ],
            security_rules: vec![
                SecurityRule {
                    id: "vue-template-injection".to_string(),
                    description: "Prevent template injection vulnerabilities".to_string(),
                    pattern: r"v-html\s*=.*\{\{.*\}\}".to_string(),
                    severity: ValidationSeverity::Warning,
                    category: "Template Security".to_string(),
                    fix_suggestion: "Sanitize HTML content or use v-text for plain text".to_string(),
                },
            ],
            performance_rules: vec![
                PerformanceRule {
                    id: "vue-computed-usage".to_string(),
                    description: "Use computed properties for derived data".to_string(),
                    metric_type: "computed_ratio".to_string(),
                    threshold: 0.3,
                    severity: ValidationSeverity::Info,
                    optimization_suggestion: "Consider using computed properties for better performance".to_string(),
                },
            ],
            configuration_rules: vec![
                ConfigurationRule {
                    id: "vue-config-validation".to_string(),
                    description: "Validate Vue configuration".to_string(),
                    file_path_pattern: "vue.config.js".to_string(),
                    required_fields: vec![],
                    deprecated_fields: vec!["baseUrl".to_string()],
                    validation_schema: None,
                },
            ],
        };
        
        self.framework_rules.insert("vue".to_string(), vue_rules);
    }

    /// Add Angular-specific validation rules
    fn add_angular_rules(&mut self) {
        let angular_rules = FrameworkValidationRules {
            framework_id: "angular".to_string(),
            required_dependencies: vec![
                "@angular/core".to_string(),
                "@angular/common".to_string(),
                "@angular/platform-browser".to_string(),
            ],
            incompatible_dependencies: HashMap::from([
                ("@angular/core".to_string(), vec!["react".to_string(), "vue".to_string()]),
            ]),
            required_files: vec![
                "package.json".to_string(),
                "angular.json".to_string(),
                "src/main.ts".to_string(),
                "src/app/app.module.ts".to_string(),
            ],
            recommended_files: vec![
                "tsconfig.json".to_string(),
                "src/app/app.component.ts".to_string(),
                "src/environments/environment.ts".to_string(),
            ],
            security_rules: vec![
                SecurityRule {
                    id: "angular-sanitization".to_string(),
                    description: "Ensure proper HTML sanitization".to_string(),
                    pattern: r"innerHTML\s*=.*\+".to_string(),
                    severity: ValidationSeverity::Error,
                    category: "XSS Prevention".to_string(),
                    fix_suggestion: "Use Angular's DomSanitizer for HTML content".to_string(),
                },
            ],
            performance_rules: vec![
                PerformanceRule {
                    id: "angular-change-detection".to_string(),
                    description: "Optimize change detection strategy".to_string(),
                    metric_type: "change_detection_strategy".to_string(),
                    threshold: 1.0,
                    severity: ValidationSeverity::Info,
                    optimization_suggestion: "Use OnPush change detection strategy for better performance".to_string(),
                },
            ],
            configuration_rules: vec![
                ConfigurationRule {
                    id: "angular-build-config".to_string(),
                    description: "Validate Angular build configuration".to_string(),
                    file_path_pattern: "angular.json".to_string(),
                    required_fields: vec!["projects".to_string(), "version".to_string()],
                    deprecated_fields: vec![],
                    validation_schema: None,
                },
            ],
        };
        
        self.framework_rules.insert("angular".to_string(), angular_rules);
    }

    /// Add Node.js-specific validation rules
    fn add_nodejs_rules(&mut self) {
        let nodejs_rules = FrameworkValidationRules {
            framework_id: "nodejs".to_string(),
            required_dependencies: vec![],
            incompatible_dependencies: HashMap::new(),
            required_files: vec![
                "package.json".to_string(),
            ],
            recommended_files: vec![
                ".gitignore".to_string(),
                "README.md".to_string(),
                ".env.example".to_string(),
            ],
            security_rules: vec![
                SecurityRule {
                    id: "nodejs-env-exposure".to_string(),
                    description: "Prevent environment variable exposure".to_string(),
                    pattern: r"console\.log.*process\.env".to_string(),
                    severity: ValidationSeverity::Warning,
                    category: "Information Disclosure".to_string(),
                    fix_suggestion: "Remove console.log statements that expose environment variables".to_string(),
                },
                SecurityRule {
                    id: "nodejs-eval-usage".to_string(),
                    description: "Avoid eval() function for security".to_string(),
                    pattern: r"\beval\s*\(".to_string(),
                    severity: ValidationSeverity::Error,
                    category: "Code Injection".to_string(),
                    fix_suggestion: "Use safer alternatives like JSON.parse() or Function constructor".to_string(),
                },
            ],
            performance_rules: vec![
                PerformanceRule {
                    id: "nodejs-async-patterns".to_string(),
                    description: "Use modern async/await patterns".to_string(),
                    metric_type: "async_ratio".to_string(),
                    threshold: 0.7,
                    severity: ValidationSeverity::Info,
                    optimization_suggestion: "Convert callbacks to async/await for better performance and readability".to_string(),
                },
            ],
            configuration_rules: vec![
                ConfigurationRule {
                    id: "nodejs-version-check".to_string(),
                    description: "Validate Node.js version requirements".to_string(),
                    file_path_pattern: "package.json".to_string(),
                    required_fields: vec!["name".to_string(), "version".to_string()],
                    deprecated_fields: vec![],
                    validation_schema: None,
                },
            ],
        };
        
        self.framework_rules.insert("nodejs".to_string(), nodejs_rules);
    }

    /// Add Express-specific validation rules
    fn add_express_rules(&mut self) {
        let express_rules = FrameworkValidationRules {
            framework_id: "express".to_string(),
            required_dependencies: vec![
                "express".to_string(),
            ],
            incompatible_dependencies: HashMap::new(),
            required_files: vec![
                "package.json".to_string(),
            ],
            recommended_files: vec![
                "app.js".to_string(),
                "routes/".to_string(),
                "middleware/".to_string(),
            ],
            security_rules: vec![
                SecurityRule {
                    id: "express-helmet-usage".to_string(),
                    description: "Use Helmet.js for security headers".to_string(),
                    pattern: r"app\.use\(helmet\(\)\)".to_string(),
                    severity: ValidationSeverity::Warning,
                    category: "Security Headers".to_string(),
                    fix_suggestion: "Add helmet middleware: app.use(helmet())".to_string(),
                },
                SecurityRule {
                    id: "express-cors-config".to_string(),
                    description: "Configure CORS properly".to_string(),
                    pattern: r"app\.use\(cors\(\)\)".to_string(),
                    severity: ValidationSeverity::Warning,
                    category: "CORS Configuration".to_string(),
                    fix_suggestion: "Configure CORS with specific origins instead of allowing all".to_string(),
                },
            ],
            performance_rules: vec![
                PerformanceRule {
                    id: "express-compression".to_string(),
                    description: "Enable gzip compression".to_string(),
                    metric_type: "compression_enabled".to_string(),
                    threshold: 1.0,
                    severity: ValidationSeverity::Info,
                    optimization_suggestion: "Enable compression middleware for better performance".to_string(),
                },
            ],
            configuration_rules: vec![
                ConfigurationRule {
                    id: "express-env-config".to_string(),
                    description: "Validate environment configuration".to_string(),
                    file_path_pattern: "app.js".to_string(),
                    required_fields: vec![],
                    deprecated_fields: vec![],
                    validation_schema: None,
                },
            ],
        };
        
        self.framework_rules.insert("express".to_string(), express_rules);
    }

    /// Add common security patterns
    fn add_security_patterns(&mut self) {
        self.security_patterns = vec![
            SecurityRule {
                id: "hardcoded-secrets".to_string(),
                description: "Detect hardcoded secrets and API keys".to_string(),
                pattern: r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*[a-zA-Z0-9]{8,}".to_string(),
                severity: ValidationSeverity::Error,
                category: "Hardcoded_Secrets".to_string(),
                fix_suggestion: "Move secrets to environment variables or secure config".to_string(),
            },
            SecurityRule {
                id: "sql_injection_risk".to_string(),
                description: "Potential SQL injection risk".to_string(),
                pattern: r"(SELECT|INSERT|UPDATE|DELETE).*\+".to_string(),
                severity: ValidationSeverity::Error,
                category: "SQL_Injection".to_string(),
                fix_suggestion: "Use parameterized queries or prepared statements".to_string(),
            },
            SecurityRule {
                id: "weak-crypto".to_string(),
                description: "Weak cryptographic algorithms detected".to_string(),
                pattern: r"\b(MD5|SHA1|DES)\b".to_string(),
                severity: ValidationSeverity::Warning,
                category: "Weak_Cryptography".to_string(),
                fix_suggestion: "Use stronger algorithms like SHA-256 or SHA-3".to_string(),
            },
            SecurityRule {
                id: "debug-code".to_string(),
                description: "Debug code left in production".to_string(),
                pattern: r"(console\.log|debugger|alert)\s*\(".to_string(),
                severity: ValidationSeverity::Info,
                category: "Debug_Code".to_string(),
                fix_suggestion: "Remove debug statements before production deployment".to_string(),
            },
        ];
    }

    /// Validate a complete generated configuration
    pub async fn validate_configuration(
        &self,
        generated_files: &[GeneratedFile],
        context: &GenerationContext,
    ) -> Result<ValidationResult> {
        let start_time = std::time::Instant::now();
        let mut issues = Vec::new();
        let mut total_files = 0;

        debug!("Starting configuration validation for {} files", generated_files.len());

        // Validate each generated file
        for file in generated_files {
            total_files += 1;
            
            // File structure validation
            issues.extend(self.validate_file_structure(file)?);
            
            // Content validation based on file type
            issues.extend(self.validate_file_content(file, context)?);
            
            // Security validation
            issues.extend(self.validate_security(file)?);
        }

        // Framework-specific validation
        if let Some(framework_rules) = self.framework_rules.get(&context.framework) {
            issues.extend(self.validate_framework_requirements(generated_files, framework_rules)?);
        }

        // Dependency validation
        issues.extend(self.validate_dependencies(generated_files)?);

        // Environment validation
        issues.extend(self.validate_environment_configuration(generated_files)?);

        let duration = start_time.elapsed();
        let metrics = self.calculate_metrics(&issues, total_files, duration);
        let recommendations = self.generate_recommendations(&issues, context);

        Ok(ValidationResult {
            is_valid: issues.iter().all(|i| i.severity != ValidationSeverity::Error),
            issues,
            metrics,
            recommendations,
        })
    }

    /// Validate file structure and naming conventions
    fn validate_file_structure(&self, file: &GeneratedFile) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Check file path validity
        if file.path.is_empty() {
            issues.push(ValidationIssue {
                severity: ValidationSeverity::Error,
                code: "INVALID_FILE_PATH".to_string(),
                message: "File path cannot be empty".to_string(),
                file_path: Some(file.path.clone()),
                line_number: None,
                suggestion: Some("Provide a valid file path".to_string()),
                category: ValidationCategory::Configuration,
            });
        }

        // Check for dangerous file paths
        if file.path.contains("..") {
            issues.push(ValidationIssue {
                severity: ValidationSeverity::Error,
                code: "UNSAFE_FILE_PATH".to_string(),
                message: "File path contains directory traversal sequences".to_string(),
                file_path: Some(file.path.clone()),
                line_number: None,
                suggestion: Some("Use absolute paths or sanitize file paths".to_string()),
                category: ValidationCategory::Security,
            });
        }

        // Check file naming conventions
        if let Some(extension) = PathBuf::from(&file.path).extension() {
            match extension.to_str() {
                Some("js") | Some("ts") => {
                    if !self.is_valid_js_filename(&file.path) {
                        issues.push(ValidationIssue {
                            severity: ValidationSeverity::Warning,
                            code: "INVALID_JS_FILENAME".to_string(),
                            message: "JavaScript/TypeScript file naming doesn't follow conventions".to_string(),
                            file_path: Some(file.path.clone()),
                            line_number: None,
                            suggestion: Some("Use camelCase or kebab-case for file names".to_string()),
                            category: ValidationCategory::BestPractices,
                        });
                    }
                },
                Some("json") => {
                    if !self.is_valid_json_syntax(&file.content) {
                        issues.push(ValidationIssue {
                            severity: ValidationSeverity::Error,
                            code: "INVALID_JSON_SYNTAX".to_string(),
                            message: "Invalid JSON syntax".to_string(),
                            file_path: Some(file.path.clone()),
                            line_number: None,
                            suggestion: Some("Fix JSON syntax errors".to_string()),
                            category: ValidationCategory::Configuration,
                        });
                    }
                },
                _ => {}
            }
        }

        Ok(issues)
    }

    /// Validate file content based on type and context
    fn validate_file_content(&self, file: &GeneratedFile, context: &GenerationContext) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Check for required content patterns
        if file.path.ends_with("package.json") {
            issues.extend(self.validate_package_json(&file.content)?);
        }
        
        if file.path.ends_with(".env") || file.path.contains(".env.") {
            issues.extend(self.validate_env_file(&file.content)?);
        }
        
        // TypeScript/JavaScript specific validation
        if file.path.ends_with(".ts") || file.path.ends_with(".js") {
            issues.extend(self.validate_js_ts_content(&file.content, &file.path)?);
        }

        // Framework-specific content validation
        match context.framework.as_str() {
            "react" => issues.extend(self.validate_react_content(&file.content, &file.path)?),
            "vue" => issues.extend(self.validate_vue_content(&file.content, &file.path)?),
            "angular" => issues.extend(self.validate_angular_content(&file.content, &file.path)?),
            _ => {}
        }

        Ok(issues)
    }

    /// Validate security aspects of the file
    pub fn validate_security(&self, file: &GeneratedFile) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Apply security patterns
        for rule in &self.security_patterns {
            if let Ok(regex) = Regex::new(&rule.pattern) {
                for (line_num, line) in file.content.lines().enumerate() {
                    if regex.is_match(line) {
                        issues.push(ValidationIssue {
                            severity: rule.severity.clone(),
                            code: rule.id.clone(),
                            message: rule.description.clone(),
                            file_path: Some(file.path.clone()),
                            line_number: Some(line_num as u32 + 1),
                            suggestion: Some(rule.fix_suggestion.clone()),
                            category: ValidationCategory::Security,
                        });
                    }
                }
            }
        }

        Ok(issues)
    }

    /// Validate framework-specific requirements
    fn validate_framework_requirements(
        &self,
        files: &[GeneratedFile],
        rules: &FrameworkValidationRules,
    ) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        let file_paths: HashSet<String> = files.iter().map(|f| f.path.clone()).collect();

        // Check for required files
        for required_file in &rules.required_files {
            if !file_paths.iter().any(|path| path.contains(required_file)) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    code: "MISSING_REQUIRED_FILE".to_string(),
                    message: format!("Required file missing: {}", required_file),
                    file_path: None,
                    line_number: None,
                    suggestion: Some(format!("Create the required file: {}", required_file)),
                    category: ValidationCategory::Configuration,
                });
            }
        }

        // Check for recommended files
        for recommended_file in &rules.recommended_files {
            if !file_paths.iter().any(|path| path.contains(recommended_file)) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Info,
                    code: "MISSING_RECOMMENDED_FILE".to_string(),
                    message: format!("Recommended file missing: {}", recommended_file),
                    file_path: None,
                    line_number: None,
                    suggestion: Some(format!("Consider adding: {}", recommended_file)),
                    category: ValidationCategory::BestPractices,
                });
            }
        }

        Ok(issues)
    }

    /// Validate dependency configurations
    fn validate_dependencies(&self, files: &[GeneratedFile]) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Find package.json files
        for file in files {
            if file.path.ends_with("package.json") {
                if let Ok(package_json) = serde_json::from_str::<Value>(&file.content) {
                    issues.extend(self.validate_package_dependencies(&package_json, &file.path)?);
                }
            }
        }

        Ok(issues)
    }

    /// Validate environment configuration
    fn validate_environment_configuration(&self, files: &[GeneratedFile]) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        for file in files {
            if file.path.contains(".env") {
                issues.extend(self.validate_env_file(&file.content)?);
            }
        }

        Ok(issues)
    }

    /// Helper method to validate JavaScript filename conventions
    fn is_valid_js_filename(&self, path: &str) -> bool {
        let path_buf = PathBuf::from(path);
        let filename = path_buf
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        
        // Allow camelCase, kebab-case, and snake_case
        let camel_case = Regex::new(r"^[a-z][a-zA-Z0-9]*$").unwrap();
        let kebab_case = Regex::new(r"^[a-z][a-z0-9-]*$").unwrap();
        let snake_case = Regex::new(r"^[a-z][a-z0-9_]*$").unwrap();
        
        camel_case.is_match(filename) || kebab_case.is_match(filename) || snake_case.is_match(filename)
    }

    /// Helper method to validate JSON syntax
    fn is_valid_json_syntax(&self, content: &str) -> bool {
        serde_json::from_str::<Value>(content).is_ok()
    }

    /// Validate package.json content
    fn validate_package_json(&self, content: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        match serde_json::from_str::<Value>(content) {
            Ok(package_json) => {
                // Check for required fields
                let required_fields = ["name", "version"];
                for field in &required_fields {
                    if !package_json.get(field).is_some() {
                        issues.push(ValidationIssue {
                            severity: ValidationSeverity::Error,
                            code: "MISSING_PACKAGE_FIELD".to_string(),
                            message: format!("Missing required field in package.json: {}", field),
                            file_path: Some("package.json".to_string()),
                            line_number: None,
                            suggestion: Some(format!("Add {} field to package.json", field)),
                            category: ValidationCategory::Configuration,
                        });
                    }
                }

                // Check for security vulnerabilities in dependencies
                if let Some(deps) = package_json.get("dependencies").and_then(|d| d.as_object()) {
                    issues.extend(self.check_vulnerable_dependencies(deps)?);
                }
            },
            Err(_) => {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    code: "INVALID_PACKAGE_JSON".to_string(),
                    message: "Invalid package.json syntax".to_string(),
                    file_path: Some("package.json".to_string()),
                    line_number: None,
                    suggestion: Some("Fix JSON syntax in package.json".to_string()),
                    category: ValidationCategory::Configuration,
                });
            }
        }

        Ok(issues)
    }

    /// Validate environment file
    fn validate_env_file(&self, content: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        for (line_num, line) in content.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Check for proper key=value format
            if !line.contains('=') {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    code: "INVALID_ENV_FORMAT".to_string(),
                    message: "Environment variable should be in KEY=VALUE format".to_string(),
                    file_path: Some(".env".to_string()),
                    line_number: Some(line_num as u32 + 1),
                    suggestion: Some("Use KEY=VALUE format for environment variables".to_string()),
                    category: ValidationCategory::Configuration,
                });
            }

            // Check for potential secrets
            if line.to_lowercase().contains("password") || 
               line.to_lowercase().contains("secret") || 
               line.to_lowercase().contains("key") {
                let parts: Vec<&str> = line.split('=').collect();
                if parts.len() == 2 && !parts[1].trim().is_empty() && parts[1].trim() != "your_value_here" {
                    issues.push(ValidationIssue {
                        severity: ValidationSeverity::Warning,
                        code: "POTENTIAL_SECRET_IN_ENV".to_string(),
                        message: "Potential secret value in environment file".to_string(),
                        file_path: Some(".env".to_string()),
                        line_number: Some(line_num as u32 + 1),
                        suggestion: Some("Ensure this is not a production secret and use .env.example for templates".to_string()),
                        category: ValidationCategory::Security,
                    });
                }
            }
        }

        Ok(issues)
    }

    /// Validate JavaScript/TypeScript content
    fn validate_js_ts_content(&self, content: &str, path: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Check for common issues
        for (line_num, line) in content.lines().enumerate() {
            // Check for var usage (prefer let/const)
            if line.trim().starts_with("var ") {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Info,
                    code: "VAR_USAGE".to_string(),
                    message: "Consider using 'let' or 'const' instead of 'var'".to_string(),
                    file_path: Some(path.to_string()),
                    line_number: Some(line_num as u32 + 1),
                    suggestion: Some("Use 'let' for mutable variables or 'const' for constants".to_string()),
                    category: ValidationCategory::BestPractices,
                });
            }

            // Check for TODO comments
            if line.to_lowercase().contains("todo") || line.to_lowercase().contains("fixme") {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Info,
                    code: "TODO_COMMENT".to_string(),
                    message: "TODO/FIXME comment found".to_string(),
                    file_path: Some(path.to_string()),
                    line_number: Some(line_num as u32 + 1),
                    suggestion: Some("Address TODO items before production".to_string()),
                    category: ValidationCategory::BestPractices,
                });
            }
        }

        Ok(issues)
    }

    /// Validate React-specific content
    fn validate_react_content(&self, content: &str, path: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // React-specific validations
        if content.contains("React") && !content.contains("import React") && !content.contains("import * as React") {
            issues.push(ValidationIssue {
                severity: ValidationSeverity::Warning,
                code: "MISSING_REACT_IMPORT".to_string(),
                message: "React is used but not imported".to_string(),
                file_path: Some(path.to_string()),
                line_number: None,
                suggestion: Some("Add 'import React from \"react\"' at the top of the file".to_string()),
                category: ValidationCategory::Configuration,
            });
        }

        Ok(issues)
    }

    /// Validate Vue-specific content
    fn validate_vue_content(&self, content: &str, path: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Vue-specific validations
        if path.ends_with(".vue") && !content.contains("<template>") {
            issues.push(ValidationIssue {
                severity: ValidationSeverity::Warning,
                code: "MISSING_VUE_TEMPLATE".to_string(),
                message: "Vue component missing template section".to_string(),
                file_path: Some(path.to_string()),
                line_number: None,
                suggestion: Some("Add <template> section to Vue component".to_string()),
                category: ValidationCategory::Configuration,
            });
        }

        Ok(issues)
    }

    /// Validate Angular-specific content
    fn validate_angular_content(&self, content: &str, path: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Angular-specific validations
        if path.ends_with(".component.ts") && !content.contains("@Component") {
            issues.push(ValidationIssue {
                severity: ValidationSeverity::Error,
                code: "MISSING_COMPONENT_DECORATOR".to_string(),
                message: "Angular component missing @Component decorator".to_string(),
                file_path: Some(path.to_string()),
                line_number: None,
                suggestion: Some("Add @Component decorator to the class".to_string()),
                category: ValidationCategory::Configuration,
            });
        }

        Ok(issues)
    }

    /// Validate package dependencies for known vulnerabilities
    fn validate_package_dependencies(&self, package_json: &Value, file_path: &str) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        if let Some(deps) = package_json.get("dependencies").and_then(|d| d.as_object()) {
            issues.extend(self.check_vulnerable_dependencies(deps)?);
        }

        if let Some(dev_deps) = package_json.get("devDependencies").and_then(|d| d.as_object()) {
            issues.extend(self.check_vulnerable_dependencies(dev_deps)?);
        }

        Ok(issues)
    }

    /// Check for known vulnerable dependencies
    fn check_vulnerable_dependencies(&self, deps: &serde_json::Map<String, Value>) -> Result<Vec<ValidationIssue>> {
        let mut issues = Vec::new();
        
        // Known vulnerable packages (this would typically come from a security database)
        let vulnerable_packages = HashMap::from([
            ("lodash", "< 4.17.21"),
            ("axios", "< 0.21.4"),
            ("minimist", "< 1.2.6"),
        ]);

        for (package_name, version) in deps {
            if let Some(version_str) = version.as_str() {
                if let Some(vulnerable_version) = vulnerable_packages.get(package_name.as_str()) {
                    issues.push(ValidationIssue {
                        severity: ValidationSeverity::Warning,
                        code: "VULNERABLE_DEPENDENCY".to_string(),
                        message: format!("Package {} may have known vulnerabilities", package_name),
                        file_path: Some("package.json".to_string()),
                        line_number: None,
                        suggestion: Some(format!("Update {} to a secure version", package_name)),
                        category: ValidationCategory::Security,
                    });
                }
            }
        }

        Ok(issues)
    }

    /// Calculate validation metrics
    fn calculate_metrics(
        &self,
        issues: &[ValidationIssue],
        total_files: u32,
        duration: std::time::Duration,
    ) -> ValidationMetrics {
        let error_count = issues.iter().filter(|i| i.severity == ValidationSeverity::Error).count() as u32;
        let warning_count = issues.iter().filter(|i| i.severity == ValidationSeverity::Warning).count() as u32;
        let info_count = issues.iter().filter(|i| i.severity == ValidationSeverity::Info).count() as u32;

        let security_issues = issues.iter().filter(|i| i.category == ValidationCategory::Security).count();
        let performance_issues = issues.iter().filter(|i| i.category == ValidationCategory::Performance).count();
        let compatibility_issues = issues.iter().filter(|i| i.category == ValidationCategory::Compatibility).count();

        // Calculate scores (0-100 scale)
        let security_score = if security_issues == 0 { 100.0 } else { (100.0 - (security_issues as f32 * 10.0)).max(0.0) };
        let performance_score = if performance_issues == 0 { 100.0 } else { (100.0 - (performance_issues as f32 * 5.0)).max(0.0) };
        let compatibility_score = if compatibility_issues == 0 { 100.0 } else { (100.0 - (compatibility_issues as f32 * 8.0)).max(0.0) };

        ValidationMetrics {
            total_files_checked: total_files,
            error_count,
            warning_count,
            info_count,
            security_score,
            performance_score,
            compatibility_score,
            validation_duration_ms: duration.as_millis() as u64,
        }
    }

    /// Generate recommendations based on validation results
    fn generate_recommendations(&self, issues: &[ValidationIssue], context: &GenerationContext) -> Vec<String> {
        let mut recommendations = Vec::new();

        let error_count = issues.iter().filter(|i| i.severity == ValidationSeverity::Error).count();
        let warning_count = issues.iter().filter(|i| i.severity == ValidationSeverity::Warning).count();

        if error_count > 0 {
            recommendations.push(format!("❌ Fix {} critical errors before deployment", error_count));
        }

        if warning_count > 0 {
            recommendations.push(format!("⚠️ Address {} warnings to improve code quality", warning_count));
        }

        // Framework-specific recommendations
        match context.framework.as_str() {
            "react" => {
                recommendations.push("💡 Consider adding TypeScript for better type safety".to_string());
                recommendations.push("💡 Add React.StrictMode for development checks".to_string());
            },
            "vue" => {
                recommendations.push("💡 Use Vue 3 Composition API for better performance".to_string());
                recommendations.push("💡 Consider adding Vite for faster builds".to_string());
            },
            "angular" => {
                recommendations.push("💡 Enable strict mode in TypeScript configuration".to_string());
                recommendations.push("💡 Use OnPush change detection for better performance".to_string());
            },
            _ => {}
        }

        // Security recommendations
        let security_issues = issues.iter().filter(|i| i.category == ValidationCategory::Security).count();
        if security_issues > 0 {
            recommendations.push("🔒 Run security audit: npm audit or yarn audit".to_string());
            recommendations.push("🔒 Consider adding security linting rules".to_string());
        }

        // Performance recommendations
        let performance_issues = issues.iter().filter(|i| i.category == ValidationCategory::Performance).count();
        if performance_issues > 0 {
            recommendations.push("⚡ Consider code splitting for better performance".to_string());
            recommendations.push("⚡ Optimize bundle size with webpack-bundle-analyzer".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("✅ Configuration looks good! Ready for deployment".to_string());
        }

        recommendations
    }
}

impl Default for ValidationEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate environment compatibility
pub fn validate_environment_compatibility(
    node_version: Option<&str>,
    npm_version: Option<&str>,
    framework: &str,
) -> Result<Vec<ValidationIssue>> {
    let mut issues = Vec::new();

    // Check Node.js version compatibility
    if let Some(node_ver) = node_version {
        let min_versions = HashMap::from([
            ("react", "14.0.0"),
            ("vue", "12.0.0"),
            ("angular", "16.0.0"),
            ("nodejs", "12.0.0"),
        ]);

        if let Some(min_version) = min_versions.get(framework) {
            // Simplified version comparison (would need proper semver parsing in production)
            if node_ver.parse::<f32>().unwrap_or(0.0) < min_version.parse::<f32>().unwrap_or(999.0) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    code: "INCOMPATIBLE_NODE_VERSION".to_string(),
                    message: format!("Node.js version {} is too old for {}", node_ver, framework),
                    file_path: None,
                    line_number: None,
                    suggestion: Some(format!("Upgrade Node.js to version {} or higher", min_version)),
                    category: ValidationCategory::Compatibility,
                });
            }
        }
    }

    Ok(issues)
}