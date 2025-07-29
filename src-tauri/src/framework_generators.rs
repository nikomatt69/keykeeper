use crate::enhanced_types::*;
use crate::llm_wrapper::LLMEngine;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn, error};

/// Framework-specific code generator trait
#[async_trait]
pub trait FrameworkGenerator: Send + Sync {
    /// Get the framework identifier
    fn framework_id(&self) -> &str;
    
    /// Get the framework display name
    fn framework_name(&self) -> &str;
    
    /// Get supported framework versions
    fn supported_versions(&self) -> Vec<String>;
    
    /// Generate framework-specific configuration files
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>>;
    
    /// Generate framework-specific API integration code
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>>;
    
    /// Generate authentication integration
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>>;
    
    /// Generate state management setup
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>>;
    
    /// Generate testing framework configuration
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>>;
    
    /// Enhance package.json for this framework
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value>;
    
    /// Get framework-specific best practices prompt
    fn get_llm_prompt_template(&self, generation_type: &str) -> String;
    
    /// Validate framework-specific requirements
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult>;
}

/// Generated file result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedFile {
    /// File path relative to project root
    pub file_path: String,
    /// File content
    pub content: String,
    /// File type/language
    pub file_type: String,
    /// Whether this file should overwrite existing files
    pub overwrite: bool,
    /// File generation metadata
    pub metadata: FileMetadata,
}

/// File generation metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    /// Generator that created this file
    pub generator: String,
    /// Timestamp of generation
    pub generated_at: String,
    /// Version of the generator
    pub generator_version: String,
    /// Template ID used for generation
    pub template_id: Option<String>,
    /// Whether LLM was used for enhancement
    pub llm_enhanced: bool,
}

/// API integration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiIntegrationConfig {
    /// API provider type (openai, anthropic, etc.)
    pub provider: String,
    /// Authentication method
    pub auth_method: String,
    /// Endpoint configurations
    pub endpoints: Vec<ApiEndpointConfig>,
    /// Client configuration
    pub client_config: HashMap<String, Value>,
    /// Error handling strategy
    pub error_handling: ErrorHandlingConfig,
}

/// API endpoint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiEndpointConfig {
    /// Endpoint name/identifier
    pub name: String,
    /// HTTP method
    pub method: String,
    /// Endpoint path
    pub path: String,
    /// Request/response types
    pub types: EndpointTypes,
    /// Whether to generate TypeScript types
    pub generate_types: bool,
}

/// Endpoint type definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointTypes {
    /// Request type
    pub request: Option<String>,
    /// Response type
    pub response: Option<String>,
    /// Error type
    pub error: Option<String>,
}

/// Error handling configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorHandlingConfig {
    /// Error handling strategy (throw, return, callback)
    pub strategy: String,
    /// Custom error types
    pub custom_errors: Vec<String>,
    /// Retry configuration
    pub retry_config: Option<RetryConfig>,
}

/// Retry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retries
    pub max_retries: u32,
    /// Retry delay in milliseconds
    pub delay_ms: u64,
    /// Exponential backoff factor
    pub backoff_factor: f64,
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Authentication provider
    pub provider: String,
    /// Authentication strategy
    pub strategy: String,
    /// Configuration options
    pub options: HashMap<String, Value>,
    /// Protected routes/components
    pub protected_resources: Vec<String>,
}

/// State management configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateManagementConfig {
    /// State management library (redux, zustand, pinia, etc.)
    pub library: String,
    /// State structure
    pub state_structure: Vec<StateModule>,
    /// Middleware configuration
    pub middleware: Vec<String>,
    /// DevTools integration
    pub devtools: bool,
}

/// State module configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateModule {
    /// Module name
    pub name: String,
    /// Initial state
    pub initial_state: Value,
    /// Actions/mutations
    pub actions: Vec<String>,
    /// Getters/selectors
    pub getters: Vec<String>,
}

/// Testing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestingConfig {
    /// Testing framework (jest, vitest, cypress, etc.)
    pub framework: String,
    /// Test types to generate
    pub test_types: Vec<String>,
    /// Coverage configuration
    pub coverage: CoverageConfig,
    /// E2E testing configuration
    pub e2e_config: Option<E2EConfig>,
}

/// Coverage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageConfig {
    /// Minimum coverage threshold
    pub threshold: f64,
    /// Coverage reporters
    pub reporters: Vec<String>,
    /// Directories to exclude
    pub exclude_dirs: Vec<String>,
}

/// E2E testing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2EConfig {
    /// E2E framework (cypress, playwright, etc.)
    pub framework: String,
    /// Test scenarios
    pub scenarios: Vec<String>,
    /// Browser configuration
    pub browsers: Vec<String>,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// Whether validation passed
    pub is_valid: bool,
    /// Validation errors
    pub errors: Vec<String>,
    /// Validation warnings
    pub warnings: Vec<String>,
    /// Suggested fixes
    pub suggestions: Vec<String>,
}

