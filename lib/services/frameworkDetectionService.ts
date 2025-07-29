/**
 * Framework Detection Service
 * 
 * Service for analyzing project structure and automatically detecting 
 * the frameworks being used. Integrates with the Rust backend's 
 * framework detection system.
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  FrameworkDetectionResult,
  DetectionEvidence,
  FrameworkCompatibilityInfo
} from '../types/enhanced-templates'

/**
 * Framework detection configuration
 */
export interface FrameworkDetectionConfig {
  /** Maximum confidence threshold (0.0 to 1.0) */
  maxConfidenceThreshold: number
  /** Minimum confidence threshold to include in results */
  minConfidenceThreshold: number
  /** Whether to include detailed evidence in results */
  includeEvidence: boolean
  /** Maximum number of frameworks to return */
  maxResults: number
}

/**
 * Framework suggestion with reasoning
 */
export interface FrameworkSuggestion {
  framework: string
  name: string
  confidence: number
  reason: string
  benefits: string[]
  limitations: string[]
  setupComplexity: 'low' | 'medium' | 'high'
  recommendedFor: string[]
}

/**
 * Project analysis result
 */
export interface ProjectAnalysisResult {
  detectedFrameworks: FrameworkDetectionResult[]
  primaryFramework?: FrameworkDetectionResult
  suggestions: FrameworkSuggestion[]
  projectType: 'frontend' | 'backend' | 'fullstack' | 'library' | 'unknown'
  hasPackageJson: boolean
  hasTypescriptConfig: boolean
  languagesDetected: string[]
  confidence: number
}

/**
 * Framework Detection Service
 */
