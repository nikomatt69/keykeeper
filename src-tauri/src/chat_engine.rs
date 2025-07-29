use crate::documentation_library::*;
use crate::llm_wrapper::{LLMEngine, LLMConfig};
use crate::ml_engine::MLEngine;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Chat engine for LLM-powered documentation assistance
pub struct ChatEngine {
    llm_engine: Option<Arc<LLMEngine>>,
    ml_engine: Option<Arc<MLEngine>>,
    doc_manager: Arc<DocumentationLibraryManager>,
    llm_proxy_state: Option<Arc<crate::llm_proxy::LLMProxyState>>,
    config: ChatEngineConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatEngineConfig {
    pub max_context_chunks: usize,
    pub min_similarity_threshold: f32,
    pub max_conversation_history: usize,
    pub enable_code_generation: bool,
    pub enable_integration_assistance: bool,
    pub system_prompt_template: String,
    pub response_max_tokens: usize,
    pub temperature: f32,
}

impl Default for ChatEngineConfig {
    fn default() -> Self {
        Self {
            max_context_chunks: 5,
            min_similarity_threshold: 0.75,
            max_conversation_history: 10,
            enable_code_generation: true,
            enable_integration_assistance: true,
            system_prompt_template: Self::default_system_prompt(),
            response_max_tokens: 1024,
            temperature: 0.7,
        }
    }
}

impl ChatEngineConfig {
    fn default_system_prompt() -> String {
        r#"You are an expert API integration assistant powered by comprehensive documentation knowledge. 

Your role is to help developers integrate APIs by:
1. Providing accurate, contextual information from official documentation
2. Generating working code examples and configurations
3. Explaining complex concepts clearly with practical examples
4. Suggesting best practices and security considerations
5. Troubleshooting integration issues

Key principles:
- Always base answers on provided documentation context
- Generate production-ready, secure code
- Explain the reasoning behind recommendations
- Provide multiple approaches when appropriate
- Include error handling and edge cases
- Reference specific documentation sections when possible

If you're unsure about something, say so clearly and suggest consulting the official documentation."#.to_string()
    }
}

/// Chat request from user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub session_id: String,
    pub user_message: String,
    pub context_libraries: Vec<String>,
    pub user_preferences: UserPreferences,
    pub generation_context: Option<GenerationContext>,
    pub include_code_generation: bool,
}

