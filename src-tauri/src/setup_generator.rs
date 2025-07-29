use crate::enhanced_types::{GenerationContext};
use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{debug, info, warn, error};

/// Deployment target platforms
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DeploymentTarget {
    Docker,
    Vercel,
    Netlify,
    AWS,
    DigitalOcean,
    Heroku,
    Firebase,
    Railway,
    Render,
    Custom(String),
}

/// CI/CD platform types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CIPlatform {
    GitHubActions,
    GitLabCI,
    CircleCI,
    TravisCI,
    AzureDevOps,
    Jenkins,
    Custom(String),
}

/// Generated setup script with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupScript {
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub content: String,
    pub script_type: SetupScriptType,
    pub execution_order: u32,
    pub dependencies: Vec<String>,
    pub platform_specific: bool,
    pub validation_commands: Vec<String>,
}

/// Types of setup scripts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SetupScriptType {
    Installation,
    Configuration,
    Environment,
    Docker,
    CI,
    Deployment,
    PostSetup,
    Validation,
}

/// Complete setup package with all scripts and configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupPackage {
    pub scripts: Vec<SetupScript>,
    pub docker_configs: Vec<DockerConfig>,
    pub ci_configs: Vec<CIConfig>,
    pub deployment_configs: Vec<DeploymentConfig>,
    pub environment_templates: Vec<EnvironmentTemplate>,
    pub readme_content: String,
    pub validation_checklist: Vec<ValidationStep>,
}

/// Docker configuration files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerConfig {
    pub name: String,
    pub file_path: String,
    pub content: String,
    pub config_type: DockerConfigType,
    pub framework_specific: bool,
}

/// Docker configuration types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DockerConfigType {
    Dockerfile,
    DockerCompose,
    DockerIgnore,
    HealthCheck,
    MultiStage,
}

/// CI/CD configuration files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CIConfig {
    pub name: String,
    pub file_path: String,
    pub content: String,
    pub platform: CIPlatform,
    pub includes_tests: bool,
    pub includes_deployment: bool,
    pub environment_secrets: Vec<String>,
}

/// Deployment configuration files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentConfig {
    pub name: String,
    pub file_path: String,
    pub content: String,
    pub target: DeploymentTarget,
    pub requires_build: bool,
    pub environment_variables: Vec<String>,
    pub custom_domains: Vec<String>,
}

/// Environment template files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentTemplate {
    pub name: String,
    pub file_path: String,
    pub content: String,
    pub environment_type: EnvironmentType,
    pub required_vars: Vec<String>,
    pub optional_vars: Vec<String>,
}

/// Environment types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EnvironmentType {
    Development,
    Staging,
    Production,
    Testing,
    Local,
}

/// Validation step for setup verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationStep {
    pub step_name: String,
    pub description: String,
    pub command: String,
    pub expected_output: Option<String>,
    pub error_message: String,
    pub fix_suggestion: String,
    pub is_critical: bool,
}

/// Main setup generator
pub struct SetupGenerator {
    framework_templates: HashMap<String, FrameworkSetupTemplate>,
    deployment_templates: HashMap<DeploymentTarget, DeploymentTemplate>,
    ci_templates: HashMap<CIPlatform, CITemplate>,
}

/// Framework-specific setup template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkSetupTemplate {
    pub framework_id: String,
    pub installation_commands: Vec<String>,
    pub dev_dependencies: Vec<String>,
    pub build_commands: Vec<String>,
    pub start_commands: Vec<String>,
    pub test_commands: Vec<String>,
    pub docker_base_image: String,
    pub docker_port: u16,
    pub environment_variables: Vec<String>,
    pub required_files: Vec<String>,
}

/// Deployment template configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentTemplate {
    pub target: DeploymentTarget,
    pub config_files: Vec<String>,
    pub build_commands: Vec<String>,
    pub deployment_commands: Vec<String>,
    pub environment_setup: Vec<String>,
    pub domain_configuration: Option<String>,
    pub ssl_configuration: Option<String>,
    pub requires_build: bool,
}

/// CI template configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CITemplate {
    pub platform: CIPlatform,
    pub config_file_path: String,
    pub workflow_template: String,
    pub test_commands: Vec<String>,
    pub build_commands: Vec<String>,
    pub deployment_commands: Vec<String>,
    pub cache_configuration: Option<String>,
    pub security_scanning: bool,
}

impl SetupGenerator {
    /// Create a new setup generator with default templates
    pub fn new() -> Self {
        let mut generator = Self {
            framework_templates: HashMap::new(),
            deployment_templates: HashMap::new(),
            ci_templates: HashMap::new(),
        };
        
        generator.initialize_templates();
        generator
    }

    /// Initialize all framework and deployment templates
    fn initialize_templates(&mut self) {
        self.init_framework_templates();
        self.init_deployment_templates();
        self.init_ci_templates();
    }