export class FrameworkDetectionService {
  private static instance: FrameworkDetectionService | null = null
  private config: FrameworkDetectionConfig = {
    maxConfidenceThreshold: 1.0,
    minConfidenceThreshold: 0.3,
    includeEvidence: true,
    maxResults: 10
  }

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): FrameworkDetectionService {
    if (!FrameworkDetectionService.instance) {
      FrameworkDetectionService.instance = new FrameworkDetectionService()
    }
    return FrameworkDetectionService.instance
  }

  /**
   * Update detection configuration
   */
  public updateConfig(config: Partial<FrameworkDetectionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Detect frameworks in a project directory
   */
  public async detectFrameworks(projectPath: string): Promise<FrameworkDetectionResult[]> {
    try {
      const results = await invoke<FrameworkDetectionResult[]>('detect_project_framework', {
        projectPath
      })

      // Filter and sort results based on configuration
      return results
        .filter(result => 
          result.confidence >= this.config.minConfidenceThreshold &&
          result.confidence <= this.config.maxConfidenceThreshold
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.config.maxResults)
        .map(result => this.processDetectionResult(result))
    } catch (error) {
      console.error('Framework detection failed:', error)
      throw new Error(`Framework detection failed: ${error}`)
    }
  }

  /**
   * Analyze project comprehensively
   */
  public async analyzeProject(projectPath: string): Promise<ProjectAnalysisResult> {
    try {
      const detectedFrameworks = await this.detectFrameworks(projectPath)
      const primaryFramework = detectedFrameworks.length > 0 ? detectedFrameworks[0] : undefined
      
      // Analyze project structure
      const projectType = await this.determineProjectType(detectedFrameworks)
      const { hasPackageJson, hasTypescriptConfig, languagesDetected } = await this.analyzeProjectStructure(projectPath)
      
      // Generate suggestions
      const suggestions = await this.generateFrameworkSuggestions(detectedFrameworks, projectType)
      
      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(detectedFrameworks)

      return {
        detectedFrameworks,
        primaryFramework,
        suggestions,
        projectType,
        hasPackageJson,
        hasTypescriptConfig,
        languagesDetected,
        confidence
      }
    } catch (error) {
      console.error('Project analysis failed:', error)
      throw new Error(`Project analysis failed: ${error}`)
    }
  }

  /**
   * Get framework compatibility information
   */
  public async getFrameworkCompatibility(
    framework: string,
    providerId: string
  ): Promise<FrameworkCompatibilityInfo | null> {
    try {
      const compatibility = await invoke<FrameworkCompatibilityInfo[]>('get_provider_framework_compatibility', {
        providerId
      })
      return compatibility.find(info => info.framework === framework) || null
    } catch (error) {
      console.error('Getting framework compatibility failed:', error)
      return null
    }
  }

  /**
   * Get all supported frameworks for a provider
   */
  public async getSupportedFrameworks(providerId: string): Promise<FrameworkCompatibilityInfo[]> {
    try {
      return await invoke<FrameworkCompatibilityInfo[]>('get_provider_framework_compatibility', {
        providerId
      })
    } catch (error) {
      console.error('Getting supported frameworks failed:', error)
      return []
    }
  }

  /**
   * Validate framework and provider combination
   */
  public async validateFrameworkProviderCombination(
    framework: string,
    providerId: string,
    features: string[] = []
  ): Promise<{
    isSupported: boolean
    compatibilityLevel: string
    confidence: number
    limitations: string[]
    recommendedFeatures: string[]
  }> {
    try {
      const compatibility = await this.getFrameworkCompatibility(framework, providerId)
      
      if (!compatibility) {
        return {
          isSupported: false,
          compatibilityLevel: 'unsupported',
          confidence: 0,
          limitations: ['Framework not supported for this provider'],
          recommendedFeatures: []
        }
      }

      return {
        isSupported: compatibility.compatibilityLevel !== 'unsupported',
        compatibilityLevel: compatibility.compatibilityLevel,
        confidence: compatibility.confidence,
        limitations: compatibility.limitations,
        recommendedFeatures: compatibility.supportedFeatures.filter(feature => 
          !features.includes(feature)
        )
      }
    } catch (error) {
      console.error('Framework provider validation failed:', error)
      return {
        isSupported: false,
        compatibilityLevel: 'unknown',
        confidence: 0,
        limitations: ['Validation failed'],
        recommendedFeatures: []
      }
    }
  }

  /**
   * Get framework recommendations based on project characteristics
   */
  public async getFrameworkRecommendations(
    projectPath: string,
    requirements: {
      projectType?: 'frontend' | 'backend' | 'fullstack'
      complexity?: 'simple' | 'medium' | 'complex'
      team_size?: 'solo' | 'small' | 'large'
      performance_requirements?: 'low' | 'medium' | 'high'
      seo_requirements?: boolean
      realtime_requirements?: boolean
    } = {}
  ): Promise<FrameworkSuggestion[]> {
    try {
      const analysis = await this.analyzeProject(projectPath)
      const suggestions: FrameworkSuggestion[] = []

      // Base framework suggestions
      const frameworkDatabase = this.getFrameworkDatabase()
      
      // Score frameworks based on requirements and detected characteristics
      for (const framework of frameworkDatabase) {
        const score = this.calculateFrameworkScore(framework, requirements, analysis)
        if (score > 0.3) { // Only include frameworks with reasonable scores
          suggestions.push({
            ...framework,
            confidence: score
          })
        }
      }

      // Sort by confidence and return top suggestions
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
    } catch (error) {
      console.error('Getting framework recommendations failed:', error)
      return []
    }
  }

  /**
   * Check if a specific framework is detected in the project
   */
  public async isFrameworkDetected(projectPath: string, framework: string): Promise<boolean> {
    try {
      const results = await this.detectFrameworks(projectPath)
      return results.some(result => 
        result.framework === framework && 
        result.confidence > this.config.minConfidenceThreshold
      )
    } catch {
      return false
    }
  }

  /**
   * Get the primary (most likely) framework
   */
  public async getPrimaryFramework(projectPath: string): Promise<FrameworkDetectionResult | null> {
    try {
      const results = await this.detectFrameworks(projectPath)
      return results.length > 0 ? results[0] : null
    } catch {
      return null
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Process detection result from backend
   */
  private processDetectionResult(result: FrameworkDetectionResult): FrameworkDetectionResult {
    // Add frontend-specific processing if needed
    return {
      ...result,
      evidence: this.config.includeEvidence ? result.evidence : []
    }
  }

  /**
   * Determine project type based on detected frameworks
   */
  private async determineProjectType(
    frameworks: FrameworkDetectionResult[]
  ): Promise<'frontend' | 'backend' | 'fullstack' | 'library' | 'unknown'> {
    const frontendFrameworks = ['nextjs', 'react', 'vue', 'angular', 'svelte']
    const backendFrameworks = ['express', 'nestjs', 'fastapi', 'django', 'rails']
    
    const hasFrontend = frameworks.some(f => frontendFrameworks.includes(f.framework))
    const hasBackend = frameworks.some(f => backendFrameworks.includes(f.framework))
    
    if (hasFrontend && hasBackend) return 'fullstack'
    if (hasFrontend) return 'frontend'
    if (hasBackend) return 'backend'
    
    // Check for library indicators
    const hasLibraryIndicators = frameworks.some(f => 
      f.evidence.some(e => 
        e.evidenceType === 'file' && 
        (e.value.includes('lib/') || e.value.includes('src/lib/'))
      )
    )
    
    return hasLibraryIndicators ? 'library' : 'unknown'
  }

  /**
   * Analyze project structure for additional context
   */
  private async analyzeProjectStructure(projectPath: string): Promise<{
    hasPackageJson: boolean
    hasTypescriptConfig: boolean
    languagesDetected: string[]
  }> {
    // This would typically use filesystem APIs
    // For now, return mock data that would be detected
    return {
      hasPackageJson: true,
      hasTypescriptConfig: true,
      languagesDetected: ['typescript', 'javascript']
    }
  }

  /**
   * Generate framework suggestions based on analysis
   */
  private async generateFrameworkSuggestions(
    detectedFrameworks: FrameworkDetectionResult[],
    projectType: string
  ): Promise<FrameworkSuggestion[]> {
    const suggestions: FrameworkSuggestion[] = []
    
    // If frameworks are already detected, suggest improvements or alternatives
    if (detectedFrameworks.length > 0) {
      const primary = detectedFrameworks[0]
      
      // Suggest complementary frameworks
      if (primary.framework === 'react' && projectType === 'frontend') {
        suggestions.push({
          framework: 'nextjs',
          name: 'Next.js',
          confidence: 0.8,
          reason: 'Next.js provides additional features like SSR, routing, and optimization for React projects',
          benefits: ['Server-side rendering', 'Built-in routing', 'Performance optimizations', 'API routes'],
          limitations: ['Learning curve', 'Opinionated structure'],
          setupComplexity: 'medium',
          recommendedFor: ['Production applications', 'SEO-critical sites', 'Full-stack applications']
        })
      }
    } else {
      // Suggest frameworks based on project type
      if (projectType === 'frontend') {
        suggestions.push({
          framework: 'nextjs',
          name: 'Next.js',
          confidence: 0.9,
          reason: 'Excellent choice for modern frontend applications with React',
          benefits: ['Great developer experience', 'Built-in optimizations', 'SSR/SSG support'],
          limitations: ['React-specific', 'Can be complex for simple sites'],
          setupComplexity: 'medium',
          recommendedFor: ['Web applications', 'E-commerce sites', 'Blogs']
        })
      }
    }

    return suggestions
  }

  /**
   * Calculate overall confidence based on all detections
   */
  private calculateOverallConfidence(frameworks: FrameworkDetectionResult[]): number {
    if (frameworks.length === 0) return 0
    
    // Use the highest confidence as base, with bonuses for multiple detections
    const maxConfidence = frameworks[0].confidence
    const multipleFrameworkBonus = Math.min(frameworks.length - 1, 3) * 0.05
    
    return Math.min(maxConfidence + multipleFrameworkBonus, 1.0)
  }

  /**
   * Get framework database with characteristics
   */
  private getFrameworkDatabase(): FrameworkSuggestion[] {
    return [
      {
        framework: 'nextjs',
        name: 'Next.js',
        confidence: 0,
        reason: 'Full-stack React framework',
        benefits: ['SSR/SSG', 'API routes', 'Optimizations', 'Great DX'],
        limitations: ['React-specific', 'Can be complex'],
        setupComplexity: 'medium',
        recommendedFor: ['Web apps', 'E-commerce', 'Blogs']
      },
      {
        framework: 'react',
        name: 'React',
        confidence: 0,
        reason: 'Popular UI library',
        benefits: ['Large ecosystem', 'Flexible', 'Virtual DOM'],
        limitations: ['Learning curve', 'Requires additional tools'],
        setupComplexity: 'medium',
        recommendedFor: ['SPAs', 'Interactive UIs', 'Large applications']
      },
      {
        framework: 'vue',
        name: 'Vue.js',
        confidence: 0,
        reason: 'Progressive framework',
        benefits: ['Easy to learn', 'Good documentation', 'Flexible'],
        limitations: ['Smaller ecosystem than React', 'Less job market'],
        setupComplexity: 'low',
        recommendedFor: ['Beginners', 'Small to medium apps', 'Gradual adoption']
      },
      {
        framework: 'svelte',
        name: 'Svelte',
        confidence: 0,
        reason: 'Compile-time framework',
        benefits: ['No runtime', 'Small bundle size', 'Easy to learn'],
        limitations: ['Smaller ecosystem', 'Less mature tooling'],
        setupComplexity: 'low',
        recommendedFor: ['Performance-critical apps', 'Small apps', 'Beginners']
      },
      {
        framework: 'angular',
        name: 'Angular',
        confidence: 0,
        reason: 'Full framework with TypeScript',
        benefits: ['Full framework', 'TypeScript first', 'Enterprise features'],
        limitations: ['Steep learning curve', 'Complex', 'Large bundle'],
        setupComplexity: 'high',
        recommendedFor: ['Enterprise apps', 'Large teams', 'Complex applications']
      }
    ]
  }

  /**
   * Calculate framework score based on requirements
   */
  private calculateFrameworkScore(
    framework: FrameworkSuggestion,
    requirements: any,
    analysis: ProjectAnalysisResult
  ): number {
    let score = 0.5 // Base score

    // Adjust based on detected frameworks
    if (analysis.detectedFrameworks.some(f => f.framework === framework.framework)) {
      score += 0.3 // Bonus for already being detected
    }

    // Adjust based on project type
    if (requirements.projectType === 'frontend') {
      if (['nextjs', 'react', 'vue', 'svelte', 'angular'].includes(framework.framework)) {
        score += 0.2
      }
    }

    // Adjust based on complexity requirements
    if (requirements.complexity === 'simple' && framework.setupComplexity === 'low') {
      score += 0.15
    } else if (requirements.complexity === 'complex' && framework.setupComplexity === 'high') {
      score += 0.15
    }

    // Adjust based on team size
    if (requirements.team_size === 'large' && framework.framework === 'angular') {
      score += 0.1 // Angular is good for large teams
    }

    // Adjust based on SEO requirements
    if (requirements.seo_requirements && ['nextjs'].includes(framework.framework)) {
      score += 0.15
    }

    return Math.min(score, 1.0)
  }
}

/**
 * Export singleton instance
 */
export const frameworkDetectionService = FrameworkDetectionService.getInstance()

/**
 * Export service class
 */
export default FrameworkDetectionService