/// Chat response with context and generated content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message_id: String,
    pub content: String,
    pub context_chunks: Vec<DocumentationSearchResult>,
    pub generated_code: Option<GeneratedCode>,
    pub suggestions: Vec<ChatSuggestion>,
    pub metadata: ChatResponseMetadata,
    pub follow_up_questions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSuggestion {
    pub title: String,
    pub description: String,
    pub action: SuggestionAction,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionAction {
    GenerateCode { framework: String, language: String },
    ExploreDocumentation { library_id: String, section: String },
    CreateIntegration { provider: String },
    ViewExample { example_type: String },
    LearnMore { topic: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponseMetadata {
    pub processing_time_ms: u64,
    pub context_relevance: f32,
    pub tokens_used: Option<usize>,
    pub search_queries: Vec<String>,
    pub confidence_score: f32,
    pub used_libraries: Vec<String>,
}

impl ChatEngine {
    /// Create a new chat engine instance
    pub fn new(
        llm_engine: Option<Arc<LLMEngine>>,
        ml_engine: Option<Arc<MLEngine>>,
        doc_manager: Arc<DocumentationLibraryManager>,
        llm_proxy_state: Option<Arc<crate::llm_proxy::LLMProxyState>>,
        config: ChatEngineConfig,
    ) -> Self {
        Self {
            llm_engine,
            ml_engine,
            doc_manager,
            llm_proxy_state,
            config,
        }
    }

    /// Get a reference to the documentation manager
    pub fn doc_manager(&self) -> &Arc<DocumentationLibraryManager> {
        &self.doc_manager
    }

    /// Process a chat request and generate response
    pub async fn process_chat(&self, request: ChatRequest) -> Result<ChatResponse> {
        let start_time = std::time::Instant::now();
        info!("Processing chat request for session: {}", request.session_id);

        // 1. Retrieve conversation history
        let conversation_history = self.get_conversation_context(&request.session_id).await?;

        // 2. Perform semantic search for relevant documentation
        let search_results = self.search_documentation(&request).await?;

        // 3. Build context for LLM
        let context = self.build_chat_context(&request, &conversation_history, &search_results).await?;

        // 4. Generate response using LLM
        let (response_content, generated_code) = self.generate_response(&request, &context).await?;

        // 5. Generate suggestions and follow-up questions
        let suggestions = self.generate_suggestions(&request, &search_results).await?;
        let follow_up_questions = self.generate_follow_up_questions(&request, &response_content).await?;

        // 6. Store message in conversation history
        let message_id = self.store_chat_message(&request, &response_content, &search_results, &generated_code).await?;

        let processing_time = start_time.elapsed();
        
        Ok(ChatResponse {
            message_id,
            content: response_content,
            context_chunks: search_results.clone(),
            generated_code,
            suggestions,
            metadata: ChatResponseMetadata {
                processing_time_ms: processing_time.as_millis() as u64,
                context_relevance: self.calculate_context_relevance(&search_results),
                tokens_used: None, // Would be populated by LLM
                search_queries: vec![request.user_message.clone()],
                confidence_score: self.calculate_response_confidence(&search_results),
                used_libraries: request.context_libraries.clone(),
            },
            follow_up_questions,
        })
    }

    /// Search documentation for relevant context
    async fn search_documentation(&self, request: &ChatRequest) -> Result<Vec<DocumentationSearchResult>> {
        debug!("Searching documentation for: {}", request.user_message);

        // Generate embedding for user query if ML engine available
        let query_embedding = if let Some(ml_engine) = &self.ml_engine {
            match ml_engine.get_usage_stats().await {
                Ok(_) => {
                    // ML engine is available, but we need to implement embedding generation
                    // For now, use a placeholder - this would integrate with the embedding model
                    warn!("ML engine embedding generation not implemented, using text search");
                    vec![0.0; 384] // Placeholder embedding
                }
                Err(_) => {
                    warn!("ML engine not available for embedding generation");
                    vec![0.0; 384] // Placeholder embedding
                }
            }
        } else {
            warn!("No ML engine available for semantic search");
            vec![0.0; 384] // Placeholder embedding
        };

        // Build search parameters
        let search_params = VectorSearchParams {
            query: request.user_message.clone(),
            library_ids: if request.context_libraries.is_empty() {
                None
            } else {
                Some(request.context_libraries.clone())
            },
            content_types: None, // Allow all content types
            min_similarity: self.config.min_similarity_threshold,
            max_results: self.config.max_context_chunks,
            include_metadata: true,
            boost_recent: true,
            section_filter: None,
        };

        // Perform vector search
        let results = self.doc_manager.vector_search(search_params, query_embedding).await?;
        
        info!("Found {} relevant documentation chunks", results.len());
        
        Ok(results)
    }

    /// Build comprehensive chat context
    async fn build_chat_context(
        &self,
        request: &ChatRequest,
        conversation_history: &[ChatMessage],
        search_results: &[DocumentationSearchResult],
    ) -> Result<ChatContext> {
        Ok(ChatContext {
            relevant_chunks: search_results.to_vec(),
            previous_messages: conversation_history.to_vec(),
            user_preferences: request.user_preferences.clone(),
            generation_context: request.generation_context.clone(),
        })
    }

    /// Generate response using LLM
    async fn generate_response(
        &self,
        request: &ChatRequest,
        context: &ChatContext,
    ) -> Result<(String, Option<GeneratedCode>)> {
        debug!("Generating LLM response");

        // Build comprehensive prompt
        let prompt = self.build_llm_prompt(request, context).await?;

        // Try using LLM proxy first for real dynamic responses
        let llm_response = self.try_llm_proxy_generation(&prompt, request).await;
        
        match llm_response {
            Ok(response) => {
                info!("✅ Generated LLM response successfully via proxy");
                
                // Extract code blocks if code generation is requested
                let generated_code = if request.include_code_generation {
                    self.extract_generated_code(&response, request).await?
                } else {
                    None
                };
                
                Ok((response, generated_code))
            },
            Err(proxy_error) => {
                error!("❌ LLM proxy failed: {}", proxy_error);
                
                // Fall back to local LLM engine if available
                if let Some(llm_engine) = &self.llm_engine {
                    info!("🔄 Trying local LLM engine as fallback");
                    match llm_engine.generate_text(&prompt).await {
                        Ok(response) => {
                            info!("✅ Generated LLM response successfully via local engine");
                            
                            // Extract code blocks if code generation is requested
                            let generated_code = if request.include_code_generation {
                                self.extract_generated_code(&response, request).await?
                            } else {
                                None
                            };
                            
                            Ok((response, generated_code))
                        },
                        Err(e) => {
                            error!("❌ Local LLM generation failed: {}", e);
                            // Return an error that explains the situation instead of fallback
                            return Err(anyhow!(
                                "Unable to generate AI response. All LLM providers failed:\n\n\
                                🔍 Primary Error: {}\n\
                                🔍 Local LLM Error: {}\n\n\
                                Please configure an LLM provider to enable dynamic chat responses.", 
                                proxy_error, e
                            ));
                        }
                    }
                } else {
                    // Return an error with helpful instructions instead of static fallback
                    return Err(anyhow!(
                        "Unable to generate AI response: {}\n\n\
                        🚀 To enable dynamic chat responses:\n\
                        1. Set up OpenAI: Export OPENAI_API_KEY environment variable\n\
                        2. Set up Anthropic: Export ANTHROPIC_API_KEY environment variable\n\
                        3. Set up Ollama: Install and run Ollama locally\n\n\
                        Without an LLM provider, the chat cannot provide intelligent responses.", 
                        proxy_error
                    ));
                }
            }
        }
    }

    /// Try generating response using LLM proxy (OpenAI, Ollama, etc.)
    async fn try_llm_proxy_generation(&self, prompt: &str, request: &ChatRequest) -> Result<String> {
        use crate::llm_proxy::{LLMConfig as ProxyConfig, process_with_llm_internal};

        // Use injected proxy state or create default
        let proxy_state = self.llm_proxy_state.clone()
            .unwrap_or_else(|| Arc::new(crate::llm_proxy::LLMProxyState::default()));

        // Try OpenAI first if API key is available
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            info!("🔑 Using OpenAI API for chat response");
            let config = ProxyConfig {
                provider: "openai".to_string(),
                model: "gpt-4o-mini".to_string(), // Use GPT-4o for better responses and cost efficiency
                temperature: self.config.temperature,
                max_tokens: self.config.response_max_tokens,
                api_key: Some(api_key),
                stream: Some(false),
                system_prompt: Some(self.build_system_prompt_for_provider("openai")),
            };

            match process_with_llm_internal(prompt.to_string(), None, config.clone(), proxy_state.clone()).await {
                Ok(response) => {
                    info!("✅ OpenAI API response received: {} chars", response.content.len());
                    return Ok(response.content);
                },
                Err(e) => {
                    error!("❌ OpenAI request failed: {}", e);
                    // Continue to try other providers
                }
            }
        } else {
            debug!("No OPENAI_API_KEY found, skipping OpenAI");
        }

        // Try Anthropic Claude if API key is available
        if let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") {
            info!("🔑 Using Anthropic Claude API for chat response");
            let config = ProxyConfig {
                provider: "anthropic".to_string(),
                model: "claude-sonnet-4-20250514".to_string(), // Use Claude 3.5 Sonnet for best quality
                temperature: self.config.temperature,
                max_tokens: self.config.response_max_tokens,
                api_key: Some(api_key),
                stream: Some(false),
                system_prompt: Some(self.build_system_prompt_for_provider("anthropic")),
            };

            match process_with_llm_internal(prompt.to_string(), None, config.clone(), proxy_state.clone()).await {
                Ok(response) => {
                    info!("✅ Anthropic Claude response received: {} chars", response.content.len());
                    return Ok(response.content);
                },
                Err(e) => {
                    error!("❌ Anthropic request failed: {}", e);
                    // Continue to try other providers
                }
            }
        } else {
            debug!("No ANTHROPIC_API_KEY found, skipping Anthropic");
        }

        // Try Ollama as fallback (check common models)
        info!("🦙 Trying Ollama local models as fallback");
        let ollama_models = [
            "qwen2.5:latest", "qwen2.5:7b", "qwen2.5:14b", // Prioritize Qwen models
            "llama3.2:latest", "llama3.1:latest", "llama3.1:8b", 
            "llama3:latest", "llama3:8b",
            "codellama:latest", "codellama:7b",
            "mistral:latest", "mistral:7b",
            "dolphin-mixtral:latest"
        ];
        
        for model in &ollama_models {
            debug!("Trying Ollama model: {}", model);
            let ollama_config = ProxyConfig {
                provider: "ollama".to_string(),
                model: model.to_string(),
                temperature: self.config.temperature,
                max_tokens: self.config.response_max_tokens,
                api_key: None,
                stream: Some(false),
                system_prompt: Some(self.build_system_prompt_for_provider("ollama")),
            };

            match process_with_llm_internal(prompt.to_string(), None, ollama_config, proxy_state.clone()).await {
                Ok(response) => {
                    info!("✅ Ollama ({}) response received: {} chars", model, response.content.len());
                    return Ok(response.content);
                },
                Err(e) => {
                    debug!("Ollama {} request failed: {}", model, e);
                    // Continue to next model
                }
            }
        }

        // Final fallback: Use local integrated model (even if not perfect)
        info!("🔄 Trying local integrated model as final fallback");
        let config = ProxyConfig {
            provider: "local".to_string(),
            model: "/Volumes/SSD/dev/projects/keykeeper/src-tauri/models/Qwen3-0.6B.Q2_K.gguf".to_string(),
            temperature: self.config.temperature,
            max_tokens: self.config.response_max_tokens,
            api_key: None,
            stream: Some(false),
            system_prompt: Some(self.build_system_prompt_for_provider("local")),
        };

        match process_with_llm_internal(prompt.to_string(), None, config, proxy_state.clone()).await {
            Ok(response) => {
                info!("✅ Local integrated model response: {} chars", response.content.len());
                return Ok(response.content);
            },
            Err(e) => {
                error!("❌ Local integrated model also failed: {}", e);
            }
        }

        Err(anyhow!(
            "❌ All LLM providers failed to generate a response.\n\n\
            🔍 Troubleshooting steps:\n\
            1. For OpenAI: Set OPENAI_API_KEY environment variable\n\
            2. For Anthropic: Set ANTHROPIC_API_KEY environment variable\n\
            3. For Ollama: Ensure Ollama is running locally (http://localhost:11434) with a model installed\n\n\
            💡 To use Ollama:\n\
            - Install: https://ollama.ai\n\
            - Run: ollama pull llama3.1\n\
            - Start: ollama serve"
        ))
    }

    /// Build LLM prompt with context
    async fn build_llm_prompt(&self, request: &ChatRequest, context: &ChatContext) -> Result<String> {
        let mut prompt = String::new();
        
        // Enhanced system prompt with role definition
        prompt.push_str("You are an expert API integration and development assistant with comprehensive knowledge of modern APIs, frameworks, and programming languages. ");
        prompt.push_str("Your mission is to provide developers with accurate, practical, and actionable guidance for API integration, configuration, and development tasks.\n\n");
        
        // Add enhanced core capabilities
        prompt.push_str("🎯 CORE CAPABILITIES:\n");
        prompt.push_str("• API Integration: Authentication, configuration, error handling, rate limiting\n");
        prompt.push_str("• Code Generation: Production-ready code with proper error handling and security\n");
        prompt.push_str("• Documentation Analysis: Extract relevant information from API docs and examples\n");
        prompt.push_str("• Best Practices: Security, performance, maintainability, and testing\n");
        prompt.push_str("• Troubleshooting: Debug integration issues and provide solutions\n");
        prompt.push_str("• Multi-Language Support: Adapt solutions to the user's preferred language/framework\n\n");
        
        // Add core system prompt
        prompt.push_str(&self.config.system_prompt_template);
        prompt.push_str("\n\n");

        // Add user preferences and target environment
        prompt.push_str("=== USER CONTEXT ===\n");
        prompt.push_str(&format!("Preferred Language: {}\n", context.user_preferences.preferred_language));
        prompt.push_str(&format!("Preferred Framework: {}\n", context.user_preferences.preferred_framework));
        prompt.push_str(&format!("Code Style: {}\n", context.user_preferences.code_style));
        prompt.push_str(&format!("Detail Level: {:?}\n", context.user_preferences.detail_level));
        prompt.push_str(&format!("Include Examples: {}\n", context.user_preferences.include_examples));
        prompt.push_str(&format!("Include Tests: {}\n", context.user_preferences.include_tests));
        prompt.push_str(&format!("Security Focused: {}\n", context.user_preferences.security_focused));

        if let Some(gen_context) = &context.generation_context {
            prompt.push_str(&format!("Target Framework: {}\n", gen_context.target_framework));
            prompt.push_str(&format!("Target Language: {}\n", gen_context.target_language));
            
            if let Some(project_context) = &gen_context.project_context {
                prompt.push_str(&format!("Project Context: {}\n", project_context));
            }
            
            if !gen_context.requirements.is_empty() {
                prompt.push_str(&format!("Requirements: {}\n", gen_context.requirements.join(", ")));
            }
            
            if !gen_context.constraints.is_empty() {
                prompt.push_str(&format!("Constraints: {}\n", gen_context.constraints.join(", ")));
            }
        }
        prompt.push_str("=== END USER CONTEXT ===\n\n");

        // Add conversation history for context awareness with better formatting
        if !context.previous_messages.is_empty() {
            prompt.push_str("=== CONVERSATION HISTORY ===\n");
            prompt.push_str("Recent conversation for context (most recent first):\n\n");
            
            let recent_messages: Vec<_> = context.previous_messages.iter()
                .rev()
                .take(self.config.max_conversation_history)
                .collect();
            
            for (i, message) in recent_messages.into_iter().rev().enumerate() {
                let role = match message.role {
                    MessageRole::User => "👤 User",
                    MessageRole::Assistant => "🤖 Assistant",
                    MessageRole::System => "⚙️ System",
                };
                
                // Smart truncation - keep important information
                let content = if message.content.len() > 800 {
                    let truncated = &message.content[..800];
                    // Try to truncate at a sentence boundary
                    if let Some(pos) = truncated.rfind(". ") {
                        format!("{}...", &truncated[..pos + 1])
                    } else if let Some(pos) = truncated.rfind(' ') {
                        format!("{}...", &truncated[..pos])
                    } else {
                        format!("{}...", truncated)
                    }
                } else {
                    message.content.clone()
                };
                
                prompt.push_str(&format!("{}. {} ({}):\n{}\n\n", 
                    i + 1,
                    role, 
                    message.created_at.format("%H:%M"),
                    content
                ));
            }
            prompt.push_str("=== END CONVERSATION HISTORY ===\n\n");
        }

        // Add documentation context with enhanced relevance scoring and prioritization
        if !context.relevant_chunks.is_empty() {
            prompt.push_str("=== RELEVANT DOCUMENTATION ===\n");
            prompt.push_str("📚 Available documentation sources (prioritized by relevance):\n\n");
            
            // Sort by relevance score (highest first)
            let mut sorted_chunks = context.relevant_chunks.clone();
            sorted_chunks.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap_or(std::cmp::Ordering::Equal));
            
            for (i, chunk) in sorted_chunks.iter().enumerate() {
                let relevance_indicator = if chunk.relevance_score > 0.9 {
                    "🎯 HIGHLY RELEVANT"
                } else if chunk.relevance_score > 0.7 {
                    "✅ RELEVANT"
                } else {
                    "📖 REFERENCE"
                };
                
                prompt.push_str(&format!(
                    "📑 Source {} - {} (Score: {:.2}):\n",
                    i + 1,
                    relevance_indicator,
                    chunk.relevance_score
                ));
                prompt.push_str(&format!("📝 Title: {}\n", chunk.title));
                prompt.push_str(&format!("📂 Section: {}\n", chunk.section_path.join(" > ")));
                
                // Include more content for highly relevant chunks
                let content = if chunk.relevance_score > 0.8 {
                    chunk.content.clone()
                } else if chunk.content.len() > 1000 {
                    format!("{}...\n[Content truncated - full details available if needed]", &chunk.content[..1000])
                } else {
                    chunk.content.clone()
                };
                
                prompt.push_str(&format!("📄 Content:\n{}\n", content));
                prompt.push_str("---\n\n");
            }
            prompt.push_str("💡 DOCUMENTATION USAGE GUIDELINES:\n");
            prompt.push_str("• Prioritize information from highly relevant sources\n");
            prompt.push_str("• Reference specific sections when providing answers\n");
            prompt.push_str("• If documentation is unclear, suggest consulting the official source\n");
            prompt.push_str("• Combine information from multiple sources when helpful\n");
            prompt.push_str("=== END DOCUMENTATION ===\n\n");
        }

        // Add the current user question with emphasis
        prompt.push_str("=== CURRENT QUESTION ===\n");
        prompt.push_str(&format!("User asks: \"{}\"\n", request.user_message));
        prompt.push_str("=== END QUESTION ===\n\n");

        // Add enhanced response instructions with structured guidance
        prompt.push_str("=== RESPONSE INSTRUCTIONS ===\n");
        prompt.push_str("🎯 RESPONSE REQUIREMENTS:\n");
        prompt.push_str("Provide a comprehensive, actionable response that:\n\n");
        
        prompt.push_str("📋 CORE ELEMENTS:\n");
        prompt.push_str("1. ✅ Directly addresses the user's specific question\n");
        prompt.push_str("2. 📚 Uses provided documentation as primary information source\n");
        prompt.push_str("3. 🛠️ Includes practical, working examples when appropriate\n");
        prompt.push_str("4. 🎯 Follows user's preferred language and framework\n");
        prompt.push_str("5. 📖 Explains complex concepts step-by-step with clear reasoning\n");
        prompt.push_str("6. 🔒 Highlights security considerations and best practices\n");
        prompt.push_str("7. ⚠️ Points out common pitfalls and how to avoid them\n\n");
        
        if request.include_code_generation {
            prompt.push_str("💻 CODE GENERATION REQUIREMENTS:\n");
            prompt.push_str("8. 🧩 Provide complete, production-ready code with proper error handling\n");
            prompt.push_str("9. ⚙️ Include configuration examples and environment setup\n");
            prompt.push_str("10. 💡 Add detailed comments explaining important sections\n");
            prompt.push_str("11. 🔗 Show integration points and dependencies\n\n");
        }
        
        if context.user_preferences.include_tests {
            prompt.push_str("🧪 TESTING:\n");
            prompt.push_str("12. 📋 Include practical test examples and validation steps\n\n");
        }
        
        prompt.push_str("📝 FORMATTING GUIDELINES:\n");
        prompt.push_str("• Use clear markdown formatting for readability\n");
        prompt.push_str("• Structure response with headers, lists, and code blocks\n");
        prompt.push_str("• Use emojis sparingly for visual organization\n");
        prompt.push_str("• Include relevant links and references\n\n");
        
        prompt.push_str("🤔 UNCERTAINTY HANDLING:\n");
        prompt.push_str("• If uncertain, clearly state limitations\n");
        prompt.push_str("• Suggest consulting official documentation\n");
        prompt.push_str("• Provide multiple approaches when applicable\n");
        prompt.push_str("• Ask clarifying questions if needed\n\n");
        
        prompt.push_str("🎯 SUCCESS CRITERIA:\n");
        prompt.push_str("Your response should enable the user to successfully implement the solution with confidence.\n");
        prompt.push_str("=== END INSTRUCTIONS ===\n");

        Ok(prompt)
    }

    /// Build provider-specific system prompt
    fn build_system_prompt_for_provider(&self, provider: &str) -> String {
        let mut system_prompt = self.config.system_prompt_template.clone();
        
        // Add provider-specific instructions
        match provider {
            "openai" => {
                system_prompt.push_str("\n\n🎯 OPENAI-SPECIFIC INSTRUCTIONS:\n");
                system_prompt.push_str("• Use your extensive training on API documentation and code examples\n");
                system_prompt.push_str("• Provide clear, step-by-step implementation guidance\n");
                system_prompt.push_str("• Include relevant code snippets with explanations\n");
                system_prompt.push_str("• Reference best practices from the OpenAI ecosystem\n");
            },
            "anthropic" => {
                system_prompt.push_str("\n\n🎯 CLAUDE-SPECIFIC INSTRUCTIONS:\n");
                system_prompt.push_str("• Use your analytical capabilities to break down complex integrations\n");
                system_prompt.push_str("• Provide thoughtful explanations of trade-offs and alternatives\n");
                system_prompt.push_str("• Include security considerations and best practices\n");
                system_prompt.push_str("• Structure responses with clear sections and reasoning\n");
            },
            "ollama" => {
                system_prompt.push_str("\n\n🎯 LOCAL MODEL INSTRUCTIONS:\n");
                system_prompt.push_str("• Focus on practical, working code examples\n");
                system_prompt.push_str("• Keep responses concise but comprehensive\n");
                system_prompt.push_str("• Prioritize commonly used patterns and libraries\n");
                system_prompt.push_str("• Include essential error handling and validation\n");
            },
            "local" => {
                system_prompt.push_str("\n\n🎯 LOCAL QWEN MODEL INSTRUCTIONS:\n");
                system_prompt.push_str("• Provide helpful, practical responses\n");
                system_prompt.push_str("• Focus on working solutions and clear explanations\n");
                system_prompt.push_str("• Include relevant code examples when appropriate\n");
                system_prompt.push_str("• Keep responses concise but informative\n");
            },
            _ => {}
        }
        
        system_prompt
    }

    /// Generate intelligent fallback response when LLM is not available
    async fn generate_intelligent_fallback(&self, request: &ChatRequest, context: &ChatContext) -> Result<String> {
        let mut response = String::new();
        
        // Analyze the user's question to provide targeted help
        let user_message = request.user_message.to_lowercase();
        
        // Start with contextual greeting based on query type
        if user_message.contains("how") || user_message.contains("setup") || user_message.contains("configure") {
            response.push_str("I can help you with the setup and configuration. ");
        } else if user_message.contains("error") || user_message.contains("problem") || user_message.contains("issue") {
            response.push_str("I understand you're experiencing an issue. ");
        } else if user_message.contains("example") || user_message.contains("code") {
            response.push_str("I can provide code examples and implementation guidance. ");
        } else {
            response.push_str("I can help you with your API integration question. ");
        }
        
        if !context.relevant_chunks.is_empty() {
            response.push_str("Based on the available documentation, here are the most relevant resources:\n\n");
            
            // Prioritize chunks by relevance and show more detailed responses
            for (i, chunk) in context.relevant_chunks.iter().take(3).enumerate() {
                response.push_str(&format!("**{}. {}**\n", i + 1, chunk.title));
                
                // Show more content for highly relevant chunks
                let content_preview = if chunk.relevance_score > 0.8 && chunk.content.len() > 300 {
                    format!("{}...", &chunk.content[..300])
                } else if chunk.content.len() > 150 {
                    format!("{}...", &chunk.content[..150])
                } else {
                    chunk.content.clone()
                };
                
                response.push_str(&format!("{}\n\n", content_preview));
                
                // Add section path for context
                if !chunk.section_path.is_empty() {
                    response.push_str(&format!("*Section: {}*\n\n", chunk.section_path.join(" > ")));
                }
            }
            
            // Add actionable suggestions based on content
            if context.relevant_chunks.iter().any(|c| c.content.contains("API key") || c.content.contains("authentication")) {
                response.push_str("💡 **Next Steps:**\n");
                response.push_str("1. Set up your API credentials\n");
                response.push_str("2. Configure authentication in your application\n");
                response.push_str("3. Test the connection\n\n");
            } else if context.relevant_chunks.iter().any(|c| c.content.contains("install") || c.content.contains("dependency")) {
                response.push_str("💡 **Next Steps:**\n");
                response.push_str("1. Install required dependencies\n");
                response.push_str("2. Configure your development environment\n");
                response.push_str("3. Import necessary modules\n\n");
            }
            
            response.push_str("For more detailed information, I recommend reviewing the complete documentation sections above.");
        } else {
            // No relevant documentation found - provide helpful guidance
            response.push_str("I couldn't find specific documentation for your query in the current knowledge base.\n\n");
            
            response.push_str("Here are some suggestions:\n");
            response.push_str("• Check the official API documentation for the most up-to-date information\n");
            response.push_str("• Try rephrasing your question with more specific terms\n");
            response.push_str("• Look for code examples in the provider's documentation or GitHub repositories\n");
            
            // Provide framework-specific guidance if available
            if !request.user_preferences.preferred_framework.is_empty() {
                response.push_str(&format!("• Search for {} integration examples\n", request.user_preferences.preferred_framework));
            }
            
            if !request.user_preferences.preferred_language.is_empty() {
                response.push_str(&format!("• Look for {} SDK or client libraries\n", request.user_preferences.preferred_language));
            }
        }
        
        // Add follow-up encouragement
        response.push_str("\n❓ Feel free to ask more specific questions about authentication, configuration, or implementation details!");
        
        Ok(response)
    }

    /// Extract generated code from LLM response
    async fn extract_generated_code(&self, response: &str, request: &ChatRequest) -> Result<Option<GeneratedCode>> {
        // Look for code blocks in the response
        let code_block_regex = match regex::Regex::new(r"```(\w+)?\n([\s\S]*?)\n```") {
            Ok(regex) => regex,
            Err(_) => return Ok(None),
        };
        let mut code_blocks = Vec::new();
        
        for captures in code_block_regex.captures_iter(response) {
            let language = captures.get(1).map(|m| m.as_str()).unwrap_or("text");
            let content = captures.get(2).map(|m| m.as_str()).unwrap_or("");
            
            if !content.trim().is_empty() {
                let filename = self.generate_filename_for_code(language, &code_blocks.len());
                let description = format!("Generated {} code example", language);
                
                code_blocks.push(CodeBlock {
                    filename,
                    content: content.to_string(),
                    description,
                    file_type: self.determine_file_type(language),
                });
            }
        }
        
        if code_blocks.is_empty() {
            return Ok(None);
        }
        
        let framework = request.generation_context
            .as_ref()
            .map(|ctx| ctx.target_framework.clone())
            .unwrap_or_else(|| request.user_preferences.preferred_framework.clone());
            
        let language = request.generation_context
            .as_ref()
            .map(|ctx| ctx.target_language.clone())
            .unwrap_or_else(|| request.user_preferences.preferred_language.clone());
        
        Ok(Some(GeneratedCode {
            language,
            framework,
            code_blocks,
            dependencies: Vec::new(), // Would be extracted from code analysis
            configuration: std::collections::HashMap::new(),
            test_cases: None,
            documentation: None,
        }))
    }

    /// Generate suggestions based on context and query
    async fn generate_suggestions(&self, request: &ChatRequest, search_results: &[DocumentationSearchResult]) -> Result<Vec<ChatSuggestion>> {
        let mut suggestions = Vec::new();
        
        // Code generation suggestion
        if self.config.enable_code_generation && request.include_code_generation {
            suggestions.push(ChatSuggestion {
                title: "Generate Integration Code".to_string(),
                description: "Create complete integration code with configuration".to_string(),
                action: SuggestionAction::GenerateCode {
                    framework: request.user_preferences.preferred_framework.clone(),
                    language: request.user_preferences.preferred_language.clone(),
                },
                confidence: 0.8,
            });
        }
        
        // Documentation exploration suggestions
        for result in search_results.iter().take(2) {
            suggestions.push(ChatSuggestion {
                title: format!("Explore {}", result.title),
                description: format!("Learn more about {}", result.section_path.join(" > ")),
                action: SuggestionAction::ExploreDocumentation {
                    library_id: result.library_id.clone(),
                    section: result.section_path.join("/"),
                },
                confidence: result.relevance_score,
            });
        }
        
        // Integration creation suggestion
        if self.config.enable_integration_assistance {
            suggestions.push(ChatSuggestion {
                title: "Create Full Integration".to_string(),
                description: "Generate a complete integration setup with best practices".to_string(),
                action: SuggestionAction::CreateIntegration {
                    provider: "detected_provider".to_string(), // Would be detected from context
                },
                confidence: 0.7,
            });
        }
        
        Ok(suggestions)
    }

    /// Generate follow-up questions
    async fn generate_follow_up_questions(&self, request: &ChatRequest, response: &str) -> Result<Vec<String>> {
        let mut questions = Vec::new();
        
        // Generic follow-up questions based on content
        if response.contains("configuration") {
            questions.push("Would you like help with environment variables and configuration setup?".to_string());
        }
        
        if response.contains("authentication") || response.contains("API key") {
            questions.push("Do you need help with authentication and security best practices?".to_string());
        }
        
        if response.contains("example") || response.contains("code") {
            questions.push("Would you like to see more code examples or test cases?".to_string());
        }
        
        if request.generation_context.is_some() {
            questions.push("Should I generate additional configuration files for your project?".to_string());
        }
        
        // Limit to 3 follow-up questions
        questions.truncate(3);
        
        Ok(questions)
    }

    /// Store chat message in conversation history
    async fn store_chat_message(
        &self,
        request: &ChatRequest,
        response_content: &str,
        search_results: &[DocumentationSearchResult],
        generated_code: &Option<GeneratedCode>,
    ) -> Result<String> {
        // Store user message
        let user_message = ChatMessage {
            id: String::new(), // Will be set by manager
            session_id: request.session_id.clone(),
            role: MessageRole::User,
            content: request.user_message.clone(),
            context_chunks: Vec::new(),
            metadata: MessageMetadata {
                token_count: None,
                processing_time_ms: None,
                context_relevance: None,
                generated_code: None,
                search_queries: vec![request.user_message.clone()],
                confidence_score: None,
            },
            created_at: Utc::now(),
        };
        
        self.doc_manager.add_chat_message(user_message).await?;
        
        // Store assistant response
        let assistant_message = ChatMessage {
            id: String::new(), // Will be set by manager
            session_id: request.session_id.clone(),
            role: MessageRole::Assistant,
            content: response_content.to_string(),
            context_chunks: search_results.iter().map(|r| r.chunk_id.clone()).collect(),
            metadata: MessageMetadata {
                token_count: None,
                processing_time_ms: None,
                context_relevance: Some(self.calculate_context_relevance(search_results)),
                generated_code: generated_code.clone(),
                search_queries: vec![request.user_message.clone()],
                confidence_score: Some(self.calculate_response_confidence(search_results)),
            },
            created_at: Utc::now(),
        };
        
        self.doc_manager.add_chat_message(assistant_message).await
    }

    /// Get conversation context
    async fn get_conversation_context(&self, session_id: &str) -> Result<Vec<ChatMessage>> {
        let messages = self.doc_manager.get_chat_messages(session_id).await?;
        
        // Return the last N messages for context
        let context_messages = messages
            .into_iter()
            .rev()
            .take(self.config.max_conversation_history)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        
        Ok(context_messages)
    }

    /// Helper methods for metrics and utilities
    fn calculate_context_relevance(&self, search_results: &[DocumentationSearchResult]) -> f32 {
        if search_results.is_empty() {
            return 0.0;
        }
        
        search_results.iter().map(|r| r.relevance_score).sum::<f32>() / search_results.len() as f32
    }

    fn calculate_response_confidence(&self, search_results: &[DocumentationSearchResult]) -> f32 {
        if search_results.is_empty() {
            return 0.3; // Low confidence without context
        }
        
        let avg_similarity = search_results.iter().map(|r| r.similarity_score).sum::<f32>() / search_results.len() as f32;
        
        // Confidence increases with better similarity and more results
        let result_count_factor = (search_results.len() as f32 / self.config.max_context_chunks as f32).min(1.0);
        
        (avg_similarity * 0.7 + result_count_factor * 0.3).min(1.0)
    }

    fn generate_filename_for_code(&self, language: &str, index: &usize) -> String {
        match language {
            "typescript" | "ts" => format!("integration-{}.ts", index),
            "javascript" | "js" => format!("integration-{}.js", index),
            "python" | "py" => format!("integration_{}.py", index),
            "json" => format!("config-{}.json", index),
            "yaml" | "yml" => format!("config-{}.yaml", index),
            "bash" | "shell" => format!("setup-{}.sh", index),
            _ => format!("code-{}.{}", index, language),
        }
    }

    fn determine_file_type(&self, language: &str) -> CodeFileType {
        match language {
            "json" | "yaml" | "yml" | "toml" => CodeFileType::Configuration,
            "test" | "spec" => CodeFileType::Test,
            "md" | "markdown" => CodeFileType::Documentation,
            _ => CodeFileType::Component,
        }
    }
}

