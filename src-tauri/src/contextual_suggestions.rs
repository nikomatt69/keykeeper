use crate::ai_enhanced_detector::{AIProjectAnalysis, AIFrameworkDetection};
use crate::enhanced_api_commands::GenerationSession;
use crate::enhanced_types::TemplateFile;
use crate::llm_proxy::LLMResponse;
use crate::llm_wrapper::LLMEngine;
use crate::template_engine::EnhancedTemplateEngine;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Contextual suggestions engine that provides AI-powered recommendations
pub struct ContextualSuggestionsEngine {
    /// LLM engine for AI-powered analysis
    llm_engine: Arc<RwLock<Option<LLMEngine>>>,
    /// Template engine for template recommendations
    template_engine: Arc<EnhancedTemplateEngine>,
}

/// Contextual suggestions for a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualSuggestions {
    /// Template recommendations based on project context
    pub template_recommendations: Vec<TemplateRecommendation>,
    /// Code improvement suggestions
    pub code_improvements: Vec<CodeImprovement>,
    /// Documentation suggestions
    pub documentation_suggestions: Vec<DocumentationSuggestion>,
    /// Security recommendations
    pub security_recommendations: Vec<SecurityRecommendation>,
    /// Performance optimization suggestions
    pub performance_suggestions: Vec<PerformanceSuggestion>,
    /// Testing suggestions
    pub testing_suggestions: Vec<TestingSuggestion>,
    /// Architecture recommendations
    pub architecture_recommendations: Vec<ArchitectureRecommendation>,
    /// Overall reasoning for suggestions
    pub reasoning: String,
    /// Confidence in suggestions
    pub confidence: f64,
}

/// AI-powered template recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateRecommendation {
    /// Template identifier
    pub template_id: String,
    /// Template display name
    pub template_name: String,
    /// Provider this template is for
    pub provider: String,
    /// Recommendation confidence (0.0 to 1.0)
    pub confidence: f64,
    /// AI reasoning for this recommendation
    pub reasoning: String,
    /// Compatibility score with detected frameworks
    pub compatibility_score: f64,
    /// Expected benefits of using this template
    pub benefits: Vec<String>,
    /// Prerequisites or requirements
    pub requirements: Vec<String>,
    /// Estimated implementation effort (low, medium, high)
    pub effort_level: String,
    /// Template metadata
    pub metadata: HashMap<String, Value>,
    /// Customization suggestions
    pub customizations: Vec<String>,
}

/// Code improvement suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeImprovement {
    /// Type of improvement (refactoring, optimization, modernization, etc.)
    pub improvement_type: String,
    /// Description of the improvement
    pub description: String,
    /// Priority level (low, medium, high, critical)
    pub priority: String,
    /// File paths affected
    pub affected_files: Vec<String>,
    /// Estimated impact (low, medium, high)
    pub impact: String,
    /// Implementation complexity (simple, moderate, complex)
    pub complexity: String,
    /// Before/after code examples if applicable
    pub code_examples: Option<CodeExample>,
    /// Benefits of implementing this improvement
    pub benefits: Vec<String>,
    /// Potential risks or considerations
    pub risks: Vec<String>,
}

/// Documentation suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationSuggestion {
    /// Type of documentation (API, README, comments, etc.)
    pub doc_type: String,
    /// Description of what needs documentation
    pub description: String,
    /// Priority level
    pub priority: String,
    /// Suggested location for documentation
    pub suggested_location: String,
    /// Template or outline for the documentation
    pub template: Option<String>,
    /// Existing documentation gaps identified
    pub gaps: Vec<String>,
    /// Target audience (developers, users, maintainers)
    pub target_audience: String,
}

/// Security recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRecommendation {
    /// Security category (authentication, authorization, data protection, etc.)
    pub category: String,
    /// Severity level (low, medium, high, critical)
    pub severity: String,
    /// Description of the security issue or recommendation
    pub description: String,
    /// Potential vulnerabilities addressed
    pub vulnerabilities: Vec<String>,
    /// Recommended actions
    pub actions: Vec<String>,
    /// Security tools or practices to implement
    pub tools: Vec<String>,
    /// Compliance considerations
    pub compliance: Vec<String>,
}

