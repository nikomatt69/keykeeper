import { useState, useEffect, useCallback } from 'react';
import { 
    MLService, 
    ContextInfo, 
    MLPrediction, 
    KeySuggestion, 
    MLConfig 
} from '../services/mlService';
import { 
    GeneratedDocumentation, 
    CodeExample, 
    GeneratedConfigTemplate,
    EnhancedMLPrediction,
    DocumentationSuggestion,
    ConfigurationRecommendation,
    LLMEngineConfig
} from '../tauri-api';
import { llmProxy } from '../services/llmProxyService';

interface UseMLEngineOptions {
    autoInit?: boolean;
    config?: MLConfig;
    enableLLM?: boolean;
    llmConfig?: LLMEngineConfig;
}

interface UseMLEngineReturn {
    // State
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    prediction: MLPrediction | null;
    enhancedPrediction: EnhancedMLPrediction | null;
    stats: Record<string, any>;
    llmAvailable: boolean;

    // Actions
    initialize: (config?: MLConfig) => Promise<boolean>;
    getSuggestions: (context: ContextInfo, availableKeys: string[]) => Promise<void>;
    getEnhancedSuggestions: (context: ContextInfo, availableKeys: string[]) => Promise<void>;
    recordUsage: (keyId: string, context: ContextInfo, success: boolean) => Promise<void>;
    detectContext: () => Promise<ContextInfo | null>;
    loadStats: () => Promise<void>;
    clearError: () => void;
    reset: () => void;

    // LLM-Enhanced Features
    generateDocumentation: (provider: string, context: string, apiKeyFormat?: string) => Promise<GeneratedDocumentation | null>;
    generateUsageExamples: (provider: string, apiKeyFormat: string) => Promise<CodeExample[]>;
    generateConfigTemplate: (provider: string, framework: string, environment: string, features?: string[]) => Promise<GeneratedConfigTemplate | null>;
    getDocumentationSuggestions: (provider: string, context: ContextInfo) => Promise<DocumentationSuggestion[]>;
    getConfigRecommendations: (provider: string, context: ContextInfo) => Promise<ConfigurationRecommendation[]>;
    initializeLLM: (config: LLMEngineConfig) => Promise<boolean>;
    checkLLMStatus: () => Promise<boolean>;
}

/**
 * React hook for managing ML Engine state and operations
 */
