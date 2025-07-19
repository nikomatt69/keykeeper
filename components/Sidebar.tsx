import { motion } from 'framer-motion'
import {
  Key,
  Plus,
  Search,
  Lock,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '../lib/store'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import ThemeToggle from './ThemeToggle'
import DragDropZone from './DragDropZone'
import { useEffect } from 'react'

export default function Sidebar() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    setShowAddModal,
    lockVault,
    exportVault,
    loadApiKeys,
    searchQuery,
    setSearchQuery,
    apiKeys,
    isLoading,
    setShowSettingsModal
  } = useAppStore()

  const handleExport = async () => {
    try {
      const exportData = await exportVault()
      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      })

      if (filePath) {
        await writeTextFile(filePath, exportData)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }
  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])
  return (
    <div className="flex flex-col h-full sidebar-native">
      {/* Header */}
      <div className="p-6 border-subtle">
        <div className="flex justify-between items-center">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-3"
            >
              <img src="/assets/icon.png" alt="KeyKeeper" className="flex justify-center items-center w-14 h-14 glass-card" style={{

                borderRadius: 'var(--radius-md)'
              }} />
              <div>
                <img src="/assets/logo.png" alt="KeyKeeper" className="h-10" />
                <p className="text-caption text-contrast-medium">
                  {apiKeys.length} API keys
                </p>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 btn-secondary hover-lift focus-native"
            style={{
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-contrast-medium" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-contrast-medium" />
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4 border-subtle">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 w-4 h-4 transform -translate-y-1/2 text-contrast-low"
            />
            <input
              type="text"
              placeholder="Search API keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full search-native focus-native"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="overflow-auto flex-1 p-4 space-y-2 scrollbar-native">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className={`btn-primary hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center p-3 space-x-3'
            }`}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            fontWeight: '500'
          }}
        >
          <Plus className="w-5 h-5" />
          {!sidebarCollapsed && <span>New API Key</span>}
        </motion.button>

        {!sidebarCollapsed && (
          <div className="pt-4 space-y-1">
            <div className="flex items-center px-3 py-2 space-x-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Key className="w-4 h-4" />
              <span className="font-medium text-body">My API Keys</span>
            </div>

            <div className="ml-6 space-y-1">
              <div className="flex justify-between items-center px-3 py-1">
                <span className="text-caption">Production</span>
                <span className="tag-native badge-production" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {apiKeys.filter(k => k.environment === 'production').length}
                </span>
              </div>
              <div className="flex justify-between items-center px-3 py-1">
                <span className="text-caption">Staging</span>
                <span className="tag-native badge-staging" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {apiKeys.filter(k => k.environment === 'staging').length}
                </span>
              </div>
              <div className="flex justify-between items-center px-3 py-1">
                <span className="text-caption">Development</span>
                <span className="tag-native badge-dev" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {apiKeys.filter(k => k.environment === 'dev').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      {!sidebarCollapsed &&
        <div className="p-2 border-t h-max-[70vh] border-gray-200 dark:border-gray-700">
          <DragDropZone
            onFileImport={(filePath, projectPath) => {
              console.log('File imported:', filePath, 'Project:', projectPath);
              // Refresh the keys list after import
              loadApiKeys();
            }}
          />
        </div>
      }

      {/* Footer Actions */}
      <div className="p-4 space-y-2" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <button
          onClick={handleExport}
          disabled={isLoading}
          className={`btn-secondary hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center p-3 space-x-3'
            }`}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            opacity: isLoading ? '0.5' : '1'
          }}
        >
          <Download className="w-4 h-4" />
          {!sidebarCollapsed && <span className="text-body">Export Vault</span>}
        </button>

        {!sidebarCollapsed && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center p-3 space-x-3 btn-secondary hover-lift focus-native"
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <Settings className="w-4 h-4" />
            <span className="text-body">Settings</span>
          </button>
        )}

        {/* Theme Toggle */}
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-body text-contrast-medium">Theme</span>
            <ThemeToggle />
          </div>
        )}

        <button
          onClick={lockVault}
          className={`hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center p-3 space-x-3'
            }`}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 59, 48, 0.1)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(255, 59, 48, 0.2)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Lock className="w-4 h-4" />
          {!sidebarCollapsed && <span className="text-body">Lock Vault</span>}
        </button>
      </div>
    </div>
  )
}