/// Performance optimization suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSuggestion {
    /// Performance category (loading, rendering, memory, network, etc.)
    pub category: String,
    /// Description of the optimization
    pub description: String,
    /// Expected performance impact
    pub impact: String,
    /// Implementation difficulty
    pub difficulty: String,
    /// Specific techniques or patterns to use
    pub techniques: Vec<String>,
    /// Metrics to measure improvement
    pub metrics: Vec<String>,
    /// Tools for monitoring or profiling
    pub monitoring_tools: Vec<String>,
}

/// Testing suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestingSuggestion {
    /// Type of testing (unit, integration, e2e, performance, etc.)
    pub test_type: String,
    /// Description of what should be tested
    pub description: String,
    /// Priority level
    pub priority: String,
    /// Recommended testing frameworks or tools
    pub frameworks: Vec<String>,
    /// Test coverage goals
    pub coverage_goals: Vec<String>,
    /// Test scenarios to implement
    pub scenarios: Vec<String>,
    /// Existing testing gaps
    pub gaps: Vec<String>,
}

/// Architecture recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureRecommendation {
    /// Architecture pattern or principle
    pub pattern: String,
    /// Description of the recommendation
    pub description: String,
    /// Benefits of implementing this pattern
    pub benefits: Vec<String>,
    /// Implementation considerations
    pub considerations: Vec<String>,
    /// Examples or references
    pub examples: Vec<String>,
    /// Alternative approaches
    pub alternatives: Vec<String>,
    /// Migration strategy if applicable
    pub migration_strategy: Option<String>,
}

/// Code example showing before/after
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeExample {
    /// Code before improvement
    pub before: String,
    /// Code after improvement
    pub after: String,
    /// Language of the code
    pub language: String,
    /// Explanation of the changes
    pub explanation: String,
}

/// Smart template matching request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartTemplateMatchingRequest {
    /// Project path to analyze
    pub project_path: String,
    /// Specific provider to focus on (optional)
    pub target_provider: Option<String>,
    /// Required features or capabilities
    pub required_features: Vec<String>,
    /// Preferences for template characteristics
    pub preferences: HashMap<String, Value>,
    /// Existing project analysis (if available)
    pub project_analysis: Option<AIProjectAnalysis>,
}

/// Smart template matching result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartTemplateMatchingResult {
    /// Recommended templates ranked by suitability
    pub recommendations: Vec<TemplateRecommendation>,
    /// Semantic similarity scores
    pub similarity_analysis: SemanticSimilarityAnalysis,
    /// Customization suggestions for top recommendations
    pub customization_suggestions: HashMap<String, Vec<String>>,
    /// Alternative approaches if templates don't fit well
    pub alternatives: Vec<AlternativeApproach>,
    /// Overall matching confidence
    pub matching_confidence: f64,
}

/// Semantic similarity analysis between project and templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticSimilarityAnalysis {
    /// Project characteristics vector
    pub project_vector: Vec<f64>,
    /// Template similarity scores
    pub template_scores: HashMap<String, f64>,
    /// Key similarity factors
    pub similarity_factors: Vec<SimilarityFactor>,
    /// Analysis methodology used
    pub methodology: String,
}

/// Factor contributing to semantic similarity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityFactor {
    /// Factor name (technology_stack, architecture_pattern, etc.)
    pub factor: String,
    /// Weight in overall similarity calculation
    pub weight: f64,
    /// Score for this factor
    pub score: f64,
    /// Explanation of the score
    pub explanation: String,
}

/// Alternative approach when templates don't match well
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeApproach {
    /// Approach name
    pub name: String,
    /// Description of the approach
    pub description: String,
    /// Benefits of this approach
    pub benefits: Vec<String>,
    /// Implementation steps
    pub implementation_steps: Vec<String>,
    /// Required resources or tools
    pub requirements: Vec<String>,
}

impl ContextualSuggestionsEngine {
    /// Create a new contextual suggestions engine
    pub fn new(
        llm_engine: Arc<RwLock<Option<LLMEngine>>>,
        template_engine: Arc<EnhancedTemplateEngine>,
    ) -> Self {
        Self {
            llm_engine,
            template_engine,
        }
    }

