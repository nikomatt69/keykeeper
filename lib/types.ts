// Core API Key types
export interface ApiKey {
    id: string
    name: string
    service: string
    key: string
    description?: string
    environment: 'development' | 'staging' | 'production'
    rate_limit?: string
    expires_at?: string
    scopes: string[]
    tags: string[]
    is_active: boolean
    created_at: string
    updated_at: string
    project_id?: string
}

// Project Management
export interface Project {
    id: string
    name: string
    description?: string
    icon?: string
    color?: string
    created_at: string
    updated_at: string
    settings: ProjectSettings
}

export interface ProjectSettings {
    defaultEnvironment: 'development' | 'staging' | 'production'
    autoSync: boolean
    vscodeIntegration: boolean
    cursorIntegration: boolean
    notifications: boolean
}

// Enterprise Settings
export interface EnterpriseSettings {
    security: SecuritySettings
    backup: BackupSettings
    ui: UISettings
    integrations: IntegrationSettings
    analytics: AnalyticsSettings
}

export interface SecuritySettings {
    autoLockTimeout: number // minutes
    biometricAuth: boolean
    passwordComplexity: PasswordPolicy
    sessionTimeout: number // minutes
    mfaEnabled: boolean
    ipRestrictions: string[]
    deviceFingerprinting: boolean
    auditLogging: boolean
}

export interface PasswordPolicy {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
    preventReuse: number
}

export interface BackupSettings {
    autoBackup: boolean
    backupInterval: number // hours
    cloudSync: boolean
    encryptionEnabled: boolean
    retentionDays: number
    backupLocation: string
}

export interface UISettings {
    theme: 'light' | 'dark' | 'auto'
    fontSize: 'small' | 'medium' | 'large'
    compactMode: boolean
    animationsEnabled: boolean
    soundEnabled: boolean
    customShortcuts: KeyboardShortcut[]
    language: string
}

export interface KeyboardShortcut {
    action: string
    key: string
    modifiers: string[]
}

export interface IntegrationSettings {
    vscode: VSCodeConfig
    cursor: CursorConfig
    notifications: NotificationConfig
    cicd: CICDConfig
}

export interface VSCodeConfig {
    enabled: boolean
    autoConnect: boolean
    projectSync: boolean
    quickInsert: boolean
    contextAware: boolean
    securityWarnings: boolean
}

export interface CursorConfig {
    enabled: boolean
    aiSuggestions: boolean
    chatIntegration: boolean
    contextAnalysis: boolean
    autoComplete: boolean
}

export interface NotificationConfig {
    desktop: boolean
    sound: boolean
    keyExpiration: boolean
    securityAlerts: boolean
    syncStatus: boolean
    emailNotifications: boolean
}

export interface CICDConfig {
    githubActions: boolean
    gitlabCI: boolean
    jenkins: boolean
    azureDevOps: boolean
    webhookUrl?: string
}

export interface AnalyticsSettings {
    enabled: boolean
    usageTracking: boolean
    performanceMetrics: boolean
    securityMetrics: boolean
    anonymizeData: boolean
}

// Team & Collaboration
export interface Team {
    id: string
    name: string
    description?: string
    owner_id: string
    members: TeamMember[]
    settings: TeamSettings
    created_at: string
    updated_at: string
}

export interface TeamMember {
    id: string
    email: string
    name: string
    role: UserRole
    permissions: Permission[]
    joined_at: string
    last_active: string
}

export type UserRole = 'admin' | 'developer' | 'viewer'

export interface Permission {
    resource: string
    actions: string[]
}

export interface TeamSettings {
    allowKeySharing: boolean
    requireApproval: boolean
    auditLevel: 'basic' | 'detailed' | 'paranoid'
    maxMembers: number
    retentionDays: number
}

// Audit & Logging
export interface AuditLog {
    id: string
    user_id: string
    action: AuditAction
    resource_type: string
    resource_id: string
    details: Record<string, any>
    ip_address: string
    user_agent: string
    timestamp: string
}

export type AuditAction =
    | 'create' | 'read' | 'update' | 'delete'
    | 'export' | 'import' | 'share' | 'revoke'
    | 'login' | 'logout' | 'unlock' | 'lock'

// Analytics & Monitoring
export interface UsageAnalytics {
    keyUsage: KeyUsageStats[]
    accessPatterns: AccessPattern[]
    securityEvents: SecurityEvent[]
    performanceMetrics: PerformanceMetric[]
}