/// Integration generation service
impl ChatEngine {
    /// Generate complete integration based on requirements
    pub async fn generate_integration(&self, request: IntegrationGenerationRequest) -> Result<IntegrationGeneration> {
        info!("Generating integration for provider: {}", request.provider_name);
        
        // Search for provider-specific documentation
        let search_params = VectorSearchParams {
            query: format!("{} {} integration", request.provider_name, request.framework),
            library_ids: None,
            content_types: Some(vec![ContentType::Tutorial, ContentType::Configuration, ContentType::Example]),
            min_similarity: 0.6,
            max_results: 10,
            include_metadata: true,
            boost_recent: true,
            section_filter: None,
        };
        
        // Generate query embedding (placeholder for now)
        let query_embedding = vec![0.0; 384];
        let context_chunks = self.doc_manager.vector_search(search_params, query_embedding).await?;
        
        // Build generation context
        let generation_context = GenerationContext {
            target_framework: request.framework.clone(),
            target_language: request.language.clone(),
            project_context: request.project_context.clone(),
            existing_code: request.existing_code.clone(),
            requirements: request.requirements.clone(),
            constraints: request.constraints.clone(),
        };
        
        // Generate code using LLM if available
        let generated_code = if let Some(llm_engine) = &self.llm_engine {
            let prompt = self.build_integration_prompt(&request, &context_chunks, &generation_context).await?;
            
            match llm_engine.generate_text(&prompt).await {
                Ok(response) => {
                    self.parse_integration_response(&response, &request).await?
                },
                Err(e) => {
                    warn!("LLM integration generation failed: {}", e);
                    self.generate_template_integration(&request).await?
                }
            }
        } else {
            self.generate_template_integration(&request).await?
        };
        
        // Create integration generation record
        let integration = IntegrationGeneration {
            id: String::new(), // Will be set by manager
            session_id: request.session_id,
            provider_name: request.provider_name,
            framework: request.framework,
            language: request.language,
            user_requirements: request.requirements.join("; "),
            generated_code,
            context_chunks: context_chunks.iter().map(|c| c.chunk_id.clone()).collect(),
            generation_metadata: GenerationMetadata {
                template_used: Some("llm_generated".to_string()),
                llm_model: "chat_engine".to_string(),
                context_tokens: 0, // Would be calculated
                generation_tokens: 0, // Would be calculated
                quality_score: None,
                user_feedback: None,
            },
            created_at: Utc::now(),
            status: GenerationStatus::Success,
        };
        
        Ok(integration)
    }