    /// Get contextual suggestions for a project
    pub async fn get_contextual_suggestions(
        &self,
        project_path: &str,
        project_analysis: &AIProjectAnalysis,
    ) -> Result<ContextualSuggestions> {
        info!("Generating contextual suggestions for project: {}", project_path);

        if let Some(llm) = &*self.llm_engine.read().await {
            self.generate_ai_suggestions(project_path, project_analysis, llm).await
        } else {
            warn!("LLM not available, providing basic suggestions");
            self.generate_basic_suggestions(project_path, project_analysis).await
        }
    }

    /// Generate AI-powered suggestions
    async fn generate_ai_suggestions(
        &self,
        project_path: &str,
        project_analysis: &AIProjectAnalysis,
        llm: &LLMEngine,
    ) -> Result<ContextualSuggestions> {
        let prompt = self.build_suggestions_prompt(project_path, project_analysis).await?;
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
        
        self.parse_suggestions_response(&llm_response, project_analysis).await
    }

    /// Build prompt for AI suggestions
    async fn build_suggestions_prompt(
        &self,
        project_path: &str,
        project_analysis: &AIProjectAnalysis,
    ) -> Result<String> {
        let mut prompt = String::new();
        
        prompt.push_str("You are an expert software consultant providing contextual suggestions for project improvement.\n\n");
        
        // Project analysis summary
        prompt.push_str("## PROJECT ANALYSIS SUMMARY\n");
        for framework in &project_analysis.frameworks {
            prompt.push_str(&format!("- {} (confidence: {:.2}, reasoning: {})\n", 
                                   framework.name, framework.hybrid_confidence, framework.ai_reasoning));
        }
        
        // Architecture insights
        prompt.push_str("\n## ARCHITECTURE INSIGHTS\n");
        for insight in &project_analysis.architecture_insights {
            prompt.push_str(&format!("- {}: {} (confidence: {:.2})\n", 
                                   insight.insight_type, insight.description, insight.confidence));
        }
        
        // Code quality assessment
        prompt.push_str("\n## CODE QUALITY ASSESSMENT\n");
        let quality = &project_analysis.code_quality;
        prompt.push_str(&format!("Overall Score: {:.2}\n", quality.overall_score));
        prompt.push_str(&format!("Maintainability: {:.2}\n", quality.maintainability));
        prompt.push_str(&format!("Documentation: {:.2}\n", quality.documentation));
        prompt.push_str(&format!("Testing: {:.2}\n", quality.testing));
        prompt.push_str(&format!("Security: {:.2}\n", quality.security));
        prompt.push_str(&format!("Performance: {:.2}\n", quality.performance));
        
        // Request for suggestions
        prompt.push_str("\n## SUGGESTIONS REQUEST\n");
        prompt.push_str("Based on this analysis, provide comprehensive suggestions in JSON format:\n");
        prompt.push_str("{\n");
        prompt.push_str("  \"template_recommendations\": [\n");
        prompt.push_str("    {\n");
        prompt.push_str("      \"template_id\": \"template_identifier\",\n");
        prompt.push_str("      \"template_name\": \"Template Name\",\n");
        prompt.push_str("      \"provider\": \"provider_name\",\n");
        prompt.push_str("      \"confidence\": 0.9,\n");
        prompt.push_str("      \"reasoning\": \"Why this template is recommended\",\n");
        prompt.push_str("      \"compatibility_score\": 0.95,\n");
        prompt.push_str("      \"benefits\": [\"list of benefits\"],\n");
        prompt.push_str("      \"requirements\": [\"prerequisites\"],\n");
        prompt.push_str("      \"effort_level\": \"low|medium|high\",\n");
        prompt.push_str("      \"customizations\": [\"suggested customizations\"]\n");
        prompt.push_str("    }\n");
        prompt.push_str("  ],\n");
        prompt.push_str("  \"code_improvements\": [\n");
        prompt.push_str("    {\n");
        prompt.push_str("      \"improvement_type\": \"refactoring|optimization|modernization\",\n");
        prompt.push_str("      \"description\": \"Description of improvement\",\n");
        prompt.push_str("      \"priority\": \"low|medium|high|critical\",\n");
        prompt.push_str("      \"affected_files\": [\"file paths\"],\n");
        prompt.push_str("      \"impact\": \"low|medium|high\",\n");
        prompt.push_str("      \"complexity\": \"simple|moderate|complex\",\n");
        prompt.push_str("      \"benefits\": [\"benefits of implementing\"],\n");
        prompt.push_str("      \"risks\": [\"potential risks\"]\n");
        prompt.push_str("    }\n");
        prompt.push_str("  ],\n");
        prompt.push_str("  \"documentation_suggestions\": [\n");
        prompt.push_str("    {\n");
        prompt.push_str("      \"doc_type\": \"API|README|comments\",\n");
        prompt.push_str("      \"description\": \"What needs documentation\",\n");
        prompt.push_str("      \"priority\": \"low|medium|high\",\n");
        prompt.push_str("      \"suggested_location\": \"where to add docs\",\n");
        prompt.push_str("      \"gaps\": [\"existing documentation gaps\"],\n");
        prompt.push_str("      \"target_audience\": \"developers|users|maintainers\"\n");
        prompt.push_str("    }\n");
        prompt.push_str("  ],\n");
        prompt.push_str("  \"security_recommendations\": [],\n");
        prompt.push_str("  \"performance_suggestions\": [],\n");
        prompt.push_str("  \"testing_suggestions\": [],\n");
        prompt.push_str("  \"architecture_recommendations\": [],\n");
        prompt.push_str("  \"reasoning\": \"Overall reasoning for suggestions\",\n");
        prompt.push_str("  \"confidence\": 0.85\n");
        prompt.push_str("}\n\n");
        
        prompt.push_str("Focus on:\n");
        prompt.push_str("1. Template recommendations that match the detected frameworks\n");
        prompt.push_str("2. Actionable code improvements based on quality assessment\n");
        prompt.push_str("3. Security best practices for the technology stack\n");
        prompt.push_str("4. Performance optimizations specific to the frameworks used\n");
        prompt.push_str("5. Testing strategies appropriate for the project type\n");
        prompt.push_str("6. Documentation improvements to enhance maintainability\n");
        
        Ok(prompt)
    }

