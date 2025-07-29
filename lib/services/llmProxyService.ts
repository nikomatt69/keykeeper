import { invoke } from '@tauri-apps/api/core';
import {
  TauriAPI,
  LLMEngineConfig,
  DocumentationGenerationRequest,
  GeneratedDocumentation,
  CodeExample,
  DocumentationSection
} from '../tauri-api';

interface LLMProxyConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // LLM.rs specific options
  useLocalLLM?: boolean;
  llmEngineConfig?: LLMEngineConfig;
}

export interface LLMResponse {
  content: string;
  metadata: {
    model: string;
    tokens: number;
    completion_reason: string; // Match backend snake_case
    cached: boolean; // Match backend structure
  };
  error?: string;
}

interface CachedResponse {
  response: LLMResponse;
  timestamp: number;
}

export class LLMProxyService {
  private static instance: LLMProxyService;
  private config: LLMProxyConfig;
  private cache = new Map<string, CachedResponse>();
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  private constructor(config: Partial<LLMProxyConfig> = {}) {
    this.config = {
      provider: 'openai', // Default provider
      model: 'gpt-4o-mini', // Default model
      temperature: 0.2,
      maxTokens: 2000,
      ...config
    };
  }

  public static getInstance(config: Partial<LLMProxyConfig> = {}): LLMProxyService {
    if (!LLMProxyService.instance) {
      LLMProxyService.instance = new LLMProxyService(config);
    }
    return LLMProxyService.instance;
  }

