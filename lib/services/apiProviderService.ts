import { invoke } from '@tauri-apps/api/core';
import { GeneratedFile } from '../tauri-api';
import { enhancedTemplateService } from './enhancedTemplateService';
import { frameworkDetectionService } from './frameworkDetectionService';
import {
    EnhancedGenerationRequest,
    EnhancedGenerationResult,
    FrameworkDetectionResult,
    TemplateSuggestion,
    DEFAULT_USER_PREFERENCES
} from '../types/enhanced-templates';

export interface ApiProvider {
    id: string;
    name: string;
    description: string;
    keyPatterns: string[];
    envPatterns: string[];
    docsUrl: string;
    setupType: 'config-file' | 'client-library' | 'full-stack';
    configTemplates: ConfigTemplate[];
    dependencies: string[];
    category: 'auth' | 'payment' | 'database' | 'messaging' | 'ai' | 'storage' | 'analytics' | 'other';
}

export interface ConfigTemplate {
    id: string;
    name: string;
    description: string;
    fileType: 'typescript' | 'javascript' | 'json' | 'env' | 'yaml';
    fileName: string;
    template: string;
    requiredEnvVars: string[];
    optionalEnvVars: string[];
    dependencies: string[];
}

export interface DetectionResult {
    provider: ApiProvider;
    confidence: number;
    matchedPatterns: string[];
    detectedEnvVars: string[];
}

export interface GenerationRequest {
    providerId: string;
    envVars: Record<string, string>;
    features: string[];
    framework?: string;
    outputPath?: string;
}

export interface GeneratedConfig {
    files: GeneratedFile[];
    dependencies: string[];
    setupInstructions: string[];
    nextSteps: string[];
}

// Using GeneratedFile from tauri-api.ts

/**
 * API Provider Service - Detects API providers and generates configurations
 */
export class ApiProviderService {
    private static providers: Map<string, ApiProvider> = new Map();
    private static initialized = false;