export interface KeyUsageStats {
    key_id: string
    usage_count: number
    last_used: string
    environments: string[]
    projects: string[]
}

export interface AccessPattern {
    user_id: string
    access_times: string[]
    ip_addresses: string[]
    devices: string[]
    frequency: number
}

export interface SecurityEvent {
    id: string
    type: 'failed_login' | 'suspicious_access' | 'key_exposure' | 'policy_violation'
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    user_id?: string
    ip_address: string
    timestamp: string
    resolved: boolean
}

export interface PerformanceMetric {
    metric: string
    value: number
    unit: string
    timestamp: string
}

// Workflow & Automation
export interface WorkflowTemplate {
    id: string
    name: string
    description: string
    category: string
    steps: WorkflowStep[]
    variables: WorkflowVariable[]
    created_at: string
}

export interface WorkflowStep {
    id: string
    type: 'action' | 'condition' | 'loop'
    name: string
    config: Record<string, any>
    next_step?: string
}

export interface WorkflowVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'array'
    required: boolean
    default?: any
    description?: string
}

// Export/Import
export interface ExportData {
    version: string
    timestamp: string
    projects: Project[]
    apiKeys: Omit<ApiKey, 'key'>[] // Keys are encrypted separately
    settings: EnterpriseSettings
    metadata: ExportMetadata
}

export interface ExportMetadata {
    total_keys: number
    environments: string[]
    services: string[]
    created_by: string
    encryption_method: string
}

// Error types
export interface AppError {
    code: string
    message: string
    details?: Record<string, any>
    timestamp: string
}

// Enhanced Template Generation Types (aligned with Rust backend)
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
    dependencies: string[]
    devDependencies: string[]
    supportedFeatures: string[]
    setupInstructions: string[]
    nextSteps: string[]
    tags: string[]
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
    estimatedSetupTime: string
}

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

export interface EnhancedGenerationRequest {
    providerId: string
    templateId?: string
    context: GenerationContext
    features: string[]
    useLlmEnhancement: boolean
    templateOverrides: Record<string, string>
    previewOnly: boolean
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

// Store interfaces
export interface AppState {
    // Authentication
    isUnlocked: boolean
    user: UserProfile | null

    // Core data
    apiKeys: ApiKey[]
    projects: Project[]
    selectedKey: ApiKey | null
    selectedProject: Project | null

    // UI state
    searchQuery: string
    sidebarCollapsed: boolean
    showAddModal: boolean
    showEditModal: boolean
    showDeleteModal: boolean
    showSettingsModal: boolean

    // Enterprise features
    settings: EnterpriseSettings
    analytics: UsageAnalytics | null
    auditLogs: AuditLog[]
    team: Team | null

    // Enhanced Template Generation State
    templateGeneration: TemplateGenerationState

    // System state
    isLoading: boolean
    error: string | null
    lastSync: string | null
    connectionStatus: 'online' | 'offline' | 'syncing'
}

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
    
    // Error handling
    lastError?: string
    warnings: string[]
}

export interface UserProfile {
    id: string
    email: string
    name: string
    avatar?: string
    role: UserRole
    team_id?: string
    preferences: UserPreferences
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto'
    language: string
    timezone: string
    notifications: NotificationConfig
}

// ===============================
// CHAT & DOCUMENTATION LIBRARY TYPES
// ===============================

// Chat System Types (aligned with Rust backend)
export interface ChatSession {
    id: string
    user_id: string
    title: string
    description?: string
    message_count: number
    created_at: string
    updated_at: string
    status: ChatSessionStatus
    context_libraries: string[]
}

export type ChatSessionStatus = 'active' | 'archived' | 'deleted'

