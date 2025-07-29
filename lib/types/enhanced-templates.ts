/**
 * Enhanced Template Types for Multi-Framework Template Generation
 * 
 * These types align with the Rust backend's enhanced template system
 * providing type safety across the frontend-backend boundary.
 */

// ===== CORE TEMPLATE TYPES =====

export interface TemplateFile {
  id: string
  name: string
  description: string
  fileType: string
  filePath: string
  templateContent: string
  language: string
  isRequired: boolean
  dependencies: string[]
  frameworkVariants: Record<string, string>
  conditions: string[]
  category: string
  priority: number
}

export interface FrameworkCompatibility {
  framework: string
  compatibilityLevel: 'full' | 'partial' | 'minimal' | 'unsupported'
  confidence: number
  configOverrides: Record<string, any>
  additionalDependencies: string[]
  setupInstructions: string[]
  limitations: string[]
}

export interface UserPreferences {
  codeStyle: 'typescript' | 'javascript'
  useSemicolons: boolean
  indentation: 'spaces' | 'tabs'
  indentSize: number
  generateTypes: boolean
  includeJsdoc: boolean
  importStyle: 'default' | 'named' | 'namespace'
  useAsyncAwait: boolean
}

export interface GenerationContext {
  framework: string
  envVars: Record<string, string>
  requestedFeatures: string[]
  outputPath: string
  projectSettings: Record<string, any>
  userPreferences: UserPreferences
  existingFiles: string[]
  packageJson?: any
  tsconfig?: any
}

export interface EnhancedConfigTemplate {
  id: string
  name: string
  description: string
  version: string
  author?: string
  providerId: string
  providerName: string
  providerCategory: string
  templateFiles: TemplateFile[]
  frameworkCompatibility: FrameworkCompatibility[]
  requiredEnvVars: string[]
  optionalEnvVars: string[]
  envVarDescriptions: Record<string, string>
  dependencies: string[]
  devDependencies: string[]
  peerDependencies: string[]
  extends?: string
  overrides: Record<string, any>
  supportedFeatures: string[]
  featureCombinations: Record<string, string[]>
  setupInstructions: string[]
  usageExamples: CodeExample[]
  nextSteps: string[]
  tags: string[]
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: string
  documentationLinks: DocumentationLink[]
  validationRules: ValidationRule[]
  llmContext?: LLMContext
}

export interface CodeExample {
  title: string
  description: string
  language: string
  code: string
  filename?: string
  category: string
}

export interface DocumentationLink {
  title: string
  url: string
  description: string
  linkType: 'official' | 'tutorial' | 'example' | 'reference'
}

export interface ValidationRule {
  ruleType: string
  condition: string
  errorMessage: string
  warningMessage?: string
  autoFix?: string
}

export interface LLMContext {
  systemPrompt: string
  providerContext: string
  bestPractices: string[]
  commonPitfalls: string[]
  securityNotes: string[]
}

// ===== REQUEST/RESPONSE TYPES =====

export interface EnhancedGenerationRequest {
  providerId: string
  templateId?: string
  context: GenerationContext
  features: string[]
  useLlmEnhancement: boolean
  templateOverrides: Record<string, string>
  previewOnly: boolean
}

export interface EnhancedGenerationResult {
  files: GeneratedTemplateFile[]
  dependencies: string[]
  devDependencies: string[]
  setupInstructions: string[]
  nextSteps: string[]
  validationResults: ValidationResult[]
  warnings: string[]
  recommendations: string[]
  templateInfo: TemplateInfo
}

export interface GeneratedTemplateFile {
  path: string
  content: string
  fileType: string
  language: string
  exists: boolean
  category: string
  isRequired: boolean
  size: number
  checksum: string
  createdByTemplate: string
  createdAt: string
}

export interface ValidationResult {
  ruleId: string
  passed: boolean
  errorMessage?: string
  warningMessage?: string
  suggestedFix?: string
  severity: 'error' | 'warning' | 'info'
}

export interface TemplateInfo {
  templateId: string
  templateName: string
  templateVersion: string
  providerId: string
  providerName: string
  framework: string
  compatibilityLevel: string
  enabledFeatures: string[]
  generatedAt: string
  llmEnhanced: boolean
}

// ===== PROGRESS TRACKING TYPES =====

export interface GenerationProgress {
  currentStep: string
  progress: number // 0-100
  totalSteps: number
  currentStepNumber: number
  statusMessage: string
  hasError: boolean
  errorMessage?: string
  etaSeconds?: number
}

export interface GenerationSessionStatus {
  id: string
  providerId: string
  status: GenerationStatus
  progress: GenerationProgress
  startedAt: string
  durationSeconds: number
}

export type GenerationStatus = 
  | 'starting'
  | 'inProgress' 
  | 'completed'
  | 'failed'
  | 'cancelled'

// ===== FRAMEWORK DETECTION TYPES =====

export interface FrameworkDetectionResult {
  framework: string
  confidence: number
  evidence: DetectionEvidence[]
  version?: string
  metadata: Record<string, any>
}

export interface DetectionEvidence {
  evidenceType: string
  value: string
  confidenceWeight: number
  source: string
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  compatibleFrameworks: string[]
  missingRequirements: string[]
}