    /// Parse AI suggestions response
    async fn parse_suggestions_response(
        &self,
        llm_response: &LLMResponse,
        project_analysis: &AIProjectAnalysis,
    ) -> Result<ContextualSuggestions> {
        // Try to extract JSON from response
        let json_content = self.extract_json_from_response(&llm_response.content)?;
        
        match serde_json::from_str::<ContextualSuggestions>(&json_content) {
            Ok(suggestions) => Ok(suggestions),
            Err(e) => {
                warn!("Failed to parse AI suggestions response: {}", e);
                self.generate_basic_suggestions("", project_analysis).await
            }
        }
    }

    /// Extract JSON from LLM response
    fn extract_json_from_response(&self, content: &str) -> Result<String> {
        if let Some(start) = content.find("```json") {
            if let Some(end) = content[start..].find("```") {
                let json_start = start + 7;
                let json_end = start + end;
                return Ok(content[json_start..json_end].trim().to_string());
            }
        }
        
        if let Some(start) = content.find('{') {
            if let Some(end) = content.rfind('}') {
                return Ok(content[start..=end].trim().to_string());
            }
        }
        
        Err(anyhow::anyhow!("No valid JSON found in suggestions response"))
    }

    /// Generate basic suggestions when AI is not available
    async fn generate_basic_suggestions(
        &self,
        _project_path: &str,
        project_analysis: &AIProjectAnalysis,
    ) -> Result<ContextualSuggestions> {
        let mut template_recommendations = Vec::new();
        
        // Generate basic template recommendations based on detected frameworks
        for framework in &project_analysis.frameworks {
            if framework.hybrid_confidence > 0.5 {
                match framework.framework.as_str() {
                    "nextjs" => {
                        template_recommendations.push(TemplateRecommendation {
                            template_id: "better-auth-nextjs".to_string(),
                            template_name: "Better Auth for Next.js".to_string(),
                            provider: "better-auth".to_string(),
                            confidence: 0.8,
                            reasoning: "Next.js detected - Better Auth provides excellent TypeScript support".to_string(),
                            compatibility_score: 0.9,
                            benefits: vec![
                                "Type-safe authentication".to_string(),
                                "Modern hooks-based API".to_string(),
                                "Great Next.js integration".to_string(),
                            ],
                            requirements: vec!["Next.js 13+".to_string(), "TypeScript (recommended)".to_string()],
                            effort_level: "medium".to_string(),
                            metadata: HashMap::new(),
                            customizations: vec![
                                "Configure OAuth providers".to_string(),
                                "Set up database integration".to_string(),
                            ],
                        });
                    }
                    "react" => {
                        template_recommendations.push(TemplateRecommendation {
                            template_id: "openai-react".to_string(),
                            template_name: "OpenAI SDK for React".to_string(),
                            provider: "openai".to_string(),
                            confidence: 0.7,
                            reasoning: "React detected - OpenAI SDK works well with React applications".to_string(),
                            compatibility_score: 0.8,
                            benefits: vec![
                                "Easy AI integration".to_string(),
                                "React-friendly API".to_string(),
                                "Comprehensive documentation".to_string(),
                            ],
                            requirements: vec!["React 16.8+".to_string(), "API key setup".to_string()],
                            effort_level: "low".to_string(),
                            metadata: HashMap::new(),
                            customizations: vec![
                                "Configure API endpoints".to_string(),
                                "Set up error handling".to_string(),
                            ],
                        });
                    }
                    _ => {}
                }
            }
        }

        // Basic code improvements based on quality assessment
        let mut code_improvements = Vec::new();
        let quality = &project_analysis.code_quality;
        
        if quality.documentation < 0.7 {
            code_improvements.push(CodeImprovement {
                improvement_type: "documentation".to_string(),
                description: "Improve code documentation and comments".to_string(),
                priority: "medium".to_string(),
                affected_files: vec!["All source files".to_string()],
                impact: "medium".to_string(),
                complexity: "simple".to_string(),
                code_examples: None,
                benefits: vec![
                    "Better maintainability".to_string(),
                    "Easier onboarding".to_string(),
                    "Reduced technical debt".to_string(),
                ],
                risks: vec!["Time investment required".to_string()],
            });
        }

        if quality.testing < 0.6 {
            code_improvements.push(CodeImprovement {
                improvement_type: "testing".to_string(),
                description: "Add comprehensive test coverage".to_string(),
                priority: "high".to_string(),
                affected_files: vec!["All feature modules".to_string()],
                impact: "high".to_string(),
                complexity: "moderate".to_string(),
                code_examples: None,
                benefits: vec![
                    "Increased reliability".to_string(),
                    "Safer refactoring".to_string(),
                    "Better code quality".to_string(),
                ],
                risks: vec!["Initial setup complexity".to_string()],
            });
        }

        Ok(ContextualSuggestions {
            template_recommendations,
            code_improvements,
            documentation_suggestions: vec![],
            security_recommendations: vec![],
            performance_suggestions: vec![],
            testing_suggestions: vec![],
            architecture_recommendations: vec![],
            reasoning: "Basic suggestions generated from framework detection and quality assessment".to_string(),
            confidence: 0.6,
        })
    }

