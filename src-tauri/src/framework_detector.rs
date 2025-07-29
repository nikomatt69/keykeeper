use crate::enhanced_types::{FrameworkDetectionResult, DetectionEvidence};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Framework detector service for automatic project framework detection
pub struct FrameworkDetector {
    /// Detection rules for different frameworks
    detection_rules: HashMap<String, FrameworkDetectionRule>,
}

/// Detection rule for a specific framework
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkDetectionRule {
    /// Framework identifier
    pub framework: String,
    /// Display name
    pub name: String,
    /// Framework version pattern
    pub version_pattern: Option<String>,
    /// Files that indicate this framework
    pub indicator_files: Vec<FileIndicator>,
    /// Dependencies that indicate this framework
    pub indicator_dependencies: Vec<DependencyIndicator>,
    /// File patterns to look for
    pub file_patterns: Vec<PatternIndicator>,
    /// Content patterns within files
    pub content_patterns: Vec<ContentPatternIndicator>,
    /// Base confidence score for this framework
    pub base_confidence: f64,
    /// Minimum confidence threshold to consider this framework
    pub min_confidence: f64,
}

/// File-based framework indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIndicator {
    /// File path relative to project root
    pub file_path: String,
    /// Confidence weight if this file exists
    pub confidence_weight: f64,
    /// Whether this file is required for framework detection
    pub is_required: bool,
    /// Optional content that must be present in the file
    pub required_content: Option<String>,
}

/// Dependency-based framework indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyIndicator {
    /// Package name to look for
    pub package_name: String,
    /// Confidence weight if this dependency exists
    pub confidence_weight: f64,
    /// Dependency type (dependencies, devDependencies, peerDependencies)
    pub dependency_type: String,
    /// Version pattern if applicable
    pub version_pattern: Option<String>,
    /// Whether this is a primary indicator
    pub is_primary: bool,
}

/// Pattern-based framework indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternIndicator {
    /// Glob pattern to match files
    pub pattern: String,
    /// Confidence weight if pattern matches
    pub confidence_weight: f64,
    /// Minimum number of matches required
    pub min_matches: usize,
}

/// Content pattern indicator within files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentPatternIndicator {
    /// File extensions to check
    pub file_extensions: Vec<String>,
    /// Regex pattern to search for in file content
    pub pattern: String,
    /// Confidence weight if pattern is found
    pub confidence_weight: f64,
    /// Maximum number of files to check
    pub max_files_to_check: usize,
}

impl FrameworkDetector {
    /// Create a new framework detector with built-in rules
    pub fn new() -> Self {
        let mut detector = Self {
            detection_rules: HashMap::new(),
        };
        
        detector.register_built_in_rules();
        detector
    }

    /// Register built-in framework detection rules
    fn register_built_in_rules(&mut self) {
        // Next.js detection
        self.detection_rules.insert("nextjs".to_string(), FrameworkDetectionRule {
            framework: "nextjs".to_string(),
            name: "Next.js".to_string(),
            version_pattern: None,
            indicator_files: vec![
                FileIndicator {
                    file_path: "next.config.js".to_string(),
                    confidence_weight: 0.8,
                    is_required: false,
                    required_content: None,
                },
                FileIndicator {
                    file_path: "next.config.ts".to_string(),
                    confidence_weight: 0.8,
                    is_required: false,
                    required_content: None,
                },
                FileIndicator {
                    file_path: "next.config.mjs".to_string(),
                    confidence_weight: 0.8,
                    is_required: false,
                    required_content: None,
                },
            ],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "next".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
            ],
            file_patterns: vec![
                PatternIndicator {
                    pattern: "pages/**/*.{js,ts,jsx,tsx}".to_string(),
                    confidence_weight: 0.6,
                    min_matches: 1,
                },
                PatternIndicator {
                    pattern: "app/**/*.{js,ts,jsx,tsx}".to_string(),
                    confidence_weight: 0.7,
                    min_matches: 1,
                },
            ],
            content_patterns: vec![
                ContentPatternIndicator {
                    file_extensions: vec!["js".to_string(), "ts".to_string(), "jsx".to_string(), "tsx".to_string()],
                    pattern: "from.*next/".to_string(),
                    confidence_weight: 0.5,
                    max_files_to_check: 10,
                },
            ],
            base_confidence: 0.1,
            min_confidence: 0.5,
        });