    /// Initialize framework-specific templates
    fn init_framework_templates(&mut self) {
        // React setup template
        self.framework_templates.insert("react".to_string(), FrameworkSetupTemplate {
            framework_id: "react".to_string(),
            installation_commands: vec![
                "npm install".to_string(),
                "npm install --save-dev @types/node".to_string(),
            ],
            dev_dependencies: vec![
                "@testing-library/react".to_string(),
                "@testing-library/jest-dom".to_string(),
                "eslint".to_string(),
                "prettier".to_string(),
            ],
            build_commands: vec!["npm run build".to_string()],
            start_commands: vec!["npm start".to_string()],
            test_commands: vec!["npm test".to_string()],
            docker_base_image: "node:18-alpine".to_string(),
            docker_port: 3000,
            environment_variables: vec![
                "NODE_ENV".to_string(),
                "REACT_APP_API_URL".to_string(),
                "REACT_APP_VERSION".to_string(),
            ],
            required_files: vec![
                "package.json".to_string(),
                "public/index.html".to_string(),
                "src/index.js".to_string(),
            ],
        });

        // Vue setup template
        self.framework_templates.insert("vue".to_string(), FrameworkSetupTemplate {
            framework_id: "vue".to_string(),
            installation_commands: vec![
                "npm install".to_string(),
                "npm install --save-dev @vue/cli-service".to_string(),
            ],
            dev_dependencies: vec![
                "@vue/test-utils".to_string(),
                "vue-jest".to_string(),
                "eslint-plugin-vue".to_string(),
            ],
            build_commands: vec!["npm run build".to_string()],
            start_commands: vec!["npm run serve".to_string()],
            test_commands: vec!["npm run test:unit".to_string()],
            docker_base_image: "node:18-alpine".to_string(),
            docker_port: 8080,
            environment_variables: vec![
                "NODE_ENV".to_string(),
                "VUE_APP_API_URL".to_string(),
                "VUE_APP_TITLE".to_string(),
            ],
            required_files: vec![
                "package.json".to_string(),
                "public/index.html".to_string(),
                "src/main.js".to_string(),
            ],
        });

        // Angular setup template
        self.framework_templates.insert("angular".to_string(), FrameworkSetupTemplate {
            framework_id: "angular".to_string(),
            installation_commands: vec![
                "npm install".to_string(),
                "npm install -g @angular/cli".to_string(),
            ],
            dev_dependencies: vec![
                "@angular/testing".to_string(),
                "karma".to_string(),
                "protractor".to_string(),
            ],
            build_commands: vec!["ng build --prod".to_string()],
            start_commands: vec!["ng serve".to_string()],
            test_commands: vec!["ng test".to_string(), "ng e2e".to_string()],
            docker_base_image: "node:18-alpine".to_string(),
            docker_port: 4200,
            environment_variables: vec![
                "NODE_ENV".to_string(),
                "NG_APP_API_URL".to_string(),
                "NG_APP_ENVIRONMENT".to_string(),
            ],
            required_files: vec![
                "package.json".to_string(),
                "angular.json".to_string(),
                "src/main.ts".to_string(),
            ],
        });

        // Node.js/Express setup template
        self.framework_templates.insert("nodejs".to_string(), FrameworkSetupTemplate {
            framework_id: "nodejs".to_string(),
            installation_commands: vec![
                "npm install".to_string(),
                "npm install --save-dev nodemon".to_string(),
            ],
            dev_dependencies: vec![
                "jest".to_string(),
                "supertest".to_string(),
                "eslint".to_string(),
                "nodemon".to_string(),
            ],
            build_commands: vec!["npm run build".to_string()],
            start_commands: vec!["npm start".to_string()],
            test_commands: vec!["npm test".to_string()],
            docker_base_image: "node:18-alpine".to_string(),
            docker_port: 8000,
            environment_variables: vec![
                "NODE_ENV".to_string(),
                "PORT".to_string(),
                "DATABASE_URL".to_string(),
                "JWT_SECRET".to_string(),
            ],
            required_files: vec![
                "package.json".to_string(),
                "server.js".to_string(),
            ],
        });

        // Next.js setup template
        self.framework_templates.insert("nextjs".to_string(), FrameworkSetupTemplate {
            framework_id: "nextjs".to_string(),
            installation_commands: vec![
                "npm install".to_string(),
                "npm install --save-dev @types/node typescript".to_string(),
            ],
            dev_dependencies: vec![
                "@testing-library/react".to_string(),
                "jest".to_string(),
                "eslint-config-next".to_string(),
            ],
            build_commands: vec!["npm run build".to_string()],
            start_commands: vec!["npm run dev".to_string()],
            test_commands: vec!["npm test".to_string()],
            docker_base_image: "node:18-alpine".to_string(),
            docker_port: 3000,
            environment_variables: vec![
                "NODE_ENV".to_string(),
                "NEXTAUTH_URL".to_string(),
                "NEXTAUTH_SECRET".to_string(),
                "DATABASE_URL".to_string(),
            ],
            required_files: vec![
                "package.json".to_string(),
                "next.config.js".to_string(),
                "pages/_app.js".to_string(),
            ],
        });
    }

