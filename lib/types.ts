// Core API Key types
export interface ApiKey {
    id: string
    name: string
    service: string
    key: string
    description?: string
    environment: 'dev' | 'staging' | 'production'
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
    defaultEnvironment: 'dev' | 'staging' | 'production'
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

    // System state
    isLoading: boolean
    error: string | null
    lastSync: string | null
    connectionStatus: 'online' | 'offline' | 'syncing'
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