/// Framework generator registry
pub struct FrameworkGeneratorRegistry {
    /// Registered generators
    generators: HashMap<String, Arc<dyn FrameworkGenerator>>,
}

impl FrameworkGeneratorRegistry {
    /// Create a new registry
    pub fn new() -> Self {
        Self {
            generators: HashMap::new(),
        }
    }
    
    /// Register a framework generator
    pub fn register(&mut self, generator: Arc<dyn FrameworkGenerator>) {
        let framework_id = generator.framework_id().to_string();
        let framework_name = generator.framework_name().to_string();
        self.generators.insert(framework_id, generator);
        info!("Registered framework generator: {}", framework_name);
    }
    
    /// Get a generator by framework ID
    pub fn get(&self, framework_id: &str) -> Option<&Arc<dyn FrameworkGenerator>> {
        self.generators.get(framework_id)
    }
    
    /// Get all registered frameworks
    pub fn get_supported_frameworks(&self) -> Vec<String> {
        self.generators.keys().cloned().collect()
    }
    
    /// Initialize with built-in generators
    pub fn with_built_in_generators() -> Self {
        let mut registry = Self::new();
        
        // Register built-in generators
        registry.register(Arc::new(NextJSGenerator::new()));
        registry.register(Arc::new(ReactGenerator::new()));
        registry.register(Arc::new(VueGenerator::new()));
        registry.register(Arc::new(SvelteGenerator::new()));
        registry.register(Arc::new(AngularGenerator::new()));
        
        registry
    }
}

/// NextJS framework generator
pub struct NextJSGenerator {
    framework_id: String,
    framework_name: String,
    supported_versions: Vec<String>,
}

impl NextJSGenerator {
    pub fn new() -> Self {
        Self {
            framework_id: "nextjs".to_string(),
            framework_name: "Next.js".to_string(),
            supported_versions: vec!["14".to_string(), "13".to_string()],
        }
    }
    
    /// Generate Next.js App Router configuration
    async fn generate_app_router_config(
        &self,
        context: &GenerationContext,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate app layout
        let layout_content = self.generate_app_layout(context, llm_engine).await?;
        files.push(GeneratedFile {
            file_path: "app/layout.tsx".to_string(),
            content: layout_content,
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("nextjs-app-layout".to_string()),
                llm_enhanced: llm_engine.is_some(),
            },
        });
        
        // Generate page template
        let page_content = self.generate_page_template(context, llm_engine).await?;
        files.push(GeneratedFile {
            file_path: "app/page.tsx".to_string(),
            content: page_content,
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("nextjs-page".to_string()),
                llm_enhanced: llm_engine.is_some(),
            },
        });
        
        Ok(files)
    }
    
    /// Generate Next.js app layout
    async fn generate_app_layout(
        &self,
        context: &GenerationContext,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<String> {
        let base_layout = r#"import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{PROJECT_NAME}}',
  description: 'Generated with KeyKeeper',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
"#;
        
        let mut content = base_layout.replace("{{PROJECT_NAME}}", 
            &context.project_settings.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("My App")
        );
        
        // Enhance with LLM if available
        if let Some(llm) = llm_engine {
            let prompt = format!(
                "Enhance this Next.js App Router layout.tsx file with best practices:\n\n{}\n\nContext: {}\n\nImprove the layout with modern Next.js patterns, proper metadata, and any necessary providers.",
                content,
                serde_json::to_string_pretty(&context).unwrap_or_default()
            );
            
            if let Ok(enhanced) = llm.generate_text(&prompt).await {
                content = enhanced;
            }
        }
        
        Ok(content)
    }
    
    /// Generate Next.js page template
    async fn generate_page_template(
        &self,
        context: &GenerationContext,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<String> {
        let base_page = r#"export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">Welcome to {{PROJECT_NAME}}</h1>
        <p className="mt-4 text-xl">
          Your application is ready to go!
        </p>
      </div>
    </main>
  )
}
"#;
        
        let mut content = base_page.replace("{{PROJECT_NAME}}", 
            &context.project_settings.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("My App")
        );
        
        // Enhance with LLM if available
        if let Some(llm) = llm_engine {
            let prompt = format!(
                "Enhance this Next.js page component with modern patterns:\n\n{}\n\nContext: {}\n\nAdd proper TypeScript types, error boundaries, and contemporary Next.js patterns.",
                content,
                serde_json::to_string_pretty(&context).unwrap_or_default()
            );
            
            if let Ok(enhanced) = llm.generate_text(&prompt).await {
                content = enhanced;
            }
        }
        
        Ok(content)
    }
}

