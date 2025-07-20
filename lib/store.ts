import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { EnterpriseSettings } from './types'
import type { VSCodeWorkspace } from './tauri-api'
import { integrationService } from './services/integrationService'
import { initializeNativeStorage } from './services/nativeStorageService'

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

interface AppState {
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
  setShowProjectModal: (show: boolean) => void
  setShowAssignKeysModal: (show: boolean) => void
  calculateProjectStats: (projectId: string) => Promise<void>

  // VSCode Workspace Actions
  loadVSCodeWorkspaces: () => Promise<void>
  updateVSCodeWorkspaces: (workspaces: string[]) => Promise<void>
  getProjectVSCodeStatus: (projectPath: string) => Promise<string>
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

    setShowAssignKeysModal: (show: boolean) => {
      set({ showAssignKeysModal: show })
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
        console.log('🚀 Initializing app state...')
        set({ isLoading: true, error: null })

        // Check if backend has master password set
        const hasMasterPassword = await invoke<boolean>('is_master_password_set')
        console.log('🔑 Backend master password status:', hasMasterPassword)

        // Sync frontend state with backend
        set({ hasMasterPassword })

        console.log('✅ App initialization complete')
      } catch (error) {
        console.error('❌ Failed to initialize app:', error)
        set({ error: error as string })
      } finally {
        set({ isLoading: false })
      }
    }
  }),

)