    /// Perform smart template matching using semantic similarity
    pub async fn get_smart_template_recommendations(
        &self,
        request: &SmartTemplateMatchingRequest,
    ) -> Result<SmartTemplateMatchingResult> {
        info!("Performing smart template matching for project: {}", request.project_path);

        // Get project analysis if not provided
        let project_analysis = if let Some(analysis) = &request.project_analysis {
            analysis.clone()
        } else {
            // TODO: Integrate with AI enhanced detector
            return Err(anyhow::anyhow!("Project analysis required for smart template matching"));
        };

        // For now, use a basic list of available templates
        let available_templates = vec![];
        
        // Perform semantic similarity analysis
        let similarity_analysis = self.analyze_semantic_similarity(&project_analysis, &available_templates).await?;
        
        // Generate recommendations based on similarity scores
        let recommendations = self.generate_template_recommendations(
            &project_analysis,
            &available_templates,
            &similarity_analysis,
            request,
        ).await?;

        // Generate customization suggestions
        let customization_suggestions = self.generate_customization_suggestions(&recommendations, &project_analysis).await?;

        // Generate alternatives if no good matches
        let alternatives = if recommendations.is_empty() || recommendations[0].confidence < 0.5 {
            self.generate_alternative_approaches(&project_analysis, request).await?
        } else {
            vec![]
        };

        let matching_confidence = if !recommendations.is_empty() {
            recommendations.iter().map(|r| r.confidence).fold(0.0, f64::max)
        } else {
            0.0
        };

        Ok(SmartTemplateMatchingResult {
            recommendations,
            similarity_analysis,
            customization_suggestions,
            alternatives,
            matching_confidence,
        })
    }

