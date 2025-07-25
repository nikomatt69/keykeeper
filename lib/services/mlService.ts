import { invoke } from '@tauri-apps/api/core';
import { 
    TauriAPI, 
    DocumentationGenerationRequest, 
    GeneratedDocumentation, 
    CodeExample, 
    ConfigTemplateRequest, 
    GeneratedConfigTemplate,
    EnhancedMLPrediction,
    DocumentationSuggestion,
    ConfigurationRecommendation,
    LLMEngineConfig,
    DocumentationSection
} from '../tauri-api';

// ML Types
export interface ContextInfo {
    active_app?: string;
    file_path?: string;
    file_extension?: string;
    project_type?: string;
    language?: string;
    content_snippet?: string;
}

export interface MLConfig {
    model_cache_path: string;
    max_suggestions: number;
    learning_rate: number;
    similarity_threshold: number;
}

export interface KeySuggestion {
    key_id: string;
    confidence: number;
    reason: string;
    suggested_format: KeyFormat;
}

export enum KeyFormat {
    Plain = 'Plain',
    EnvironmentVariable = 'EnvironmentVariable',
    ProcessEnv = 'ProcessEnv',
    ConfigFile = 'ConfigFile'
}

export interface UsagePrediction {
    frequency_score: number;
    recency_score: number;
    context_match_score: number;
    predicted_next_usage?: string;
}

export interface SecurityScore {
    risk_level: RiskLevel;
    confidence: number;
    reasons: string[];
}

export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Critical = 'Critical'
}

export interface MLPrediction {
    api_key_suggestions: KeySuggestion[];
    context_confidence: number;
    usage_prediction: UsagePrediction;
    security_score: SecurityScore;
}

export interface MLUsageRecord extends Record<string, unknown> {
    key_id: string;
    context: ContextInfo;
    success: boolean;
}

export interface MLAnalysisRequest extends Record<string, unknown> {
    context: ContextInfo;
    available_keys: string[];
}

export // Extend Record<string, unknown> to ensure compatibility with Tauri's invoke function
interface MLInitRequest extends Record<string, unknown> {
    config?: MLConfig;
}

/**
 * ML Service for KeyKeeper
 * Provides intelligent API key suggestions and context analysis
 */
export class MLService {
    private static isInitialized = false;
    private static initializationPromise: Promise<boolean> | null = null;

    /**
     * Initialize the ML Engine
     */
    static async initialize(config?: MLConfig): Promise<boolean> {
        // Avoid multiple initialization attempts
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization(config);
        return this.initializationPromise;
    }

