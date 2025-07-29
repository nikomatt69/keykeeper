use crate::enhanced_types::{FrameworkDetectionResult, DetectionEvidence};
use crate::framework_detector::{FrameworkDetector, FrameworkDetectionRule};
use crate::llm_proxy::LLMResponse;
use crate::llm_wrapper::LLMEngine;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Enhanced framework detector that combines traditional pattern matching with AI analysis
pub struct AIEnhancedDetector {
    /// Traditional framework detector for baseline detection
    traditional_detector: FrameworkDetector,
    /// LLM engine for AI-powered analysis
    llm_engine: Arc<RwLock<Option<LLMEngine>>>,
}

/// AI analysis result for project structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProjectAnalysis {
    /// Detected frameworks with AI confidence scores
    pub frameworks: Vec<AIFrameworkDetection>,
    /// Project architecture insights
    pub architecture_insights: Vec<ArchitectureInsight>,
    /// Code quality assessment
    pub code_quality: CodeQualityAssessment,
    /// AI reasoning for detections
    pub reasoning: String,
    /// Confidence in overall analysis
    pub overall_confidence: f64,
}

/// AI-enhanced framework detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIFrameworkDetection {
    /// Framework identifier
    pub framework: String,
    /// Framework display name
    pub name: String,
    /// AI confidence score (0.0 to 1.0)
    pub ai_confidence: f64,
    /// Traditional detection confidence
    pub traditional_confidence: f64,
    /// Hybrid confidence combining both approaches
    pub hybrid_confidence: f64,
    /// Version information if detected
    pub version: Option<String>,
    /// AI reasoning for this detection
    pub ai_reasoning: String,
    /// Evidence from traditional and AI analysis
    pub evidence: Vec<DetectionEvidence>,
    /// Framework-specific metadata
    pub metadata: HashMap<String, Value>,
}

/// Architecture insight from AI analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureInsight {
    /// Type of insight (pattern, structure, convention, etc.)
    pub insight_type: String,
    /// Description of the insight
    pub description: String,
    /// Confidence in this insight
    pub confidence: f64,
    /// Suggested improvements or actions
    pub suggestions: Vec<String>,
    /// Files or locations related to this insight
    pub related_files: Vec<String>,
}

/// Code quality assessment from AI analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityAssessment {
    /// Overall quality score (0.0 to 1.0)
    pub overall_score: f64,
    /// Maintainability score
    pub maintainability: f64,
    /// Documentation quality score
    pub documentation: f64,
    /// Testing coverage estimation
    pub testing: f64,
    /// Security assessment
    pub security: f64,
    /// Performance considerations
    pub performance: f64,
    /// Specific quality issues found
    pub issues: Vec<QualityIssue>,
    /// Improvement recommendations
    pub recommendations: Vec<String>,
}

/// Specific code quality issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityIssue {
    /// Issue type (security, performance, maintainability, etc.)
    pub issue_type: String,
    /// Severity level (low, medium, high, critical)
    pub severity: String,
    /// Description of the issue
    pub description: String,
    /// File path where issue was found
    pub file_path: Option<String>,
    /// Line number if applicable
    pub line_number: Option<usize>,
    /// Suggested fix
    pub suggested_fix: String,
}

impl AIEnhancedDetector {
    /// Create a new AI-enhanced detector
    pub fn new(llm_engine: Arc<RwLock<Option<LLMEngine>>>) -> Self {
        Self {
            traditional_detector: FrameworkDetector::new(),
            llm_engine,
        }
    }

    /// Perform comprehensive AI-enhanced framework detection
    pub async fn analyze_project_with_ai(&self, project_path: &str) -> Result<AIProjectAnalysis> {
        info!("Starting AI-enhanced project analysis for: {}", project_path);

        let project_path = Path::new(project_path);
        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project path does not exist: {}", project_path.display()));
        }

        // Step 1: Traditional framework detection
        let traditional_results = self.traditional_detector.detect_framework(project_path.to_str().unwrap()).await?;
        debug!("Traditional detection found {} frameworks", traditional_results.len());

        // Step 2: Collect project information for AI analysis
        let project_info = self.collect_project_information(project_path).await?;
        debug!("Collected project information: {} files analyzed", project_info.file_count);

        // Step 3: AI analysis if LLM is available
        let ai_analysis = if let Some(llm) = &*self.llm_engine.read().await {
            self.perform_ai_analysis(&project_info, &traditional_results, llm).await?
        } else {
            warn!("LLM not available, falling back to traditional detection only");
            self.fallback_analysis(&traditional_results, &project_info).await?
        };