    /// Analyze semantic similarity between project and templates
    async fn analyze_semantic_similarity(
        &self,
        project_analysis: &AIProjectAnalysis,
        _available_templates: &[TemplateFile],
    ) -> Result<SemanticSimilarityAnalysis> {
        // Generate project characteristics vector
        let project_vector = self.generate_project_vector(project_analysis).await?;
        
        // For now, use simple heuristic matching
        // In a full implementation, this would use embedding models or semantic analysis
        let mut template_scores = HashMap::new();
        
        // Calculate similarity scores based on framework compatibility
        for framework in &project_analysis.frameworks {
            match framework.framework.as_str() {
                "nextjs" => {
                    template_scores.insert("better-auth-nextjs".to_string(), 0.9);
                    template_scores.insert("openai-nextjs".to_string(), 0.8);
                    template_scores.insert("stripe-nextjs".to_string(), 0.85);
                }
                "react" => {
                    template_scores.insert("openai-react".to_string(), 0.8);
                    template_scores.insert("better-auth-react".to_string(), 0.7);
                }
                "vue" => {
                    template_scores.insert("openai-vue".to_string(), 0.8);
                }
                "express" => {
                    template_scores.insert("better-auth-express".to_string(), 0.85);
                    template_scores.insert("openai-express".to_string(), 0.8);
                }
                _ => {}
            }
        }

        let similarity_factors = vec![
            SimilarityFactor {
                factor: "framework_compatibility".to_string(),
                weight: 0.4,
                score: 0.8,
                explanation: "Templates match detected frameworks well".to_string(),
            },
            SimilarityFactor {
                factor: "architecture_alignment".to_string(),
                weight: 0.3,
                score: 0.7,
                explanation: "Template architecture aligns with project structure".to_string(),
            },
            SimilarityFactor {
                factor: "technology_stack".to_string(),
                weight: 0.3,
                score: 0.75,
                explanation: "Technology stack compatibility is good".to_string(),
            },
        ];

        Ok(SemanticSimilarityAnalysis {
            project_vector,
            template_scores,
            similarity_factors,
            methodology: "Heuristic framework-based matching".to_string(),
        })
    }

    /// Generate project characteristics vector
    async fn generate_project_vector(&self, project_analysis: &AIProjectAnalysis) -> Result<Vec<f64>> {
        // Simple vector representation based on project characteristics
        let mut vector = vec![0.0; 10];
        
        // Framework presence (positions 0-5)
        for framework in &project_analysis.frameworks {
            match framework.framework.as_str() {
                "nextjs" => vector[0] = framework.hybrid_confidence,
                "react" => vector[1] = framework.hybrid_confidence,
                "vue" => vector[2] = framework.hybrid_confidence,
                "angular" => vector[3] = framework.hybrid_confidence,
                "express" => vector[4] = framework.hybrid_confidence,
                "nestjs" => vector[5] = framework.hybrid_confidence,
                _ => {}
            }
        }
        
        // Quality metrics (positions 6-9)
        let quality = &project_analysis.code_quality;
        vector[6] = quality.maintainability;
        vector[7] = quality.testing;
        vector[8] = quality.security;
        vector[9] = quality.performance;
        
        Ok(vector)
    }

    /// Generate template recommendations based on similarity analysis
    async fn generate_template_recommendations(
        &self,
        project_analysis: &AIProjectAnalysis,
        _available_templates: &[TemplateFile],
        similarity_analysis: &SemanticSimilarityAnalysis,
        request: &SmartTemplateMatchingRequest,
    ) -> Result<Vec<TemplateRecommendation>> {
        let mut recommendations = Vec::new();
        
        // Sort templates by similarity score
        let mut scored_templates: Vec<_> = similarity_analysis.template_scores.iter().collect();
        scored_templates.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        for (template_id, &score) in scored_templates.iter().take(5) {
            if score < 0.3 {
                continue;
            }
            
            // Filter by target provider if specified
            if let Some(target) = &request.target_provider {
                if !template_id.contains(target) {
                    continue;
                }
            }
            
            let recommendation = self.create_template_recommendation(
                template_id,
                score,
                project_analysis,
                request,
            ).await?;
            
            recommendations.push(recommendation);
        }
        
        Ok(recommendations)
    }