export interface ChatMessage {
    id: string
    session_id: string
    role: MessageRole
    content: string
    context_chunks: string[]
    generated_code?: GeneratedCode
    metadata: ChatMessageMetadata
    created_at: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface GeneratedCode {
    language: string
    framework: string
    code_blocks: CodeBlock[]
    dependencies: string[]
    configuration: Record<string, string>
    test_cases?: string
    documentation?: string
}

export interface CodeBlock {
    filename: string
    content: string
    description: string
    file_type: FileType
}

export type FileType = 'config' | 'code' | 'documentation' | 'test' | 'schema'

export interface ChatMessageMetadata {
    token_count?: number
    tokens?: number
    processing_time_ms?: number
    response_time_ms?: number
    context_relevance?: number
    confidence_score?: number
    search_queries: string[]
    provider_used?: string
    model?: string
    completion_reason?: string
    cached?: boolean
}

export interface ChatUserPreferences {
    preferredLanguage: string
    preferredFramework: string
    codeStyle: string
    detailLevel: DetailLevel
    includeExamples: boolean
    includeTests: boolean
    securityFocused: boolean
}

export type DetailLevel = 'minimal' | 'standard' | 'comprehensive' | 'expert'

export interface ChatGenerationContext {
    targetFramework: string
    targetLanguage: string
    projectContext?: string
    existingCode?: string
    requirements: string[]
    constraints: string[]
}

export interface IntegrationGeneration {
    id: string
    session_id: string
    provider_name: string
    framework: string
    language: string
    generated_code: GeneratedCode
    requirements: string[]
    constraints: string[]
    project_context?: string
    created_at: string
    status: IntegrationStatus
}

export type IntegrationStatus = 'generating' | 'completed' | 'failed' | 'cancelled'

// Documentation Library Types (aligned with Rust backend)
export interface DocumentationLibrary {
    id: string
    name: string
    description: string
    provider_id?: string
    url: string
    version: string
    language: string
    tags: string[]
    created_at: string
    updated_at: string
    total_chunks: number
    status: DocumentationStatus
    content_hash: string
}

export type DocumentationStatus = 'processing' | 'indexed' | 'failed' | 'outdated'

export interface DocumentationChunk {
    id: string
    library_id: string
    chunk_index: number
    title: string
    content: string
    section_path: string[]
    metadata: ChunkMetadata
    created_at: string
}

export interface ChunkMetadata {
    word_count: number
    content_type: ContentType
    importance_score: number
    keywords: string[]
    related_chunks: string[]
    source_url?: string
    line_numbers?: [number, number]
}

export type ContentType = 
    | 'overview' 
    | 'tutorial' 
    | 'reference' 
    | 'example' 
    | 'configuration' 
    | 'troubleshooting'
    | 'migration'
    | 'changelog'

export interface DocumentationSearchResult {
    chunk_id: string
    library_id: string
    title: string
    content: string
    section_path: string[]
    similarity_score: number
    relevance_score: number
    content_type: ContentType
    url?: string
    metadata: ChunkMetadata
}

export interface VectorSearchParams {
    query: string
    library_ids?: string[]
    content_types?: ContentType[]
    min_similarity: number
    max_results: number
    include_metadata: boolean
    boost_recent: boolean
    section_filter?: string[]
}

// Request/Response Types for Frontend API Calls
export interface CreateChatSessionRequest {
    userId: string
    title: string
    description?: string
    contextLibraries: string[]
}

export interface CreateChatSessionResponse {
    sessionId: string
    title: string
    createdAt: string
}

export interface SendChatMessageRequest {
    sessionId: string
    message: string
    contextLibraries: string[]
    userPreferences: ChatUserPreferences
    generationContext?: ChatGenerationContext
    includeCodeGeneration: boolean
}

export interface SearchDocumentationRequest {
    query: string
    providerId?: string
    contentTypes?: string[]
    maxResults?: number
    minSimilarity?: number
}

export interface GenerateIntegrationRequest {
    sessionId: string
    providerName: string
    framework: string
    language: string
    requirements: string[]
    constraints: string[]
    projectContext?: string
    existingCode?: string
}

export interface AddDocumentationRequest {
    provider_id: string
    provider_name: string
    provider_category: string
    docs_url: string
    description?: string
    tags: string[]
    version?: string
}

export interface AddManualDocumentationRequest {
    provider_id: string
    provider_name: string
    title: string
    content: string
    section_path: string[]
    content_type: string
    tags: string[]
    importance_score?: number
}

export interface SearchDocumentationLibraryRequest {
    query: string
    library_ids?: string[]
    provider_ids?: string[]
    content_types?: string[]
    section_filter?: string[]
    min_similarity?: number
    max_results?: number
    include_metadata?: boolean
    boost_recent?: boolean
}

export interface BulkImportRequest {
    provider_id: string
    provider_name: string
    documents: BulkDocumentEntry[]
}

export interface BulkDocumentEntry {
    title: string
    content: string
    url?: string
    section_path: string[]
    content_type: string
    tags: string[]
}

export interface LibraryStatistics {
    total_libraries: number
    total_chunks: number
    total_embeddings: number
    libraries_by_provider: Record<string, number>
    chunks_by_content_type: Record<string, number>
    average_chunk_size: number
    last_updated: string
} 