    async fn build_integration_prompt(
        &self,
        request: &IntegrationGenerationRequest,
        context_chunks: &[DocumentationSearchResult],
        generation_context: &GenerationContext,
    ) -> Result<String> {
        let mut prompt = String::new();
        
        prompt.push_str(&format!(
            "Generate a complete {} integration for {} framework in {}.\n\n",
            request.provider_name, request.framework, request.language
        ));
        
        // Add documentation context
        if !context_chunks.is_empty() {
            prompt.push_str("=== DOCUMENTATION CONTEXT ===\n");
            for chunk in context_chunks {
                prompt.push_str(&format!("{}\n{}\n\n", chunk.title, chunk.content));
            }
            prompt.push_str("=== END CONTEXT ===\n\n");
        }
        
        // Add requirements
        if !request.requirements.is_empty() {
            prompt.push_str(&format!("Requirements:\n- {}\n\n", request.requirements.join("\n- ")));
        }
        
        // Add constraints
        if !request.constraints.is_empty() {
            prompt.push_str(&format!("Constraints:\n- {}\n\n", request.constraints.join("\n- ")));
        }
        
        prompt.push_str("Generate the following files:\n");
        prompt.push_str("1. Main integration component/service\n");
        prompt.push_str("2. Configuration file\n");
        prompt.push_str("3. Environment variables template\n");
        prompt.push_str("4. Type definitions (if TypeScript)\n");
        prompt.push_str("5. Basic test file\n\n");
        
        prompt.push_str("Include proper error handling, security best practices, and comprehensive documentation.");
        
        Ok(prompt)
    }