    /// Create a template recommendation
    async fn create_template_recommendation(
        &self,
        template_id: &str,
        confidence: f64,
        project_analysis: &AIProjectAnalysis,
        _request: &SmartTemplateMatchingRequest,
    ) -> Result<TemplateRecommendation> {
        let (provider, template_name) = self.parse_template_info(template_id);
        
        // Calculate compatibility score based on detected frameworks
        let compatibility_score = project_analysis.frameworks
            .iter()
            .filter_map(|f| {
                if template_id.contains(&f.framework) {
                    Some(f.hybrid_confidence)
                } else {
                    None
                }
            })
            .fold(0.0, f64::max);
        
        let benefits = self.get_template_benefits(&provider, &project_analysis.frameworks);
        let requirements = self.get_template_requirements(&provider);
        let effort_level = self.estimate_effort_level(&provider, project_analysis);
        
        Ok(TemplateRecommendation {
            template_id: template_id.to_string(),
            template_name,
            provider,
            confidence,
            reasoning: format!("High compatibility with detected frameworks (score: {:.2})", compatibility_score),
            compatibility_score,
            benefits,
            requirements,
            effort_level,
            metadata: HashMap::new(),
            customizations: vec![],
        })
    }

    /// Parse template information from ID
    fn parse_template_info(&self, template_id: &str) -> (String, String) {
        let parts: Vec<&str> = template_id.split('-').collect();
        if parts.len() >= 2 {
            let provider = parts[0].to_string();
            let framework = parts[1..].join("-");
            let template_name = format!("{} for {}", 
                                      self.capitalize(&provider), 
                                      self.capitalize(&framework));
            (provider, template_name)
        } else {
            (template_id.to_string(), template_id.to_string())
        }
    }

    /// Capitalize first letter
    fn capitalize(&self, s: &str) -> String {
        let mut chars = s.chars();
        match chars.next() {
            None => String::new(),
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        }
    }

    /// Get benefits for a template based on provider and frameworks
    fn get_template_benefits(&self, provider: &str, frameworks: &[AIFrameworkDetection]) -> Vec<String> {
        let mut benefits = Vec::new();
        
        match provider {
            "better-auth" => {
                benefits.push("Type-safe authentication".to_string());
                benefits.push("Modern React hooks API".to_string());
                benefits.push("Built-in security best practices".to_string());
            }
            "openai" => {
                benefits.push("Easy AI integration".to_string());
                benefits.push("Comprehensive API coverage".to_string());
                benefits.push("Excellent documentation".to_string());
            }
            "stripe" => {
                benefits.push("Secure payment processing".to_string());
                benefits.push("PCI compliance handling".to_string());
                benefits.push("Multiple payment methods".to_string());
            }
            _ => {
                benefits.push("Framework integration".to_string());
                benefits.push("Production-ready configuration".to_string());
            }
        }
        
        // Add framework-specific benefits
        for framework in frameworks {
            if framework.hybrid_confidence > 0.7 {
                match framework.framework.as_str() {
                    "nextjs" => benefits.push("Optimized for Next.js SSR/SSG".to_string()),
                    "react" => benefits.push("React hooks integration".to_string()),
                    "typescript" => benefits.push("Full TypeScript support".to_string()),
                    _ => {}
                }
            }
        }
        
        benefits
    }

    /// Get requirements for a template
    fn get_template_requirements(&self, provider: &str) -> Vec<String> {
        match provider {
            "better-auth" => vec![
                "Node.js 16+".to_string(),
                "Database setup".to_string(),
                "Environment variables configuration".to_string(),
            ],
            "openai" => vec![
                "OpenAI API key".to_string(),
                "API rate limiting consideration".to_string(),
            ],
            "stripe" => vec![
                "Stripe account".to_string(),
                "SSL certificate".to_string(),
                "Webhook endpoint setup".to_string(),
            ],
            _ => vec!["Basic project setup".to_string()],
        }
    }