        info!("AI-enhanced analysis completed with {} framework detections", ai_analysis.frameworks.len());
        Ok(ai_analysis)
    }

    /// Collect project information for AI analysis
    async fn collect_project_information(&self, project_path: &Path) -> Result<ProjectInformation> {
        let mut info = ProjectInformation {
            project_path: project_path.to_string_lossy().to_string(),
            file_count: 0,
            directory_structure: Vec::new(),
            key_files: HashMap::new(),
            package_managers: Vec::new(),
            languages: HashMap::new(),
            file_samples: HashMap::new(),
        };

        // Analyze directory structure
        self.analyze_directory_structure(project_path, &mut info, 0, 3).await?;

        // Read key configuration files
        self.read_key_files(project_path, &mut info).await?;

        // Detect package managers
        self.detect_package_managers(project_path, &mut info).await?;

        // Sample code files for AI analysis
        self.sample_code_files(project_path, &mut info).await?;

        Ok(info)
    }

    /// Analyze directory structure recursively
    fn analyze_directory_structure<'a>(
        &'a self,
        dir: &'a Path,
        info: &'a mut ProjectInformation,
        depth: usize,
        max_depth: usize,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
        if depth > max_depth {
            return Ok(());
        }

        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            let relative_path = path.strip_prefix(&info.project_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                
                // Skip common directories that don't provide value
                if ["node_modules", ".git", ".next", "dist", "build", ".vscode", ".idea"].contains(&dir_name) {
                    continue;
                }

                info.directory_structure.push(relative_path);
                self.analyze_directory_structure(&path, info, depth + 1, max_depth).await?;
            } else if path.is_file() {
                info.file_count += 1;
                
                // Track language distribution
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    *info.languages.entry(ext.to_string()).or_insert(0) += 1;
                }
            }
        }

        Ok(())
        })
    }

    /// Read key configuration files
    async fn read_key_files(&self, project_path: &Path, info: &mut ProjectInformation) -> Result<()> {
        let key_files = [
            "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
            "Cargo.toml", "Cargo.lock", "requirements.txt", "pyproject.toml",
            "composer.json", "composer.lock", "Gemfile", "Gemfile.lock",
            "go.mod", "go.sum", "build.gradle", "pom.xml",
            "next.config.js", "next.config.ts", "next.config.mjs",
            "vite.config.js", "vite.config.ts", "webpack.config.js",
            "vue.config.js", "nuxt.config.js", "angular.json",
            "svelte.config.js", "rollup.config.js", "parcel.json",
            "tsconfig.json", "jsconfig.json", ".babelrc", ".eslintrc.json",
            "README.md", "README.txt", "CHANGELOG.md", "LICENSE",
            "Dockerfile", "docker-compose.yml", ".env.example",
        ];

        for file_name in key_files {
            let file_path = project_path.join(file_name);
            if file_path.exists() {
                if let Ok(content) = fs::read_to_string(&file_path) {
                    // Limit content size for AI analysis
                    let truncated_content = if content.len() > 5000 {
                        format!("{}...\n[TRUNCATED - Original length: {} chars]", &content[..5000], content.len())
                    } else {
                        content
                    };
                    info.key_files.insert(file_name.to_string(), truncated_content);
                }
            }
        }

        Ok(())
    }

    /// Detect package managers in use
    async fn detect_package_managers(&self, project_path: &Path, info: &mut ProjectInformation) -> Result<()> {
        let package_manager_files = [
            ("npm", "package-lock.json"),
            ("yarn", "yarn.lock"),
            ("pnpm", "pnpm-lock.yaml"),
            ("cargo", "Cargo.lock"),
            ("pip", "requirements.txt"),
            ("poetry", "pyproject.toml"),
            ("composer", "composer.lock"),
            ("bundler", "Gemfile.lock"),
            ("go_modules", "go.sum"),
            ("gradle", "build.gradle"),
            ("maven", "pom.xml"),
        ];

        for (manager, file) in package_manager_files {
            if project_path.join(file).exists() {
                info.package_managers.push(manager.to_string());
            }
        }

        Ok(())
    }

    /// Sample code files for AI analysis
    async fn sample_code_files(&self, project_path: &Path, info: &mut ProjectInformation) -> Result<()> {
        let code_extensions = ["js", "ts", "jsx", "tsx", "vue", "svelte", "py", "rs", "go", "java", "php"];
        let max_samples_per_extension = 3;
        let max_file_size = 2000; // chars

        for ext in code_extensions {
            let mut samples = Vec::new();
            self.collect_file_samples(project_path, ext, &mut samples, max_samples_per_extension, max_file_size).await?;
            
            if !samples.is_empty() {
                info.file_samples.insert(ext.to_string(), samples);
            }
        }

        Ok(())
    }

    /// Collect file samples for a specific extension
    fn collect_file_samples<'a>(
        &'a self,
        dir: &'a Path,
        extension: &'a str,
        samples: &'a mut Vec<String>,
        max_samples: usize,
        max_size: usize,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
        if samples.len() >= max_samples {
            return Ok(());
        }

        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            if samples.len() >= max_samples {
                break;
            }

            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !["node_modules", ".git", ".next", "dist", "build"].contains(&dir_name) {
                    self.collect_file_samples(&path, extension, samples, max_samples, max_size).await?;
                }
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext == extension {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let sample = if content.len() > max_size {
                                format!("{}...\n[TRUNCATED]", &content[..max_size])
                            } else {
                                content
                            };
                            samples.push(sample);
                        }
                    }
                }
            }
        }

        Ok(())
        })
    }

    /// Perform AI analysis using LLM
    async fn perform_ai_analysis(
        &self,
        project_info: &ProjectInformation,
        traditional_results: &[FrameworkDetectionResult],
        llm: &LLMEngine,
    ) -> Result<AIProjectAnalysis> {
        let prompt = self.build_analysis_prompt(project_info, traditional_results).await?;
        
        debug!("Generated AI analysis prompt with {} characters", prompt.len());

        let response_text = llm.generate_text(&prompt).await?;
        let llm_response = LLMResponse {
            content: response_text,
            metadata: crate::llm_proxy::LLMMetadata {
                model: "local".to_string(),
                tokens: 0,
                completion_reason: "complete".to_string(),
                cached: false,
                provider_used: "local".to_string(),
                response_time_ms: None,
            },
            error: None,
        };
        
        // Parse AI response
        self.parse_ai_response(&llm_response, traditional_results, project_info).await
    }

    /// Build comprehensive analysis prompt for LLM
    async fn build_analysis_prompt(
        &self,
        project_info: &ProjectInformation,
        traditional_results: &[FrameworkDetectionResult],
    ) -> Result<String> {
        let mut prompt = String::new();
        
        prompt.push_str("You are an expert software architect and code analyst. Analyze this project and provide comprehensive insights.\n\n");
        
        // Project overview
        prompt.push_str("## PROJECT OVERVIEW\n");
        prompt.push_str(&format!("Total files: {}\n", project_info.file_count));
        prompt.push_str(&format!("Package managers: {:?}\n", project_info.package_managers));
        
        // Language distribution
        prompt.push_str("\n## LANGUAGE DISTRIBUTION\n");
        for (lang, count) in &project_info.languages {
            prompt.push_str(&format!("{}: {} files\n", lang, count));
        }
        
        // Directory structure
        prompt.push_str("\n## DIRECTORY STRUCTURE\n");
        for dir in &project_info.directory_structure[..project_info.directory_structure.len().min(20)] {
            prompt.push_str(&format!("- {}\n", dir));
        }
        
        // Key configuration files
        prompt.push_str("\n## KEY CONFIGURATION FILES\n");
        for (file, content) in &project_info.key_files {
            prompt.push_str(&format!("\n### {}\n```\n{}\n```\n", file, content));
        }
        
        // Code samples
        prompt.push_str("\n## CODE SAMPLES\n");
        for (ext, samples) in &project_info.file_samples {
            prompt.push_str(&format!("\n### .{} files\n", ext));
            for (i, sample) in samples.iter().enumerate() {
                prompt.push_str(&format!("Sample {}:\n```\n{}\n```\n", i + 1, sample));
            }
        }
        
        // Traditional detection results
        if !traditional_results.is_empty() {
            prompt.push_str("\n## TRADITIONAL FRAMEWORK DETECTION RESULTS\n");
            for result in traditional_results {
                prompt.push_str(&format!("- {}: {:.2} confidence\n", result.framework, result.confidence));
            }
        }
        
        // Analysis request
        prompt.push_str("\n## ANALYSIS REQUEST\n");
        prompt.push_str("Please provide a comprehensive analysis in JSON format with the following structure:\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"frameworks\": [\n");
        prompt.push_str("    {\n");
        prompt.push_str("      \"framework\": \"framework_id\",\n");
        prompt.push_str("      \"name\": \"Framework Name\",\n");
        prompt.push_str("      \"ai_confidence\": 0.95,\n");
        prompt.push_str("      \"ai_reasoning\": \"Detailed reasoning for detection\",\n");
        prompt.push_str("      \"version\": \"version_if_detected\",\n");
        prompt.push_str("      \"metadata\": {}\n");
        prompt.push_str("    }\n");
        prompt.push_str("  ],\n");
        prompt.push_str("  \"architecture_insights\": [\n");
        prompt.push_str("    {\n");
        prompt.push_str("      \"insight_type\": \"pattern|structure|convention\",\n");
        prompt.push_str("      \"description\": \"Insight description\",\n");
        prompt.push_str("      \"confidence\": 0.85,\n");
        prompt.push_str("      \"suggestions\": [\"improvement suggestions\"],\n");
        prompt.push_str("      \"related_files\": [\"file paths\"]\n");
        prompt.push_str("    }\n");
        prompt.push_str("  ],\n");
        prompt.push_str("  \"code_quality\": {\n");
        prompt.push_str("    \"overall_score\": 0.8,\n");
        prompt.push_str("    \"maintainability\": 0.85,\n");
        prompt.push_str("    \"documentation\": 0.7,\n");
        prompt.push_str("    \"testing\": 0.6,\n");
        prompt.push_str("    \"security\": 0.9,\n");
        prompt.push_str("    \"performance\": 0.8,\n");
        prompt.push_str("    \"issues\": [],\n");
        prompt.push_str("    \"recommendations\": []\n");
        prompt.push_str("  },\n");
        prompt.push_str("  \"reasoning\": \"Overall analysis reasoning\",\n");
        prompt.push_str("  \"overall_confidence\": 0.9\n");
        prompt.push_str("}\n\n");
        prompt.push_str("Focus on:\n");
        prompt.push_str("1. Accurate framework detection with detailed reasoning\n");
        prompt.push_str("2. Architecture patterns and conventions used\n");
        prompt.push_str("3. Code quality assessment\n");
        prompt.push_str("4. Security considerations\n");
        prompt.push_str("5. Performance optimization opportunities\n");
        prompt.push_str("6. Maintainability improvements\n");
        
        Ok(prompt)
    }

    /// Parse AI response into structured analysis
    async fn parse_ai_response(
        &self,
        llm_response: &LLMResponse,
        traditional_results: &[FrameworkDetectionResult],
        project_info: &ProjectInformation,
    ) -> Result<AIProjectAnalysis> {
        // Try to extract JSON from the response
        let json_content = self.extract_json_from_response(&llm_response.content)?;
        
        match serde_json::from_str::<AIProjectAnalysis>(&json_content) {
            Ok(mut ai_analysis) => {
                // Combine AI and traditional results
                ai_analysis.frameworks = self.combine_detection_results(&ai_analysis.frameworks, traditional_results).await?;
                Ok(ai_analysis)
            }
            Err(e) => {
                warn!("Failed to parse AI response as JSON: {}", e);
                // Fallback to manual parsing or traditional results
                self.fallback_analysis(traditional_results, project_info).await
            }
        }
    }

    /// Extract JSON content from LLM response
    fn extract_json_from_response(&self, content: &str) -> Result<String> {
        // Look for JSON block between ```json and ``` or { and }
        if let Some(start) = content.find("```json") {
            if let Some(end) = content[start..].find("```") {
                let json_start = start + 7; // Skip "```json"
                let json_end = start + end;
                return Ok(content[json_start..json_end].trim().to_string());
            }
        }
        
        // Look for standalone JSON object
        if let Some(start) = content.find('{') {
            if let Some(end) = content.rfind('}') {
                return Ok(content[start..=end].trim().to_string());
            }
        }
        
        Err(anyhow::anyhow!("No valid JSON found in LLM response"))
    }

    /// Combine AI and traditional detection results
    async fn combine_detection_results(
        &self,
        ai_frameworks: &[AIFrameworkDetection],
        traditional_results: &[FrameworkDetectionResult],
    ) -> Result<Vec<AIFrameworkDetection>> {
        let mut combined = Vec::new();
        let mut processed_frameworks = std::collections::HashSet::new();

        // Process AI detections first
        for ai_detection in ai_frameworks {
            let traditional_confidence = traditional_results
                .iter()
                .find(|r| r.framework == ai_detection.framework)
                .map(|r| r.confidence)
                .unwrap_or(0.0);

            // Calculate hybrid confidence (weighted average)
            let hybrid_confidence = (ai_detection.ai_confidence * 0.6) + (traditional_confidence * 0.4);

            let mut combined_detection = ai_detection.clone();
            combined_detection.traditional_confidence = traditional_confidence;
            combined_detection.hybrid_confidence = hybrid_confidence;

            // Merge evidence from traditional detection
            if let Some(traditional) = traditional_results.iter().find(|r| r.framework == ai_detection.framework) {
                combined_detection.evidence.extend(traditional.evidence.clone());
                
                // Update version from traditional if not present in AI
                if combined_detection.version.is_none() {
                    combined_detection.version = traditional.version.clone();
                }
            }

            combined.push(combined_detection);
            processed_frameworks.insert(ai_detection.framework.clone());
        }

        // Add high-confidence traditional detections not found by AI
        for traditional in traditional_results {
            if !processed_frameworks.contains(&traditional.framework) && traditional.confidence > 0.7 {
                let ai_detection = AIFrameworkDetection {
                    framework: traditional.framework.clone(),
                    name: self.get_framework_display_name(&traditional.framework),
                    ai_confidence: 0.0,
                    traditional_confidence: traditional.confidence,
                    hybrid_confidence: traditional.confidence * 0.4, // Lower weight without AI confirmation
                    version: traditional.version.clone(),
                    ai_reasoning: "Detected by traditional pattern matching only".to_string(),
                    evidence: traditional.evidence.clone(),
                    metadata: traditional.metadata.clone(),
                };
                combined.push(ai_detection);
            }
        }

        // Sort by hybrid confidence
        combined.sort_by(|a, b| b.hybrid_confidence.partial_cmp(&a.hybrid_confidence).unwrap_or(std::cmp::Ordering::Equal));

        Ok(combined)
    }

    /// Get display name for framework
    fn get_framework_display_name(&self, framework: &str) -> String {
        match framework {
            "nextjs" => "Next.js".to_string(),
            "react" => "React".to_string(),
            "vue" => "Vue.js".to_string(),
            "angular" => "Angular".to_string(),
            "svelte" => "Svelte".to_string(),
            "express" => "Express.js".to_string(),
            "nestjs" => "NestJS".to_string(),
            _ => framework.to_string(),
        }
    }

    /// Fallback analysis when AI is not available
    async fn fallback_analysis(
        &self,
        traditional_results: &[FrameworkDetectionResult],
        project_info: &ProjectInformation,
    ) -> Result<AIProjectAnalysis> {
        let frameworks = traditional_results
            .iter()
            .map(|r| AIFrameworkDetection {
                framework: r.framework.clone(),
                name: self.get_framework_display_name(&r.framework),
                ai_confidence: 0.0,
                traditional_confidence: r.confidence,
                hybrid_confidence: r.confidence,
                version: r.version.clone(),
                ai_reasoning: "Traditional pattern matching only - AI not available".to_string(),
                evidence: r.evidence.clone(),
                metadata: r.metadata.clone(),
            })
            .collect();

        let architecture_insights = vec![
            ArchitectureInsight {
                insight_type: "structure".to_string(),
                description: format!("Project contains {} files across {} languages", 
                                   project_info.file_count, project_info.languages.len()),
                confidence: 0.9,
                suggestions: vec!["Consider AI analysis for deeper insights".to_string()],
                related_files: vec![],
            }
        ];

        let code_quality = CodeQualityAssessment {
            overall_score: 0.7, // Conservative estimate
            maintainability: 0.7,
            documentation: 0.6,
            testing: 0.5,
            security: 0.7,
            performance: 0.7,
            issues: vec![],
            recommendations: vec![
                "Enable AI analysis for detailed code quality assessment".to_string(),
                "Consider adding comprehensive documentation".to_string(),
                "Implement automated testing if not present".to_string(),
            ],
        };

        Ok(AIProjectAnalysis {
            frameworks,
            architecture_insights,
            code_quality,
            reasoning: "Analysis performed using traditional detection methods only. AI analysis unavailable.".to_string(),
            overall_confidence: 0.6,
        })
    }
}

/// Project information collected for AI analysis
#[derive(Debug)]
struct ProjectInformation {
    project_path: String,
    file_count: usize,
    directory_structure: Vec<String>,
    key_files: HashMap<String, String>,
    package_managers: Vec<String>,
    languages: HashMap<String, usize>,
    file_samples: HashMap<String, Vec<String>>,
}