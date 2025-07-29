/**
 * Enhanced Template Service
 * 
 * Service for interacting with the new Rust backend enhanced template system.
 * Provides comprehensive multi-framework template generation with real-time progress,
 * framework detection, and AI enhancement capabilities.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { DEFAULT_USER_PREFERENCES } from '../types/enhanced-templates'
import type {
  EnhancedGenerationRequest,
  EnhancedGenerationResult,
  EnhancedConfigTemplate,
  FrameworkDetectionResult,
  TemplateValidationResult,
  FrameworkCompatibilityInfo,
  GenerationSessionStatus,
  GenerationProgress,
  TemplateSuggestion,
  GeneratedTemplateFile
} from '../types/enhanced-templates'

/**
 * Progress callback function type for real-time updates
 */
export type ProgressCallback = (progress: GenerationProgress) => void

/**
 * Completion callback function type for generation completion
 */
export type CompletionCallback = (sessionId: string, success: boolean, error?: string) => void

/**
 * Enhanced Template Service for multi-framework template generation
 */
export class EnhancedTemplateService {
  private static instance: EnhancedTemplateService | null = null
  private progressListeners: Map<string, ProgressCallback> = new Map()
  private completionListeners: Map<string, CompletionCallback> = new Map()
  private eventListeners: Array<() => void> = []

  private constructor() {
    this.setupEventListeners()
  }

  /**
   * Get singleton instance of the service
   */
  public static getInstance(): EnhancedTemplateService {
    if (!EnhancedTemplateService.instance) {
      EnhancedTemplateService.instance = new EnhancedTemplateService()
    }
    return EnhancedTemplateService.instance
  }

  /**
   * Setup event listeners for real-time updates from the backend
   */
  private async setupEventListeners(): Promise<void> {
    // Only setup event listeners in browser/Tauri context
    if (typeof window === 'undefined' || !(window as any).__TAURI__) {
      console.log('Skipping event listeners setup - not in Tauri context')
      return
    }

    try {
      // Listen for generation progress updates
      const progressUnlisten = await listen<GenerationProgress>('generation_progress', (event) => {
        const progress = event.payload
        // Notify all progress listeners
        this.progressListeners.forEach(callback => callback(progress))
      })
      this.eventListeners.push(progressUnlisten)

      // Listen for preview progress updates  
      const previewUnlisten = await listen<GenerationProgress>('preview_progress', (event) => {
        const progress = event.payload
        // Notify progress listeners for preview updates
        this.progressListeners.forEach(callback => callback(progress))
      })
      this.eventListeners.push(previewUnlisten)

      // Listen for generation completion
      const completionUnlisten = await listen<{ sessionId: string, success: boolean, errorMessage?: string }>('generation_completed', (event) => {
        const { sessionId, success, errorMessage } = event.payload
        // Notify completion listeners
        this.completionListeners.forEach(callback => callback(sessionId, success, errorMessage))
      })
      this.eventListeners.push(completionUnlisten)

      // Listen for preview completion
      const previewCompletionUnlisten = await listen<{ sessionId: string, success: boolean, errorMessage?: string }>('preview_completed', (event) => {
        const { sessionId, success, errorMessage } = event.payload
        // Notify completion listeners for preview completion
        this.completionListeners.forEach(callback => callback(sessionId, success, errorMessage))
      })
      this.eventListeners.push(previewCompletionUnlisten)

    } catch (error) {
      console.error('Failed to setup event listeners:', error)
    }
  }

  /**
   * Generate enhanced configuration with progress streaming
   */
  public async generateEnhancedConfiguration(
    request: EnhancedGenerationRequest,
    onProgress?: ProgressCallback,
    onCompletion?: CompletionCallback
  ): Promise<EnhancedGenerationResult> {
    try {
      // Register progress callback if provided
      const callbackId = Math.random().toString(36).substring(7)
      if (onProgress) {
        this.progressListeners.set(callbackId, onProgress)
      }
      if (onCompletion) {
        this.completionListeners.set(callbackId, onCompletion)
      }

      // Call the Rust backend
      const result = await invoke<EnhancedGenerationResult>('generate_enhanced_configuration', {
        request: this.convertRequestToRustFormat(request)
      })

      // Clean up listeners
      this.progressListeners.delete(callbackId)
      this.completionListeners.delete(callbackId)

      return this.convertResultFromRustFormat(result)
    } catch (error) {
      console.error('Enhanced configuration generation failed:', error)
      throw new Error(`Template generation failed: ${error}`)
    }
  }