    /// Initialize deployment templates
    fn init_deployment_templates(&mut self) {
        // Docker deployment
        self.deployment_templates.insert(DeploymentTarget::Docker, DeploymentTemplate {
            target: DeploymentTarget::Docker,
            config_files: vec!["Dockerfile".to_string(), "docker-compose.yml".to_string()],
            build_commands: vec!["docker build -t app .".to_string()],
            deployment_commands: vec!["docker run -p 8080:8080 app".to_string()],
            environment_setup: vec!["docker-compose up -d".to_string()],
            domain_configuration: None,
            ssl_configuration: None,
            requires_build: true,
        });

        // Vercel deployment
        self.deployment_templates.insert(DeploymentTarget::Vercel, DeploymentTemplate {
            target: DeploymentTarget::Vercel,
            config_files: vec!["vercel.json".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["vercel --prod".to_string()],
            environment_setup: vec!["vercel env add".to_string()],
            domain_configuration: Some("vercel domains add".to_string()),
            ssl_configuration: Some("Automatic SSL via Vercel".to_string()),
            requires_build: true,
        });

        // Netlify deployment
        self.deployment_templates.insert(DeploymentTarget::Netlify, DeploymentTemplate {
            target: DeploymentTarget::Netlify,
            config_files: vec!["netlify.toml".to_string(), "_redirects".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["netlify deploy --prod".to_string()],
            environment_setup: vec!["netlify env:set".to_string()],
            domain_configuration: Some("netlify domains:add".to_string()),
            ssl_configuration: Some("Automatic SSL via Netlify".to_string()),
            requires_build: true,
        });

        // AWS deployment
        self.deployment_templates.insert(DeploymentTarget::AWS, DeploymentTemplate {
            target: DeploymentTarget::AWS,
            config_files: vec!["aws-template.yml".to_string(), "buildspec.yml".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["aws s3 sync build/ s3://bucket-name".to_string()],
            environment_setup: vec!["aws configure".to_string()],
            domain_configuration: Some("Route 53 configuration".to_string()),
            ssl_configuration: Some("Certificate Manager SSL".to_string()),
            requires_build: true,
        });

        // Railway deployment
        self.deployment_templates.insert(DeploymentTarget::Railway, DeploymentTemplate {
            target: DeploymentTarget::Railway,
            config_files: vec!["railway.toml".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["railway up".to_string()],
            environment_setup: vec!["railway login".to_string()],
            domain_configuration: Some("railway domain".to_string()),
            ssl_configuration: Some("Automatic SSL via Railway".to_string()),
            requires_build: true,
        });
    }

    /// Initialize CI/CD templates
    fn init_ci_templates(&mut self) {
        // GitHub Actions
        self.ci_templates.insert(CIPlatform::GitHubActions, CITemplate {
            platform: CIPlatform::GitHubActions,
            config_file_path: ".github/workflows/ci.yml".to_string(),
            workflow_template: "github_actions_template".to_string(),
            test_commands: vec!["npm test".to_string(), "npm run test:coverage".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["npm run deploy".to_string()],
            cache_configuration: Some("npm cache".to_string()),
            security_scanning: true,
        });

        // GitLab CI
        self.ci_templates.insert(CIPlatform::GitLabCI, CITemplate {
            platform: CIPlatform::GitLabCI,
            config_file_path: ".gitlab-ci.yml".to_string(),
            workflow_template: "gitlab_ci_template".to_string(),
            test_commands: vec!["npm test".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["npm run deploy".to_string()],
            cache_configuration: Some("npm cache paths".to_string()),
            security_scanning: true,
        });

        // CircleCI
        self.ci_templates.insert(CIPlatform::CircleCI, CITemplate {
            platform: CIPlatform::CircleCI,
            config_file_path: ".circleci/config.yml".to_string(),
            workflow_template: "circleci_template".to_string(),
            test_commands: vec!["npm test".to_string()],
            build_commands: vec!["npm run build".to_string()],
            deployment_commands: vec!["npm run deploy".to_string()],
            cache_configuration: Some("save_cache and restore_cache".to_string()),
            security_scanning: false,
        });
    }

    /// Generate complete setup package for a project
    pub async fn generate_setup_package(
        &self,
        context: &GenerationContext,
        deployment_targets: &[DeploymentTarget],
        ci_platforms: &[CIPlatform],
        include_security: bool,
    ) -> Result<SetupPackage> {
        info!("Generating setup package for framework: {}", context.framework);

        let framework_template = self.framework_templates.get(&context.framework)
            .ok_or_else(|| anyhow!("Framework template not found: {}", context.framework))?;

        let mut scripts = Vec::new();
        let mut docker_configs = Vec::new();
        let mut ci_configs = Vec::new();
        let mut deployment_configs = Vec::new();
        let mut environment_templates = Vec::new();
        let mut validation_checklist = Vec::new();

        // Generate installation scripts
        scripts.push(self.generate_installation_script(framework_template)?);
        scripts.push(self.generate_development_script(framework_template)?);
        scripts.push(self.generate_production_script(framework_template)?);

        // Generate environment templates
        environment_templates.extend(self.generate_environment_templates(framework_template)?);

        // Generate Docker configurations
        if deployment_targets.contains(&DeploymentTarget::Docker) {
            docker_configs.extend(self.generate_docker_configs(framework_template)?);
        }

        // Generate CI/CD configurations
        for platform in ci_platforms {
            if let Some(ci_template) = self.ci_templates.get(platform) {
                ci_configs.push(self.generate_ci_config(ci_template, framework_template)?);
            }
        }

        // Generate deployment configurations
        for target in deployment_targets {
            if let Some(deployment_template) = self.deployment_templates.get(target) {
                deployment_configs.push(self.generate_deployment_config(deployment_template, framework_template)?);
            }
        }

        // Generate security scripts if requested
        if include_security {
            scripts.extend(self.generate_security_scripts(framework_template)?);
        }

        // Generate validation checklist
        validation_checklist = self.generate_validation_checklist(framework_template, deployment_targets)?;

        // Generate README content
        let readme_content = self.generate_readme_content(context, framework_template, deployment_targets)?;

        Ok(SetupPackage {
            scripts,
            docker_configs,
            ci_configs,
            deployment_configs,
            environment_templates,
            readme_content,
            validation_checklist,
        })
    }

    /// Generate installation script
    fn generate_installation_script(&self, template: &FrameworkSetupTemplate) -> Result<SetupScript> {
        let content = format!(
            r#"#!/bin/bash
# Installation script for {} application
set -e

echo "🚀 Starting {} application setup..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "16" ]; then
    echo "❌ Node.js version 16+ required. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
{}

# Install development dependencies
echo "🛠️ Installing development dependencies..."
{}

echo "✅ Installation completed successfully!"
echo "🎯 Next steps:"
echo "  1. Copy .env.example to .env and configure your environment variables"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Run 'npm test' to execute tests"
"#,
            template.framework_id,
            template.framework_id,
            template.installation_commands.join("\n"),
            template.dev_dependencies.iter()
                .map(|dep| format!("npm install --save-dev {}", dep))
                .collect::<Vec<_>>()
                .join("\n")
        );

        Ok(SetupScript {
            name: "install.sh".to_string(),
            description: format!("Installation script for {} application", template.framework_id),
            file_path: "scripts/install.sh".to_string(),
            content,
            script_type: SetupScriptType::Installation,
            execution_order: 1,
            dependencies: vec![],
            platform_specific: false,
            validation_commands: vec!["node -v".to_string(), "npm -v".to_string()],
        })
    }

    /// Generate development script
    fn generate_development_script(&self, template: &FrameworkSetupTemplate) -> Result<SetupScript> {
        let content = format!(
            r#"#!/bin/bash
# Development setup script for {} application
set -e

echo "🔧 Setting up development environment for {}..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Dependencies not found. Running installation..."
    ./scripts/install.sh
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📄 Creating .env file from template..."
        cp .env.example .env
        echo "⚠️ Please update .env file with your configuration"
    else
        echo "📄 Creating basic .env file..."
        cat > .env << EOF
NODE_ENV=development
{}
EOF
    fi
fi

# Start development server
echo "🚀 Starting development server..."
{}

echo "✅ Development environment is ready!"
echo "🌐 Application should be running on http://localhost:{}"
"#,
            template.framework_id,
            template.framework_id,
            template.environment_variables.iter()
                .map(|var| format!("{}=", var))
                .collect::<Vec<_>>()
                .join("\n"),
            template.start_commands.join(" && "),
            template.docker_port
        );

        Ok(SetupScript {
            name: "dev.sh".to_string(),
            description: format!("Development setup script for {}", template.framework_id),
            file_path: "scripts/dev.sh".to_string(),
            content,
            script_type: SetupScriptType::Configuration,
            execution_order: 2,
            dependencies: vec!["install.sh".to_string()],
            platform_specific: false,
            validation_commands: vec!["npm list".to_string()],
        })
    }

    /// Generate production script
    fn generate_production_script(&self, template: &FrameworkSetupTemplate) -> Result<SetupScript> {
        let content = format!(
            r#"#!/bin/bash
# Production deployment script for {} application
set -e

echo "🚀 Building {} application for production..."

# Set production environment
export NODE_ENV=production

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build/ dist/ .next/ || true

# Install production dependencies only
echo "📦 Installing production dependencies..."
npm ci --only=production

# Build application
echo "🔨 Building application..."
{}

# Validate build
if [ ! -d "build" ] && [ ! -d "dist" ] && [ ! -d ".next" ]; then
    echo "❌ Build failed - no build directory found"
    exit 1
fi

echo "✅ Production build completed successfully!"
echo "📁 Build artifacts are ready for deployment"

# Run production validation
echo "🔍 Running production validation..."
{}

echo "✅ Production validation passed!"
"#,
            template.framework_id,
            template.framework_id,
            template.build_commands.join(" && "),
            template.test_commands.first().unwrap_or(&"echo 'No tests configured'".to_string())
        );

        Ok(SetupScript {
            name: "build.sh".to_string(),
            description: format!("Production build script for {}", template.framework_id),
            file_path: "scripts/build.sh".to_string(),
            content,
            script_type: SetupScriptType::Deployment,
            execution_order: 3,
            dependencies: vec!["install.sh".to_string()],
            platform_specific: false,
            validation_commands: template.test_commands.clone(),
        })
    }

    /// Generate environment templates
    fn generate_environment_templates(&self, template: &FrameworkSetupTemplate) -> Result<Vec<EnvironmentTemplate>> {
        let mut templates = Vec::new();

        // Development environment
        let dev_content = template.environment_variables.iter()
            .map(|var| match var.as_str() {
                "NODE_ENV" => "NODE_ENV=development".to_string(),
                "PORT" => format!("PORT={}", template.docker_port),
                var_name => format!("{}=your_value_here", var_name),
            })
            .collect::<Vec<_>>()
            .join("\n");

        templates.push(EnvironmentTemplate {
            name: "Development Environment".to_string(),
            file_path: ".env.development".to_string(),
            content: format!("# Development environment configuration\n{}", dev_content),
            environment_type: EnvironmentType::Development,
            required_vars: template.environment_variables.clone(),
            optional_vars: vec!["DEBUG".to_string(), "LOG_LEVEL".to_string()],
        });

        // Production environment
        let prod_content = template.environment_variables.iter()
            .map(|var| match var.as_str() {
                "NODE_ENV" => "NODE_ENV=production".to_string(),
                "PORT" => format!("PORT={}", template.docker_port),
                var_name => format!("{}=REPLACE_WITH_ACTUAL_VALUE", var_name),
            })
            .collect::<Vec<_>>()
            .join("\n");

        templates.push(EnvironmentTemplate {
            name: "Production Environment".to_string(),
            file_path: ".env.production".to_string(),
            content: format!("# Production environment configuration\n{}", prod_content),
            environment_type: EnvironmentType::Production,
            required_vars: template.environment_variables.clone(),
            optional_vars: vec![],
        });

        // Example template
        let example_content = template.environment_variables.iter()
            .map(|var| match var.as_str() {
                "NODE_ENV" => "NODE_ENV=development".to_string(),
                "PORT" => format!("PORT={}", template.docker_port),
                var_name if var_name.contains("SECRET") || var_name.contains("KEY") => {
                    format!("{}=your_secret_key_here", var_name)
                },
                var_name if var_name.contains("URL") => {
                    format!("{}=http://localhost:8000", var_name)
                },
                var_name => format!("{}=example_value", var_name),
            })
            .collect::<Vec<_>>()
            .join("\n");

        templates.push(EnvironmentTemplate {
            name: "Environment Example".to_string(),
            file_path: ".env.example".to_string(),
            content: format!("# Environment variables template\n# Copy this file to .env and update values\n\n{}", example_content),
            environment_type: EnvironmentType::Local,
            required_vars: template.environment_variables.clone(),
            optional_vars: vec!["DEBUG".to_string(), "LOG_LEVEL".to_string()],
        });

        Ok(templates)
    }

    /// Generate Docker configurations
    fn generate_docker_configs(&self, template: &FrameworkSetupTemplate) -> Result<Vec<DockerConfig>> {
        let mut configs = Vec::new();

        // Dockerfile
        let dockerfile_content = self.generate_dockerfile_content(template)?;
        configs.push(DockerConfig {
            name: "Dockerfile".to_string(),
            file_path: "Dockerfile".to_string(),
            content: dockerfile_content,
            config_type: DockerConfigType::Dockerfile,
            framework_specific: true,
        });

        // Docker Compose
        let compose_content = self.generate_docker_compose_content(template)?;
        configs.push(DockerConfig {
            name: "Docker Compose".to_string(),
            file_path: "docker-compose.yml".to_string(),
            content: compose_content,
            config_type: DockerConfigType::DockerCompose,
            framework_specific: true,
        });

        // Docker ignore
        let dockerignore_content = self.generate_dockerignore_content()?;
        configs.push(DockerConfig {
            name: "Docker Ignore".to_string(),
            file_path: ".dockerignore".to_string(),
            content: dockerignore_content,
            config_type: DockerConfigType::DockerIgnore,
            framework_specific: false,
        });

        Ok(configs)
    }

    /// Generate Dockerfile content
    fn generate_dockerfile_content(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"# Multi-stage Dockerfile for {} application
FROM {} AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE {}
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM {} AS production
WORKDIR /app

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE {}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:{}/health || exit 1

CMD ["npm", "start"]
"#,
            template.framework_id,
            template.docker_base_image,
            template.docker_port,
            template.docker_base_image,
            template.docker_port,
            template.docker_port
        );

        Ok(content)
    }

    /// Generate docker-compose.yml content
    fn generate_docker_compose_content(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let env_vars = template.environment_variables.iter()
            .map(|var| format!("      - {}=${{{}}}", var, var))
            .collect::<Vec<_>>()
            .join("\n");

        let content = format!(
            r#"version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "{}:{}"
    environment:
{}
    env_file:
      - .env
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network

  # Uncomment if you need a database
  # database:
  #   image: postgres:14-alpine
  #   environment:
  #     POSTGRES_DB: myapp
  #     POSTGRES_USER: myuser
  #     POSTGRES_PASSWORD: mypassword
  #   volumes:
  #     - postgres_data:/var/lib/postgresql/data
  #   networks:
  #     - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
"#,
            template.docker_port,
            template.docker_port,
            env_vars
        );

        Ok(content)
    }

    /// Generate .dockerignore content
    fn generate_dockerignore_content(&self) -> Result<String> {
        let content = r#"# Git
.git
.gitignore
README.md

# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
build
dist
.next

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode
.idea
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Test coverage
coverage

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history
"#;

        Ok(content.to_string())
    }

    /// Generate CI configuration
    fn generate_ci_config(&self, ci_template: &CITemplate, framework_template: &FrameworkSetupTemplate) -> Result<CIConfig> {
        let content = match ci_template.platform {
            CIPlatform::GitHubActions => self.generate_github_actions_config(framework_template)?,
            CIPlatform::GitLabCI => self.generate_gitlab_ci_config(framework_template)?,
            CIPlatform::CircleCI => self.generate_circleci_config(framework_template)?,
            _ => "# CI configuration not implemented for this platform".to_string(),
        };

        Ok(CIConfig {
            name: format!("{:?} Configuration", ci_template.platform),
            file_path: ci_template.config_file_path.clone(),
            content,
            platform: ci_template.platform.clone(),
            includes_tests: true,
            includes_deployment: true,
            environment_secrets: framework_template.environment_variables.clone(),
        })
    }

    /// Generate GitHub Actions workflow
    fn generate_github_actions_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{{{ matrix.node-version }}}}
      uses: actions/setup-node@v4
      with:
        node-version: ${{{{ matrix.node-version }}}}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test -- --coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js 18
      uses: actions/setup-node@v4
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: {}
      env:
        NODE_ENV: production
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-files
        path: build/
    
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Run Snyk to check for vulnerabilities
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{{{ secrets.SNYK_TOKEN }}}}
    
  deploy:
    needs: [test, build, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Download build artifacts
      uses: actions/download-artifact@v3
      with:
        name: build-files
        path: build/
    
    - name: Deploy to production
      run: echo "Add your deployment commands here"
      env:
{}
"#,
            template.build_commands.join(" && "),
            template.environment_variables.iter()
                .map(|var| format!("        {}: ${{{{ secrets.{} }}}}", var, var))
                .collect::<Vec<_>>()
                .join("\n")
        );

        Ok(content)
    }

    /// Generate GitLab CI configuration
    fn generate_gitlab_ci_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"stages:
  - test
  - build
  - security
  - deploy

variables:
  NODE_VERSION: "18"
  CACHE_KEY: "npm-$CI_PROJECT_ID"

cache:
  key: $CACHE_KEY
  paths:
    - node_modules/
    - .npm/

before_script:
  - apt-get update -qq && apt-get install -y -qq git curl
  - curl -sL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
  - apt-get install -y nodejs
  - npm ci --cache .npm --prefer-offline

test:
  stage: test
  script:
    - npm run lint
    - npm test -- --coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  script:
    - {}
  artifacts:
    paths:
      - build/
    expire_in: 1 hour
  only:
    - main
    - develop

security:
  stage: security
  script:
    - npm audit --audit-level moderate
  allow_failure: true

deploy_staging:
  stage: deploy
  script:
    - echo "Deploy to staging"
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy_production:
  stage: deploy
  script:
    - echo "Deploy to production"
  environment:
    name: production
    url: https://example.com
  only:
    - main
  when: manual
"#,
            template.build_commands.join(" && ")
        );

        Ok(content)
    }