    async fn parse_integration_response(&self, response: &str, request: &IntegrationGenerationRequest) -> Result<GeneratedCode> {
        // Extract code blocks from LLM response
        let code_block_regex = match regex::Regex::new(r"```(\w+)?\n([\s\S]*?)\n```") {
            Ok(regex) => regex,
            Err(_) => return self.generate_template_integration(request).await,
        };
        let mut code_blocks = Vec::new();
        
        for captures in code_block_regex.captures_iter(response) {
            let language = captures.get(1).map(|m| m.as_str()).unwrap_or("text");
            let content = captures.get(2).map(|m| m.as_str()).unwrap_or("");
            
            if !content.trim().is_empty() {
                let filename = self.determine_integration_filename(language, &code_blocks.len(), &request.provider_name);
                let description = format!("{} integration file", request.provider_name);
                
                code_blocks.push(CodeBlock {
                    filename,
                    content: content.to_string(),
                    description,
                    file_type: self.determine_file_type(language),
                });
            }
        }
        
        Ok(GeneratedCode {
            language: request.language.clone(),
            framework: request.framework.clone(),
            code_blocks,
            dependencies: vec![], // Would be extracted from code analysis
            configuration: std::collections::HashMap::new(),
            test_cases: None,
            documentation: Some(format!("Integration for {} API", request.provider_name)),
        })
    }

