import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { EnhancedConfigTemplate, EnhancedGenerationRequest, EnhancedGenerationResult, EnterpriseSettings, FrameworkCompatibilityInfo, FrameworkDetectionResult, GenerationProgress, GenerationSessionStatus, TemplateSuggestion, TemplateValidationResult } from './types'
import type {
  VSCodeWorkspace,
  Documentation,
  MLEngineStatus,
  MLPrediction,
  MLConfig,
  ContextInfo,
  ApiProvider,
  GenerationRequest,
  GeneratedConfig,
  DetectionResult,
  LLMRequest,
  LLMResponse
} from './tauri-api'
import type {
  ChatSession,
  ChatMessage,
  ChatUserPreferences,
  ChatGenerationContext,
  DocumentationLibrary,
  DocumentationSearchResult,
  IntegrationGeneration,
  LibraryStatistics,
  ContentType,
  GenerateIntegrationRequest
} from './types'
import { TauriAPI } from './tauri-api'
import { integrationService } from './services/integrationService'
import { initializeNativeStorage } from './services/nativeStorageService'
import { ChatService } from './services/chatService'
import { DocumentationLibraryService } from './services/documentationLibraryService'

// Use the unified Documentation interface from tauri-api
export type DocumentationEntry = Documentation

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
  created_at: string
  updated_at: string
  tags: string[]
  is_active: boolean
  // Informazioni per chiavi importate da .env
  source_type?: 'manual' | 'env_file'
  env_file_path?: string
  project_path?: string
  env_file_name?: string
  // Documentation fields

  documentation_url?: string
  documentation_title?: string
  documentation_content?: string
  last_doc_sync?: string
}

// Project Management Interfaces
export interface Project {
  id: string
  name: string
  description?: string
  path: string
  created_at: string
  updated_at: string
  settings: ProjectSettings
}

export interface ProjectSettings {
  default_environment: string
  auto_sync: boolean
  vscode_integration: boolean
  cursor_integration: boolean
  notifications: boolean
}

export interface ProjectStats {
  totalKeys: number
  activeKeys: number
  environments: string[]
  lastUpdated: string
}

// Default settings
const defaultSettings: EnterpriseSettings = {
  security: {
    autoLockTimeout: 15,
    biometricAuth: true,
    passwordComplexity: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventReuse: 5
    },
    sessionTimeout: 60,
    mfaEnabled: false,
    ipRestrictions: [],
    deviceFingerprinting: true,
    auditLogging: true
  },
  backup: {
    autoBackup: true,
    backupInterval: 24,
    cloudSync: false,
    encryptionEnabled: true,
    retentionDays: 30,
    backupLocation: ''
  },
  ui: {
    theme: 'auto',
    fontSize: 'medium',
    compactMode: false,
    animationsEnabled: true,
    soundEnabled: true,
    customShortcuts: [],
    language: 'en'
  },
  integrations: {
    vscode: {
      enabled: true,
      autoConnect: true,
      projectSync: true,
      quickInsert: true,
      contextAware: true,
      securityWarnings: true
    },
    cursor: {
      enabled: true,
      aiSuggestions: true,
      chatIntegration: true,
      contextAnalysis: true,
      autoComplete: true
    },
    notifications: {
      desktop: true,
      sound: true,
      keyExpiration: true,
      securityAlerts: true,
      syncStatus: true,
      emailNotifications: false
    },
    cicd: {
      githubActions: false,
      gitlabCI: false,
      jenkins: false,
      azureDevOps: false
    }
  },
  analytics: {
    enabled: true,
    usageTracking: true,
    performanceMetrics: true,
    securityMetrics: true,
    anonymizeData: true
  }
}

// Chat System State Interface
interface ChatState {
  // Active sessions
  sessions: ChatSession[]
  currentSessionId: string | null
  currentSession: ChatSession | null

  // Messages for current session
  messages: ChatMessage[]
  isLoadingMessages: boolean

  // User preferences
  userPreferences: ChatUserPreferences

  // Generation context
  generationContext: ChatGenerationContext | null

  // Integration generations
  integrations: IntegrationGeneration[]
  currentIntegration: IntegrationGeneration | null

  // UI state
  isCreatingSession: boolean
  isSendingMessage: boolean
  isGeneratingIntegration: boolean
  showSessionList: boolean
  showPreferences: boolean

  // Search and context
  contextLibraries: string[]
  searchResults: DocumentationSearchResult[]
  isSearching: boolean

  // Statistics
  statistics: Record<string, number>

  // Error state
  lastError: string | null
  lastWarning: string | null
}

// Documentation Library State Interface
interface DocumentationLibraryState {
  // Libraries
  libraries: DocumentationLibrary[]
  currentLibraryId: string | null
  currentLibrary: DocumentationLibrary | null

  // Search and filtering
  searchQuery: string
  searchResults: DocumentationSearchResult[]
  isSearching: boolean

  // Filters
  selectedProviders: string[]
  selectedContentTypes: ContentType[]
  minSimilarity: number

  // Current chunks (for pagination)
  currentChunks: any[]
  chunksOffset: number
  chunksLimit: number
  isLoadingChunks: boolean

  // Import/Export
  isImporting: boolean
  isExporting: boolean
  bulkImportProgress: number

  // Statistics
  statistics: LibraryStatistics | null

  // UI state
  showAddModal: boolean
  showBulkImportModal: boolean
  showLibrarySettings: boolean
  selectedLibraryIds: string[]

  // Error state
  lastError: string | null
  lastWarning: string | null
}

interface AppState {
  templateGeneration: any
  // Auth state - simplified to only master password and vault
  isUnlocked: boolean
  isLoading: boolean
  error: string | null
  hasMasterPassword: boolean

  // API Keys state
  apiKeys: ApiKey[]
  selectedKey: ApiKey | null
  searchQuery: string
  filteredKeys: ApiKey[]

  // UI state
  showAddModal: boolean
  showEditModal: boolean
  showDeleteModal: boolean
  showSettingsModal: boolean
  sidebarCollapsed: boolean

  // Settings
  settings: EnterpriseSettings

  // VSCode Workspace state
  vscodeWorkspaces: VSCodeWorkspace[]
  lastWorkspaceUpdate: Date | null

  // Project Management state
  projects: Project[]
  selectedProject: Project | null
  currentProjectId: string | null
  projectStats: Map<string, ProjectStats>
  showProjectModal: boolean
  showAssignKeysModal: boolean
  showDocumentationModal: boolean

  // Documentation state
  documentation: DocumentationEntry[]

  // Chat System state
  chat: ChatState

  // Documentation Library state
  documentationLibrary: DocumentationLibraryState

  // ML Engine state
  mlEngineStatus: MLEngineStatus | null
  mlConfig: MLConfig | null
  currentContext: ContextInfo | null
  lastMLPrediction: MLPrediction | null
  mlStats: any | null

  // LLM Proxy state
  llmCacheStats: any | null
  isLLMProcessing: boolean

  // API Generator state
  apiProviders: ApiProvider[]
  currentGenerationRequest: GenerationRequest | null
  lastGeneratedConfig: GeneratedConfig | null
  lastDetectionResult: DetectionResult | null