    /// Generate CircleCI configuration
    fn generate_circleci_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"version: 2.1

orbs:
  node: circleci/node@5.0

workflows:
  build_and_test:
    jobs:
      - node/test:
          version: '18.17'
          cache-version: v1
          run-command: npm test
      - build:
          requires:
            - node/test
      - deploy:
          requires:
            - build
          filters:
            branches:
              only: main

jobs:
  build:
    docker:
      - image: cimg/node:18.17
    steps:
      - checkout
      - node/install-packages:
          cache-version: v1
      - run:
          name: Build application
          command: {}
      - persist_to_workspace:
          root: .
          paths:
            - build

  deploy:
    docker:
      - image: cimg/node:18.17
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run:
          name: Deploy application
          command: echo "Add deployment commands here"
"#,
            template.build_commands.join(" && ")
        );

        Ok(content)
    }

    /// Generate deployment configuration
    pub fn generate_deployment_config(
        &self,
        deployment_template: &DeploymentTemplate,
        framework_template: &FrameworkSetupTemplate,
    ) -> Result<DeploymentConfig> {
        let content = match deployment_template.target {
            DeploymentTarget::Vercel => self.generate_vercel_config(framework_template)?,
            DeploymentTarget::Netlify => self.generate_netlify_config(framework_template)?,
            DeploymentTarget::AWS => self.generate_aws_config(framework_template)?,
            DeploymentTarget::Railway => self.generate_railway_config(framework_template)?,
            _ => "# Deployment configuration not implemented for this target".to_string(),
        };

        Ok(DeploymentConfig {
            name: format!("{:?} Deployment", deployment_template.target),
            file_path: deployment_template.config_files.first().unwrap_or(&"deploy.config".to_string()).clone(),
            content,
            target: deployment_template.target.clone(),
            requires_build: deployment_template.requires_build,
            environment_variables: framework_template.environment_variables.clone(),
            custom_domains: vec![],
        })
    }

    /// Generate Vercel configuration
    fn generate_vercel_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"{{
  "version": 2,
  "builds": [
    {{
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {{
        "distDir": "build"
      }}
    }}
  ],
  "routes": [
    {{
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }},
    {{
      "src": "/(.*)",
      "dest": "/index.html"
    }}
  ],
  "env": {{
{}
  }},
  "build": {{
    "env": {{
      "NODE_ENV": "production"
    }}
  }}
}}
"#,
            template.environment_variables.iter()
                .map(|var| format!(r#"    "{}": "@{}""#, var, var))
                .collect::<Vec<_>>()
                .join(",\n")
        );

        Ok(content)
    }

    /// Generate Netlify configuration
    fn generate_netlify_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"[build]
  publish = "build"
  command = "{}"