  /**
   * Preview generated files without creating them
   */
  public async previewGeneratedFiles(
    request: EnhancedGenerationRequest,
    onProgress?: ProgressCallback,
    onCompletion?: CompletionCallback
  ): Promise<EnhancedGenerationResult> {
    try {
      // Register callbacks
      const callbackId = Math.random().toString(36).substring(7)
      if (onProgress) {
        this.progressListeners.set(callbackId, onProgress)
      }
      if (onCompletion) {
        this.completionListeners.set(callbackId, onCompletion)
      }

      // Set preview mode
      const previewRequest = { ...request, previewOnly: true }

      // Call the Rust backend
      const result = await invoke<EnhancedGenerationResult>('preview_generated_files', {
        request: this.convertRequestToRustFormat(previewRequest)
      })

      // Clean up listeners
      this.progressListeners.delete(callbackId)
      this.completionListeners.delete(callbackId)

      return this.convertResultFromRustFormat(result)
    } catch (error) {
      console.error('File preview generation failed:', error)
      throw new Error(`Preview generation failed: ${error}`)
    }
  }

  /**
   * Detect project framework with confidence scoring
   */
  public async detectProjectFramework(projectPath: string): Promise<FrameworkDetectionResult[]> {
    try {
      const results = await invoke<FrameworkDetectionResult[]>('detect_project_framework', {
        projectPath
      })
      return results.map(this.convertFrameworkDetectionFromRustFormat)
    } catch (error) {
      console.error('Framework detection failed:', error)
      throw new Error(`Framework detection failed: ${error}`)
    }
  }

  /**
   * Validate template combination for compatibility
   */
  public async validateTemplateCombination(
    providerId: string,
    templateId: string | undefined,
    framework: string,
    features: string[]
  ): Promise<TemplateValidationResult> {
    try {
      const result = await invoke<TemplateValidationResult>('validate_template_combination', {
        providerId,
        templateId,
        framework,
        features
      })
      return result
    } catch (error) {
      console.error('Template validation failed:', error)
      throw new Error(`Template validation failed: ${error}`)
    }
  }

  /**
   * Get template suggestions based on environment variables
   */
  public async getTemplateSuggestions(
    envVars: Record<string, string>,
    projectPath?: string
  ): Promise<TemplateSuggestion[]> {
    try {
      const suggestions = await invoke<TemplateSuggestion[]>('get_template_suggestions', {
        envVars,
        projectPath
      })
      return suggestions.map(this.convertTemplateSuggestionFromRustFormat)
    } catch (error) {
      console.error('Template suggestions failed:', error)
      throw new Error(`Getting template suggestions failed: ${error}`)
    }
  }

  /**
   * Register a custom template
   */
  public async registerCustomTemplate(template: EnhancedConfigTemplate): Promise<void> {
    try {
      await invoke('register_custom_template', {
        template: this.convertTemplateToRustFormat(template)
      })
    } catch (error) {
      console.error('Custom template registration failed:', error)
      throw new Error(`Custom template registration failed: ${error}`)
    }
  }

  /**
   * Get generation session status
   */
  public async getGenerationSessionStatus(sessionId: string): Promise<GenerationSessionStatus | null> {
    try {
      const status = await invoke<GenerationSessionStatus | null>('get_generation_session_status', {
        sessionId
      })
      return status ? this.convertSessionStatusFromRustFormat(status) : null
    } catch (error) {
      console.error('Getting session status failed:', error)
      return null
    }
  }