    private static async _performInitialization(config?: MLConfig): Promise<boolean> {
        try {
            const request: MLInitRequest = { config };
            const result = await invoke<string>('initialize_ml_engine', request);
            this.isInitialized = true;
            console.log('✅ ML Engine initialized:', result);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize ML Engine:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Check if ML Engine is ready
     */
    static async isReady(): Promise<boolean> {
        try {
            return await invoke<boolean>('check_ml_status');
        } catch (error) {
            console.error('Error checking ML status:', error);
            return false;
        }
    }

    /**
     * Get intelligent API key suggestions based on context
     */
    static async getSmartSuggestions(
        context: ContextInfo,
        availableKeys: string[]
    ): Promise<MLPrediction> {
        await this.ensureInitialized();
        
        const request: MLAnalysisRequest = {
            context,
            available_keys: availableKeys
        };

        try {
            return await invoke<MLPrediction>('analyze_context_ml', request);
        } catch (error) {
            console.error('ML analysis failed:', error);
            // Return fallback prediction
            return this.createFallbackPrediction(availableKeys);
        }
    }

    /**
     * Record key usage for ML learning
     */
    static async recordUsage(keyId: string, context: ContextInfo, success: boolean): Promise<void> {
        if (!this.isInitialized) {
            console.warn('ML Engine not initialized, skipping usage recording');
            return;
        }

        const record: MLUsageRecord = {
            key_id: keyId,
            context,
            success
        };

        try {
            await invoke<string>('record_ml_usage', record);
        } catch (error) {
            console.error('Failed to record ML usage:', error);
        }
    }

    /**
     * Get ML usage statistics
     */
    static async getUsageStats(): Promise<Record<string, any>> {
        await this.ensureInitialized();
        
        try {
            return await invoke('get_ml_stats');
        } catch (error) {
            console.error('Failed to get ML stats:', error);
            return {};
        }
    }

    /**
     * Detect current context automatically
     */
    static async detectCurrentContext(): Promise<ContextInfo> {
        try {
            return await invoke<ContextInfo>('detect_context');
        } catch (error) {
            console.warn('Context detection failed, using fallback:', error);
            return this.createFallbackContext();
        }
    }

    /**
     * Get current ML configuration
     */
    static async getConfig(): Promise<MLConfig> {
        await this.ensureInitialized();
        
        try {
            return await invoke<MLConfig>('get_ml_config');
        } catch (error) {
            console.error('Failed to get ML config:', error);
            return this.getDefaultConfig();
        }
    }

    /**
     * Reinitialize ML Engine with new configuration
     */
    static async reinitialize(config?: MLConfig): Promise<boolean> {
        this.isInitialized = false;
        this.initializationPromise = null;
        
        try {
            const request: MLInitRequest = { config };
            const result = await invoke<string>('reinitialize_ml_engine', request);
            this.isInitialized = true;
            console.log('✅ ML Engine reinitialized:', result);
            return true;
        } catch (error) {
            console.error('❌ Failed to reinitialize ML Engine:', error);
            return false;
        }
    }

    // Utility Methods

    /**
     * Ensure ML Engine is initialized before operations
     */
    private static async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Create fallback context when detection fails
     */
    private static createFallbackContext(): ContextInfo {
        return {
            active_app: 'Unknown',
            file_extension: undefined,
            project_type: undefined,
            language: undefined,
        };
    }

    /**
     * Create fallback prediction when ML analysis fails
     */
    private static createFallbackPrediction(availableKeys: string[]): MLPrediction {
        const suggestions: KeySuggestion[] = availableKeys.slice(0, 3).map((keyId, index) => ({
            key_id: keyId,
            confidence: 0.5 - (index * 0.1),
            reason: 'Available for current context',
            suggested_format: KeyFormat.Plain
        }));

        return {
            api_key_suggestions: suggestions,
            context_confidence: 0.3,
            usage_prediction: {
                frequency_score: 0.0,
                recency_score: 0.0,
                context_match_score: 0.0,
            },
            security_score: {
                risk_level: RiskLevel.Low,
                confidence: 0.5,
                reasons: []
            }
        };
    }

    /**
     * Get default ML configuration
     */
    private static getDefaultConfig(): MLConfig {
        return {
            model_cache_path: './ml_models',
            max_suggestions: 5,
            learning_rate: 0.1,
            similarity_threshold: 0.3
        };
    }

    // Context Detection Helpers

    /**
     * Create context from browser environment
     */
    static createWebContext(url: string, domainInfo?: string): ContextInfo {
        const domain = new URL(url).hostname;
        return {
            active_app: 'Browser',
            file_extension: 'html',
            project_type: 'web',
            content_snippet: domainInfo,
            file_path: url
        };
    }

    /**
     * Create context from VSCode environment
     */
    static createVSCodeContext(
        filePath?: string,
        language?: string,
        projectType?: string
    ): ContextInfo {
        const fileExtension = filePath ? 
            filePath.split('.').pop()?.toLowerCase() : undefined;

        return {
            active_app: 'VSCode',
            file_path: filePath,
            file_extension: fileExtension,
            language,
            project_type: projectType
        };
    }

    /**
     * Create context from file system
     */
    static createFileContext(filePath: string, content?: string): ContextInfo {
        const fileExtension = filePath.split('.').pop()?.toLowerCase();
        const projectType = this.inferProjectType(filePath, content);
        const language = this.inferLanguage(fileExtension);

        return {
            active_app: 'FileManager',
            file_path: filePath,
            file_extension: fileExtension,
            project_type: projectType,
            language,
            content_snippet: content?.substring(0, 200)
        };
    }

    /**
     * Infer project type from file path and content
     */
    private static inferProjectType(filePath: string, content?: string): string | undefined {
        const path = filePath.toLowerCase();
        
        if (path.includes('package.json') || path.includes('node_modules')) {
            return 'node';
        }
        if (path.includes('cargo.toml') || path.includes('src/main.rs')) {
            return 'rust';
        }
        if (path.includes('requirements.txt') || path.includes('.py')) {
            return 'python';
        }
        if (path.includes('.java') || path.includes('pom.xml')) {
            return 'java';
        }
        if (path.includes('.go') || path.includes('go.mod')) {
            return 'go';
        }
        
        return undefined;
    }

    /**
     * Infer programming language from file extension
     */
    private static inferLanguage(extension?: string): string | undefined {
        const languageMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'rs': 'rust',
            'go': 'go',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin',
            'dart': 'dart',
            'scala': 'scala',
            'cs': 'csharp'
        };

        return extension ? languageMap[extension] : undefined;
    }

    // Security Helpers

    /**
     * Analyze security risk of current context
     */
    static analyzeSecurityRisk(context: ContextInfo): {
        risk: RiskLevel;
        reasons: string[];
    } {
        const reasons: string[] = [];
        let riskScore = 0;

        // Check for risky applications
        if (context.active_app?.toLowerCase().includes('browser')) {
            riskScore += 0.4;
            reasons.push('Web browser environment detected');
        }

        // Check for risky file locations
        if (context.file_path?.includes('/tmp') || 
            context.file_path?.includes('temp') ||
            context.file_path?.includes('downloads')) {
            riskScore += 0.3;
            reasons.push('Temporary or public directory');
        }

        // Check for script files
        if (['sh', 'bat', 'cmd', 'ps1'].includes(context.file_extension || '')) {
            riskScore += 0.3;
            reasons.push('Script file detected');
        }

        let risk: RiskLevel;
        if (riskScore > 0.7) risk = RiskLevel.Critical;
        else if (riskScore > 0.5) risk = RiskLevel.High;
        else if (riskScore > 0.3) risk = RiskLevel.Medium;
        else risk = RiskLevel.Low;

        return { risk, reasons };
    }

    /**
     * Get security recommendations for key usage
     */
    static getSecurityRecommendations(context: ContextInfo): string[] {
        const recommendations: string[] = [];
        const { risk } = this.analyzeSecurityRisk(context);

        switch (risk) {
            case RiskLevel.Critical:
                recommendations.push('🚨 High risk context - avoid using sensitive keys');
                recommendations.push('🔒 Consider using read-only or limited scope keys');
                recommendations.push('⏰ Enable short-term key expiration');
                break;
            case RiskLevel.High:
                recommendations.push('⚠️ Elevated risk - use caution');
                recommendations.push('📝 Monitor key usage closely');
                break;
            case RiskLevel.Medium:
                recommendations.push('💡 Standard security practices apply');
                break;
            case RiskLevel.Low:
                recommendations.push('✅ Safe environment for key usage');
                break;
        }

        return recommendations;
    }

    // ===============================
    //  LLM-ENHANCED METHODS
    // ===============================

    /**
     * Generate comprehensive documentation using LLM
     */
    static async generateDocumentation(
        provider: string, 
        context: string, 
        apiKeyFormat?: string, 
        environment?: string
    ): Promise<GeneratedDocumentation> {
        const request: DocumentationGenerationRequest = {
            provider,
            context,
            api_key_format: apiKeyFormat,
            environment
        };

        try {
            return await TauriAPI.generateDocumentation(request);
        } catch (error) {
            console.error('Documentation generation failed:', error);
            // Return fallback documentation
            return this.createFallbackDocumentation(provider);
        }
    }

    /**
     * Generate usage examples for an API provider
     */
    static async generateUsageExamples(
        provider: string, 
        apiKeyFormat: string
    ): Promise<CodeExample[]> {
        try {
            return await TauriAPI.generateUsageExamples(provider, apiKeyFormat);
        } catch (error) {
            console.error('Usage examples generation failed:', error);
            return this.createFallbackUsageExamples(provider);
        }
    }

    /**
     * Generate configuration templates
     */
    static async generateConfigurationTemplate(
        provider: string,
        framework: string,
        environment: string,
        features?: string[]
    ): Promise<GeneratedConfigTemplate> {
        const request: ConfigTemplateRequest = {
            provider,
            framework,
            environment,
            features
        };

        try {
            return await TauriAPI.generateConfigurationTemplate(request);
        } catch (error) {
            console.error('Configuration template generation failed:', error);
            return this.createFallbackConfigTemplate(provider, framework);
        }
    }

    /**
     * Get enhanced ML predictions with LLM insights
     */
    static async getEnhancedMLPrediction(
        context: ContextInfo,
        availableKeys: string[]
    ): Promise<EnhancedMLPrediction> {
        try {
            return await TauriAPI.getEnhancedMLPrediction(context, availableKeys);
        } catch (error) {
            console.error('Enhanced ML prediction failed:', error);
            // Fallback to regular prediction and enhance it
            const basicPrediction = await this.getSmartSuggestions(context, availableKeys);
            return this.enhancePredictionWithFallback(basicPrediction, context);
        }
    }

    /**
     * Get contextual documentation suggestions
     */
    static async getContextualDocumentationSuggestions(
        provider: string,
        context: ContextInfo
    ): Promise<DocumentationSuggestion[]> {
        try {
            return await TauriAPI.getContextualDocumentationSuggestions(provider, context);
        } catch (error) {
            console.error('Contextual documentation suggestions failed:', error);
            return [];
        }
    }

    /**
     * Get configuration recommendations based on context
     */
    static async getConfigurationRecommendations(
        provider: string,
        context: ContextInfo
    ): Promise<ConfigurationRecommendation[]> {
        try {
            return await TauriAPI.getConfigurationRecommendations(provider, context);
        } catch (error) {
            console.error('Configuration recommendations failed:', error);
            return this.createFallbackConfigRecommendations(provider, context);
        }
    }

    /**
     * Initialize LLM Engine
     */
    static async initializeLLMEngine(config: LLMEngineConfig): Promise<boolean> {
        try {
            await TauriAPI.initializeLLMEngine(config);
            return true;
        } catch (error) {
            console.error('Failed to initialize LLM engine:', error);
            return false;
        }
    }

    /**
     * Check if LLM Engine is loaded
     */
    static async isLLMEngineLoaded(): Promise<boolean> {
        try {
            return await TauriAPI.isLLMEngineLoaded();
        } catch (error) {
            console.error('Failed to check LLM engine status:', error);
            return false;
        }
    }

    /**
     * Enhance documentation with LLM
     */
    static async enhanceDocumentationWithLLM(
        docId: string,
        content: string
    ): Promise<{ enhanced_content: string; sections: DocumentationSection[] }> {
        try {
            return await TauriAPI.enhanceDocumentationWithLLM(docId, content);
        } catch (error) {
            console.error('Documentation enhancement failed:', error);
            return {
                enhanced_content: content,
                sections: []
            };
        }
    }

    /**
     * Summarize documentation content
     */
    static async summarizeDocumentation(
        content: string,
        maxLength?: number
    ): Promise<string> {
        try {
            return await TauriAPI.summarizeDocumentation(content, maxLength);
        } catch (error) {
            console.error('Documentation summarization failed:', error);
            // Simple fallback summarization
            return this.createFallbackSummary(content, maxLength);
        }
    }

    // ===============================
    //  FALLBACK METHODS
    // ===============================

    private static createFallbackDocumentation(provider: string): GeneratedDocumentation {
        return {
            content: `# ${provider} API Documentation\n\nBasic documentation for ${provider} API integration.`,
            sections: [
                {
                    title: 'Overview',
                    content: `Documentation for ${provider} API integration.`,
                    level: 1,
                    type: 'overview'
                }
            ],
            usage_examples: this.createFallbackUsageExamples(provider),
            configuration_template: `# ${provider} Configuration\n${provider.toUpperCase()}_API_KEY=your_api_key_here`
        };
    }

    private static createFallbackUsageExamples(provider: string): CodeExample[] {
        return [
            {
                language: 'javascript',
                title: `${provider} JavaScript Example`,
                code: `const apiKey = '${provider.toLowerCase()}_api_key';\n// Add your ${provider} integration code here`,
                description: `Basic ${provider} integration example`
            }
        ];
    }

    private static createFallbackConfigTemplate(provider: string, framework: string): GeneratedConfigTemplate {
        return {
            files: [
                {
                    path: `.env.${framework}`,
                    content: `${provider.toUpperCase()}_API_KEY=your_api_key_here`,
                    description: `${provider} environment configuration`,
                    file_type: 'config'
                }
            ],
            environment_variables: [
                {
                    name: `${provider.toUpperCase()}_API_KEY`,
                    description: `API key for ${provider} service`,
                    required: true
                }
            ],
            setup_instructions: [
                `1. Set your ${provider} API key in the environment variables`,
                `2. Install required dependencies for ${framework}`,
                `3. Initialize ${provider} client in your application`
            ],
            dependencies: []
        };
    }

    private static enhancePredictionWithFallback(
        basicPrediction: MLPrediction,
        context: ContextInfo
    ): EnhancedMLPrediction {
        return {
            ...basicPrediction,
            suggested_documentation: [],
            configuration_recommendations: [],
            llm_insights: [
                {
                    category: 'best_practice',
                    insight: 'Consider using environment variables for API key management',
                    confidence: 0.8,
                    actionable: true
                }
            ]
        };
    }

    private static createFallbackConfigRecommendations(
        provider: string,
        context: ContextInfo
    ): ConfigurationRecommendation[] {
        const recommendations: ConfigurationRecommendation[] = [];
        
        // Infer framework from context
        if (context.file_extension === 'js' || context.file_extension === 'ts') {
            recommendations.push({
                framework: 'nextjs',
                confidence: 0.7,
                reasoning: 'JavaScript/TypeScript files detected',
                template_available: true
            });
        }

        if (context.project_type === 'python') {
            recommendations.push({
                framework: 'fastapi',
                confidence: 0.8,
                reasoning: 'Python project detected',
                template_available: true
            });
        }

        return recommendations;
    }

    private static createFallbackSummary(content: string, maxLength?: number): string {
        const summaryLength = maxLength || 500;
        
        if (content.length <= summaryLength) {
            return content;
        }
        
        // Simple truncation with ellipsis
        return content.substring(0, summaryLength - 3) + '...';
    }
}