        // React detection
        self.detection_rules.insert("react".to_string(), FrameworkDetectionRule {
            framework: "react".to_string(),
            name: "React".to_string(),
            version_pattern: None,
            indicator_files: vec![],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "react".to_string(),
                    confidence_weight: 0.8,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
                DependencyIndicator {
                    package_name: "react-dom".to_string(),
                    confidence_weight: 0.7,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: false,
                },
            ],
            file_patterns: vec![
                PatternIndicator {
                    pattern: "src/**/*.{jsx,tsx}".to_string(),
                    confidence_weight: 0.6,
                    min_matches: 1,
                },
            ],
            content_patterns: vec![
                ContentPatternIndicator {
                    file_extensions: vec!["js".to_string(), "ts".to_string(), "jsx".to_string(), "tsx".to_string()],
                    pattern: "from.*react".to_string(),
                    confidence_weight: 0.4,
                    max_files_to_check: 10,
                },
            ],
            base_confidence: 0.1,
            min_confidence: 0.4,
        });

        // Vue.js detection
        self.detection_rules.insert("vue".to_string(), FrameworkDetectionRule {
            framework: "vue".to_string(),
            name: "Vue.js".to_string(),
            version_pattern: None,
            indicator_files: vec![
                FileIndicator {
                    file_path: "vue.config.js".to_string(),
                    confidence_weight: 0.8,
                    is_required: false,
                    required_content: None,
                },
                FileIndicator {
                    file_path: "vite.config.js".to_string(),
                    confidence_weight: 0.6,
                    is_required: false,
                    required_content: Some("@vitejs/plugin-vue".to_string()),
                },
            ],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "vue".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
                DependencyIndicator {
                    package_name: "@vue/cli-service".to_string(),
                    confidence_weight: 0.7,
                    dependency_type: "devDependencies".to_string(),
                    version_pattern: None,
                    is_primary: false,
                },
            ],
            file_patterns: vec![
                PatternIndicator {
                    pattern: "src/**/*.vue".to_string(),
                    confidence_weight: 0.8,
                    min_matches: 1,
                },
            ],
            content_patterns: vec![],
            base_confidence: 0.1,
            min_confidence: 0.5,
        });

        // Express.js detection
        self.detection_rules.insert("express".to_string(), FrameworkDetectionRule {
            framework: "express".to_string(),
            name: "Express.js".to_string(),
            version_pattern: None,
            indicator_files: vec![],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "express".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
            ],
            file_patterns: vec![],
            content_patterns: vec![
                ContentPatternIndicator {
                    file_extensions: vec!["js".to_string(), "ts".to_string()],
                    pattern: "require.*express".to_string(),
                    confidence_weight: 0.7,
                    max_files_to_check: 5,
                },
                ContentPatternIndicator {
                    file_extensions: vec!["js".to_string(), "ts".to_string()],
                    pattern: "from.*express".to_string(),
                    confidence_weight: 0.7,
                    max_files_to_check: 5,
                },
            ],
            base_confidence: 0.1,
            min_confidence: 0.6,
        });

        // NestJS detection
        self.detection_rules.insert("nestjs".to_string(), FrameworkDetectionRule {
            framework: "nestjs".to_string(),
            name: "NestJS".to_string(),
            version_pattern: None,
            indicator_files: vec![
                FileIndicator {
                    file_path: "nest-cli.json".to_string(),
                    confidence_weight: 0.9,
                    is_required: false,
                    required_content: None,
                },
            ],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "@nestjs/core".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
                DependencyIndicator {
                    package_name: "@nestjs/common".to_string(),
                    confidence_weight: 0.8,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: false,
                },
            ],
            file_patterns: vec![],
            content_patterns: vec![
                ContentPatternIndicator {
                    file_extensions: vec!["ts".to_string()],
                    pattern: "from.*@nestjs/".to_string(),
                    confidence_weight: 0.6,
                    max_files_to_check: 10,
                },
            ],
            base_confidence: 0.1,
            min_confidence: 0.5,
        });

        // Svelte detection
        self.detection_rules.insert("svelte".to_string(), FrameworkDetectionRule {
            framework: "svelte".to_string(),
            name: "Svelte".to_string(),
            version_pattern: None,
            indicator_files: vec![
                FileIndicator {
                    file_path: "svelte.config.js".to_string(),
                    confidence_weight: 0.9,
                    is_required: false,
                    required_content: None,
                },
            ],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "svelte".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "devDependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
            ],
            file_patterns: vec![
                PatternIndicator {
                    pattern: "src/**/*.svelte".to_string(),
                    confidence_weight: 0.8,
                    min_matches: 1,
                },
            ],
            content_patterns: vec![],
            base_confidence: 0.1,
            min_confidence: 0.5,
        });

        // Angular detection
        self.detection_rules.insert("angular".to_string(), FrameworkDetectionRule {
            framework: "angular".to_string(),
            name: "Angular".to_string(),
            version_pattern: None,
            indicator_files: vec![
                FileIndicator {
                    file_path: "angular.json".to_string(),
                    confidence_weight: 0.9,
                    is_required: false,
                    required_content: None,
                },
                FileIndicator {
                    file_path: "src/main.ts".to_string(),
                    confidence_weight: 0.6,
                    is_required: false,
                    required_content: Some("platformBrowserDynamic".to_string()),
                },
            ],
            indicator_dependencies: vec![
                DependencyIndicator {
                    package_name: "@angular/core".to_string(),
                    confidence_weight: 0.9,
                    dependency_type: "dependencies".to_string(),
                    version_pattern: None,
                    is_primary: true,
                },
            ],
            file_patterns: vec![],
            content_patterns: vec![
                ContentPatternIndicator {
                    file_extensions: vec!["ts".to_string()],
                    pattern: "from.*@angular/".to_string(),
                    confidence_weight: 0.6,
                    max_files_to_check: 10,
                },
            ],
            base_confidence: 0.1,
            min_confidence: 0.5,
        });
    }

    /// Detect framework in a given project directory
    pub async fn detect_framework(&self, project_path: &str) -> Result<Vec<FrameworkDetectionResult>> {
        let project_path = Path::new(project_path);
        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project path does not exist: {}", project_path.display()));
        }

        info!("Detecting framework in: {}", project_path.display());

        let mut results = Vec::new();

        // Load package.json if it exists
        let package_json = self.load_package_json(project_path).await?;

        for (framework_id, rule) in &self.detection_rules {
            let detection_result = self.detect_single_framework(project_path, rule, &package_json).await?;
            
            if detection_result.confidence >= rule.min_confidence {
                debug!("Framework {} detected with confidence {:.2}", framework_id, detection_result.confidence);
                results.push(detection_result);
            }
        }

        // Sort by confidence (highest first)
        results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

        info!("Framework detection completed. Found {} frameworks", results.len());
        Ok(results)
    }

    /// Detect a single framework based on its rules
    async fn detect_single_framework(
        &self,
        project_path: &Path,
        rule: &FrameworkDetectionRule,
        package_json: &Option<Value>,
    ) -> Result<FrameworkDetectionResult> {
        let mut confidence = rule.base_confidence;
        let mut evidence = Vec::new();
        let mut metadata = HashMap::new();

        // Check file indicators
        for file_indicator in &rule.indicator_files {
            let file_path = project_path.join(&file_indicator.file_path);
            if file_path.exists() {
                confidence += file_indicator.confidence_weight;
                evidence.push(DetectionEvidence {
                    evidence_type: "file".to_string(),
                    value: file_indicator.file_path.clone(),
                    confidence_weight: file_indicator.confidence_weight,
                    source: file_path.to_string_lossy().to_string(),
                });

                // Check required content if specified
                if let Some(required_content) = &file_indicator.required_content {
                    if let Ok(content) = fs::read_to_string(&file_path) {
                        if content.contains(required_content) {
                            confidence += 0.2; // Bonus for matching content
                            evidence.push(DetectionEvidence {
                                evidence_type: "file_content".to_string(),
                                value: required_content.clone(),
                                confidence_weight: 0.2,
                                source: file_path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }

        // Check dependency indicators
        if let Some(pkg_json) = package_json {
            let mut framework_version = None;

            for dep_indicator in &rule.indicator_dependencies {
                let dep_sections = [
                    ("dependencies", pkg_json.get("dependencies")),
                    ("devDependencies", pkg_json.get("devDependencies")),
                    ("peerDependencies", pkg_json.get("peerDependencies")),
                ];

                for (section_name, section) in dep_sections.iter() {
                    if dep_indicator.dependency_type == *section_name || dep_indicator.dependency_type == "any" {
                        if let Some(deps) = section {
                            if let Some(deps_obj) = deps.as_object() {
                                if let Some(version) = deps_obj.get(&dep_indicator.package_name) {
                                    confidence += dep_indicator.confidence_weight;
                                    evidence.push(DetectionEvidence {
                                        evidence_type: "dependency".to_string(),
                                        value: format!("{}@{}", dep_indicator.package_name, version),
                                        confidence_weight: dep_indicator.confidence_weight,
                                        source: format!("package.json::{}", section_name),
                                    });

                                    // Extract version for primary indicators
                                    if dep_indicator.is_primary {
                                        framework_version = Some(version.as_str().unwrap_or("unknown").to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if let Some(version) = framework_version {
                metadata.insert("version".to_string(), serde_json::Value::String(version));
            }
        }

        // Check file patterns
        for pattern_indicator in &rule.file_patterns {
            let matches = self.find_files_matching_pattern(project_path, &pattern_indicator.pattern).await?;
            if matches.len() >= pattern_indicator.min_matches {
                confidence += pattern_indicator.confidence_weight;
                evidence.push(DetectionEvidence {
                    evidence_type: "file_pattern".to_string(),
                    value: format!("{} (matched {} files)", pattern_indicator.pattern, matches.len()),
                    confidence_weight: pattern_indicator.confidence_weight,
                    source: "file_system".to_string(),
                });
            }
        }

        // Check content patterns
        for content_pattern in &rule.content_patterns {
            let matches = self.find_content_pattern_matches(
                project_path,
                content_pattern,
            ).await?;
            
            if matches > 0 {
                confidence += content_pattern.confidence_weight;
                evidence.push(DetectionEvidence {
                    evidence_type: "content_pattern".to_string(),
                    value: format!("{} (found in {} files)", content_pattern.pattern, matches),
                    confidence_weight: content_pattern.confidence_weight,
                    source: "file_content".to_string(),
                });
            }
        }

        // Cap confidence at 1.0
        confidence = confidence.min(1.0);

        Ok(FrameworkDetectionResult {
            framework: rule.framework.clone(),
            confidence,
            evidence,
            version: metadata.get("version").and_then(|v| v.as_str()).map(|s| s.to_string()),
            metadata,
        })
    }

    /// Load package.json from project directory
    async fn load_package_json(&self, project_path: &Path) -> Result<Option<Value>> {
        let package_json_path = project_path.join("package.json");
        if !package_json_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&package_json_path)
            .context("Failed to read package.json")?;
        
        let parsed: Value = serde_json::from_str(&content)
            .context("Failed to parse package.json")?;
        
        Ok(Some(parsed))
    }

    /// Find files matching a glob pattern
    async fn find_files_matching_pattern(&self, project_path: &Path, pattern: &str) -> Result<Vec<PathBuf>> {
        let mut matches = Vec::new();
        
        // Simple pattern matching implementation
        // For a full implementation, consider using the `glob` crate
        if pattern.contains("**") {
            // Recursive pattern
            matches.extend(self.find_files_recursive(project_path, pattern).await?);
        } else {
            // Simple pattern
            let pattern_path = project_path.join(pattern);
            if pattern_path.exists() {
                matches.push(pattern_path);
            }
        }

        Ok(matches)
    }

    /// Find files recursively matching a pattern
    async fn find_files_recursive(&self, dir: &Path, pattern: &str) -> Result<Vec<PathBuf>> {
        let mut matches = Vec::new();
        
        if !dir.is_dir() {
            return Ok(matches);
        }

        // Extract file extensions from pattern
        let extensions = self.extract_extensions_from_pattern(pattern);
        
        self.visit_directory_recursive(dir, &extensions, &mut matches).await?;
        
        Ok(matches)
    }

    /// Visit directory recursively looking for matching files
    fn visit_directory_recursive<'a>(
        &'a self,
        dir: &'a Path,
        extensions: &'a [String],
        matches: &'a mut Vec<PathBuf>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return Ok(()), // Skip directories we can't read
        };

        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                // Skip node_modules and other common directories to avoid
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !["node_modules", ".git", ".next", "dist", "build"].contains(&dir_name) {
                    self.visit_directory_recursive(&path, extensions, matches).await?;
                }
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if extensions.is_empty() || extensions.contains(&ext.to_string()) {
                        matches.push(path);
                    }
                }
            }
        }

        Ok(())
        })
    }

    /// Extract file extensions from a glob pattern
    fn extract_extensions_from_pattern(&self, pattern: &str) -> Vec<String> {
        let mut extensions = Vec::new();
        
        // Look for {ext1,ext2,ext3} pattern
        if let Some(start) = pattern.find('{') {
            if let Some(end) = pattern.find('}') {
                let ext_part = &pattern[start + 1..end];
                extensions.extend(
                    ext_part
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .collect::<Vec<_>>()
                );
            }
        } else if let Some(dot_pos) = pattern.rfind('.') {
            // Simple .ext pattern
            let ext = &pattern[dot_pos + 1..];
            if !ext.contains('*') && !ext.contains('/') {
                extensions.push(ext.to_string());
            }
        }

        extensions
    }

    /// Find content pattern matches in files
    async fn find_content_pattern_matches(
        &self,
        project_path: &Path,
        content_pattern: &ContentPatternIndicator,
    ) -> Result<usize> {
        let mut match_count = 0;
        let mut files_checked = 0;

        // Find files with matching extensions
        let mut candidate_files = Vec::new();
        self.collect_files_by_extension(
            project_path,
            &content_pattern.file_extensions,
            &mut candidate_files,
        ).await?;

        // Check content in files
        for file_path in candidate_files.iter().take(content_pattern.max_files_to_check) {
            if let Ok(content) = fs::read_to_string(file_path) {
                if let Ok(regex) = regex::Regex::new(&content_pattern.pattern) {
                    if regex.is_match(&content) {
                        match_count += 1;
                    }
                }
            }
            files_checked += 1;
            
            if files_checked >= content_pattern.max_files_to_check {
                break;
            }
        }

        Ok(match_count)
    }

    /// Collect files by extension
    fn collect_files_by_extension<'a>(
        &'a self,
        dir: &'a Path,
        extensions: &'a [String],
        files: &'a mut Vec<PathBuf>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
        if !dir.is_dir() {
            return Ok(());
        }

        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !["node_modules", ".git", ".next", "dist", "build"].contains(&dir_name) {
                    self.collect_files_by_extension(&path, extensions, files).await?;
                }
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if extensions.contains(&ext.to_string()) {
                        files.push(path);
                    }
                }
            }
        }

        Ok(())
        })
    }

    /// Get framework compatibility information
    pub fn get_framework_compatibility(&self, framework: &str, provider_id: &str) -> Option<String> {
        // This would typically be loaded from a configuration file or database
        // For now, return basic compatibility information
        match (framework, provider_id) {
            ("nextjs", "better-auth") => Some("full".to_string()),
            ("nextjs", "openai") => Some("full".to_string()),
            ("nextjs", "stripe") => Some("full".to_string()),
            ("react", "better-auth") => Some("partial".to_string()),
            ("react", "openai") => Some("full".to_string()),
            ("vue", "openai") => Some("full".to_string()),
            ("express", "better-auth") => Some("full".to_string()),
            ("nestjs", "openai") => Some("full".to_string()),
            _ => Some("minimal".to_string()),
        }
    }
}

impl Default for FrameworkDetector {
    fn default() -> Self {
        Self::new()
    }
}