  /**
   * Cancel an active generation session
   */
  public async cancelGenerationSession(sessionId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('cancel_generation_session', {
        sessionId
      })
    } catch (error) {
      console.error('Canceling session failed:', error)
      return false
    }
  }

  /**
   * Get all active generation sessions
   */
  public async getActiveGenerationSessions(): Promise<GenerationSessionStatus[]> {
    try {
      const sessions = await invoke<GenerationSessionStatus[]>('get_active_generation_sessions')
      return sessions.map(this.convertSessionStatusFromRustFormat)
    } catch (error) {
      console.error('Getting active sessions failed:', error)
      return []
    }
  }

  /**
   * Get framework compatibility matrix for a provider
   */
  public async getProviderFrameworkCompatibility(providerId: string): Promise<FrameworkCompatibilityInfo[]> {
    try {
      const compatibility = await invoke<FrameworkCompatibilityInfo[]>('get_provider_framework_compatibility', {
        providerId
      })
      return compatibility
    } catch (error) {
      console.error('Getting framework compatibility failed:', error)
      throw new Error(`Getting framework compatibility failed: ${error}`)
    }
  }

  /**
   * Batch validate multiple template combinations
   */
  public async batchValidateTemplates(
    requests: Array<{
      providerId: string
      templateId?: string
      framework: string
      features: string[]
    }>
  ): Promise<TemplateValidationResult[]> {
    try {
      const results = await invoke<TemplateValidationResult[]>('batch_validate_templates', {
        requests
      })
      return results
    } catch (error) {
      console.error('Batch template validation failed:', error)
      throw new Error(`Batch validation failed: ${error}`)
    }
  }

  /**
   * Clear generation cache
   */
  public async clearGenerationCache(): Promise<void> {
    try {
      await invoke('clear_generation_cache')
    } catch (error) {
      console.error('Clearing generation cache failed:', error)
      throw new Error(`Clearing cache failed: ${error}`)
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStatistics(): Promise<any> {
    try {
      return await invoke('get_cache_statistics')
    } catch (error) {
      console.error('Getting cache statistics failed:', error)
      throw new Error(`Getting cache statistics failed: ${error}`)
    }
  }

  /**
   * Cleanup event listeners
   */
  public cleanup(): void {
    this.eventListeners.forEach(unlisten => unlisten())
    this.eventListeners = []
    this.progressListeners.clear()
    this.completionListeners.clear()
  }

  // ===== PRIVATE CONVERSION METHODS =====

  /**
   * Convert frontend request to Rust backend format
   */
  private convertRequestToRustFormat(request: EnhancedGenerationRequest): any {
    return {
      provider_id: request.providerId,
      template_id: request.templateId,
      context: {
        framework: request.context.framework,
        env_vars: request.context.envVars,
        requested_features: request.context.requestedFeatures,  
        output_path: request.context.outputPath,
        project_settings: request.context.projectSettings,
        user_preferences: {
          code_style: request.context.userPreferences.codeStyle,
          use_semicolons: request.context.userPreferences.useSemicolons,
          indentation: request.context.userPreferences.indentation,
          indent_size: request.context.userPreferences.indentSize,
          generate_types: request.context.userPreferences.generateTypes,
          include_jsdoc: request.context.userPreferences.includeJsdoc,
          import_style: request.context.userPreferences.importStyle,
          use_async_await: request.context.userPreferences.useAsyncAwait
        },
        existing_files: request.context.existingFiles,
        package_json: request.context.packageJson,
        tsconfig: request.context.tsconfig
      },
      features: request.features,
      use_llm_enhancement: request.useLlmEnhancement,
      template_overrides: request.templateOverrides,
      preview_only: request.previewOnly
    }
  }

  /**
   * Convert Rust backend result to frontend format
   */
  private convertResultFromRustFormat(result: any): EnhancedGenerationResult {
    return {
      files: result.files.map((file: any) => ({
        path: file.path,
        content: file.content,
        fileType: file.file_type,
        language: file.language,
        exists: file.exists,
        category: file.category,
        isRequired: file.is_required,
        size: file.size,
        checksum: file.checksum,
        createdByTemplate: file.created_by_template,
        createdAt: file.created_at
      })),
      dependencies: result.dependencies,
      devDependencies: result.dev_dependencies,
      setupInstructions: result.setup_instructions,
      nextSteps: result.next_steps,
      validationResults: result.validation_results.map((validation: any) => ({
        ruleId: validation.rule_id,
        passed: validation.passed,
        errorMessage: validation.error_message,
        warningMessage: validation.warning_message,
        suggestedFix: validation.suggested_fix,
        severity: validation.severity
      })),
      warnings: result.warnings,
      recommendations: result.recommendations,
      templateInfo: {
        templateId: result.template_info.template_id,
        templateName: result.template_info.template_name,
        templateVersion: result.template_info.template_version,
        providerId: result.template_info.provider_id,
        providerName: result.template_info.provider_name,
        framework: result.template_info.framework,
        compatibilityLevel: result.template_info.compatibility_level,
        enabledFeatures: result.template_info.enabled_features,
        generatedAt: result.template_info.generated_at,
        llmEnhanced: result.template_info.llm_enhanced
      }
    }
  }

  /**
   * Convert framework detection result from Rust format
   */
  private convertFrameworkDetectionFromRustFormat(result: any): FrameworkDetectionResult {
    return {
      framework: result.framework,
      confidence: result.confidence,
      evidence: result.evidence.map((evidence: any) => ({
        evidenceType: evidence.evidence_type,
        value: evidence.value,
        confidenceWeight: evidence.confidence_weight,
        source: evidence.source
      })),
      version: result.version,
      metadata: result.metadata
    }
  }

  /**
   * Convert template suggestion from Rust format
   */
  private convertTemplateSuggestionFromRustFormat(suggestion: any): TemplateSuggestion {
    return {
      templateId: suggestion.template_id,
      templateName: suggestion.template_name,
      providerId: suggestion.provider_id,
      providerName: suggestion.provider_name,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      framework: suggestion.framework,
      requiredEnvVars: suggestion.required_env_vars,
      estimatedSetupTime: suggestion.estimated_setup_time,
      difficultyLevel: suggestion.difficulty_level,
      tags: suggestion.tags
    }
  }

  /**
   * Convert template to Rust format for registration
   */
  private convertTemplateToRustFormat(template: EnhancedConfigTemplate): any {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      author: template.author,
      provider_id: template.providerId,
      provider_name: template.providerName,
      provider_category: template.providerCategory,
      template_files: template.templateFiles.map(file => ({
        id: file.id,
        name: file.name,
        description: file.description,
        file_type: file.fileType,
        file_path: file.filePath,
        template_content: file.templateContent,
        language: file.language,
        is_required: file.isRequired,
        dependencies: file.dependencies,
        framework_variants: file.frameworkVariants,
        conditions: file.conditions,
        category: file.category,
        priority: file.priority
      })),
      framework_compatibility: template.frameworkCompatibility.map(compat => ({
        framework: compat.framework,
        compatibility_level: compat.compatibilityLevel,
        confidence: compat.confidence,
        config_overrides: compat.configOverrides,
        additional_dependencies: compat.additionalDependencies,
        setup_instructions: compat.setupInstructions,
        limitations: compat.limitations
      })),
      required_env_vars: template.requiredEnvVars,
      optional_env_vars: template.optionalEnvVars,
      dependencies: template.dependencies,
      dev_dependencies: template.devDependencies,
      supported_features: template.supportedFeatures,
      setup_instructions: template.setupInstructions,
      next_steps: template.nextSteps,
      tags: template.tags,
      difficulty_level: template.difficultyLevel,
      estimated_setup_time: template.estimatedSetupTime
    }
  }

  /**
   * Convert session status from Rust format
   */
  private convertSessionStatusFromRustFormat(status: any): GenerationSessionStatus {
    return {
      id: status.id,
      providerId: status.provider_id,
      status: status.status,
      progress: {
        currentStep: status.progress.current_step,
        progress: status.progress.progress,
        totalSteps: status.progress.total_steps,
        currentStepNumber: status.progress.current_step_number,
        statusMessage: status.progress.status_message,
        hasError: status.progress.has_error,
        errorMessage: status.progress.error_message,
        etaSeconds: status.progress.eta_seconds
      },
      startedAt: status.started_at,
      durationSeconds: status.duration_seconds
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Create a default generation context
   */
  public createDefaultGenerationContext(
    framework: string = 'nextjs',
    outputPath: string = './',
    envVars: Record<string, string> = {}
  ) {
    return {
      framework,
      envVars,
      requestedFeatures: [],
      outputPath,
      projectSettings: {},
      userPreferences: DEFAULT_USER_PREFERENCES,
      existingFiles: [],
      packageJson: undefined,
      tsconfig: undefined
    }
  }

  /**
   * Create a basic generation request
   */
  public createBasicGenerationRequest(
    providerId: string,
    framework: string = 'nextjs',
    features: string[] = [],
    envVars: Record<string, string> = {}
  ): EnhancedGenerationRequest {
    return {
      providerId,
      templateId: undefined,
      context: this.createDefaultGenerationContext(framework, './', envVars),
      features,
      useLlmEnhancement: false,
      templateOverrides: {},
      previewOnly: false
    }
  }

  /**
   * Check if a framework is supported for a provider
   */
  public async isFrameworkSupported(providerId: string, framework: string): Promise<boolean> {
    try {
      const compatibility = await this.getProviderFrameworkCompatibility(providerId)
      return compatibility.some(info => 
        info.framework === framework && 
        info.compatibilityLevel !== 'unsupported'
      )
    } catch {
      return false
    }
  }

  /**
   * Get recommended features for a provider and framework combination
   */
  public async getRecommendedFeatures(providerId: string, framework: string): Promise<string[]> {
    try {
      const compatibility = await this.getProviderFrameworkCompatibility(providerId)
      const frameworkInfo = compatibility.find(info => info.framework === framework)
      return frameworkInfo?.supportedFeatures || []
    } catch {
      return []
    }
  }
}

/**
 * Export singleton instance
 */
export const enhancedTemplateService = EnhancedTemplateService.getInstance()

/**
 * Export service class for dependency injection or testing
 */
export default EnhancedTemplateService