[build.environment]
  NODE_ENV = "production"
{}

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.deploy-preview]
  command = "npm run build"

[context.branch-deploy]
  command = "npm run build"
"#,
            template.build_commands.join(" && "),
            template.environment_variables.iter()
                .map(|var| format!(r#"  {} = """#, var))
                .collect::<Vec<_>>()
                .join("\n")
        );

        Ok(content)
    }

    /// Generate AWS configuration
    fn generate_aws_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"AWSTemplateFormatVersion: '2010-09-09'
Description: 'AWS CloudFormation template for {} application'

Parameters:
  BucketName:
    Type: String
    Default: my-{}-app
  
Resources:
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: error.html

  BucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref S3Bucket
      PolicyDocument:
        Statement:
          - Sid: PublicReadGetObject
            Effect: Allow
            Principal: '*'
            Action: s3:GetObject
            Resource: !Sub '${{S3Bucket}}/*'

  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - DomainName: !GetAtt S3Bucket.RegionalDomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: ''
        Enabled: true
        DefaultRootObject: index.html
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad

Outputs:
  BucketName:
    Description: 'Name of the S3 bucket'
    Value: !Ref S3Bucket
  
  DistributionDomainName:
    Description: 'CloudFront distribution domain name'
    Value: !GetAtt CloudFrontDistribution.DomainName