    /// Estimate implementation effort level
    fn estimate_effort_level(&self, provider: &str, project_analysis: &AIProjectAnalysis) -> String {
        let base_effort = match provider {
            "openai" => "low",
            "better-auth" => "medium",
            "stripe" => "medium",
            _ => "medium",
        };
        
        // Adjust based on project complexity
        let complexity_factor = project_analysis.code_quality.overall_score;
        if complexity_factor < 0.5 {
            match base_effort {
                "low" => "medium".to_string(),
                "medium" => "high".to_string(),
                "high" => "high".to_string(),
                _ => base_effort.to_string(),
            }
        } else {
            base_effort.to_string()
        }
    }

    /// Generate customization suggestions for recommendations
    async fn generate_customization_suggestions(
        &self,
        recommendations: &[TemplateRecommendation],
        project_analysis: &AIProjectAnalysis,
    ) -> Result<HashMap<String, Vec<String>>> {
        let mut suggestions = HashMap::new();
        
        for recommendation in recommendations {
            let mut customizations = Vec::new();
            
            // Provider-specific customizations
            match recommendation.provider.as_str() {
                "better-auth" => {
                    customizations.push("Configure OAuth providers (Google, GitHub, etc.)".to_string());
                    customizations.push("Set up database schema and migrations".to_string());
                    customizations.push("Customize session management".to_string());
                    
                    if project_analysis.frameworks.iter().any(|f| f.framework == "nextjs") {
                        customizations.push("Configure Next.js middleware for auth".to_string());
                    }
                }
                "openai" => {
                    customizations.push("Set up API key management".to_string());
                    customizations.push("Configure rate limiting and error handling".to_string());
                    customizations.push("Implement streaming responses".to_string());
                    
                    if project_analysis.code_quality.security < 0.8 {
                        customizations.push("Add input validation and sanitization".to_string());
                    }
                }
                "stripe" => {
                    customizations.push("Configure payment methods and currencies".to_string());
                    customizations.push("Set up webhook event handling".to_string());
                    customizations.push("Implement subscription management".to_string());
                }
                _ => {
                    customizations.push("Adapt configuration to project structure".to_string());
                }
            }
            
            suggestions.insert(recommendation.template_id.clone(), customizations);
        }
        
        Ok(suggestions)
    }

    /// Generate alternative approaches when templates don't match well
    async fn generate_alternative_approaches(
        &self,
        project_analysis: &AIProjectAnalysis,
        _request: &SmartTemplateMatchingRequest,
    ) -> Result<Vec<AlternativeApproach>> {
        let mut alternatives = Vec::new();
        
        // Manual configuration approach
        alternatives.push(AlternativeApproach {
            name: "Manual Configuration".to_string(),
            description: "Set up integrations manually with custom configuration".to_string(),
            benefits: vec![
                "Full control over implementation".to_string(),
                "Tailored to specific needs".to_string(),
                "No template constraints".to_string(),
            ],
            implementation_steps: vec![
                "Research provider documentation".to_string(),
                "Create custom configuration files".to_string(),
                "Implement integration logic".to_string(),
                "Add error handling and validation".to_string(),
                "Test thoroughly".to_string(),
            ],
            requirements: vec![
                "Development time".to_string(),
                "Provider documentation".to_string(),
                "Testing environment".to_string(),
            ],
        });
        
        // If project has low quality scores, suggest improvement first
        if project_analysis.code_quality.overall_score < 0.6 {
            alternatives.push(AlternativeApproach {
                name: "Project Improvement First".to_string(),
                description: "Improve project structure and quality before adding integrations".to_string(),
                benefits: vec![
                    "Better foundation for integrations".to_string(),
                    "Easier maintenance".to_string(),
                    "Reduced technical debt".to_string(),
                ],
                implementation_steps: vec![
                    "Refactor code structure".to_string(),
                    "Add comprehensive testing".to_string(),
                    "Improve documentation".to_string(),
                    "Update dependencies".to_string(),
                    "Then proceed with integrations".to_string(),
                ],
                requirements: vec![
                    "Time for refactoring".to_string(),
                    "Testing framework setup".to_string(),
                    "Code review process".to_string(),
                ],
            });
        }
        
        Ok(alternatives)
    }
}