    /**
     * Initialize the provider registry
     */
    static async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.loadProviderRegistry();
            this.initialized = true;
            console.log('✅ API Provider Service initialized with', this.providers.size, 'providers');
        } catch (error) {
            console.error('❌ Failed to initialize API Provider Service:', error);
        }
    }

    /**
     * Load provider registry from backend
     */
    private static async loadProviderRegistry(): Promise<void> {
        // Load built-in providers first
        this.registerBuiltInProviders();

        // TODO: Load additional providers from backend/database
        try {
            const customProviders = await invoke<ApiProvider[]>('get_api_providers');
            customProviders.forEach(provider => {
                this.providers.set(provider.id, provider);
            });
        } catch (error) {
            console.warn('Could not load custom providers:', error);
        }
    }

    /**
     * Register built-in API providers
     */
    private static registerBuiltInProviders(): void {
        // Better Auth
        this.providers.set('better-auth', {
            id: 'better-auth',
            name: 'Better Auth',
            description: 'Framework-agnostic TypeScript authentication library',
            keyPatterns: ['BETTERAUTH_', 'BETTER_AUTH_'],
            envPatterns: ['BETTERAUTH_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET'],
            docsUrl: 'https://www.better-auth.com/docs',
            setupType: 'full-stack',
            category: 'auth',
            dependencies: ['better-auth', 'drizzle-orm'],
            configTemplates: [
                {
                    id: 'better-auth-config',
                    name: 'Better Auth Configuration',
                    description: 'Main auth configuration with email/password',
                    fileType: 'typescript',
                    fileName: 'lib/auth.ts',
                    template: 'better-auth-config-template',
                    requiredEnvVars: ['BETTERAUTH_URL', 'BETTER_AUTH_SECRET'],
                    optionalEnvVars: ['DATABASE_URL'],
                    dependencies: ['better-auth', 'drizzle-orm']
                },
                {
                    id: 'better-auth-client',
                    name: 'Better Auth Client',
                    description: 'Client-side auth setup',
                    fileType: 'typescript',
                    fileName: 'lib/auth-client.ts',
                    template: 'better-auth-client-template',
                    requiredEnvVars: ['NEXT_PUBLIC_BETTERAUTH_URL'],
                    optionalEnvVars: [],
                    dependencies: ['better-auth']
                }
            ]
        });

        // OpenAI
        this.providers.set('openai', {
            id: 'openai',
            name: 'OpenAI',
            description: 'OpenAI GPT and AI models API',
            keyPatterns: ['OPENAI_', 'OPENAI_API_KEY'],
            envPatterns: ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
            docsUrl: 'https://platform.openai.com/docs',
            setupType: 'client-library',
            category: 'ai',
            dependencies: ['openai'],
            configTemplates: [
                {
                    id: 'openai-config',
                    name: 'OpenAI Configuration',
                    description: 'OpenAI client setup',
                    fileType: 'typescript',
                    fileName: 'lib/openai.ts',
                    template: 'openai-config-template',
                    requiredEnvVars: ['OPENAI_API_KEY'],
                    optionalEnvVars: ['OPENAI_BASE_URL'],
                    dependencies: ['openai']
                }
            ]
        });

        // Stripe
        this.providers.set('stripe', {
            id: 'stripe',
            name: 'Stripe',
            description: 'Payment processing platform',
            keyPatterns: ['STRIPE_', 'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'],
            envPatterns: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
            docsUrl: 'https://stripe.com/docs',
            setupType: 'full-stack',
            category: 'payment',
            dependencies: ['stripe'],
            configTemplates: [
                {
                    id: 'stripe-config',
                    name: 'Stripe Configuration',
                    description: 'Stripe payment setup',
                    fileType: 'typescript',
                    fileName: 'lib/stripe.ts',
                    template: 'stripe-config-template',
                    requiredEnvVars: ['STRIPE_SECRET_KEY'],
                    optionalEnvVars: ['STRIPE_WEBHOOK_SECRET'],
                    dependencies: ['stripe']
                }
            ]
        });

        // Supabase
        this.providers.set('supabase', {
            id: 'supabase',
            name: 'Supabase',
            description: 'Open source Firebase alternative',
            keyPatterns: ['SUPABASE_', 'NEXT_PUBLIC_SUPABASE_'],
            envPatterns: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
            docsUrl: 'https://supabase.com/docs',
            setupType: 'full-stack',
            category: 'database',
            dependencies: ['@supabase/supabase-js'],
            configTemplates: [
                {
                    id: 'supabase-config',
                    name: 'Supabase Configuration',
                    description: 'Supabase client setup',
                    fileType: 'typescript',
                    fileName: 'lib/supabase.ts',
                    template: 'supabase-config-template',
                    requiredEnvVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
                    optionalEnvVars: ['SUPABASE_SERVICE_ROLE_KEY'],
                    dependencies: ['@supabase/supabase-js']
                }
            ]
        });

        // Resend
        this.providers.set('resend', {
            id: 'resend',
            name: 'Resend',
            description: 'Email API for developers',
            keyPatterns: ['RESEND_', 'RESEND_API_KEY'],
            envPatterns: ['RESEND_API_KEY'],
            docsUrl: 'https://resend.com/docs',
            setupType: 'client-library',
            category: 'messaging',
            dependencies: ['resend'],
            configTemplates: [
                {
                    id: 'resend-config',
                    name: 'Resend Configuration',
                    description: 'Resend email client setup',
                    fileType: 'typescript',
                    fileName: 'lib/resend.ts',
                    template: 'resend-config-template',
                    requiredEnvVars: ['RESEND_API_KEY'],
                    optionalEnvVars: [],
                    dependencies: ['resend']
                }
            ]
        });
    }

    /**
     * Detect API providers from environment variables
     */
    static async detectProvidersFromEnv(envVars: Record<string, string>): Promise<DetectionResult[]> {
        await this.initialize();

        const results: DetectionResult[] = [];
        const envKeys = Object.keys(envVars);

        for (const [providerId, provider] of Array.from(this.providers)) {
            const matchedPatterns: string[] = [];
            const detectedEnvVars: string[] = [];
            let confidence = 0;

            // Check key patterns
            for (const pattern of provider.keyPatterns) {
                for (const envKey of envKeys) {
                    if (envKey.includes(pattern)) {
                        matchedPatterns.push(pattern);
                        detectedEnvVars.push(envKey);
                        confidence += 0.4;
                    }
                }
            }

            // Check specific env patterns (higher confidence)
            for (const envPattern of provider.envPatterns) {
                if (envKeys.includes(envPattern)) {
                    matchedPatterns.push(envPattern);
                    detectedEnvVars.push(envPattern);
                    confidence += 0.6;
                }
            }

            if (confidence > 0) {
                results.push({
                    provider,
                    confidence: Math.min(confidence, 1.0),
                    matchedPatterns,
                    detectedEnvVars
                });
            }
        }

        // Sort by confidence
        return results.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Detect providers from a single environment variable name
     */
    static async detectProviderFromEnvVar(envVarName: string): Promise<DetectionResult | null> {
        await this.initialize();

        for (const [providerId, provider] of Array.from(this.providers)) {
            // Check exact match first
            if (provider.envPatterns.includes(envVarName)) {
                return {
                    provider,
                    confidence: 0.9,
                    matchedPatterns: [envVarName],
                    detectedEnvVars: [envVarName]
                };
            }

            // Check pattern match
            for (const pattern of provider.keyPatterns) {
                if (envVarName.includes(pattern)) {
                    return {
                        provider,
                        confidence: 0.7,
                        matchedPatterns: [pattern],
                        detectedEnvVars: [envVarName]
                    };
                }
            }
        }

        return null;
    }

    /**
     * Generate configuration for a specific provider (Legacy method)
     */
    static async generateConfiguration(request: GenerationRequest): Promise<GeneratedConfig> {
        await this.initialize();

        const provider = this.providers.get(request.providerId);
        if (!provider) {
            throw new Error(`Provider ${request.providerId} not found`);
        }

        try {
            // Call backend to generate configuration
            const result = await invoke<GeneratedConfig>('generate_api_configuration', {
                request: {
                    provider_id: request.providerId,
                    env_vars: request.envVars,
                    features: request.features || [],
                    framework: request.framework || 'nextjs',
                    output_path: request.outputPath || './'
                }
            });

            return result;
        } catch (error) {
            console.error(`Failed to generate configuration for ${request.providerId}:`, error);

            // Fallback to client-side generation
            return this.generateConfigurationClientSide(provider, request);
        }
    }

    /**
     * Enhanced configuration generation with multi-framework support
     */
    static async generateEnhancedConfiguration(
        request: EnhancedGenerationRequest,
        onProgress?: (progress: any) => void,
        onCompletion?: (sessionId: string, success: boolean, error?: string) => void
    ): Promise<EnhancedGenerationResult> {
        await this.initialize();

        const provider = this.providers.get(request.providerId);
        if (!provider) {
            throw new Error(`Provider ${request.providerId} not found`);
        }

        try {
            // Use the enhanced template service for new generation
            return await enhancedTemplateService.generateEnhancedConfiguration(
                request,
                onProgress,
                onCompletion
            );
        } catch (error) {
            console.error(`Enhanced configuration generation failed for ${request.providerId}:`, error);
            throw error;
        }
    }

    /**
     * Preview enhanced configuration without creating files
     */
    static async previewEnhancedConfiguration(
        request: EnhancedGenerationRequest,
        onProgress?: (progress: any) => void
    ): Promise<EnhancedGenerationResult> {
        await this.initialize();

        const provider = this.providers.get(request.providerId);
        if (!provider) {
            throw new Error(`Provider ${request.providerId} not found`);
        }

        try {
            return await enhancedTemplateService.previewGeneratedFiles(
                request,
                onProgress
            );
        } catch (error) {
            console.error(`Configuration preview failed for ${request.providerId}:`, error);
            throw error;
        }
    }

    /**
     * Detect project framework automatically
     */
    static async detectProjectFramework(projectPath: string): Promise<FrameworkDetectionResult[]> {
        try {
            return await frameworkDetectionService.detectFrameworks(projectPath);
        } catch (error) {
            console.error('Framework detection failed:', error);
            throw error;
        }
    }

    /**
     * Get template suggestions for environment variables
     */
    static async getTemplateSuggestions(
        envVars: Record<string, string>,
        projectPath?: string
    ): Promise<TemplateSuggestion[]> {
        try {
            return await enhancedTemplateService.getTemplateSuggestions(envVars, projectPath);
        } catch (error) {
            console.error('Getting template suggestions failed:', error);
            throw error;
        }
    }

    /**
     * Validate template combination for compatibility
     */
    static async validateTemplateCombination(
        providerId: string,
        templateId: string | undefined,
        framework: string,
        features: string[]
    ) {
        await this.initialize();

        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            return await enhancedTemplateService.validateTemplateCombination(
                providerId,
                templateId,
                framework,
                features
            );
        } catch (error) {
            console.error('Template validation failed:', error);
            throw error;
        }
    }

    /**
     * Get framework compatibility matrix for a provider
     */
    static async getProviderFrameworkCompatibility(providerId: string) {
        await this.initialize();

        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            return await enhancedTemplateService.getProviderFrameworkCompatibility(providerId);
        } catch (error) {
            console.error('Getting framework compatibility failed:', error);
            throw error;
        }
    }

    /**
     * Create enhanced generation request from legacy request
     */
    static createEnhancedRequest(
        legacyRequest: GenerationRequest,
        framework?: string,
        projectPath?: string
    ): EnhancedGenerationRequest {
        return {
            providerId: legacyRequest.providerId,
            templateId: undefined,
            context: {
                framework: framework || legacyRequest.framework || 'nextjs',
                envVars: legacyRequest.envVars,
                requestedFeatures: legacyRequest.features || [],
                outputPath: legacyRequest.outputPath || './',
                projectSettings: {},
                userPreferences: DEFAULT_USER_PREFERENCES,
                existingFiles: [],
                packageJson: undefined,
                tsconfig: undefined
            },
            features: legacyRequest.features || [],
            useLlmEnhancement: false,
            templateOverrides: {},
            previewOnly: false
        };
    }

    /**
     * Get enhanced provider information
     */
    static async getEnhancedProviderInfo(providerId: string) {
        await this.initialize();

        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            // Get framework compatibility
            const frameworkCompatibility = await this.getProviderFrameworkCompatibility(providerId);

            // Get template suggestions for empty env vars (to see what's available)
            const templateSuggestions = await this.getTemplateSuggestions({}, undefined);
            const providerSuggestions = templateSuggestions.filter(s => s.providerId === providerId);

            return {
                ...provider,
                frameworkCompatibility,
                availableTemplates: providerSuggestions,
                enhancedFeaturesAvailable: true
            };
        } catch (error) {
            console.error(`Getting enhanced provider info failed for ${providerId}:`, error);
            // Return basic provider info if enhanced features fail
            return {
                ...provider,
                frameworkCompatibility: [],
                availableTemplates: [],
                enhancedFeaturesAvailable: false
            };
        }
    }

    /**
     * Client-side configuration generation fallback
     */
    private static generateConfigurationClientSide(
        provider: ApiProvider,
        request: GenerationRequest
    ): GeneratedConfig {
        const files: GeneratedFile[] = [];
        const dependencies = [...provider.dependencies];
        const setupInstructions: string[] = [];
        const nextSteps: string[] = [];

        for (const template of provider.configTemplates) {
            // Generate file content based on template
            const content = this.generateTemplateContent(template, request.envVars);

            files.push({
                path: template.fileName,
                content,
                file_type: template.id.includes('client') ? 'code' : 'config',
                language: template.fileType as 'typescript' | 'javascript' | 'json' | 'env' | 'yaml'
            });

            dependencies.push(...template.dependencies);
        }

        setupInstructions.push(`Install dependencies: npm install ${dependencies.join(' ')}`);
        setupInstructions.push(`Add environment variables to .env file`);
        nextSteps.push(`Configure ${provider.name} according to your needs`);
        nextSteps.push(`Test the integration`);

        return {
            files,
            dependencies: [...Array.from(new Set(dependencies[0]))], // Remove duplicates
            setupInstructions,
            nextSteps
        };
    }

    /**
     * Generate template content
     */
    private static generateTemplateContent(template: ConfigTemplate, envVars: Record<string, string>): string {
        // This would normally load from actual template files
        // For now, generate basic content based on provider

        switch (template.id) {
            case 'better-auth-config':
                return this.generateBetterAuthConfig(envVars);
            case 'better-auth-client':
                return this.generateBetterAuthClient(envVars);
            case 'openai-config':
                return this.generateOpenAIConfig(envVars);
            case 'stripe-config':
                return this.generateStripeConfig(envVars);
            case 'supabase-config':
                return this.generateSupabaseConfig(envVars);
            case 'resend-config':
                return this.generateResendConfig(envVars);
            default:
                return `// Generated configuration for ${template.name}\n// TODO: Implement template content`;
        }
    }

    // Template generators
    private static generateBetterAuthConfig(envVars: Record<string, string>): string {
        return `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [process.env.BETTERAUTH_URL!],
  baseURL: process.env.BETTERAUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;`;
    }

    private static generateBetterAuthClient(envVars: Record<string, string>): string {
        return `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTERAUTH_URL!,
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  getSession 
} = authClient;`;
    }

    private static generateOpenAIConfig(envVars: Record<string, string>): string {
        return `import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  ${envVars.OPENAI_BASE_URL ? `baseURL: process.env.OPENAI_BASE_URL!,` : ''}
});

// Helper function for chat completions
export async function createChatCompletion(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model = 'gpt-4o-mini'
) {
  const completion = await openai.chat.completions.create({
    model,
    messages,
  });
  
  return completion.choices[0]?.message?.content || '';
}`;
    }

    private static generateStripeConfig(envVars: Record<string, string>): string {
        return `import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Webhook configuration
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to create payment intent
export async function createPaymentIntent(amount: number, currency = 'usd') {
  return await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency,
  });
}`;
    }

    private static generateSupabaseConfig(envVars: Record<string, string>): string {
        return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (for API routes)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);`;
    }

    private static generateResendConfig(envVars: Record<string, string>): string {
        return `import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY!);

// Helper function to send email
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from = 'noreply@example.com'
) {
  return await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}`;
    }

    /**
     * Get all available providers
     */
    static async getAllProviders(): Promise<ApiProvider[]> {
        await this.initialize();
        return Array.from(this.providers.values());
    }

    /**
     * Get provider by ID
     */
    static async getProvider(id: string): Promise<ApiProvider | null> {
        await this.initialize();
        return this.providers.get(id) || null;
    }

    /**
     * Search providers by category
     */
    static async getProvidersByCategory(category: string): Promise<ApiProvider[]> {
        await this.initialize();
        return Array.from(this.providers.values()).filter(p => p.category === category);
    }
}