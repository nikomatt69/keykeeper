import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import type { EnterpriseSettings } from './types'
import type { VSCodeWorkspace } from './tauri-api'
import { integrationService } from './services/integrationService'

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
  // Auth state
  isUnlocked: boolean
  isLoading: boolean
  error: string | null
  isUserLoggedIn: boolean
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

  // Actions
  setIsUnlocked: (unlocked: boolean) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setIsUserLoggedIn: (loggedIn: boolean) => void
  setHasMasterPassword: (has: boolean) => void
  loginUser: (email: string, password: string) => Promise<boolean>
  registerUser: (email: string, password: string) => Promise<boolean>
  setApiKeys: (keys: ApiKey[]) => void
  setSelectedKey: (key: ApiKey | null) => void
  setSearchQuery: (query: string) => void
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

  // VSCode Workspace Actions
  loadVSCodeWorkspaces: () => Promise<void>
  updateVSCodeWorkspaces: (workspaces: string[]) => Promise<void>
  getProjectVSCodeStatus: (projectPath: string) => Promise<string>
}

export const useAppStore = create<AppState>()(persist(
  (set, get) => ({
    // Initial state - vault is always locked on app start for security
    isUnlocked: false,
    isLoading: false,
    error: null,
    isUserLoggedIn: false,
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

    // Simple setters
    setIsUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setIsUserLoggedIn: (loggedIn) => set({ isUserLoggedIn: loggedIn }),
    setHasMasterPassword: (has) => set({ hasMasterPassword: has }),
    setApiKeys: (keys) => set({ apiKeys: keys, filteredKeys: keys }),
    setSelectedKey: (key) => set({ selectedKey: key }),
    setSearchQuery: (query) => {
      set({ searchQuery: query })
      const { apiKeys } = get()
      if (query.trim() === '') {
        set({ filteredKeys: apiKeys })
      } else {
        const filtered = apiKeys.filter(key =>
          key.name.toLowerCase().includes(query.toLowerCase()) ||
          key.service.toLowerCase().includes(query.toLowerCase()) ||
          key.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        )
        set({ filteredKeys: filtered })
      }
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
        const success = await invoke<boolean>('unlock_vault', { password })
        set({ isUnlocked: success })
        if (success) {
          await get().loadApiKeys()

          // Initialize integration service with current settings
          try {
            const { settings } = get()
            await integrationService.initialize(settings)
          } catch (error) {
            console.error('Failed to initialize integration service:', error)
            // Don't fail the unlock process if integration service fails
          }
        }
        return success
      } catch (error) {
        set({ error: error as string })
        return false
      } finally {
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
          searchQuery: ''
        })
      } catch (error) {
        set({ error: error as string })
      }
    },

    loadApiKeys: async () => {
      try {
        set({ isLoading: true, error: null })
        const keys = await invoke<ApiKey[]>('get_api_keys')
        set({ apiKeys: keys, filteredKeys: keys })
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

    loginUser: async (email: string, password: string) => {
      try {
        set({ isLoading: true, error: null })
        const success = await invoke<boolean>('authenticate_user', { email, password })
        set({ isUserLoggedIn: success })
        return success
      } catch (error) {
        set({ error: error as string })
        return false
      } finally {
        set({ isLoading: false })
      }
    },

    registerUser: async (email: string, password: string) => {
      try {
        set({ isLoading: true, error: null })
        const userId = await invoke<string>('create_user_account', { email, password })
        set({ isUserLoggedIn: true })
        return true
      } catch (error) {
        set({ error: error as string })
        return false
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
    }
  }),
  {
    name: 'keykeeper-store',
    partialize: (state) => ({
      // Persist user session and preferences
      isUserLoggedIn: state?.isUserLoggedIn,
      hasMasterPassword: state?.hasMasterPassword,
      sidebarCollapsed: state.sidebarCollapsed,
      settings: state.settings,
      // Don't persist sensitive data like API keys, vault unlock state, or temporary UI state
    }),

    // Optional: Add version for migration support
    version: 1,
  }
))