use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::fs;
use anyhow::{Context, Result};
use reqwest;
use scraper::{Html, Selector};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProvider {
    pub id: String,
    pub name: String,
    pub description: String,
    pub key_patterns: Vec<String>,
    pub env_patterns: Vec<String>,
    pub docs_url: String,
    pub setup_type: String,
    pub category: String,
    pub dependencies: Vec<String>,
    pub config_templates: Vec<ConfigTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_type: String,
    pub file_name: String,
    pub template: String,
    pub required_env_vars: Vec<String>,
    pub optional_env_vars: Vec<String>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationRequest {
    pub provider_id: String,
    pub env_vars: HashMap<String, String>,
    pub features: Vec<String>,
    pub framework: String,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedConfig {
    pub files: Vec<GeneratedFile>,
    pub dependencies: Vec<String>,
    pub setup_instructions: Vec<String>,
    pub next_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
    pub file_type: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocScrapingResult {
    pub url: String,
    pub title: String,
    pub content: String,
    pub code_examples: Vec<CodeExample>,
    pub config_options: Vec<ConfigOption>,
    pub setup_steps: Vec<String>,
    pub dependencies: Vec<String>,
    pub last_scraped: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeExample {
    pub language: String,
    pub code: String,
    pub description: Option<String>,
    pub filename: Option<String>,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigOption {
    pub name: String,
    pub option_type: String,
    pub required: bool,
    pub default: Option<String>,
    pub description: String,
    pub example: Option<String>,
}

pub struct ApiGeneratorService {
    client: reqwest::Client,
    providers: HashMap<String, ApiProvider>,
}

impl ApiGeneratorService {
    pub fn new() -> Self {
        use reqwest::Client;
        
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))
            .pool_idle_timeout(Some(std::time::Duration::from_secs(90)))
            .http2_keep_alive_interval(Some(std::time::Duration::from_secs(60)))
            .http2_keep_alive_timeout(std::time::Duration::from_secs(75))
            .http2_keep_alive_while_idle(true)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            .default_headers(
                [
                    ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"),
                    ("Accept-Language", "en-US,en;q=0.5"),
                    ("Accept-Encoding", "gzip, deflate, br"),
                    ("Connection", "keep-alive"),
                    ("Upgrade-Insecure-Requests", "1"),
                    ("Cache-Control", "max-age=0"),
                ]
                .iter()
                .map(|(k, v)| (k.parse().unwrap(), v.parse().unwrap()))
                .collect(),
            )
            .build()
            .expect("Failed to build HTTP client");

        let mut service = Self {
            client,
            providers: HashMap::new(),
        };
        
        service.register_built_in_providers();
        service
    }

    /// Register built-in API providers
    fn register_built_in_providers(&mut self) {
        // Better Auth
        self.providers.insert("better-auth".to_string(), ApiProvider {
            id: "better-auth".to_string(),
            name: "Better Auth".to_string(),
            description: "Framework-agnostic TypeScript authentication library".to_string(),
            key_patterns: vec!["BETTERAUTH_".to_string(), "BETTER_AUTH_".to_string()],
            env_patterns: vec!["BETTERAUTH_URL".to_string(), "BETTER_AUTH_SECRET".to_string()],
            docs_url: "https://www.better-auth.com/docs".to_string(),
            setup_type: "full-stack".to_string(),
            category: "auth".to_string(),
            dependencies: vec!["better-auth".to_string(), "drizzle-orm".to_string()],
            config_templates: vec![
                ConfigTemplate {
                    id: "better-auth-config".to_string(),
                    name: "Better Auth Configuration".to_string(),
                    description: "Main auth configuration with email/password".to_string(),
                    file_type: "typescript".to_string(),
                    file_name: "lib/auth.ts".to_string(),
                    template: "better-auth-config".to_string(),
                    required_env_vars: vec!["BETTERAUTH_URL".to_string(), "BETTER_AUTH_SECRET".to_string()],
                    optional_env_vars: vec!["DATABASE_URL".to_string()],
                    dependencies: vec!["better-auth".to_string()],
                }
            ],
        });

        // OpenAI
        self.providers.insert("openai".to_string(), ApiProvider {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            description: "OpenAI GPT and AI models API".to_string(),
            key_patterns: vec!["OPENAI_".to_string()],
            env_patterns: vec!["OPENAI_API_KEY".to_string(), "OPENAI_BASE_URL".to_string()],
            docs_url: "https://platform.openai.com/docs".to_string(),
            setup_type: "client-library".to_string(),
            category: "ai".to_string(),
            dependencies: vec!["openai".to_string()],
            config_templates: vec![
                ConfigTemplate {
                    id: "openai-config".to_string(),
                    name: "OpenAI Configuration".to_string(),
                    description: "OpenAI client setup".to_string(),
                    file_type: "typescript".to_string(),
                    file_name: "lib/openai.ts".to_string(),
                    template: "openai-config".to_string(),
                    required_env_vars: vec!["OPENAI_API_KEY".to_string()],
                    optional_env_vars: vec!["OPENAI_BASE_URL".to_string()],
                    dependencies: vec!["openai".to_string()],
                }
            ],
        });

        // Add more providers as needed...
    }

    /// Scrape documentation for API provider with CORS handling
    pub async fn scrape_documentation(&self, provider_id: &str, docs_url: &str) -> Result<DocScrapingResult> {
        println!("🔍 Scraping documentation for {} from {}", provider_id, docs_url);
        
        // Try direct request first
        let response = match self.client
            .get(docs_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.5")
            .send()
            .await 
        {
            Ok(resp) if resp.status().is_success() => resp,
            _ => {
                // If direct request fails, try with CORS proxy
                println!("⚠️ Direct request failed, trying with CORS proxy...");
                let proxy_url = format!("https://cors-anywhere.herokuapp.com/{}", docs_url);
                self.client
                    .get(&proxy_url)
                    .header("X-Requested-With", "XMLHttpRequest")
                    .send()
                    .await
                    .context("Failed to fetch documentation even with CORS proxy")?
            }
        };
        
        let html_content = response
            .text()
            .await
            .context("Failed to read response body")?;
            
        if html_content.contains("Access to this page has been denied") || 
           html_content.contains("Cloudflare") || 
           html_content.contains("captcha") 
        {
            return Err(anyhow::anyhow!("Documentation site is blocking automated access. Please check the documentation manually at: {}", docs_url));
        }
        
        let parsed_doc = self.parse_documentation(provider_id, docs_url, &html_content)?;
        
        Ok(parsed_doc)
    }

    /// Parse HTML documentation content
    fn parse_documentation(&self, provider_id: &str, url: &str, html: &str) -> Result<DocScrapingResult> {
        let document = Html::parse_document(html);
        
        let title = document
            .select(&Selector::parse("title").unwrap())
            .next()
            .map(|el| el.text().collect::<String>())
            .unwrap_or_else(|| format!("{} Documentation", provider_id));

        let content = self.extract_text_content(&document);
        let code_examples = self.extract_code_examples(&document);
        let config_options = self.extract_config_options(&document, provider_id);
        let setup_steps = self.extract_setup_steps(&document);
        let dependencies = self.extract_dependencies(&document);

        Ok(DocScrapingResult {
            url: url.to_string(),
            title,
            content,
            code_examples,
            config_options,
            setup_steps,
            dependencies,
            last_scraped: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Extract text content from HTML
    fn extract_text_content(&self, document: &Html) -> String {
        // Extract main content, avoiding navigation and sidebars
        let content_selectors = [
            "main",
            ".content",
            ".documentation",
            ".docs",
            "#content",
            "article",
        ];

        for selector in &content_selectors {
            if let Ok(sel) = Selector::parse(selector) {
                if let Some(element) = document.select(&sel).next() {
                    return element.text().collect::<Vec<_>>().join(" ");
                }
            }
        }

        // Fallback to body content
        if let Ok(body_selector) = Selector::parse("body") {
            if let Some(body) = document.select(&body_selector).next() {
                return body.text().collect::<Vec<_>>().join(" ");
            }
        }

        String::new()
    }

    /// Extract code examples from HTML
    fn extract_code_examples(&self, document: &Html) -> Vec<CodeExample> {
        let mut examples = Vec::new();
        
        let code_selectors = [
            "pre code",
            "code[class*='language-']",
            ".highlight pre",
            ".code-block",
            "pre[class*='language-']",
        ];

        for selector_str in &code_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                for element in document.select(&selector) {
                    if let Some(code) = element.text().next() {
                        let code_text = code.trim();
                        if code_text.is_empty() {
                            continue;
                        }

                        let language = self.detect_language(&element, code_text);
                        let category = self.categorize_code(code_text);
                        
                        examples.push(CodeExample {
                            language,
                            code: code_text.to_string(),
                            description: None,
                            filename: None,
                            category,
                        });
                    }
                }
            }
        }

        // Deduplicate examples
        examples.sort_by(|a, b| a.code.cmp(&b.code));
        examples.dedup_by(|a, b| a.code == b.code);
        
        examples
    }

    /// Detect programming language from code content
    fn detect_language(&self, element: &scraper::ElementRef, code: &str) -> String {
        // Check class names for language hints
        if let Some(class_attr) = element.value().attr("class") {
            if let Some(captures) = regex::Regex::new(r"language-(\w+)")
                .unwrap()
                .captures(class_attr) {
                return captures[1].to_string();
            }
        }

        // Content-based detection
        if code.contains("import ") && (code.contains("from ") || code.contains("'")) {
            if code.contains(": ") || code.contains("interface ") {
                return "typescript".to_string();
            }
            return "javascript".to_string();
        }
        
        if code.contains("def ") && code.contains(":") {
            return "python".to_string();
        }
        
        if code.contains("package ") && code.contains("func ") {
            return "go".to_string();
        }
        
        if code.contains("use ") && code.contains("fn ") {
            return "rust".to_string();
        }
        
        if code.starts_with('{') && code.contains(":") {
            return "json".to_string();
        }
        
        if code.contains("apiVersion:") || code.contains("kind:") {
            return "yaml".to_string();
        }

        "text".to_string()
    }

    /// Categorize code by purpose
    fn categorize_code(&self, code: &str) -> String {
        let code_lower = code.to_lowercase();
        
        if code_lower.contains("config") || code_lower.contains("setup") || code_lower.contains("initialize") {
            "config".to_string()
        } else if code_lower.contains("client") || code_lower.contains("createclient") {
            "client".to_string()
        } else if code_lower.contains("server") || code_lower.contains("app.") || code_lower.contains("express") {
            "server".to_string()
        } else if code_lower.contains("test") || code_lower.contains("expect") || code_lower.contains("assert") {
            "test".to_string()
        } else {
            "example".to_string()
        }
    }

    /// Extract configuration options (provider-specific)
    fn extract_config_options(&self, _document: &Html, provider_id: &str) -> Vec<ConfigOption> {
        // For now, return predefined config options based on provider
        match provider_id {
            "better-auth" => vec![
                ConfigOption {
                    name: "baseURL".to_string(),
                    option_type: "string".to_string(),
                    required: true,
                    default: None,
                    description: "The base URL for the auth server".to_string(),
                    example: Some("https://auth.example.com".to_string()),
                },
                ConfigOption {
                    name: "secret".to_string(),
                    option_type: "string".to_string(),
                    required: true,
                    default: None,
                    description: "Secret key for signing tokens".to_string(),
                    example: Some("your-secret-key-here".to_string()),
                },
            ],
            "openai" => vec![
                ConfigOption {
                    name: "apiKey".to_string(),
                    option_type: "string".to_string(),
                    required: true,
                    default: None,
                    description: "Your OpenAI API key".to_string(),
                    example: Some("sk-...".to_string()),
                },
            ],
            _ => vec![],
        }
    }

    /// Extract setup steps from documentation
    fn extract_setup_steps(&self, document: &Html) -> Vec<String> {
        let mut steps = Vec::new();

        // Look for ordered lists
        if let Ok(selector) = Selector::parse("ol li") {
            for element in document.select(&selector) {
                let text: String = element.text().collect::<Vec<_>>().join(" ").trim().to_string();
                if !text.is_empty() && text.len() > 10 {
                    steps.push(text);
                }
            }
        }

        steps
    }

    /// Extract dependencies from documentation
    fn extract_dependencies(&self, document: &Html) -> Vec<String> {
        let mut dependencies = Vec::new();
        let content = self.extract_text_content(document);
        
        // Look for npm install commands
        let npm_regex = regex::Regex::new(r"npm install\s+([^\n\r]+)").unwrap();
        for captures in npm_regex.captures_iter(&content) {
            if let Some(packages) = captures.get(1) {
                let packages: Vec<String> = packages
                    .as_str()
                    .split_whitespace()
                    .filter(|pkg| !pkg.starts_with('-') && !pkg.is_empty())
                    .map(|pkg| pkg.to_string())
                    .collect();
                dependencies.extend(packages);
            }
        }

        // Deduplicate
        dependencies.sort();
        dependencies.dedup();
        
        dependencies
    }

    /// Generate configuration for a provider
    pub async fn generate_configuration(&self, request: GenerationRequest) -> Result<GeneratedConfig> {
        let provider = self.providers
            .get(&request.provider_id)
            .context("Provider not found")?;

        let mut files = Vec::new();
        let mut dependencies = provider.dependencies.clone();
        let mut setup_instructions = Vec::new();
        let mut next_steps = Vec::new();

        // Generate files based on templates
        for template in &provider.config_templates {
            let content = self.generate_template_content(template, &request.env_vars, &request.framework)?;
            
            files.push(GeneratedFile {
                path: template.file_name.clone(),
                content,
                file_type: template.file_type.clone(),
                language: template.file_type.clone(),
            });

            dependencies.extend(template.dependencies.clone());
        }

        // Generate setup instructions
        setup_instructions.push(format!("Install dependencies: npm install {}", dependencies.join(" ")));
        setup_instructions.push("Add environment variables to .env file".to_string());
        
        next_steps.push(format!("Configure {} according to your needs", provider.name));
        next_steps.push("Test the integration".to_string());

        // Remove duplicates
        dependencies.sort();
        dependencies.dedup();

        Ok(GeneratedConfig {
            files,
            dependencies,
            setup_instructions,
            next_steps,
        })
    }

    /// Generate content from template
    fn generate_template_content(
        &self,
        template: &ConfigTemplate,
        env_vars: &HashMap<String, String>,
        framework: &str,
    ) -> Result<String> {
        match template.id.as_str() {
            "better-auth-config" => Ok(self.generate_better_auth_config(env_vars)),
            "better-auth-client" => Ok(self.generate_better_auth_client(env_vars)),
            "openai-config" => Ok(self.generate_openai_config(env_vars)),
            _ => Ok(format!("// Generated {} configuration\n// TODO: Implement template", template.name)),
        }
    }

    fn generate_better_auth_config(&self, env_vars: &HashMap<String, String>) -> String {
        format!(r#"import {{ betterAuth }} from "better-auth";
import {{ drizzleAdapter }} from "better-auth/adapters/drizzle";
import {{ db }} from "./db";

export const auth = betterAuth({{
  database: drizzleAdapter(db, {{
    provider: "postgresql",
  }}),
  emailAndPassword: {{
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  }},
  session: {{
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  }},
  trustedOrigins: [process.env.BETTERAUTH_URL!],
  baseURL: process.env.BETTERAUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
}});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;"#)
    }

    fn generate_better_auth_client(&self, env_vars: &HashMap<String, String>) -> String {
        format!(r#"import {{ createAuthClient }} from "better-auth/react";

export const authClient = createAuthClient({{
  baseURL: process.env.NEXT_PUBLIC_BETTERAUTH_URL!,
}});

export const {{ 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  getSession 
}} = authClient;"#)
    }

    fn generate_openai_config(&self, env_vars: &HashMap<String, String>) -> String {
        let base_url = env_vars.get("OPENAI_BASE_URL")
            .map(|url| format!("  baseURL: process.env.OPENAI_BASE_URL!,\n"))
            .unwrap_or_default();

        format!(r#"import OpenAI from 'openai';

export const openai = new OpenAI({{
  apiKey: process.env.OPENAI_API_KEY!,
{base_url}}});

// Helper function for chat completions
export async function createChatCompletion(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model = 'gpt-3.5-turbo'
) {{
  const completion = await openai.chat.completions.create({{
    model,
    messages,
  }});
  
  return completion.choices[0]?.message?.content || '';
}}"#)
    }

    pub fn get_providers(&self) -> Vec<ApiProvider> {
        self.providers.values().cloned().collect()
    }
}