  // Documentation actions
  loadDocumentation: () => Promise<void>
  saveDocumentation: (doc: Omit<DocumentationEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<DocumentationEntry>
  updateDocumentation: (id: string, updates: Partial<DocumentationEntry>) => Promise<void>
  deleteDocumentation: (id: string) => Promise<void>
  searchDocumentation: (query: string) => DocumentationEntry[]
  getDocumentationByProvider: (providerId: string) => DocumentationEntry[]
  getDocumentationById: (id: string) => DocumentationEntry | undefined

  // ML Engine actions
  initializeMLEngine: (config?: MLConfig) => Promise<void>
  analyzeContext: (context: ContextInfo, availableKeys: string[]) => Promise<MLPrediction>
  recordMLUsage: (keyId: string, context: ContextInfo, success: boolean) => Promise<void>
  getMLStats: () => Promise<void>
  checkMLStatus: () => Promise<void>
  detectCurrentContext: () => Promise<void>

  // LLM Proxy actions
  processWithLLM: (request: LLMRequest) => Promise<LLMResponse>
  clearLLMCache: () => Promise<void>
  getLLMCacheStats: () => Promise<void>

  // API Generator actions
  loadAPIProviders: () => Promise<void>
  generateAPIConfiguration: (request: GenerationRequest) => Promise<GeneratedConfig>
  detectProviderFromEnv: (envVarName: string) => Promise<DetectionResult | null>
  previewGeneratedConfig: (request: GenerationRequest) => Promise<GeneratedConfig>
  scrapeAPIDocumentation: (providerId: string, docsUrl: string) => Promise<any>

  // Enhanced Template Generation actions
  detectProjectFramework: (projectPath: string) => Promise<FrameworkDetectionResult[]>
  loadAvailableTemplates: (providerId?: string) => Promise<TemplateSuggestion[]>
  generateEnhancedConfiguration: (request: EnhancedGenerationRequest) => Promise<EnhancedGenerationResult>
  previewEnhancedConfiguration: (request: EnhancedGenerationRequest) => Promise<EnhancedGenerationResult>
  validateTemplateCombination: (providerId: string, templateId: string | undefined, framework: string, features: string[]) => Promise<TemplateValidationResult>
  loadFrameworkCompatibility: (providerId: string) => Promise<FrameworkCompatibilityInfo[]>
  setSelectedFramework: (framework: string) => void
  setSelectedTemplate: (template: EnhancedConfigTemplate | undefined) => void
  setShowPreview: (show: boolean) => void
  clearTemplateGenerationState: () => void
  getActiveTemplateSessions: () => GenerationSessionStatus[]
  cancelTemplateGeneration: (sessionId: string) => Promise<boolean>
  clearTemplateCache: () => Promise<void>

  // Actions - simplified
  setIsUnlocked: (unlocked: boolean) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setHasMasterPassword: (has: boolean) => void
  setApiKeys: (keys: ApiKey[]) => void
  setSelectedKey: (key: ApiKey | null) => void
  setSearchQuery: (query: string) => void
  updateFilteredKeys: () => void
  setShowAddModal: (show: boolean) => void
  setShowEditModal: (show: boolean) => void
  setShowDeleteModal: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  setShowProjectModal: (show: boolean) => void
  setShowAssignKeysModal: (show: boolean) => void
  setShowDocumentationModal: (show: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  updateSettings: (settings: EnterpriseSettings) => Promise<void>

  // API Actions
  unlockVault: (password: string) => Promise<boolean>
  lockVault: () => Promise<void>
  loadApiKeys: () => Promise<void>
  addApiKey: (key: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateApiKey: (key: ApiKey) => Promise<void>
  deleteApiKey: (id: string) => Promise<void>
  searchApiKeys: (query: string) => Promise<void>
  exportVault: () => Promise<string>



  // Native storage actions
  initializeNativeStorage: () => Promise<void>

  // App initialization
  initializeApp: () => Promise<void>

  // Project Management Actions
  loadProjects: () => Promise<void>
  createProject: (name: string, description?: string, path?: string) => Promise<void>
  updateProject: (id: string, name?: string, description?: string, settings?: ProjectSettings) => Promise<void>
  deleteProject: (id: string, reassignKeysTo?: string) => Promise<void>
  selectProject: (project: Project | null) => void
  setCurrentProject: (projectId: string | null) => void
  assignKeysToProject: (projectId: string, keyIds: string[]) => Promise<void>
  getKeysByProject: (projectId?: string) => Promise<ApiKey[]>
  getUnassignedKeys: () => Promise<ApiKey[]>
  searchKeysInProject: (projectId: string, query: string) => Promise<ApiKey[]>
  calculateProjectStats: (projectId: string) => Promise<void>

  // VSCode Workspace Actions
  loadVSCodeWorkspaces: () => Promise<void>
  updateVSCodeWorkspaces: (workspaces: string[]) => Promise<void>
  getProjectVSCodeStatus: (projectPath: string) => Promise<string>

  // Chat System Actions
  createChatSession: (title: string, description?: string, contextLibraries?: string[]) => Promise<string>
  sendChatMessage: (sessionId: string, message: string, includeCodeGeneration?: boolean) => Promise<any>
  loadChatMessages: (sessionId: string) => Promise<void>
  loadUserChatSessions: (userId: string) => Promise<void>
  setCurrentChatSession: (sessionId: string | null) => void
  updateChatPreferences: (preferences: Partial<ChatUserPreferences>) => void
  setGenerationContext: (context: ChatGenerationContext | null) => void
  searchDocumentationForChat: (query: string, providerId?: string) => Promise<void>
  generateIntegration: (request: Omit<GenerateIntegrationRequest, 'session_id'>) => Promise<void>
  exportChatSession: (sessionId: string, format?: 'json' | 'markdown' | 'text') => Promise<string>
  archiveChatSession: (sessionId: string) => Promise<void>
  deleteChatSession: (sessionId: string) => Promise<void>
  setChatContextLibraries: (libraries: string[]) => void
  clearChatError: () => void

  // Documentation Library Actions
  loadDocumentationLibraries: () => Promise<void>
  addDocumentationFromUrl: (request: { providerId: string, providerName: string, providerCategory: string, docsUrl: string, description?: string, tags?: string[] }) => Promise<string>
  addManualDocumentation: (request: { providerId: string, providerName: string, title: string, content: string, sectionPath?: string[], contentType?: ContentType, tags?: string[] }) => Promise<string>
  searchDocumentationLibrary: (query: string, options?: { providerIds?: string[], contentTypes?: ContentType[], maxResults?: number }) => Promise<void>
  setCurrentDocumentationLibrary: (libraryId: string | null) => void
  loadLibraryChunks: (libraryId: string, offset?: number, limit?: number) => Promise<void>
  updateDocumentationLibrary: (libraryId: string, name?: string, description?: string, tags?: string[]) => Promise<void>
  deleteDocumentationLibrary: (libraryId: string) => Promise<void>
  refreshDocumentationLibrary: (libraryId: string) => Promise<void>
  bulkImportDocumentation: (providerId: string, providerName: string, documents: any[]) => Promise<string>
  exportDocumentationLibrary: (libraryId: string, format?: 'json' | 'markdown' | 'csv') => Promise<string>
  validateDocumentationUrl: (url: string) => Promise<boolean>
  setDocumentationSearchQuery: (query: string) => void
  setDocumentationFilters: (providers?: string[], contentTypes?: ContentType[], minSimilarity?: number) => void
  loadLibraryStatistics: () => Promise<void>
  clearDocumentationError: () => void
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
    // Initial state - vault is always locked on app start for security
    isUnlocked: false,
    isLoading: false,
    error: null,
    hasMasterPassword: false,
    apiKeys: [],
    selectedKey: null,
    searchQuery: '',
    filteredKeys: [],
    showAddModal: false,
    showEditModal: false,
    showDeleteModal: false,
    showSettingsModal: false,
    sidebarCollapsed: false,
    settings: defaultSettings,
    vscodeWorkspaces: [],
    lastWorkspaceUpdate: null,
    projects: [],
    selectedProject: null,
    currentProjectId: null,
    projectStats: new Map(),
    showProjectModal: false,
    showAssignKeysModal: false,
    showDocumentationModal: false,
    documentation: [],

    // Chat System initial state
    chat: {
      sessions: [],
      currentSessionId: null,
      currentSession: null,
      messages: [],
      isLoadingMessages: false,
      userPreferences: ChatService.createDefaultPreferences(),
      generationContext: null,
      integrations: [],
      currentIntegration: null,
      isCreatingSession: false,
      isSendingMessage: false,
      isGeneratingIntegration: false,
      showSessionList: false,
      showPreferences: false,
      contextLibraries: [],
      searchResults: [],
      isSearching: false,
      statistics: {},
      lastError: null,
      lastWarning: null
    },

    // Documentation Library initial state
    documentationLibrary: {
      libraries: [],
      currentLibraryId: null,
      currentLibrary: null,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      selectedProviders: [],
      selectedContentTypes: [],
      minSimilarity: 0.6,
      currentChunks: [],
      chunksOffset: 0,
      chunksLimit: 50,
      isLoadingChunks: false,
      isImporting: false,
      isExporting: false,
      bulkImportProgress: 0,
      statistics: null,
      showAddModal: false,
      showBulkImportModal: false,
      showLibrarySettings: false,
      selectedLibraryIds: [],
      lastError: null,
      lastWarning: null
    },

    // ML Engine initial state
    mlEngineStatus: null,
    mlConfig: null,
    currentContext: null,
    lastMLPrediction: null,
    mlStats: null,

    // LLM Proxy initial state
    llmCacheStats: null,
    isLLMProcessing: false,

    // API Generator initial state
    apiProviders: [],
    currentGenerationRequest: null,
    lastGeneratedConfig: null,
    lastDetectionResult: null,

    // Enhanced Template Generation initial state
    templateGeneration: {
      activeSessions: {},
      currentSessionId: undefined,
      currentRequest: undefined,
      currentResult: undefined,
      detectedFrameworks: [],
      selectedFramework: undefined,
      availableTemplates: [],
      selectedTemplate: undefined,
      templateSuggestions: [],
      validationResults: [],
      compatibilityMatrix: [],
      isGenerating: false,
      isDetectingFramework: false,
      isLoadingTemplates: false,
      showPreview: false,
      previewFiles: [],
      lastError: undefined,
      warnings: []
    },

    // Simple setters
    setIsUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setHasMasterPassword: (has) => set({ hasMasterPassword: has }),
    setApiKeys: (keys) => set({ apiKeys: keys, filteredKeys: keys }),
    setSelectedKey: (key) => set({ selectedKey: key }),
    setSearchQuery: (query) => {
      set({ searchQuery: query })
      get().updateFilteredKeys()
    },

    updateFilteredKeys: () => {
      const { apiKeys, searchQuery, currentProjectId, projects } = get()

      let filtered = apiKeys

      // Filter by project if one is selected
      if (currentProjectId) {
        const currentProject = projects.find(p => p.id === currentProjectId)
        if (currentProject) {
          filtered = filtered.filter(key => key.project_path === currentProject.path)
        }
      }

      // Filter by search query
      if (searchQuery.trim() !== '') {
        filtered = filtered.filter(key =>
          key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          key.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
          key.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
          key.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }

      set({ filteredKeys: filtered })
    },
    setShowAddModal: (show) => set({ showAddModal: show }),
    setShowEditModal: (show) => set({ showEditModal: show }),
    setShowDeleteModal: (show) => set({ showDeleteModal: show }),
    setShowSettingsModal: (show) => set({ showSettingsModal: show }),
    setShowAssignKeysModal: (show) => set({ showAssignKeysModal: show }),
    setShowDocumentationModal: (show) => set({ showDocumentationModal: show }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    updateSettings: async (settings) => {
      try {
        set({ isLoading: true, error: null })
        // Save settings (in a real app this would persist to storage)
        set({ settings })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    // API Actions
    unlockVault: async (password: string) => {
      try {
        set({ isLoading: true, error: null })
        console.log('🔓 Frontend: Calling backend unlock_vault...')
        const success = await invoke<boolean>('unlock_vault', { password })
        console.log('🔓 Frontend: Backend returned:', success)
        set({ isUnlocked: success })
        if (success) {
          console.log('✅ Backend unlock successful, loading API keys...')
          try {
            await get().loadApiKeys()
            console.log('✅ API keys loaded successfully')
          } catch (error) {
            console.error('❌ Failed to load API keys:', error)
            // Don't fail the unlock process if loadApiKeys fails
          }

          // Load projects
          try {
            await get().loadProjects()
            console.log('✅ Projects loaded successfully')
          } catch (error) {
            console.error('❌ Failed to load projects:', error)
            // Don't fail the unlock process if loadProjects fails
          }

          // Initialize integration service with current settings
          try {
            console.log('🔌 Initializing integration service...')
            const { settings } = get()
            await integrationService.initialize(settings)
            console.log('✅ Integration service initialized')
          } catch (error) {
            console.error('Failed to initialize integration service:', error)
            // Don't fail the unlock process if integration service fails
          }
        }
        return success
      } catch (error) {
        console.error('❌ Frontend unlock error:', error)
        set({ error: error as string })
        return false
      } finally {
        console.log('🔓 Frontend: Setting loading to false')
        set({ isLoading: false })
      }
    },

    lockVault: async () => {
      try {
        await invoke('lock_vault')

        // Reset integration service
        integrationService.reset()

        set({
          isUnlocked: false,
          apiKeys: [],
          filteredKeys: [],
          selectedKey: null,
          searchQuery: '',
          projects: [],
          selectedProject: null,
          currentProjectId: null,
          projectStats: new Map(),
          showProjectModal: false,
          showAssignKeysModal: false
        })
      } catch (error) {
        set({ error: error as string })
      }
    },

    loadApiKeys: async () => {
      try {
        set({ isLoading: true, error: null })
        const keys = await invoke<ApiKey[]>('get_api_keys')
        set({ apiKeys: keys })
        get().updateFilteredKeys()
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    addApiKey: async (keyData) => {
      try {
        set({ isLoading: true, error: null })
        const now = new Date().toISOString()
        const newKey: ApiKey = {
          ...keyData,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          source_type: keyData.source_type || 'manual',
          env_file_path: keyData.env_file_path || undefined,
          project_path: keyData.project_path || undefined,
          env_file_name: keyData.env_file_name || undefined,
        }
        await invoke('add_api_key', { apiKey: newKey })
        await get().loadApiKeys()
        set({ showAddModal: false })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    updateApiKey: async (key) => {
      try {
        set({ isLoading: true, error: null })
        const updatedKey = {
          ...key,
          updated_at: new Date().toISOString(),
        }
        await invoke('update_api_key', { apiKey: updatedKey })
        await get().loadApiKeys()
        set({ showEditModal: false, selectedKey: null })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    deleteApiKey: async (id) => {
      try {
        set({ isLoading: true, error: null })
        await invoke('delete_api_key', { id })
        await get().loadApiKeys()
        set({ showDeleteModal: false, selectedKey: null })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    searchApiKeys: async (query) => {
      try {
        if (query.trim() === '') {
          get().setSearchQuery('')
          return
        }
        set({ isLoading: true, error: null })
        const keys = await invoke<ApiKey[]>('search_api_keys', { query })
        set({ filteredKeys: keys, searchQuery: query })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    exportVault: async () => {
      try {
        set({ isLoading: true, error: null })
        const exportData = await invoke<string>('export_vault')
        return exportData
      } catch (error) {
        set({ error: error as string })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },


    // VSCode Workspace Actions
    loadVSCodeWorkspaces: async () => {
      try {
        set({ isLoading: true, error: null })
        const workspaces = await invoke<VSCodeWorkspace[]>('get_vscode_workspaces')
        set({ vscodeWorkspaces: workspaces, lastWorkspaceUpdate: new Date() })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    updateVSCodeWorkspaces: async (workspaces: string[]) => {
      try {
        set({ isLoading: true, error: null })
        await invoke('update_vscode_workspaces', { workspaces })
        await get().loadVSCodeWorkspaces()
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    getProjectVSCodeStatus: async (projectPath: string) => {
      try {
        const status = await invoke<string | null>('get_project_vscode_status', { projectPath })
        return status || 'unknown'
      } catch (error) {
        console.error('Failed to get project VSCode status:', error)
        return 'unknown'
      }
    },

    // Project Management Actions
    loadProjects: async () => {
      try {
        set({ isLoading: true, error: null })
        const projects = await invoke<Project[]>('get_projects')
        set({ projects })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    createProject: async (name: string, description?: string, path?: string) => {
      try {
        set({ isLoading: true, error: null })
        const newProject = await invoke<Project>('create_project', { name, description, path })

        // Add to projects list
        const { projects } = get()
        set({ projects: [...projects, newProject], showProjectModal: false })
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    updateProject: async (id: string, name?: string, description?: string, settings?: ProjectSettings) => {
      try {
        set({ isLoading: true, error: null })
        const updatedProject = await invoke<Project>('update_project', { id, name, description, settings })

        // Update projects list
        const { projects } = get()
        const updatedProjects = projects.map(p => p.id === id ? updatedProject : p)
        set({ projects: updatedProjects })

        // Update selected project if it's the one being updated
        const { selectedProject } = get()
        if (selectedProject?.id === id) {
          set({ selectedProject: updatedProject })
        }
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    deleteProject: async (id: string, reassignKeysTo?: string) => {
      try {
        set({ isLoading: true, error: null })
        await invoke('delete_project', { id, reassignKeysTo })

        // Remove from projects list
        const { projects } = get()
        const filteredProjects = projects.filter(p => p.id !== id)
        set({ projects: filteredProjects })

        // Clear selection if deleted project was selected
        const { selectedProject, currentProjectId } = get()
        if (selectedProject?.id === id) {
          set({ selectedProject: null })
        }
        if (currentProjectId === id) {
          set({ currentProjectId: null })
        }

        // Reload API keys to reflect changes
        await get().loadApiKeys()
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    selectProject: (project: Project | null) => {
      set({ selectedProject: project })
    },

    setCurrentProject: (projectId: string | null) => {
      set({ currentProjectId: projectId })
      get().updateFilteredKeys()
    },

    assignKeysToProject: async (projectId: string, keyIds: string[]) => {
      try {
        set({ isLoading: true, error: null })
        await invoke('assign_keys_to_project', { projectId, keyIds })

        // Reload API keys to reflect changes
        await get().loadApiKeys()
        set({ showAssignKeysModal: false })

        // Recalculate project stats
        await get().calculateProjectStats(projectId)
      } catch (error) {
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    },

    getKeysByProject: async (projectId?: string) => {
      try {
        const keys = await invoke<ApiKey[]>('get_keys_by_project', { projectId })
        return keys
      } catch (error) {
        console.error('Failed to get keys by project:', error)
        return []
      }
    },

    getUnassignedKeys: async () => {
      try {
        const keys = await invoke<ApiKey[]>('get_unassigned_keys')
        return keys
      } catch (error) {
        console.error('Failed to get unassigned keys:', error)
        return []
      }
    },

    searchKeysInProject: async (projectId: string, query: string) => {
      try {
        const keys = await invoke<ApiKey[]>('search_keys_in_project', { projectId, query })
        return keys
      } catch (error) {
        console.error('Failed to search keys in project:', error)
        return []
      }
    },

    setShowProjectModal: (show: boolean) => {
      set({ showProjectModal: show })
    },



    calculateProjectStats: async (projectId: string) => {
      try {
        const projectKeys = await get().getKeysByProject(projectId)
        const activeKeys = projectKeys.filter(key => key.is_active).length
        const environments = Array.from(new Set(projectKeys.map(key => key.environment)))

        const stats: ProjectStats = {
          totalKeys: projectKeys.length,
          activeKeys,
          environments,
          lastUpdated: new Date().toISOString()
        }

        const { projectStats } = get()
        const newStats = new Map(projectStats)
        newStats.set(projectId, stats)
        set({ projectStats: newStats })
      } catch (error) {
        console.error('Failed to calculate project stats:', error)
      }
    },

    // Documentation actions - using native store
    loadDocumentation: async () => {
      try {
        const docs = await TauriAPI.getNativeDocumentation()
        set({ documentation: docs })
      } catch (error) {
        console.error('Failed to load native documentation:', error)
        set({ documentation: [] })
      }
    },

    saveDocumentation: async (docData) => {
      try {
        const newDoc = await TauriAPI.createNativeDocumentation(docData)
        set(state => ({
          documentation: [...state.documentation, newDoc]
        }))
        return newDoc
      } catch (error) {
        console.error('Failed to save native documentation:', error)
        throw error
      }
    },

    updateDocumentation: async (id, updates) => {
      try {
        await TauriAPI.updateNativeDocumentation(id, updates)
        set(state => ({
          documentation: state.documentation.map(doc =>
            doc.id === id ? { ...doc, ...updates, updated_at: new Date().toISOString() } : doc
          )
        }))
      } catch (error) {
        console.error('Failed to update native documentation:', error)
        throw error
      }
    },

    deleteDocumentation: async (id) => {
      try {
        await TauriAPI.deleteNativeDocumentation(id)
        set(state => ({
          documentation: state.documentation.filter(doc => doc.id !== id)
        }))
      } catch (error) {
        console.error('Failed to delete native documentation:', error)
        throw error
      }
    },

    searchDocumentation: (query) => {
      const { documentation } = get()
      if (!query.trim()) return documentation

      const searchTerm = query.toLowerCase()
      return documentation.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm) ||
        doc.content.toLowerCase().includes(searchTerm) ||
        doc.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
      )
    },

    getDocumentationByProvider: (providerId) => {
      const { documentation } = get()
      return documentation.filter(doc => doc.provider_id === providerId)
    },

    getDocumentationById: (id) => {
      const { documentation } = get()
      return documentation.find(doc => doc.id === id)
    },

    // Native storage actions
    initializeNativeStorage: async () => {
      try {
        await initializeNativeStorage()
      } catch (error) {
        console.error('Failed to initialize native storage:', error)
      }
    },

    // App initialization - sync frontend state with backend
    initializeApp: async () => {
      try {
        get().setIsLoading(true)

        // Initialize core services
        console.log('🚀 Initializing KeyKeeper services...')

        // Initialize native storage
        console.log('📦 Initializing native storage...')
        await get().initializeNativeStorage()

        // Initialize ML Engine and LLM services
        console.log('🤖 Initializing ML Engine...')
        await get().initializeMLEngine()

        console.log('✨ Checking LLM service availability...')
        await get().checkMLStatus()

        // Initialize LLM Proxy Service
        console.log('🧠 Initializing LLM Proxy Service...')
        try {
          const { llmProxy } = await import('./services/llmProxyService')
          await llmProxy.initializeService()
        } catch (error) {
          console.warn('⚠️ LLM service initialization failed, continuing without LLM features:', error)
        }

        // Load core data
        console.log('🔑 Loading API keys...')
        await get().loadApiKeys()

        console.log('📁 Loading projects...')
        await get().loadProjects()

        console.log('💻 Loading VSCode workspaces...')
        await get().loadVSCodeWorkspaces()

        // Load documentation and providers
        console.log('📚 Loading documentation...')
        await get().loadDocumentation()

        console.log('🔌 Loading API providers...')
        await get().loadAPIProviders()

        // Initialize LLM cache stats
        console.log('📊 Loading LLM cache stats...')
        await get().getLLMCacheStats()

        console.log('✅ KeyKeeper initialization completed successfully!')
        get().setIsLoading(false)
      } catch (error) {
        console.error('❌ Failed to initialize app:', error)
        get().setError('Failed to initialize application')
        get().setIsLoading(false)
      }
    },

    // ML Engine actions implementation
    initializeMLEngine: async (config?: MLConfig) => {
      try {
        set({ isLoading: true, error: null })
        const message = await TauriAPI.initializeMLEngine(config)
        console.log('ML Engine initialized:', message)
        await get().checkMLStatus()
      } catch (error) {
        console.warn('ML Engine initialization failed (this is expected if backend is not fully implemented):', error)
        // Don't set error state for ML engine failures as it's not critical
        set({ mlEngineStatus: { initialized: false, model_loaded: false, context_enabled: false } })
      } finally {
        set({ isLoading: false })
      }
    },

    analyzeContext: async (context: ContextInfo, availableKeys: string[]) => {
      try {
        set({ isLoading: true, error: null })
        const prediction = await TauriAPI.analyzeContextML(context, availableKeys)
        set({ lastMLPrediction: prediction, currentContext: context })
        return prediction
      } catch (error) {
        console.error('Failed to analyze context:', error)
        set({ error: error as string })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    recordMLUsage: async (keyId: string, context: ContextInfo, success: boolean) => {
      try {
        await TauriAPI.recordMLUsage(keyId, context, success)
        // Optionally refresh stats
        await get().getMLStats()
      } catch (error) {
        console.error('Failed to record ML usage:', error)
      }
    },

    getMLStats: async () => {
      try {
        const stats = await TauriAPI.getMLStats()
        set({ mlStats: stats })
      } catch (error) {
        console.error('Failed to get ML stats:', error)
      }
    },

    checkMLStatus: async () => {
      try {
        const isInitialized = await TauriAPI.checkMLStatus()
        const status: MLEngineStatus = {
          initialized: isInitialized,
          model_loaded: isInitialized,
          context_enabled: isInitialized
        }
        set({ mlEngineStatus: status })
      } catch (error) {
        console.warn('Failed to check ML status (this is expected if backend is not fully implemented):', error)
        // Set default status when backend is not available
        set({ mlEngineStatus: { initialized: false, model_loaded: false, context_enabled: false } })
      }
    },

    detectCurrentContext: async () => {
      try {
        const context = await TauriAPI.detectContext()
        set({ currentContext: context })
      } catch (error) {
        console.error('Failed to detect context:', error)
      }
    },

    // LLM Proxy actions implementation
    processWithLLM: async (request: LLMRequest) => {
      try {
        set({ isLLMProcessing: true, error: null })
        const response = await TauriAPI.processWithLLM(request)
        return response
      } catch (error) {
        console.error('Failed to process with LLM:', error)
        set({ error: error as string })
        throw error
      } finally {
        set({ isLLMProcessing: false })
      }
    },

    clearLLMCache: async () => {
      try {
        await TauriAPI.clearLLMCache()
        await get().getLLMCacheStats()
      } catch (error) {
        console.error('Failed to clear LLM cache:', error)
      }
    },

    getLLMCacheStats: async () => {
      try {
        const stats = await TauriAPI.getLLMCacheStats()
        set({ llmCacheStats: stats })
      } catch (error) {
        console.error('Failed to get LLM cache stats:', error)
      }
    },

    // API Generator actions implementation
    loadAPIProviders: async () => {
      try {
        const providers = await TauriAPI.getAPIProviders()
        set({ apiProviders: providers })
      } catch (error) {
        console.error('Failed to load API providers:', error)
      }
    },

    generateAPIConfiguration: async (request: GenerationRequest) => {
      try {
        set({ isLoading: true, error: null, currentGenerationRequest: request })
        const config = await TauriAPI.generateAPIConfiguration(request)
        set({ lastGeneratedConfig: config })
        return config
      } catch (error) {
        console.error('Failed to generate API configuration:', error)
        set({ error: error as string })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    detectProviderFromEnv: async (envVarName: string) => {
      try {
        const result = await TauriAPI.detectProviderFromEnv(envVarName)
        set({ lastDetectionResult: result })
        return result
      } catch (error) {
        console.error('Failed to detect provider from env:', error)
        return null
      }
    },

    previewGeneratedConfig: async (request: GenerationRequest) => {
      try {
        set({ isLoading: true, error: null })
        const config = await TauriAPI.previewGeneratedConfig(request)
        return config
      } catch (error) {
        console.error('Failed to preview generated config:', error)
        set({ error: error as string })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    scrapeAPIDocumentation: async (providerId: string, docsUrl: string) => {
      try {
        set({ isLoading: true, error: null })
        const result = await TauriAPI.scrapeAPIDocumentation(providerId, docsUrl)
        return result
      } catch (error) {
        console.error('Failed to scrape API documentation:', error)
        set({ error: error as string })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    // ===== ENHANCED TEMPLATE GENERATION ACTIONS =====

    // Framework Detection Actions
    detectProjectFramework: async (projectPath: string) => {
      try {
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isDetectingFramework: true,
            lastError: undefined
          }
        }))

        const { ApiProviderService } = await import('./services/apiProviderService')
        const frameworks = await ApiProviderService.detectProjectFramework(projectPath)

        const primaryFramework = frameworks.length > 0 ? frameworks[0].framework : undefined

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            detectedFrameworks: frameworks,
            selectedFramework: primaryFramework,
            isDetectingFramework: false
          }
        }))

        return frameworks
      } catch (error) {
        console.error('Framework detection failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isDetectingFramework: false,
            lastError: `Framework detection failed: ${error}`
          }
        }))
        throw error
      }
    },

    // Template Management Actions
    loadAvailableTemplates: async (providerId?: string) => {
      try {
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isLoadingTemplates: true,
            lastError: undefined
          }
        }))

        const { ApiProviderService } = await import('./services/apiProviderService')

        // Get template suggestions to see available templates
        const suggestions = await ApiProviderService.getTemplateSuggestions({}, undefined)
        const filteredSuggestions = providerId
          ? suggestions.filter(s => s.providerId === providerId)
          : suggestions

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            templateSuggestions: filteredSuggestions,
            isLoadingTemplates: false
          }
        }))

        return filteredSuggestions
      } catch (error) {
        console.error('Loading templates failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isLoadingTemplates: false,
            lastError: `Loading templates failed: ${error}`
          }
        }))
        throw error
      }
    },

    // Enhanced Configuration Generation
    generateEnhancedConfiguration: async (request: EnhancedGenerationRequest) => {
      try {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isGenerating: true,
            currentSessionId: sessionId,
            currentRequest: request,
            lastError: undefined,
            warnings: []
          }
        }))

        // Progress callback
        const onProgress = (progress: GenerationProgress) => {
          set(state => ({
            templateGeneration: {
              ...state.templateGeneration,
              activeSessions: {
                ...state.templateGeneration.activeSessions,
                [sessionId]: {
                  id: sessionId,
                  providerId: request.providerId,
                  status: progress.hasError ? 'failed' : progress.progress >= 100 ? 'completed' : 'inProgress',
                  progress,
                  startedAt: new Date().toISOString(),
                  durationSeconds: 0
                }
              }
            }
          }))
        }

        // Completion callback
        const onCompletion = (sessionId: string, success: boolean, error?: string) => {
          set(state => ({
            templateGeneration: {
              ...state.templateGeneration,
              isGenerating: false,
              lastError: error,
              activeSessions: {
                ...state.templateGeneration.activeSessions,
                [sessionId]: {
                  ...state.templateGeneration.activeSessions[sessionId],
                  status: success ? 'completed' : 'failed'
                }
              }
            }
          }))
        }

        const { ApiProviderService } = await import('./services/apiProviderService')
        const result = await ApiProviderService.generateEnhancedConfiguration(
          request,
          onProgress,
          onCompletion
        )

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            currentResult: result,
            isGenerating: false
          }
        }))

        return result
      } catch (error) {
        console.error('Enhanced configuration generation failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            isGenerating: false,
            lastError: `Configuration generation failed: ${error}`
          }
        }))
        throw error
      }
    },

    // Preview Configuration
    previewEnhancedConfiguration: async (request: EnhancedGenerationRequest) => {
      try {
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            showPreview: true,
            lastError: undefined
          }
        }))

        const onProgress = (progress: GenerationProgress) => {
          // Handle preview progress updates
          console.log('Preview progress:', progress)
        }

        const { ApiProviderService } = await import('./services/apiProviderService')
        const result = await ApiProviderService.previewEnhancedConfiguration(
          request,
          onProgress
        )

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            previewFiles: result.files,
            currentResult: result
          }
        }))

        return result
      } catch (error) {
        console.error('Configuration preview failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            showPreview: false,
            lastError: `Configuration preview failed: ${error}`
          }
        }))
        throw error
      }
    },

    // Validation Actions
    validateTemplateCombination: async (
      providerId: string,
      templateId: string | undefined,
      framework: string,
      features: string[]
    ) => {
      try {
        const { ApiProviderService } = await import('./services/apiProviderService')
        const result = await ApiProviderService.validateTemplateCombination(
          providerId,
          templateId,
          framework,
          features
        )

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            validationResults: [result]
          }
        }))

        return result
      } catch (error) {
        console.error('Template validation failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            lastError: `Template validation failed: ${error}`
          }
        }))
        throw error
      }
    },

    // Framework Compatibility Actions
    loadFrameworkCompatibility: async (providerId: string) => {
      try {
        const { ApiProviderService } = await import('./services/apiProviderService')
        const compatibility = await ApiProviderService.getProviderFrameworkCompatibility(providerId)

        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            compatibilityMatrix: compatibility
          }
        }))

        return compatibility
      } catch (error) {
        console.error('Loading framework compatibility failed:', error)
        set(state => ({
          templateGeneration: {
            ...state.templateGeneration,
            lastError: `Loading framework compatibility failed: ${error}`
          }
        }))
        throw error
      }
    },

    // UI State Management
    setSelectedFramework: (framework: string) => {
      set(state => ({
        templateGeneration: {
          ...state.templateGeneration,
          selectedFramework: framework
        }
      }))
    },

    setSelectedTemplate: (template: EnhancedConfigTemplate | undefined) => {
      set(state => ({
        templateGeneration: {
          ...state.templateGeneration,
          selectedTemplate: template
        }
      }))
    },

    setShowPreview: (show: boolean) => {
      set(state => ({
        templateGeneration: {
          ...state.templateGeneration,
          showPreview: show
        }
      }))
    },

    clearTemplateGenerationState: () => {
      set(state => ({
        templateGeneration: {
          activeSessions: {},
          currentSessionId: undefined,
          currentRequest: undefined,
          currentResult: undefined,
          detectedFrameworks: [],
          selectedFramework: undefined,
          availableTemplates: [],
          selectedTemplate: undefined,
          templateSuggestions: [],
          validationResults: [],
          compatibilityMatrix: [],
          isGenerating: false,
          isDetectingFramework: false,
          isLoadingTemplates: false,
          showPreview: false,
          previewFiles: [],
          lastError: undefined,
          warnings: []
        }
      }))
    },

    // Session Management
    getActiveTemplateSessions: () => {
      const { templateGeneration } = get()
      return Object.values(templateGeneration.activeSessions)
    },

    cancelTemplateGeneration: async (sessionId: string) => {
      try {
        const { enhancedTemplateService } = await import('./services/enhancedTemplateService')
        const cancelled = await enhancedTemplateService.cancelGenerationSession(sessionId)

        if (cancelled) {
          set(state => ({
            templateGeneration: {
              ...state.templateGeneration,
              activeSessions: {
                ...state.templateGeneration.activeSessions,
                [sessionId]: {
                  ...state.templateGeneration.activeSessions[sessionId],
                  status: 'cancelled'
                }
              },
              isGenerating: state.templateGeneration.currentSessionId === sessionId ? false : state.templateGeneration.isGenerating
            }
          }))
        }

        return cancelled
      } catch (error) {
        console.error('Canceling template generation failed:', error)
        return false
      }
    },

    // Cache Management
    clearTemplateCache: async () => {
      try {
        const { enhancedTemplateService } = await import('./services/enhancedTemplateService')
        await enhancedTemplateService.clearGenerationCache()
      } catch (error) {
        console.error('Clearing template cache failed:', error)
      }
    },

    // ===== CHAT SYSTEM ACTIONS =====

    createChatSession: async (title: string, description?: string, contextLibraries: string[] = []) => {
      try {
        set(state => ({
          chat: { ...state.chat, isCreatingSession: true, lastError: null }
        }))

        const userId = 'default-user' // TODO: Get from auth state
        const response = await ChatService.createSession(userId, title, description, contextLibraries)

        const newSession: ChatSession = {
          id: response.sessionId,
          user_id: userId,
          title,
          description,
          message_count: 0,
          created_at: response.createdAt,
          updated_at: response.createdAt,
          status: 'active',
          context_libraries: contextLibraries
        }

        set(state => ({
          chat: {
            ...state.chat,
            sessions: [...state.chat.sessions, newSession],
            currentSessionId: response.sessionId,
            currentSession: newSession,
            isCreatingSession: false
          }
        }))

        return response.sessionId
      } catch (error) {
        console.error('Failed to create chat session:', error)
        set(state => ({
          chat: {
            ...state.chat,
            isCreatingSession: false,
            lastError: `Failed to create session: ${error}`
          }
        }))
        throw error
      }
    },

    sendChatMessage: async (sessionId: string, message: string, includeCodeGeneration: boolean = false) => {
      try {
        const { chat } = get()
        set(state => ({
          chat: { ...state.chat, isSendingMessage: true, lastError: null }
        }))

        const response = await ChatService.sendMessage(
          sessionId,
          message,
          chat.userPreferences,
          chat.contextLibraries,
          chat.generationContext || undefined,
          includeCodeGeneration
        )

        // Reload messages to get the updated conversation
        await get().loadChatMessages(sessionId)

        set(state => ({
          chat: { ...state.chat, isSendingMessage: false }
        }))

        return response
      } catch (error) {
        console.error('Failed to send chat message:', error)
        set(state => ({
          chat: {
            ...state.chat,
            isSendingMessage: false,
            lastError: `Failed to send message: ${error}`
          }
        }))
        throw error
      }
    },

    loadChatMessages: async (sessionId: string) => {
      try {
        set(state => ({
          chat: { ...state.chat, isLoadingMessages: true, lastError: null }
        }))

        const messages = await ChatService.getSessionMessages(sessionId)

        set(state => ({
          chat: {
            ...state.chat,
            messages,
            isLoadingMessages: false
          }
        }))
      } catch (error) {
        console.error('Failed to load chat messages:', error)
        set(state => ({
          chat: {
            ...state.chat,
            isLoadingMessages: false,
            lastError: `Failed to load messages: ${error}`
          }
        }))
      }
    },

    loadUserChatSessions: async (userId: string) => {
      try {
        const sessions = await ChatService.getUserSessions(userId)

        set(state => ({
          chat: {
            ...state.chat,
            sessions
          }
        }))
      } catch (error) {
        console.error('Failed to load chat sessions:', error)
        set(state => ({
          chat: {
            ...state.chat,
            lastError: `Failed to load sessions: ${error}`
          }
        }))
      }
    },

    setCurrentChatSession: (sessionId: string | null) => {
      set(state => {
        const currentSession = sessionId
          ? state.chat.sessions.find(s => s.id === sessionId) || null
          : null

        return {
          chat: {
            ...state.chat,
            currentSessionId: sessionId,
            currentSession,
            messages: sessionId ? state.chat.messages : []
          }
        }
      })

      // Load messages for the new session
      if (sessionId) {
        get().loadChatMessages(sessionId)
      }
    },

    updateChatPreferences: (preferences: Partial<ChatUserPreferences>) => {
      set(state => ({
        chat: {
          ...state.chat,
          userPreferences: { ...state.chat.userPreferences, ...preferences }
        }
      }))
    },

    setGenerationContext: (context: ChatGenerationContext | null) => {
      set(state => ({
        chat: { ...state.chat, generationContext: context }
      }))
    },

    searchDocumentationForChat: async (query: string, providerId?: string) => {
      try {
        set(state => ({
          chat: { ...state.chat, isSearching: true, lastError: null }
        }))

        const results = await ChatService.searchDocumentationForContext(query, providerId)

        set(state => ({
          chat: {
            ...state.chat,
            searchResults: results,
            isSearching: false
          }
        }))
      } catch (error) {
        console.error('Failed to search documentation:', error)
        set(state => ({
          chat: {
            ...state.chat,
            isSearching: false,
            lastError: `Search failed: ${error}`
          }
        }))
      }
    },

    generateIntegration: async (request: Omit<GenerateIntegrationRequest, 'session_id'>) => {
      try {
        const { chat } = get()
        if (!chat.currentSessionId) {
          throw new Error('No active chat session')
        }

        set(state => ({
          chat: { ...state.chat, isGeneratingIntegration: true, lastError: null }
        }))

        const integration = await ChatService.generateIntegration(
          chat.currentSessionId,
          request.providerName,
          request.framework,
          request.language,
          request.requirements,
          request.constraints,
          request.projectContext,
          request.existingCode
        )

        set(state => ({
          chat: {
            ...state.chat,
            integrations: [...state.chat.integrations, integration],
            currentIntegration: integration,
            isGeneratingIntegration: false
          }
        }))
      } catch (error) {
        console.error('Failed to generate integration:', error)
        set(state => ({
          chat: {
            ...state.chat,
            isGeneratingIntegration: false,
            lastError: `Integration generation failed: ${error}`
          }
        }))
        throw error
      }
    },

    exportChatSession: async (sessionId: string, format: 'json' | 'markdown' | 'text' = 'markdown') => {
      try {
        return await ChatService.exportSession(sessionId, format)
      } catch (error) {
        console.error('Failed to export chat session:', error)
        set(state => ({
          chat: {
            ...state.chat,
            lastError: `Export failed: ${error}`
          }
        }))
        throw error
      }
    },

    archiveChatSession: async (sessionId: string) => {
      try {
        await ChatService.archiveSession(sessionId)

        set(state => ({
          chat: {
            ...state.chat,
            sessions: state.chat.sessions.map(session =>
              session.id === sessionId
                ? { ...session, status: 'archived' as const }
                : session
            )
          }
        }))
      } catch (error) {
        console.error('Failed to archive chat session:', error)
        set(state => ({
          chat: {
            ...state.chat,
            lastError: `Archive failed: ${error}`
          }
        }))
      }
    },

    deleteChatSession: async (sessionId: string) => {
      try {
        await ChatService.deleteSession(sessionId)

        set(state => ({
          chat: {
            ...state.chat,
            sessions: state.chat.sessions.filter(session => session.id !== sessionId),
            currentSessionId: state.chat.currentSessionId === sessionId ? null : state.chat.currentSessionId,
            currentSession: state.chat.currentSessionId === sessionId ? null : state.chat.currentSession,
            messages: state.chat.currentSessionId === sessionId ? [] : state.chat.messages
          }
        }))
      } catch (error) {
        console.error('Failed to delete chat session:', error)
        set(state => ({
          chat: {
            ...state.chat,
            lastError: `Delete failed: ${error}`
          }
        }))
      }
    },

    setChatContextLibraries: (libraries: string[]) => {
      set(state => ({
        chat: { ...state.chat, contextLibraries: libraries }
      }))
    },

    clearChatError: () => {
      set(state => ({
        chat: { ...state.chat, lastError: null, lastWarning: null }
      }))
    },

    // ===== DOCUMENTATION LIBRARY ACTIONS =====

    loadDocumentationLibraries: async () => {
      try {
        const libraries = await DocumentationLibraryService.getLibraries()

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            libraries,
            lastError: null
          }
        }))
      } catch (error) {
        console.error('Failed to load documentation libraries:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            lastError: `Failed to load libraries: ${error}`
          }
        }))
      }
    },

    addDocumentationFromUrl: async (request) => {
      try {
        set(state => ({ documentationLibrary: { ...state.documentationLibrary, isImporting: true, lastError: null } }));

        const libraryId = await DocumentationLibraryService.addFromUrl(request.providerId, request.providerName, request.providerCategory, request.docsUrl, request.description, request.tags);

        await get().loadDocumentationLibraries();

        set(state => ({ documentationLibrary: { ...state.documentationLibrary, isImporting: false } }));

        return libraryId;
      } catch (error) {
        console.error('Failed to add documentation from URL:', error);
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isImporting: false,
            lastError: `Failed to add documentation: ${error}`
          }
        }));
        throw error;
      }
    },

    addManualDocumentation: async (request: {
      providerId: string,
      providerName: string,
      title: string,
      content: string,
      sectionPath?: string[],
      contentType?: ContentType,
      tags?: string[]
    }) => {
      try {
        set(state => ({
          documentationLibrary: { ...state.documentationLibrary, isImporting: true, lastError: null }
        }))

        const {
          providerId,
          providerName,
          title,
          content,
          sectionPath = [],
          contentType = 'overview',
          tags = []
        } = request

        const chunkId = await DocumentationLibraryService.addManual(
          providerId, providerName, title, content, sectionPath, contentType, tags
        )

        // Reload libraries to get the updated list
        await get().loadDocumentationLibraries()

        set(state => ({
          documentationLibrary: { ...state.documentationLibrary, isImporting: false }
        }))

        return chunkId
      } catch (error) {
        console.error('Failed to add manual documentation:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isImporting: false,
            lastError: `Failed to add documentation: ${error}`
          }
        }))
        throw error
      }
    },

    searchDocumentationLibrary: async (
      query: string,
      options: { providerIds?: string[], contentTypes?: ContentType[], maxResults?: number } = {}
    ) => {
      try {
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isSearching: true,
            searchQuery: query,
            lastError: null
          }
        }))

        const results = await DocumentationLibraryService.search(query, options)

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            searchResults: results,
            isSearching: false
          }
        }))
      } catch (error) {
        console.error('Failed to search documentation library:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isSearching: false,
            lastError: `Search failed: ${error}`
          }
        }))
      }
    },

    setCurrentDocumentationLibrary: (libraryId: string | null) => {
      set(state => {
        const currentLibrary = libraryId
          ? state.documentationLibrary.libraries.find(lib => lib.id === libraryId) || null
          : null

        return {
          documentationLibrary: {
            ...state.documentationLibrary,
            currentLibraryId: libraryId,
            currentLibrary
          }
        }
      })

      // Load chunks for the new library
      if (libraryId) {
        get().loadLibraryChunks(libraryId)
      }
    },

    loadLibraryChunks: async (libraryId: string, offset: number = 0, limit: number = 50) => {
      try {
        set(state => ({
          documentationLibrary: { ...state.documentationLibrary, isLoadingChunks: true, lastError: null }
        }))

        const chunks = await DocumentationLibraryService.getLibraryChunks(libraryId, offset, limit)

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            currentChunks: offset === 0 ? chunks : [...state.documentationLibrary.currentChunks, ...chunks],
            chunksOffset: offset,
            isLoadingChunks: false
          }
        }))
      } catch (error) {
        console.error('Failed to load library chunks:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isLoadingChunks: false,
            lastError: `Failed to load chunks: ${error}`
          }
        }))
      }
    },

    updateDocumentationLibrary: async (libraryId: string, name?: string, description?: string, tags?: string[]) => {
      try {
        await DocumentationLibraryService.updateLibrary(libraryId, name, description, tags)

        // Reload libraries to get the updated data
        await get().loadDocumentationLibraries()
      } catch (error) {
        console.error('Failed to update documentation library:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            lastError: `Update failed: ${error}`
          }
        }))
      }
    },

    deleteDocumentationLibrary: async (libraryId: string) => {
      try {
        await DocumentationLibraryService.deleteLibrary(libraryId)

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            libraries: state.documentationLibrary.libraries.filter(lib => lib.id !== libraryId),
            currentLibraryId: state.documentationLibrary.currentLibraryId === libraryId ? null : state.documentationLibrary.currentLibraryId,
            currentLibrary: state.documentationLibrary.currentLibraryId === libraryId ? null : state.documentationLibrary.currentLibrary,
            currentChunks: state.documentationLibrary.currentLibraryId === libraryId ? [] : state.documentationLibrary.currentChunks
          }
        }))
      } catch (error) {
        console.error('Failed to delete documentation library:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            lastError: `Delete failed: ${error}`
          }
        }))
      }
    },

    refreshDocumentationLibrary: async (libraryId: string) => {
      try {
        await DocumentationLibraryService.refreshLibrary(libraryId)

        // Reload libraries to get the updated data
        await get().loadDocumentationLibraries()
      } catch (error) {
        console.error('Failed to refresh documentation library:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            lastError: `Refresh failed: ${error}`
          }
        }))
      }
    },

    bulkImportDocumentation: async (providerId: string, providerName: string, documents: any[]) => {
      try {
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isImporting: true,
            bulkImportProgress: 0,
            lastError: null
          }
        }))

        const libraryId = await DocumentationLibraryService.bulkImport(providerId, providerName, documents)

        // Reload libraries to get the updated list
        await get().loadDocumentationLibraries()

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isImporting: false,
            bulkImportProgress: 100
          }
        }))

        return libraryId
      } catch (error) {
        console.error('Failed to bulk import documentation:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isImporting: false,
            lastError: `Bulk import failed: ${error}`
          }
        }))
        throw error
      }
    },

    exportDocumentationLibrary: async (libraryId: string, format: 'json' | 'markdown' | 'csv' = 'json') => {
      try {
        set(state => ({
          documentationLibrary: { ...state.documentationLibrary, isExporting: true, lastError: null }
        }))

        const exportData = await DocumentationLibraryService.exportLibrary(libraryId, format)

        set(state => ({
          documentationLibrary: { ...state.documentationLibrary, isExporting: false }
        }))

        return exportData
      } catch (error) {
        console.error('Failed to export documentation library:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            isExporting: false,
            lastError: `Export failed: ${error}`
          }
        }))
        throw error
      }
    },

    validateDocumentationUrl: async (url: string) => {
      try {
        return await DocumentationLibraryService.validateUrl(url)
      } catch (error) {
        console.error('Failed to validate documentation URL:', error)
        return false
      }
    },

    setDocumentationSearchQuery: (query: string) => {
      set(state => ({
        documentationLibrary: { ...state.documentationLibrary, searchQuery: query }
      }))
    },

    setDocumentationFilters: (providers?: string[], contentTypes?: ContentType[], minSimilarity?: number) => {
      set(state => ({
        documentationLibrary: {
          ...state.documentationLibrary,
          selectedProviders: providers || state.documentationLibrary.selectedProviders,
          selectedContentTypes: contentTypes || state.documentationLibrary.selectedContentTypes,
          minSimilarity: minSimilarity ?? state.documentationLibrary.minSimilarity
        }
      }))
    },

    loadLibraryStatistics: async () => {
      try {
        const statistics = await DocumentationLibraryService.getStatistics()

        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            statistics,
            lastError: null
          }
        }))
      } catch (error) {
        console.error('Failed to load library statistics:', error)
        set(state => ({
          documentationLibrary: {
            ...state.documentationLibrary,
            lastError: `Failed to load statistics: ${error}`
          }
        }))
      }
    },

    clearDocumentationError: () => {
      set(state => ({
        documentationLibrary: { ...state.documentationLibrary, lastError: null, lastWarning: null }
      }))
    },
  }),

)