export function useMLEngine(options: UseMLEngineOptions = {}): UseMLEngineReturn {
    const { autoInit = true, config, enableLLM = false, llmConfig } = options;

    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<MLPrediction | null>(null);
    const [enhancedPrediction, setEnhancedPrediction] = useState<EnhancedMLPrediction | null>(null);
    const [stats, setStats] = useState<Record<string, any>>({});
    const [llmAvailable, setLlmAvailable] = useState(false);

    // Initialize ML Engine on mount if autoInit is enabled
    useEffect(() => {
        if (autoInit) {
            initialize(config);
        }
    }, [autoInit, config]);

    // Initialize ML Engine
    const initialize = useCallback(async (initConfig?: MLConfig): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);
            
            const success = await MLService.initialize(initConfig || config);
            setIsInitialized(success);
            
            if (!success) {
                setError('Failed to initialize ML Engine');
            }
            
            return success;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error';
            setError(errorMessage);
            setIsInitialized(false);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [config]);

    // Get smart suggestions
    const getSuggestions = useCallback(async (
        context: ContextInfo, 
        availableKeys: string[]
    ): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);
            
            const result = await MLService.getSmartSuggestions(context, availableKeys);
            setPrediction(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get suggestions';
            setError(errorMessage);
            setPrediction(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Record usage for learning
    const recordUsage = useCallback(async (
        keyId: string, 
        context: ContextInfo, 
        success: boolean
    ): Promise<void> => {
        try {
            await MLService.recordUsage(keyId, context, success);
        } catch (err) {
            console.warn('Failed to record ML usage:', err);
            // Don't set error state for usage recording failures
        }
    }, []);

    // Detect current context
    const detectContext = useCallback(async (): Promise<ContextInfo | null> => {
        try {
            setError(null);
            const context = await MLService.detectCurrentContext();
            return context;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Context detection failed';
            setError(errorMessage);
            return null;
        }
    }, []);

    // Load ML statistics
    const loadStats = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            const statsData = await MLService.getUsageStats();
            setStats(statsData);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load stats';
            setError(errorMessage);
        }
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Enhanced suggestions with LLM insights
    const getEnhancedSuggestions = useCallback(async (
        context: ContextInfo, 
        availableKeys: string[]
    ): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);
            
            const result = await MLService.getEnhancedMLPrediction(context, availableKeys);
            setEnhancedPrediction(result);
            setPrediction(result); // Also set the basic prediction
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get enhanced suggestions';
            setError(errorMessage);
            setEnhancedPrediction(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Generate documentation using LLM
    const generateDocumentation = useCallback(async (
        provider: string, 
        context: string, 
        apiKeyFormat?: string
    ): Promise<GeneratedDocumentation | null> => {
        try {
            setIsLoading(true);
            setError(null);
            return await MLService.generateDocumentation(provider, context, apiKeyFormat);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Documentation generation failed';
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Generate usage examples
    const generateUsageExamples = useCallback(async (
        provider: string, 
        apiKeyFormat: string
    ): Promise<CodeExample[]> => {
        try {
            setError(null);
            return await MLService.generateUsageExamples(provider, apiKeyFormat);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Usage examples generation failed';
            setError(errorMessage);
            return [];
        }
    }, []);

    // Generate configuration template
    const generateConfigTemplate = useCallback(async (
        provider: string,
        framework: string,
        environment: string,
        features?: string[]
    ): Promise<GeneratedConfigTemplate | null> => {
        try {
            setIsLoading(true);
            setError(null);
            return await MLService.generateConfigurationTemplate(provider, framework, environment, features);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Config template generation failed';
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get documentation suggestions
    const getDocumentationSuggestions = useCallback(async (
        provider: string,
        context: ContextInfo
    ): Promise<DocumentationSuggestion[]> => {
        try {
            setError(null);
            return await MLService.getContextualDocumentationSuggestions(provider, context);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Documentation suggestions failed';
            setError(errorMessage);
            return [];
        }
    }, []);

    // Get configuration recommendations
    const getConfigRecommendations = useCallback(async (
        provider: string,
        context: ContextInfo
    ): Promise<ConfigurationRecommendation[]> => {
        try {
            setError(null);
            return await MLService.getConfigurationRecommendations(provider, context);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Config recommendations failed';
            setError(errorMessage);
            return [];
        }
    }, []);

    // Initialize LLM engine
    const initializeLLM = useCallback(async (config: LLMEngineConfig): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);
            const success = await MLService.initializeLLMEngine(config);
            setLlmAvailable(success);
            return success;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'LLM initialization failed';
            setError(errorMessage);
            setLlmAvailable(false);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check LLM status
    const checkLLMStatus = useCallback(async (): Promise<boolean> => {
        try {
            const available = await MLService.isLLMEngineLoaded();
            setLlmAvailable(available);
            return available;
        } catch (err) {
            setLlmAvailable(false);
            return false;
        }
    }, []);

    // Check LLM status on mount and when initialized
    useEffect(() => {
        if (enableLLM && isInitialized) {
            checkLLMStatus();
            
            // Initialize LLM if config is provided
            if (llmConfig) {
                initializeLLM(llmConfig);
            }
        }
    }, [enableLLM, isInitialized, llmConfig, checkLLMStatus, initializeLLM]);

    // Reset all state
    const reset = useCallback(() => {
        setIsInitialized(false);
        setIsLoading(false);
        setError(null);
        setPrediction(null);
        setEnhancedPrediction(null);
        setStats({});
        setLlmAvailable(false);
    }, []);

    return {
        // State
        isInitialized,
        isLoading,
        error,
        prediction,
        enhancedPrediction,
        stats,
        llmAvailable,

        // Actions
        initialize,
        getSuggestions,
        getEnhancedSuggestions,
        recordUsage,
        detectContext,
        loadStats,
        clearError,
        reset,

        // LLM-Enhanced Features
        generateDocumentation,
        generateUsageExamples,
        generateConfigTemplate,
        getDocumentationSuggestions,
        getConfigRecommendations,
        initializeLLM,
        checkLLMStatus,
    };
}

/**
 * Hook for context-aware suggestions
 * Automatically detects context and provides suggestions
 */
export function useContextAwareSuggestions(availableKeys: string[]) {
    const ml = useMLEngine();
    const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);
    const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);

    // Auto-detect context when enabled
    useEffect(() => {
        if (autoDetectEnabled && ml.isInitialized) {
            detectAndLoadSuggestions();
        }
    }, [autoDetectEnabled, ml.isInitialized, availableKeys]);

    const detectAndLoadSuggestions = useCallback(async () => {
        const context = await ml.detectContext();
        if (context) {
            setCurrentContext(context);
            await ml.getSuggestions(context, availableKeys);
        }
    }, [ml, availableKeys]);

    const updateContext = useCallback(async (newContext: ContextInfo) => {
        setCurrentContext(newContext);
        if (ml.isInitialized) {
            await ml.getSuggestions(newContext, availableKeys);
        }
    }, [ml, availableKeys]);

    const toggleAutoDetect = useCallback(() => {
        setAutoDetectEnabled(prev => !prev);
    }, []);

    return {
        ...ml,
        currentContext,
        autoDetectEnabled,
        updateContext,
        detectAndLoadSuggestions,
        toggleAutoDetect,
    };
}

/**
 * Hook for ML statistics and analytics
 */
export function useMLAnalytics() {
    const [stats, setStats] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await MLService.getUsageStats();
            setStats(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    const getKeyUsageScore = useCallback((keyId: string): number => {
        const keyStats = stats[keyId];
        if (!keyStats) return 0;
        
        const usageCount = keyStats.usage_count || 0;
        const successRate = keyStats.success_rate || 0;
        
        // Simple scoring algorithm: usage frequency * success rate
        return usageCount * successRate;
    }, [stats]);

    const getTopKeys = useCallback((limit = 5): Array<{keyId: string, score: number}> => {
        return Object.keys(stats)
            .map(keyId => ({
                keyId,
                score: getKeyUsageScore(keyId)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }, [stats, getKeyUsageScore]);

    const getTotalUsage = useCallback((): number => {
        return Object.values(stats).reduce((total, keyStats: any) => {
            return total + (keyStats.usage_count || 0);
        }, 0);
    }, [stats]);

    const getAverageSuccessRate = useCallback((): number => {
        const rates = Object.values(stats)
            .map((keyStats: any) => keyStats.success_rate || 0)
            .filter(rate => rate > 0);
        
        if (rates.length === 0) return 0;
        return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    }, [stats]);

    return {
        stats,
        loading,
        error,
        loadStats,
        getKeyUsageScore,
        getTopKeys,
        getTotalUsage,
        getAverageSuccessRate,
    };
}

/**
 * Hook for security analysis
 */
export function useMLSecurity() {
    const [securityAnalysis, setSecurityAnalysis] = useState<{
        riskLevel: string;
        recommendations: string[];
        context?: ContextInfo;
    } | null>(null);

    const analyzeContext = useCallback((context: ContextInfo) => {
        const { risk, reasons } = MLService.analyzeSecurityRisk(context);
        const recommendations = MLService.getSecurityRecommendations(context);
        
        setSecurityAnalysis({
            riskLevel: risk,
            recommendations: [...reasons, ...recommendations],
            context
        });
    }, []);

    const clearAnalysis = useCallback(() => {
        setSecurityAnalysis(null);
    }, []);

    return {
        securityAnalysis,
        analyzeContext,
        clearAnalysis,
    };
}

/**
 * Hook for LLM-enhanced documentation workflows
 */
export function useLLMDocumentation() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocumentation | null>(null);
    const [codeExamples, setCodeExamples] = useState<CodeExample[]>([]);
    const [configTemplate, setConfigTemplate] = useState<GeneratedConfigTemplate | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generateComprehensiveDocumentation = useCallback(async (
        provider: string,
        context: string,
        options: {
            apiKeyFormat?: string;
            framework?: string;
            environment?: string;
            includeExamples?: boolean;
            includeConfig?: boolean;
        } = {}
    ) => {
        try {
            setIsGenerating(true);
            setError(null);

            // Generate main documentation
            const docs = await llmProxy.generateAPIDocumentation(provider, context);
            setGeneratedDocs(docs);

            // Generate code examples if requested
            if (options.includeExamples && options.apiKeyFormat) {
                const examples = await llmProxy.generateCodeExamples(
                    provider, 
                    options.apiKeyFormat
                );
                setCodeExamples(examples);
            }

            // Generate config template if requested
            if (options.includeConfig && options.framework && options.environment) {
                const template = await MLService.generateConfigurationTemplate(
                    provider,
                    options.framework,
                    options.environment
                );
                setConfigTemplate(template);
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Documentation generation failed';
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const enhanceExistingDocumentation = useCallback(async (
        docId: string,
        content: string,
        enhancementType: 'clarity' | 'examples' | 'structure' | 'completeness' = 'completeness'
    ) => {
        try {
            setIsGenerating(true);
            setError(null);

            const enhanced = await llmProxy.enhanceDocumentation(docId, content, enhancementType);
            
            // Update the generated docs with enhanced content
            if (generatedDocs) {
                setGeneratedDocs({
                    ...generatedDocs,
                    content: enhanced.enhanced_content,
                    sections: enhanced.sections
                });
            }

            return enhanced;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Documentation enhancement failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsGenerating(false);
        }
    }, [generatedDocs]);

    const generateIntegrationGuide = useCallback(async (
        provider: string,
        projectContext: {
            framework?: string;
            language?: string;
            dependencies?: string[];
            fileStructure?: string[];
        }
    ) => {
        try {
            setIsGenerating(true);
            setError(null);

            const suggestions = await llmProxy.generateIntegrationSuggestions(provider, projectContext);
            return suggestions;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Integration guide generation failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const clearDocumentation = useCallback(() => {
        setGeneratedDocs(null);
        setCodeExamples([]);
        setConfigTemplate(null);
        setError(null);
    }, []);

    return {
        // State
        isGenerating,
        generatedDocs,
        codeExamples,
        configTemplate,
        error,

        // Actions
        generateComprehensiveDocumentation,
        enhanceExistingDocumentation,
        generateIntegrationGuide,
        clearDocumentation,
    };
}