    async fn generate_template_integration(&self, request: &IntegrationGenerationRequest) -> Result<GeneratedCode> {
        // Fallback template generation
        let main_code = format!(
            "// {} Integration for {}\n// Generated template - customize as needed\n\nclass {}Integration {{\n  constructor(config) {{\n    this.config = config;\n  }}\n\n  async initialize() {{\n    // Initialize {} connection\n  }}\n}}",
            request.provider_name,
            request.framework,
            request.provider_name.replace(" ", ""),
            request.provider_name
        );
        
        let config_code = format!(
            "{{\n  \"{}Config\": {{\n    \"apiKey\": \"your_api_key\",\n    \"endpoint\": \"https://api.example.com\"\n  }}\n}}",
            request.provider_name.to_lowercase()
        );
        
        let code_blocks = vec![
            CodeBlock {
                filename: format!("{}-integration.{}", request.provider_name.to_lowercase(), 
                    if request.language == "typescript" { "ts" } else { "js" }),
                content: main_code,
                description: format!("Main {} integration", request.provider_name),
                file_type: CodeFileType::Component,
            },
            CodeBlock {
                filename: "config.json".to_string(),
                content: config_code,
                description: "Configuration file".to_string(),
                file_type: CodeFileType::Configuration,
            },
        ];
        
        Ok(GeneratedCode {
            language: request.language.clone(),
            framework: request.framework.clone(),
            code_blocks,
            dependencies: vec![],
            configuration: std::collections::HashMap::new(),
            test_cases: None,
            documentation: Some(format!("Template integration for {}", request.provider_name)),
        })
    }

    fn determine_integration_filename(&self, language: &str, index: &usize, provider: &str) -> String {
        let provider_slug = provider.to_lowercase().replace(" ", "-");
        
        match language {
            "typescript" | "ts" => format!("{}-integration.ts", provider_slug),
            "javascript" | "js" => format!("{}-integration.js", provider_slug),
            "python" | "py" => format!("{}_integration.py", provider_slug),
            "json" => format!("{}-config.json", provider_slug),
            "yaml" | "yml" => format!("{}-config.yaml", provider_slug),
            "env" => format!("{}.env", provider_slug),
            _ => format!("{}-{}.{}", provider_slug, index, language),
        }
    }
}

/// Request for integration generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationGenerationRequest {
    pub session_id: String,
    pub provider_name: String,
    pub framework: String,
    pub language: String,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
    pub project_context: Option<String>,
    pub existing_code: Option<String>,
}