#[async_trait]
impl FrameworkGenerator for NextJSGenerator {
    fn framework_id(&self) -> &str {
        &self.framework_id
    }
    
    fn framework_name(&self) -> &str {
        &self.framework_name
    }
    
    fn supported_versions(&self) -> Vec<String> {
        self.supported_versions.clone()
    }
    
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Next.js config
        let nextjs_config = r#"/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
"#;
        
        files.push(GeneratedFile {
            file_path: "next.config.js".to_string(),
            content: nextjs_config.to_string(),
            file_type: "javascript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("nextjs-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        // Generate app router files
        let app_files = self.generate_app_router_config(context, llm_engine).await?;
        files.extend(app_files);
        
        Ok(files)
    }
    
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate API route handler
        for endpoint in &api_config.endpoints {
            let route_content = format!(
                r#"import {{ NextRequest, NextResponse }} from 'next/server'

export async function {}(request: NextRequest) {{
  try {{
    // API implementation here
    const data = await fetch(process.env.{}_API_URL + '{}', {{
      method: '{}',
      headers: {{
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${{process.env.{}_API_KEY}}`,
      }},
      body: request.method !== 'GET' ? JSON.stringify(await request.json()) : undefined,
    }})
    
    const result = await data.json()
    return NextResponse.json(result)
  }} catch (error) {{
    console.error('API Error:', error)
    return NextResponse.json({{ error: 'Internal Server Error' }}, {{ status: 500 }})
  }}
}}
"#,
                endpoint.method.to_uppercase(),
                api_config.provider.to_uppercase(),
                endpoint.path,
                endpoint.method.to_uppercase(),
                api_config.provider.to_uppercase()
            );
            
            files.push(GeneratedFile {
                file_path: format!("app/api/{}/route.ts", endpoint.name),
                content: route_content,
                file_type: "typescript".to_string(),
                overwrite: false,
                metadata: FileMetadata {
                    generator: self.framework_id.clone(),
                    generated_at: chrono::Utc::now().to_rfc3339(),
                    generator_version: "1.0.0".to_string(),
                    template_id: Some("nextjs-api-route".to_string()),
                    llm_enhanced: llm_engine.is_some(),
                },
            });
        }
        
        Ok(files)
    }
    
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate middleware for auth
        let middleware_content = r#"import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Add authentication logic here
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
"#;
        
        files.push(GeneratedFile {
            file_path: "middleware.ts".to_string(),
            content: middleware_content.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("nextjs-middleware".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        match state_config.library.as_str() {
            "zustand" => {
                let store_content = r#"import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AppState {
  // Define your state here
  count: number
  increment: () => void
  decrement: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }),
    {
      name: 'app-store',
    }
  )
)
"#;
                
                files.push(GeneratedFile {
                    file_path: "lib/store.ts".to_string(),
                    content: store_content.to_string(),
                    file_type: "typescript".to_string(),
                    overwrite: false,
                    metadata: FileMetadata {
                        generator: self.framework_id.clone(),
                        generated_at: chrono::Utc::now().to_rfc3339(),
                        generator_version: "1.0.0".to_string(),
                        template_id: Some("nextjs-zustand-store".to_string()),
                        llm_enhanced: false,
                    },
                });
            }
            _ => {
                warn!("Unsupported state management library: {}", state_config.library);
            }
        }
        
        Ok(files)
    }
    
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Jest configuration
        let jest_config = r#"const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
"#;
        
        files.push(GeneratedFile {
            file_path: "jest.config.js".to_string(),
            content: jest_config.to_string(),
            file_type: "javascript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("nextjs-jest-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value> {
        let mut enhanced = base_package_json.clone();
        
        // Add Next.js specific dependencies and scripts
        if let Some(dependencies) = enhanced.get_mut("dependencies") {
            let deps = dependencies.as_object_mut().unwrap();
            deps.insert("next".to_string(), json!("^14.0.0"));
            deps.insert("react".to_string(), json!("^18.0.0"));
            deps.insert("react-dom".to_string(), json!("^18.0.0"));
        }
        
        if let Some(dev_dependencies) = enhanced.get_mut("devDependencies") {
            let dev_deps = dev_dependencies.as_object_mut().unwrap();
            dev_deps.insert("@types/node".to_string(), json!("^20.0.0"));
            dev_deps.insert("@types/react".to_string(), json!("^18.0.0"));
            dev_deps.insert("@types/react-dom".to_string(), json!("^18.0.0"));
            dev_deps.insert("typescript".to_string(), json!("^5.0.0"));
            dev_deps.insert("tailwindcss".to_string(), json!("^3.3.0"));
            dev_deps.insert("autoprefixer".to_string(), json!("^10.4.0"));
            dev_deps.insert("postcss".to_string(), json!("^8.4.0"));
        }
        
        if let Some(scripts) = enhanced.get_mut("scripts") {
            let scripts_obj = scripts.as_object_mut().unwrap();
            scripts_obj.insert("dev".to_string(), json!("next dev"));
            scripts_obj.insert("build".to_string(), json!("next build"));
            scripts_obj.insert("start".to_string(), json!("next start"));
            scripts_obj.insert("lint".to_string(), json!("next lint"));
        }
        
        Ok(enhanced)
    }
    
    fn get_llm_prompt_template(&self, generation_type: &str) -> String {
        match generation_type {
            "api_integration" => {
                "Generate Next.js API route handlers with proper TypeScript types, error handling, and Next.js 14 App Router patterns. Follow Next.js best practices for API routes.".to_string()
            }
            "auth_integration" => {
                "Generate Next.js authentication middleware and components using Next.js 14 App Router. Include proper session management and route protection.".to_string()
            }
            "config" => {
                "Generate Next.js configuration files following Next.js 14 best practices. Include proper TypeScript configuration and build optimization.".to_string()
            }
            _ => {
                "Generate Next.js code following modern Next.js 14 App Router patterns with TypeScript.".to_string()
            }
        }
    }
    
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut suggestions = Vec::new();
        
        // Check for TypeScript preference
        if context.user_preferences.code_style != "typescript" {
            warnings.push("Next.js works best with TypeScript. Consider enabling TypeScript.".to_string());
            suggestions.push("Set code_style to 'typescript' for better Next.js integration.".to_string());
        }
        
        // Check for required dependencies in package.json
        if let Some(package_json) = &context.package_json {
            if let Some(deps) = package_json.get("dependencies") {
                if !deps.get("react").is_some() {
                    errors.push("React is required for Next.js projects.".to_string());
                }
                if !deps.get("next").is_some() {
                    errors.push("Next.js package is required.".to_string());
                }
            }
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
            suggestions,
        })
    }
}

/// React framework generator (standalone React, not Next.js)
pub struct ReactGenerator {
    framework_id: String,
    framework_name: String,
    supported_versions: Vec<String>,
}

impl ReactGenerator {
    pub fn new() -> Self {
        Self {
            framework_id: "react".to_string(),
            framework_name: "React".to_string(),
            supported_versions: vec!["18".to_string(), "17".to_string()],
        }
    }
}

#[async_trait]
impl FrameworkGenerator for ReactGenerator {
    fn framework_id(&self) -> &str {
        &self.framework_id
    }
    
    fn framework_name(&self) -> &str {
        &self.framework_name
    }
    
    fn supported_versions(&self) -> Vec<String> {
        self.supported_versions.clone()
    }
    
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vite config for React
        let vite_config = r#"import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vite.config.ts".to_string(),
            content: vite_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("react-vite-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate React Query setup
        let api_client = r#"import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 10000,
})

// Request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
"#;
        
        files.push(GeneratedFile {
            file_path: "src/lib/api-client.ts".to_string(),
            content: api_client.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("react-api-client".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate auth context
        let auth_context = r#"import React, { createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing auth token
    const token = localStorage.getItem('authToken')
    if (token) {
      // Validate token and set user
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Implement login logic
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
"#;
        
        files.push(GeneratedFile {
            file_path: "src/contexts/AuthContext.tsx".to_string(),
            content: auth_context.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("react-auth-context".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        match state_config.library.as_str() {
            "zustand" => {
                let store_content = r#"import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AppState {
  // Define your state here
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      reset: () => set({ count: 0 }),
    }),
    {
      name: 'app-store',
    }
  )
)
"#;
                
                files.push(GeneratedFile {
                    file_path: "src/store/appStore.ts".to_string(),
                    content: store_content.to_string(),
                    file_type: "typescript".to_string(),
                    overwrite: false,
                    metadata: FileMetadata {
                        generator: self.framework_id.clone(),
                        generated_at: chrono::Utc::now().to_rfc3339(),
                        generator_version: "1.0.0".to_string(),
                        template_id: Some("react-zustand-store".to_string()),
                        llm_enhanced: false,
                    },
                });
            }
            _ => {
                warn!("Unsupported state management library: {}", state_config.library);
            }
        }
        
        Ok(files)
    }
    
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vitest configuration
        let vitest_config = r#"/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vitest.config.ts".to_string(),
            content: vitest_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("react-vitest-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value> {
        let mut enhanced = base_package_json.clone();
        
        // Add React specific dependencies
        if let Some(dependencies) = enhanced.get_mut("dependencies") {
            let deps = dependencies.as_object_mut().unwrap();
            deps.insert("react".to_string(), json!("^18.2.0"));
            deps.insert("react-dom".to_string(), json!("^18.2.0"));
        }
        
        if let Some(dev_dependencies) = enhanced.get_mut("devDependencies") {
            let dev_deps = dev_dependencies.as_object_mut().unwrap();
            dev_deps.insert("@types/react".to_string(), json!("^18.2.0"));
            dev_deps.insert("@types/react-dom".to_string(), json!("^18.2.0"));
            dev_deps.insert("@vitejs/plugin-react".to_string(), json!("^4.0.0"));
            dev_deps.insert("vite".to_string(), json!("^4.4.0"));
            dev_deps.insert("typescript".to_string(), json!("^5.0.0"));
        }
        
        Ok(enhanced)
    }
    
    fn get_llm_prompt_template(&self, generation_type: &str) -> String {
        match generation_type {
            "api_integration" => {
                "Generate React API integration code with proper TypeScript types, error handling, and modern React patterns like hooks and context.".to_string()
            }
            "auth_integration" => {
                "Generate React authentication components and context providers with proper TypeScript types and modern React patterns.".to_string()
            }
            _ => {
                "Generate React code following modern React patterns with hooks, TypeScript, and best practices.".to_string()
            }
        }
    }
    
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        // Check package.json for React
        if let Some(package_json) = &context.package_json {
            if let Some(deps) = package_json.get("dependencies") {
                if !deps.get("react").is_some() {
                    errors.push("React package is required for React projects.".to_string());
                }
            }
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
            suggestions: Vec::new(),
        })
    }
}

/// Vue.js framework generator
pub struct VueGenerator {
    framework_id: String,
    framework_name: String,
    supported_versions: Vec<String>,
}

impl VueGenerator {
    pub fn new() -> Self {
        Self {
            framework_id: "vue".to_string(),
            framework_name: "Vue.js".to_string(),
            supported_versions: vec!["3".to_string()],
        }
    }
}

#[async_trait]
impl FrameworkGenerator for VueGenerator {
    fn framework_id(&self) -> &str {
        &self.framework_id
    }
    
    fn framework_name(&self) -> &str {
        &self.framework_name
    }
    
    fn supported_versions(&self) -> Vec<String> {
        self.supported_versions.clone()
    }
    
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vite config for Vue
        let vite_config = r#"import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vite.config.ts".to_string(),
            content: vite_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("vue-vite-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vue composable for API
        let api_composable = r#"import { ref, reactive } from 'vue'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
})

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T = any>() {
  const state = reactive<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = async (config: any) => {
    state.loading = true
    state.error = null
    
    try {
      const response = await apiClient(config)
      state.data = response.data
      return response.data
    } catch (error: any) {
      state.error = error.message || 'An error occurred'
      throw error
    } finally {
      state.loading = false
    }
  }

  return {
    state,
    execute,
  }
}
"#;
        
        files.push(GeneratedFile {
            file_path: "src/composables/useApi.ts".to_string(),
            content: api_composable.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("vue-api-composable".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vue auth store with Pinia
        let auth_store = r#"import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  email: string
  name: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('authToken'))

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  const login = async (email: string, password: string) => {
    try {
      // Implement login logic here
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        user.value = data.user
        token.value = data.token
        localStorage.setItem('authToken', data.token)
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('authToken')
  }

  const checkAuth = async () => {
    if (token.value) {
      try {
        // Validate token with server
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token.value}` },
        })
        
        if (response.ok) {
          const userData = await response.json()
          user.value = userData
        } else {
          logout()
        }
      } catch (error) {
        logout()
      }
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  }
})
"#;
        
        files.push(GeneratedFile {
            file_path: "src/stores/auth.ts".to_string(),
            content: auth_store.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("vue-auth-store".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Pinia store
        let pinia_store = r#"import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const count = ref(0)
  const name = ref('App')

  const doubleCount = computed(() => count.value * 2)

  const increment = () => {
    count.value++
  }

  const decrement = () => {
    count.value--
  }

  const reset = () => {
    count.value = 0
  }

  return {
    count,
    name,
    doubleCount,
    increment,
    decrement,
    reset,
  }
})
"#;
        
        files.push(GeneratedFile {
            file_path: "src/stores/app.ts".to_string(),
            content: pinia_store.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("vue-pinia-store".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vitest config for Vue
        let vitest_config = r#"/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vitest.config.ts".to_string(),
            content: vitest_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("vue-vitest-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value> {
        let mut enhanced = base_package_json.clone();
        
        // Add Vue specific dependencies
        if let Some(dependencies) = enhanced.get_mut("dependencies") {
            let deps = dependencies.as_object_mut().unwrap();
            deps.insert("vue".to_string(), json!("^3.3.0"));
            deps.insert("pinia".to_string(), json!("^2.1.0"));
        }
        
        if let Some(dev_dependencies) = enhanced.get_mut("devDependencies") {
            let dev_deps = dev_dependencies.as_object_mut().unwrap();
            dev_deps.insert("@vitejs/plugin-vue".to_string(), json!("^4.2.0"));
            dev_deps.insert("vite".to_string(), json!("^4.4.0"));
            dev_deps.insert("typescript".to_string(), json!("^5.0.0"));
            dev_deps.insert("vue-tsc".to_string(), json!("^1.8.0"));
        }
        
        Ok(enhanced)
    }
    
    fn get_llm_prompt_template(&self, generation_type: &str) -> String {
        match generation_type {
            "api_integration" => {
                "Generate Vue 3 composables for API integration with proper TypeScript types and Composition API patterns.".to_string()
            }
            "auth_integration" => {
                "Generate Vue 3 authentication using Pinia stores and Composition API with proper TypeScript types.".to_string()
            }
            _ => {
                "Generate Vue 3 code using Composition API, TypeScript, and modern Vue patterns.".to_string()
            }
        }
    }
    
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        
        // Check package.json for Vue
        if let Some(package_json) = &context.package_json {
            if let Some(deps) = package_json.get("dependencies") {
                if !deps.get("vue").is_some() {
                    errors.push("Vue package is required for Vue projects.".to_string());
                }
            }
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings: Vec::new(),
            suggestions: Vec::new(),
        })
    }
}

/// Svelte framework generator
pub struct SvelteGenerator {
    framework_id: String,
    framework_name: String,
    supported_versions: Vec<String>,
}

impl SvelteGenerator {
    pub fn new() -> Self {
        Self {
            framework_id: "svelte".to_string(),
            framework_name: "Svelte".to_string(),
            supported_versions: vec!["4".to_string(), "3".to_string()],
        }
    }
}

#[async_trait]
impl FrameworkGenerator for SvelteGenerator {
    fn framework_id(&self) -> &str {
        &self.framework_id
    }
    
    fn framework_name(&self) -> &str {
        &self.framework_name
    }
    
    fn supported_versions(&self) -> Vec<String> {
        self.supported_versions.clone()
    }
    
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vite config for Svelte
        let vite_config = r#"import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
    },
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vite.config.ts".to_string(),
            content: vite_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("svelte-vite-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Svelte API store
        let api_store = r#"import { writable, derived } from 'svelte/store'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function createApiStore<T = any>() {
  const { subscribe, set, update } = writable<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  return {
    subscribe,
    async fetch(url: string, options: RequestInit = {}) {
      update(state => ({ ...state, loading: true, error: null }))
      
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        set({ data, loading: false, error: null })
        return data
      } catch (error: any) {
        update(state => ({ 
          ...state, 
          loading: false, 
          error: error.message || 'An error occurred' 
        }))
        throw error
      }
    },
    reset: () => set({ data: null, loading: false, error: null }),
  }
}

export const apiStore = createApiStore()
"#;
        
        files.push(GeneratedFile {
            file_path: "src/lib/stores/api.ts".to_string(),
            content: api_store.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("svelte-api-store".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Svelte auth store
        let auth_store = r#"import { writable, derived } from 'svelte/store'

interface User {
  id: string
  email: string
  name: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    token: localStorage.getItem('authToken'),
    loading: false,
  })

  return {
    subscribe,
    async login(email: string, password: string) {
      update(state => ({ ...state, loading: true }))
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        
        const data = await response.json()
        
        if (response.ok) {
          localStorage.setItem('authToken', data.token)
          set({ user: data.user, token: data.token, loading: false })
        } else {
          throw new Error(data.message)
        }
      } catch (error) {
        update(state => ({ ...state, loading: false }))
        throw error
      }
    },
    logout() {
      localStorage.removeItem('authToken')
      set({ user: null, token: null, loading: false })
    },
    async checkAuth() {
      const token = localStorage.getItem('authToken')
      if (!token) return
      
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        if (response.ok) {
          const user = await response.json()
          update(state => ({ ...state, user }))
        } else {
          this.logout()
        }
      } catch (error) {
        this.logout()
      }
    },
  }
}

export const authStore = createAuthStore()
export const isAuthenticated = derived(authStore, $auth => !!$auth.user && !!$auth.token)
"#;
        
        files.push(GeneratedFile {
            file_path: "src/lib/stores/auth.ts".to_string(),
            content: auth_store.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("svelte-auth-store".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Svelte store
        let app_store = r#"import { writable, derived } from 'svelte/store'

interface AppState {
  count: number
  name: string
}

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>({
    count: 0,
    name: 'My App',
  })

  return {
    subscribe,
    increment: () => update(state => ({ ...state, count: state.count + 1 })),
    decrement: () => update(state => ({ ...state, count: state.count - 1 })),
    reset: () => update(state => ({ ...state, count: 0 })),
    setName: (name: string) => update(state => ({ ...state, name })),
  }
}

export const appStore = createAppStore()
export const doubleCount = derived(appStore, $app => $app.count * 2)
"#;
        
        files.push(GeneratedFile {
            file_path: "src/lib/stores/app.ts".to_string(),
            content: app_store.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("svelte-app-store".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Vitest config for Svelte
        let vitest_config = r#"/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
"#;
        
        files.push(GeneratedFile {
            file_path: "vitest.config.ts".to_string(),
            content: vitest_config.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("svelte-vitest-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value> {
        let mut enhanced = base_package_json.clone();
        
        // Add Svelte specific dependencies
        if let Some(dependencies) = enhanced.get_mut("dependencies") {
            let deps = dependencies.as_object_mut().unwrap();
            deps.insert("svelte".to_string(), json!("^4.0.0"));
        }
        
        if let Some(dev_dependencies) = enhanced.get_mut("devDependencies") {
            let dev_deps = dev_dependencies.as_object_mut().unwrap();
            dev_deps.insert("@sveltejs/vite-plugin-svelte".to_string(), json!("^2.4.0"));
            dev_deps.insert("vite".to_string(), json!("^4.4.0"));
            dev_deps.insert("typescript".to_string(), json!("^5.0.0"));
            dev_deps.insert("svelte-check".to_string(), json!("^3.4.0"));
        }
        
        Ok(enhanced)
    }
    
    fn get_llm_prompt_template(&self, generation_type: &str) -> String {
        match generation_type {
            "api_integration" => {
                "Generate Svelte API integration using stores and reactive patterns with proper TypeScript types.".to_string()
            }
            "auth_integration" => {
                "Generate Svelte authentication using stores and reactive patterns with proper TypeScript types.".to_string()
            }
            _ => {
                "Generate Svelte code using modern Svelte patterns, stores, and TypeScript.".to_string()
            }
        }
    }
    
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        
        // Check package.json for Svelte
        if let Some(package_json) = &context.package_json {
            if let Some(deps) = package_json.get("dependencies") {
                if !deps.get("svelte").is_some() {
                    errors.push("Svelte package is required for Svelte projects.".to_string());
                }
            }
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings: Vec::new(),
            suggestions: Vec::new(),
        })
    }
}

/// Angular framework generator
pub struct AngularGenerator {
    framework_id: String,
    framework_name: String,
    supported_versions: Vec<String>,
}

impl AngularGenerator {
    pub fn new() -> Self {
        Self {
            framework_id: "angular".to_string(),
            framework_name: "Angular".to_string(),
            supported_versions: vec!["17".to_string(), "16".to_string()],
        }
    }
}

#[async_trait]
impl FrameworkGenerator for AngularGenerator {
    fn framework_id(&self) -> &str {
        &self.framework_id
    }
    
    fn framework_name(&self) -> &str {
        &self.framework_name
    }
    
    fn supported_versions(&self) -> Vec<String> {
        self.supported_versions.clone()
    }
    
    async fn generate_config_files(
        &self,
        context: &GenerationContext,
        template: &EnhancedConfigTemplate,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Angular service
        let api_service = r#"import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, throwError } from 'rxjs'
import { catchError, retry } from 'rxjs/operators'

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://api.example.com'

  constructor(private http: HttpClient) {}

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      })
    }
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, this.getHttpOptions())
      .pipe(
        retry(1),
        catchError(this.handleError)
      )
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, data, this.getHttpOptions())
      .pipe(
        catchError(this.handleError)
      )
  }

  private handleError(error: any) {
    console.error('API Error:', error)
    return throwError(() => new Error(error.message || 'Server Error'))
  }
}
"#;
        
        files.push(GeneratedFile {
            file_path: "src/app/services/api.service.ts".to_string(),
            content: api_service.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("angular-api-service".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_api_integration(
        &self,
        context: &GenerationContext,
        api_config: &ApiIntegrationConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        // Use the same implementation as generate_config_files for now
        self.generate_config_files(context, &EnhancedConfigTemplate::default(), llm_engine).await
    }
    
    async fn generate_auth_integration(
        &self,
        context: &GenerationContext,
        auth_config: &AuthConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Angular auth service
        let auth_service = r#"import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

export interface User {
  id: string
  email: string
  name: string
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null)
  public currentUser = this.currentUserSubject.asObservable()

  constructor(private http: HttpClient) {
    // Check for existing token on service initialization
    const token = localStorage.getItem('authToken')
    if (token) {
      this.validateToken()
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>('/api/auth/login', { email, password })
      .pipe(
        tap(response => {
          if (response.token) {
            localStorage.setItem('authToken', response.token)
            this.currentUserSubject.next(response.user)
          }
        })
      )
  }

  logout(): void {
    localStorage.removeItem('authToken')
    this.currentUserSubject.next(null)
  }

  private validateToken(): void {
    this.http.get<User>('/api/auth/me').subscribe({
      next: user => this.currentUserSubject.next(user),
      error: () => this.logout()
    })
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken')
  }

  getToken(): string | null {
    return localStorage.getItem('authToken')
  }
}
"#;
        
        files.push(GeneratedFile {
            file_path: "src/app/services/auth.service.ts".to_string(),
            content: auth_service.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("angular-auth-service".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_state_management(
        &self,
        context: &GenerationContext,
        state_config: &StateManagementConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate NgRx store files
        let app_state = r#"export interface AppState {
  count: number
  loading: boolean
  error: string | null
}

export const initialState: AppState = {
  count: 0,
  loading: false,
  error: null
}
"#;
        
        files.push(GeneratedFile {
            file_path: "src/app/store/app.state.ts".to_string(),
            content: app_state.to_string(),
            file_type: "typescript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("angular-state".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn generate_testing_setup(
        &self,
        context: &GenerationContext,
        test_config: &TestingConfig,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Vec<GeneratedFile>> {
        let mut files = Vec::new();
        
        // Generate Karma configuration
        let karma_config = r#"module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-headless'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        random: true
      },
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true
  })
}
"#;
        
        files.push(GeneratedFile {
            file_path: "karma.conf.js".to_string(),
            content: karma_config.to_string(),
            file_type: "javascript".to_string(),
            overwrite: false,
            metadata: FileMetadata {
                generator: self.framework_id.clone(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                generator_version: "1.0.0".to_string(),
                template_id: Some("angular-karma-config".to_string()),
                llm_enhanced: false,
            },
        });
        
        Ok(files)
    }
    
    async fn enhance_package_json(
        &self,
        context: &GenerationContext,
        base_package_json: &Value,
        llm_engine: Option<&LLMEngine>,
    ) -> Result<Value> {
        let mut enhanced = base_package_json.clone();
        
        // Add Angular specific dependencies
        if let Some(dependencies) = enhanced.get_mut("dependencies") {
            let deps = dependencies.as_object_mut().unwrap();
            deps.insert("@angular/core".to_string(), json!("^17.0.0"));
            deps.insert("@angular/common".to_string(), json!("^17.0.0"));
            deps.insert("@angular/platform-browser".to_string(), json!("^17.0.0"));
            deps.insert("rxjs".to_string(), json!("~7.8.0"));
        }
        
        if let Some(dev_dependencies) = enhanced.get_mut("devDependencies") {
            let dev_deps = dev_dependencies.as_object_mut().unwrap();
            dev_deps.insert("@angular/cli".to_string(), json!("^17.0.0"));
            dev_deps.insert("@angular-devkit/build-angular".to_string(), json!("^17.0.0"));
            dev_deps.insert("typescript".to_string(), json!("~5.2.0"));
        }
        
        Ok(enhanced)
    }
    
    fn get_llm_prompt_template(&self, generation_type: &str) -> String {
        match generation_type {
            "api_integration" => {
                "Generate Angular services with proper dependency injection, RxJS observables, and error handling patterns.".to_string()
            }
            "auth_integration" => {
                "Generate Angular authentication services with guards, interceptors, and proper state management using RxJS.".to_string()
            }
            _ => {
                "Generate Angular code following Angular best practices with proper dependency injection and TypeScript.".to_string()
            }
        }
    }
    
    async fn validate_requirements(&self, context: &GenerationContext) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        
        // Check package.json for Angular
        if let Some(package_json) = &context.package_json {
            if let Some(deps) = package_json.get("dependencies") {
                if !deps.get("@angular/core").is_some() {
                    errors.push("Angular core package is required for Angular projects.".to_string());
                }
            }
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings: Vec::new(),
            suggestions: Vec::new(),
        })
    }
}

// Add default implementations for EnhancedConfigTemplate
impl Default for EnhancedConfigTemplate {
    fn default() -> Self {
        Self {
            id: "default".to_string(),
            name: "Default Template".to_string(),
            description: "Default configuration template".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            provider_id: "default".to_string(),
            provider_name: "Default Provider".to_string(),
            provider_category: "general".to_string(),
            template_files: Vec::new(),
            framework_compatibility: Vec::new(),
            required_env_vars: Vec::new(),
            optional_env_vars: Vec::new(),
            env_var_descriptions: HashMap::new(),
            dependencies: Vec::new(),
            dev_dependencies: Vec::new(),
            peer_dependencies: Vec::new(),
            extends: None,
            overrides: HashMap::new(),
            supported_features: Vec::new(),
            feature_combinations: HashMap::new(),
            setup_instructions: Vec::new(),
            usage_examples: Vec::new(),
            next_steps: Vec::new(),
            tags: Vec::new(),
            difficulty_level: "beginner".to_string(),
            estimated_setup_time: "5 minutes".to_string(),
            documentation_links: Vec::new(),
            validation_rules: Vec::new(),
            llm_context: None,
        }
    }
}