export interface FrameworkCompatibilityInfo {
  framework: string
  compatibilityLevel: string
  confidence: number
  supportedFeatures: string[]
  limitations: string[]
  additionalDependencies: string[]
}

// ===== EVENT TYPES FOR REAL-TIME UPDATES =====

export interface GenerationProgressEvent {
  sessionId: string
  progress: GenerationProgress
  timestamp: string
}

export interface GenerationCompletionEvent {
  sessionId: string
  success: boolean
  errorMessage?: string
  durationSeconds: number
}

export interface PreviewCompletionEvent {
  sessionId: string
  success: boolean
  errorMessage?: string
  fileCount: number
}

// ===== TEMPLATE SUGGESTION TYPES =====

export interface TemplateSuggestion {
  templateId: string
  templateName: string
  providerId: string
  providerName: string
  confidence: number
  reason: string
  framework: string
  requiredEnvVars: string[]
  estimatedSetupTime: string
  difficultyLevel: string
  tags: string[]
}

// ===== CACHE AND PERFORMANCE TYPES =====

export interface CacheStats {
  totalEntries: number
  hitCount: number
  missCount: number
  evictionCount: number
  cacheSize: number
  oldestEntry?: string
  newestEntry?: string
}

// ===== UI STATE TYPES =====

export interface TemplateGenerationState {
  // Active generation sessions
  activeSessions: Record<string, GenerationSessionStatus>
  
  // Current generation
  currentSessionId?: string
  currentRequest?: EnhancedGenerationRequest
  currentResult?: EnhancedGenerationResult
  
  // Framework detection
  detectedFrameworks: FrameworkDetectionResult[]
  selectedFramework?: string
  
  // Template selection
  availableTemplates: EnhancedConfigTemplate[]
  selectedTemplate?: EnhancedConfigTemplate
  templateSuggestions: TemplateSuggestion[]
  
  // Validation and compatibility
  validationResults: TemplateValidationResult[]
  compatibilityMatrix: FrameworkCompatibilityInfo[]
  
  // UI state
  isGenerating: boolean
  isDetectingFramework: boolean
  isLoadingTemplates: boolean
  showPreview: boolean
  previewFiles: GeneratedTemplateFile[]
  
  // Cache statistics
  cacheStats?: CacheStats
  
  // Error handling
  lastError?: string
  warnings: string[]
}

// ===== WIZARD STEP TYPES =====

export interface WizardStep {
  id: string
  title: string
  description: string
  isComplete: boolean
  isActive: boolean
  isOptional: boolean
  validationErrors: string[]
}

export interface TemplateWizardState {
  currentStepIndex: number
  steps: WizardStep[]
  canProceed: boolean
  canGoBack: boolean
  formData: Record<string, any>
}

// ===== PREVIEW AND DIFF TYPES =====

export interface FilePreview {
  file: GeneratedTemplateFile
  hasChanges: boolean
  diffData?: FileDiff
  syntaxHighlighting: boolean
}

export interface FileDiff {
  additions: number
  deletions: number
  changes: DiffChange[]
}

export interface DiffChange {
  type: 'addition' | 'deletion' | 'modification'
  lineNumber: number
  oldContent?: string
  newContent?: string
}

// ===== BATCH OPERATION TYPES =====

export interface TemplateValidationRequest {
  providerId: string
  templateId?: string
  framework: string
  features: string[]
}

export interface BatchValidationResult {
  requests: TemplateValidationRequest[]
  results: TemplateValidationResult[]
  overallValid: boolean
  summary: ValidationSummary
}

export interface ValidationSummary {
  totalRequests: number
  validCount: number
  invalidCount: number
  warningCount: number
  errorCount: number
}

// ===== DEFAULT VALUES =====

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  codeStyle: 'typescript',
  useSemicolons: true,
  indentation: 'spaces',
  indentSize: 2,
  generateTypes: true,
  includeJsdoc: true,
  importStyle: 'named',
  useAsyncAwait: true
}

// ===== TYPE GUARDS =====

export function isGeneratedTemplateFile(obj: any): obj is GeneratedTemplateFile {
  return obj && 
    typeof obj.path === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.fileType === 'string' &&
    typeof obj.language === 'string'
}

export function isEnhancedGenerationResult(obj: any): obj is EnhancedGenerationResult {
  return obj &&
    Array.isArray(obj.files) &&
    Array.isArray(obj.dependencies) &&
    Array.isArray(obj.setupInstructions) &&
    obj.templateInfo
}

export function isFrameworkDetectionResult(obj: any): obj is FrameworkDetectionResult {
  return obj &&
    typeof obj.framework === 'string' &&
    typeof obj.confidence === 'number' &&
    Array.isArray(obj.evidence)
}

// ===== UTILITY TYPES =====

export type TemplateFileStatus = 'new' | 'modified' | 'unchanged' | 'conflict'
   
export type GenerationMode = 'full' | 'preview' | 'validation'

export type TemplateCategory = 
  | 'config'
  | 'client' 
  | 'server'
  | 'middleware'
  | 'types'
  | 'utils'
  | 'docs'

export type ProviderCategory = 
  | 'auth'
  | 'payment'
  | 'database'
  | 'messaging'
  | 'ai'
  | 'storage'
  | 'analytics'
  | 'other'