  public updateConfig(config: Partial<LLMProxyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private getCacheKey(prompt: string, context: Record<string, any> = {}): string {
    return JSON.stringify({ prompt, ...context });
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheDuration;
  }

  public async processWithLLM(
    prompt: string,
    context: Record<string, any> = {},
    options: Partial<LLMProxyConfig> = {}
  ): Promise<LLMResponse> {
    const cacheKey = this.getCacheKey(prompt, context);
    const cached = this.cache.get(cacheKey);

    // Fix: Use cached timestamp instead of current timestamp for validation
    if (cached && cached.timestamp && this.isCacheValid(cached.timestamp)) {
      console.log('Returning cached LLM response');
      return cached.response;
    }

    try {
      const mergedConfig = { ...this.config, ...options };

      console.log('Sending request to LLM proxy:', {
        promptLength: prompt.length,
        contextKeys: Object.keys(context),
        config: { ...mergedConfig, apiKey: mergedConfig.apiKey ? '***' : undefined }
      });

      // Call the Tauri backend to process with LLM
      // Note: Backend expects flat parameters, not nested config object
      const response = await invoke<LLMResponse>('process_with_llm', {
        prompt,
        context,
        config: {
          provider: mergedConfig.provider,
          model: mergedConfig.model,
          temperature: mergedConfig.temperature,
          max_tokens: mergedConfig.maxTokens, // Backend expects snake_case: max_tokens
          api_key: mergedConfig.apiKey, // Backend expects snake_case: api_key
        }
      });

      // Cache the successful response with timestamp
      this.cache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });
      console.log('LLM response received, cached with key:', cacheKey.substring(0, 32) + '...');
      return response;
    } catch (error) {
      console.error('LLM processing failed:', error);
      throw new Error(`LLM processing failed: ${error}`);
    }
  }

  public async extractDocumentation(
    content: string,
    structure: Record<string, any>,
    options: Partial<LLMProxyConfig> = {}
  ): Promise<Record<string, any>> {
    const prompt = `Extract and structure the following documentation content according to the provided schema. 
    Return only the structured data in JSON format.\n\nContent:\n${content}\n\nSchema:\n${JSON.stringify(structure, null, 2)}`;

    const response = await this.processWithLLM(prompt, { structure }, options);

    try {
      return JSON.parse(response.content);
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      throw new Error('Failed to parse documentation extraction result');
    }
  }

  public async summarizeDocumentation(
    content: string,
    maxLength = 500,
    options: Partial<LLMProxyConfig> = {}
  ): Promise<string> {
    const prompt = `Please summarize the following documentation in ${maxLength} characters or less, 
    focusing on key functionality, setup instructions, and important configuration options.\n\n${content}`;

    const response = await this.processWithLLM(prompt, { maxLength }, options);
    return response.content;
  }

  public async generateDocumentation(
    code: string,
    language: string,
    options: Partial<LLMProxyConfig> = {}
  ): Promise<string> {
    const prompt = `Generate comprehensive documentation for the following ${language} code. 
    Include function descriptions, parameters, return values, and usage examples.\n\n${code}`;

    const response = await this.processWithLLM(prompt, { language }, options);
    return response.content;
  }

  // Clear the cache
  public clearCache(): void {
    this.cache.clear();
  }

  // ===============================
  //  LLM-ENHANCED METHODS
  // ===============================

  /**
   * Generate comprehensive API documentation using local LLM
   */
  public async generateAPIDocumentation(
    provider: string,
    context: string,
    options: Partial<LLMProxyConfig> = {}
  ): Promise<GeneratedDocumentation> {
    const request: DocumentationGenerationRequest = {
      provider,
      context,
      environment: 'development'
    };

    try {
      // Use local LLM engine if available and configured
      if (this.config.useLocalLLM || options.useLocalLLM) {
        return await TauriAPI.generateDocumentation(request);
      } else {
        // Fallback to remote LLM processing
        const prompt = `Generate comprehensive API documentation for ${provider}. Context: ${context}`;
        const response = await this.processWithLLM(prompt, { provider, context }, options);
        return this.parseDocumentationResponse(response.content, provider);
      }
    } catch (error) {
      console.error('API documentation generation failed:', error);
      throw new Error(`Failed to generate documentation for ${provider}: ${error}`);
    }
  }

  /**
   * Generate code examples for API integration
   */
  public async generateCodeExamples(
    provider: string,
    apiKeyFormat: string,
    languages: string[] = ['javascript', 'python', 'curl'],
    options: Partial<LLMProxyConfig> = {}
  ): Promise<CodeExample[]> {
    try {
      // Use local LLM engine if available
      if (this.config.useLocalLLM || options.useLocalLLM) {
        return await TauriAPI.generateUsageExamples(provider, apiKeyFormat);
      } else {
        // Generate via remote LLM
        const prompt = `Generate ${languages.join(', ')} code examples for ${provider} API integration using key format: ${apiKeyFormat}`;
        const response = await this.processWithLLM(prompt, { provider, apiKeyFormat, languages }, options);
        return this.parseCodeExamples(response.content, languages);
      }
    } catch (error) {
      console.error('Code examples generation failed:', error);
      return this.createFallbackCodeExamples(provider, languages);
    }
  }

  /**
   * Enhance existing documentation with LLM insights
   */
  public async enhanceDocumentation(
    docId: string,
    content: string,
    enhancementType: 'clarity' | 'examples' | 'structure' | 'completeness' = 'completeness',
    options: Partial<LLMProxyConfig> = {}
  ): Promise<{ enhanced_content: string; sections: DocumentationSection[] }> {
    try {
      // Use local LLM engine if available
      if (this.config.useLocalLLM || options.useLocalLLM) {
        return await TauriAPI.enhanceDocumentationWithLLM(docId, content);
      } else {
        // Use remote LLM for enhancement
        const prompt = `Enhance the following documentation for ${enhancementType}:\n\n${content}`;
        const response = await this.processWithLLM(prompt, { docId, enhancementType }, options);
        return {
          enhanced_content: response.content,
          sections: this.extractSections(response.content)
        };
      }
    } catch (error) {
      console.error('Documentation enhancement failed:', error);
      return {
        enhanced_content: content,
        sections: []
      };
    }
  }

  /**
   * Generate configuration templates with LLM
   */
  public async generateConfigurationTemplate(
    provider: string,
    framework: string,
    environment: string,
    features: string[] = [],
    options: Partial<LLMProxyConfig> = {}
  ): Promise<string> {
    const prompt = `Generate a ${framework} configuration template for ${provider} API in ${environment} environment with features: ${features.join(', ')}`;

    try {
      const response = await this.processWithLLM(prompt, { provider, framework, environment, features }, options);
      return response.content;
    } catch (error) {
      console.error('Configuration template generation failed:', error);
      return this.createFallbackConfigTemplate(provider, framework, environment);
    }
  }

  /**
   * Initialize local LLM engine
   */
  public async initializeLocalLLM(config: LLMEngineConfig): Promise<boolean> {
    try {
      this.config.useLocalLLM = true;
      this.config.llmEngineConfig = config;

      const result = await TauriAPI.initializeLLMEngine(config);
      console.log('✅ Local LLM engine initialized:', result);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize local LLM engine:', error);
      this.config.useLocalLLM = false;

      // Provide more specific error information
      if (typeof error === 'string') {
        if (error.includes('Model file not found')) {
          console.error('Model file not found. Please check the model path:', config.model_path);
        } else if (error.includes('Model validation failed')) {
          console.error('Model validation failed. The model file might be corrupted or invalid.');
        } else if (error.includes('Failed to load model')) {
          console.error('Failed to load model. Check if the model is compatible with the LLM engine.');
        }
      }

      return false;
    }
  }

  /**
   * Check if local LLM engine is available
   */
  public async isLocalLLMAvailable(): Promise<boolean> {
    try {
      return await TauriAPI.isLLMEngineLoaded();
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate intelligent API integration suggestions
   */
  public async generateIntegrationSuggestions(
    provider: string,
    projectContext: {
      framework?: string;
      language?: string;
      dependencies?: string[];
      fileStructure?: string[];
    },
    options: Partial<LLMProxyConfig> = {}
  ): Promise<{
    integration_steps: string[];
    code_examples: CodeExample[];
    best_practices: string[];
    potential_issues: string[];
  }> {
    const contextString = JSON.stringify(projectContext, null, 2);
    const prompt = `Provide integration suggestions for ${provider} API in this project context:\n${contextString}`;

    try {
      const response = await this.processWithLLM(prompt, { provider, ...projectContext }, options);
      return this.parseIntegrationSuggestions(response.content);
    } catch (error) {
      console.error('Integration suggestions generation failed:', error);
      return this.createFallbackIntegrationSuggestions(provider);
    }
  }

  // ===============================
  //  PRIVATE HELPER METHODS
  // ===============================

  private parseDocumentationResponse(content: string, provider: string): GeneratedDocumentation {
    // Simple parsing - in production, this would be more sophisticated
    return {
      content,
      sections: this.extractSections(content),
      usage_examples: [],
      configuration_template: `# ${provider} Configuration\n${provider.toUpperCase()}_API_KEY=your_api_key_here`
    };
  }

  private parseCodeExamples(content: string, languages: string[]): CodeExample[] {
    const examples: CodeExample[] = [];
    const codeBlocks = content.split('```').filter((_, index) => index % 2 === 1);

    codeBlocks.forEach((block, index) => {
      const lines = block.trim().split('\n');
      const language = lines[0] || languages[index] || 'javascript';
      const code = lines.slice(1).join('\n');

      examples.push({
        language,
        title: `${language} Example`,
        code,
        description: `Code example in ${language}`
      });
    });

    return examples;
  }

  private extractSections(content: string): DocumentationSection[] {
    const sections: DocumentationSection[] = [];
    const lines = content.split('\n');
    let currentSection: Partial<DocumentationSection> | null | undefined;

    lines.forEach(line => {
      if (line.startsWith('#')) {
        // Save previous section
        if (currentSection && typeof currentSection.title === 'string' && currentSection.title.trim()) {
          sections.push({
            title: currentSection.title,
            content: currentSection.content || '',
            level: currentSection.level || 1,
            type: 'overview'
          });
        }

        // Start new section
        const level = (line.match(/^#+/) || ['#'])[0].length;
        currentSection = {
          title: line.replace(/^#+\s*/, ''),
          content: '',
          level
        };
      } else if (currentSection) {
        if (currentSection.content === undefined) {
          currentSection.content = '';
        }
        currentSection.content += line + '\n';
      }
    });

    // Add final section
    if (currentSection && currentSection.title) {
      sections.push({
        title: currentSection.title,
        content: currentSection.content || '',
        level: currentSection.level || 1,
        type: 'overview'
      });
    }

    return sections;
  }

  private createFallbackCodeExamples(provider: string, languages: string[]): CodeExample[] {
    return languages.map(language => ({
      language,
      title: `${provider} ${language} Example`,
      code: `// ${provider} integration example in ${language}\n// Add your implementation here`,
      description: `Basic ${provider} integration in ${language}`
    }));
  }

  private createFallbackConfigTemplate(provider: string, framework: string, environment: string): string {
    return `# ${provider} Configuration for ${framework} (${environment})
${provider.toUpperCase()}_API_KEY=your_api_key_here
${provider.toUpperCase()}_BASE_URL=https://api.${provider.toLowerCase()}.com
${provider.toUpperCase()}_TIMEOUT=30000
`;
  }

  private parseIntegrationSuggestions(content: string): {
    integration_steps: string[];
    code_examples: CodeExample[];
    best_practices: string[];
    potential_issues: string[];
  } {
    // Simple parsing - would be more sophisticated in production
    return {
      integration_steps: content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim()),
      code_examples: [],
      best_practices: [],
      potential_issues: []
    };
  }

  private createFallbackIntegrationSuggestions(provider: string): {
    integration_steps: string[];
    code_examples: CodeExample[];
    best_practices: string[];
    potential_issues: string[];
  } {
    return {
      integration_steps: [
        `Install ${provider} SDK or dependencies`,
        `Configure API key in environment variables`,
        `Initialize ${provider} client in your application`,
        `Implement error handling and retries`
      ],
      code_examples: [],
      best_practices: [
        'Store API keys securely in environment variables',
        'Implement proper error handling',
        'Use connection pooling for better performance',
        'Monitor API usage and rate limits'
      ],
      potential_issues: [
        'Rate limiting may occur with high usage',
        'Network timeouts should be handled gracefully',
        'API key rotation should be planned'
      ]
    };
  }

  /**
   * Initialize the LLM service with default configuration
   */
  public async initializeService(): Promise<boolean> {
    try {
      console.log('🔧 Initializing LLM Proxy Service...')

      // Check if local LLM is available
      const localAvailable = await this.isLocalLLMAvailable()

      if (localAvailable) {
        console.log('✅ Local LLM engine detected and ready')
        this.config.useLocalLLM = true
      } else {
        console.log('⚠️ Local LLM not available, using remote fallback mode')
        this.config.useLocalLLM = false
      }

      // Clear any existing cache to start fresh
      this.clearCache()

      console.log('✅ LLM Proxy Service initialized successfully')
      return true
    } catch (error) {
      console.error('❌ LLM Proxy Service initialization failed:', error)
      return false
    }
  }
}

// Export a default instance
export const llmProxy = LLMProxyService.getInstance();