"#,
            template.framework_id,
            template.framework_id
        );

        Ok(content)
    }

    /// Generate Railway configuration
    fn generate_railway_config(&self, template: &FrameworkSetupTemplate) -> Result<String> {
        let content = format!(
            r#"[build]
command = "{}"

[deploy]
startCommand = "npm start"
restartPolicyType = "never"

[env]
NODE_ENV = "production"
PORT = "{}"
{}
"#,
            template.build_commands.join(" && "),
            template.docker_port,
            template.environment_variables.iter()
                .filter(|var| *var != "NODE_ENV" && *var != "PORT")
                .map(|var| format!("{} = \"${}\"", var, var))
                .collect::<Vec<_>>()
                .join("\n")
        );

        Ok(content)
    }

    /// Generate security scripts
    fn generate_security_scripts(&self, template: &FrameworkSetupTemplate) -> Result<Vec<SetupScript>> {
        let mut scripts = Vec::new();

        // Security audit script
        let audit_content = format!(
            r#"#!/bin/bash
# Security audit script for {} application
set -e

echo "🔒 Running security audit for {} application..."

# npm audit
echo "📋 Running npm audit..."
npm audit --audit-level moderate

# Check for known vulnerabilities
echo "🔍 Checking for known vulnerabilities..."
if command -v snyk &> /dev/null; then
    snyk test
else
    echo "⚠️ Snyk not installed. Install with: npm install -g snyk"
fi

# Check dependencies
echo "📦 Checking dependency licenses..."
if command -v license-checker &> /dev/null; then
    license-checker --summary
else
    echo "⚠️ license-checker not installed. Install with: npm install -g license-checker"
fi

# Security headers check (if server is running)
echo "🌐 Checking security headers..."
if curl -f http://localhost:{}/health &> /dev/null; then
    if command -v curl &> /dev/null; then
        echo "Checking security headers..."
        curl -I http://localhost:{}/ | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Strict-Transport-Security)"
    fi
else
    echo "⚠️ Server not running, skipping header check"
fi

echo "✅ Security audit completed!"
"#,
            template.framework_id,
            template.framework_id,
            template.docker_port,
            template.docker_port
        );

        scripts.push(SetupScript {
            name: "security-audit.sh".to_string(),
            description: "Security audit and vulnerability scanning".to_string(),
            file_path: "scripts/security-audit.sh".to_string(),
            content: audit_content,
            script_type: SetupScriptType::Validation,
            execution_order: 10,
            dependencies: vec!["install.sh".to_string()],
            platform_specific: false,
            validation_commands: vec!["npm audit".to_string()],
        });

        Ok(scripts)
    }

    /// Generate validation checklist
    fn generate_validation_checklist(
        &self,
        template: &FrameworkSetupTemplate,
        deployment_targets: &[DeploymentTarget],
    ) -> Result<Vec<ValidationStep>> {
        let mut checklist = Vec::new();

        // Basic validation steps
        checklist.push(ValidationStep {
            step_name: "Node.js Version".to_string(),
            description: "Verify Node.js version compatibility".to_string(),
            command: "node -v".to_string(),
            expected_output: Some("v16.0.0 or higher".to_string()),
            error_message: "Node.js version is too old".to_string(),
            fix_suggestion: "Install Node.js 16 or higher from nodejs.org".to_string(),
            is_critical: true,
        });

        checklist.push(ValidationStep {
            step_name: "Dependencies Installation".to_string(),
            description: "Verify all dependencies are installed".to_string(),
            command: "npm list --depth=0".to_string(),
            expected_output: None,
            error_message: "Some dependencies are missing or have conflicts".to_string(),
            fix_suggestion: "Run 'npm install' to install missing dependencies".to_string(),
            is_critical: true,
        });

        checklist.push(ValidationStep {
            step_name: "Build Process".to_string(),
            description: "Verify application builds successfully".to_string(),
            command: template.build_commands.join(" && "),
            expected_output: None,
            error_message: "Build process failed".to_string(),
            fix_suggestion: "Check build logs and fix any compilation errors".to_string(),
            is_critical: true,
        });

        checklist.push(ValidationStep {
            step_name: "Test Suite".to_string(),
            description: "Verify all tests pass".to_string(),
            command: template.test_commands.first().unwrap_or(&"npm test".to_string()).clone(),
            expected_output: None,
            error_message: "Some tests are failing".to_string(),
            fix_suggestion: "Fix failing tests before deployment".to_string(),
            is_critical: true,
        });

        checklist.push(ValidationStep {
            step_name: "Security Audit".to_string(),
            description: "Check for security vulnerabilities".to_string(),
            command: "npm audit --audit-level moderate".to_string(),
            expected_output: Some("found 0 vulnerabilities".to_string()),
            error_message: "Security vulnerabilities found".to_string(),
            fix_suggestion: "Run 'npm audit fix' or update vulnerable packages".to_string(),
            is_critical: false,
        });

        // Docker-specific validation
        if deployment_targets.contains(&DeploymentTarget::Docker) {
            checklist.push(ValidationStep {
                step_name: "Docker Build".to_string(),
                description: "Verify Docker image builds successfully".to_string(),
                command: "docker build -t test-app .".to_string(),
                expected_output: None,
                error_message: "Docker build failed".to_string(),
                fix_suggestion: "Check Dockerfile syntax and build context".to_string(),
                is_critical: true,
            });

            checklist.push(ValidationStep {
                step_name: "Docker Run".to_string(),
                description: "Verify Docker container runs successfully".to_string(),
                command: format!("docker run -d -p {}:{} test-app", template.docker_port, template.docker_port),
                expected_output: None,
                error_message: "Docker container failed to start".to_string(),
                fix_suggestion: "Check container logs with 'docker logs <container_id>'".to_string(),
                is_critical: true,
            });
        }

        Ok(checklist)
    }

    /// Generate README content
    fn generate_readme_content(
        &self,
        context: &GenerationContext,
        template: &FrameworkSetupTemplate,
        deployment_targets: &[DeploymentTarget],
    ) -> Result<String> {
        let content = format!(
            r#"# {} Application

Auto-generated setup documentation for your {} application.

## 🚀 Quick Start

### Prerequisites

- Node.js 16 or higher
- npm or yarn
{}

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. **Install dependencies**
   ```bash
   ./scripts/install.sh
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   ./scripts/dev.sh
   ```

Your application will be available at `http://localhost:{}`

## 📁 Project Structure

```
{}
├── scripts/           # Setup and deployment scripts
├── src/              # Application source code
├── public/           # Static assets
├── build/            # Production build (generated)
{}
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
└── README.md         # This file
```

## 🛠️ Available Scripts

- **Development**: `./scripts/dev.sh` - Start development server
- **Build**: `./scripts/build.sh` - Create production build
- **Test**: `{}` - Run test suite
- **Security Audit**: `./scripts/security-audit.sh` - Security scan

## 🐳 Docker Support

{}

## 🚀 Deployment

This project includes configurations for:

{}

### Environment Variables

Required environment variables:

{}

## 🔒 Security

- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies updated
- Use environment variables for sensitive data
- Enable security headers in production

## 📝 Environment Configuration

### Development
Copy `.env.example` to `.env.development` and configure:
```bash
{}
```

### Production
Set the following environment variables in your deployment platform:
```bash
{}
```

## 🧪 Testing

Run the test suite:
```bash
{}
```

For coverage report:
```bash
npm test -- --coverage
```

## 📊 Monitoring and Logging

- Health check endpoint: `/health`
- Logs are written to `./logs/` directory
- Monitor application performance with built-in metrics

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT in your .env file
2. **Build failures**: Clear node_modules and reinstall dependencies
3. **Environment variables**: Ensure all required variables are set

### Support

- Check the [Issues](<repo-issues-url>) page
- Review application logs in `./logs/`
- Run `./scripts/security-audit.sh` for security issues

## 📚 Additional Resources

- [Framework Documentation](<framework-docs-url>)
- [Deployment Guides](<deployment-docs-url>)
- [Best Practices](<best-practices-url>)

---

*This README was auto-generated by KeyKeeper API Configuration Generator*
"#,
            "My App", // Default project name since project_name field doesn't exist
            template.framework_id,
            if deployment_targets.contains(&DeploymentTarget::Docker) { "- Docker (for containerization)" } else { "" },
            template.docker_port,
            "my-app", // Default project name since project_name field doesn't exist
            if deployment_targets.contains(&DeploymentTarget::Docker) { "├── Dockerfile        # Docker configuration\n├── docker-compose.yml # Docker Compose setup" } else { "" },
            template.test_commands.first().unwrap_or(&"npm test".to_string()),
            if deployment_targets.contains(&DeploymentTarget::Docker) {
                r#"Build and run with Docker:
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

Or use Docker Compose:
```bash
docker-compose up
```"#
            } else {
                "Docker configuration not included in this setup."
            },
            deployment_targets.iter()
                .map(|target| format!("- {:?}", target))
                .collect::<Vec<_>>()
                .join("\n"),
            template.environment_variables.iter()
                .map(|var| format!("- `{}`: Description of {}", var, var.to_lowercase()))
                .collect::<Vec<_>>()
                .join("\n"),
            template.environment_variables.iter()
                .map(|var| format!("{}=development_value", var))
                .collect::<Vec<_>>()
                .join("\n"),
            template.environment_variables.iter()
                .map(|var| format!("{}=production_value", var))
                .collect::<Vec<_>>()
                .join("\n"),
            template.test_commands.first().unwrap_or(&"npm test".to_string())
        );

        Ok(content)
    }

    /// Validate environment compatibility for setup generation
    pub fn validate_environment_compatibility(
        &self,
        framework: &str,
        deployment_targets: &[DeploymentTarget],
    ) -> Result<Vec<String>> {
        let mut warnings = Vec::new();

        // Check framework compatibility
        if !self.framework_templates.contains_key(framework) {
            warnings.push(format!("Framework '{}' is not supported for setup generation", framework));
        }

        // Check deployment target compatibility
        for target in deployment_targets {
            if !self.deployment_templates.contains_key(target) {
                warnings.push(format!("Deployment target '{:?}' is not supported", target));
            }
        }

        // Framework-specific warnings
        match framework {
            "angular" => {
                if deployment_targets.contains(&DeploymentTarget::Vercel) {
                    warnings.push("Angular on Vercel requires additional configuration for routing".to_string());
                }
            },
            "nextjs" => {
                if deployment_targets.contains(&DeploymentTarget::Netlify) {
                    warnings.push("Next.js on Netlify requires @netlify/plugin-nextjs".to_string());
                }
            },
            _ => {}
        }

        Ok(warnings)
    }
}

impl Default for SetupGenerator {
    fn default() -> Self {
        Self::new()
    }
}