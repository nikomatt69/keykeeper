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

export default function Sidebar() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    setShowAddModal,
    lockVault,
    exportVault,
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

  return (
    <div className="h-full flex flex-col sidebar-native">
      {/* Header */}
      <div className="p-6 border-subtle">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-3"
            >
              <img src="/assets/icon.png" alt="KeyKeeper" className="h-14 w-14 glass-card flex items-center justify-center" style={{

                borderRadius: 'var(--radius-md)'
              }} />
              <div>
                <img src="/assets/logo.png" alt="KeyKeeper" className="h-10 " />
                <p className="text-caption text-contrast-medium">
                  {apiKeys.length} API keys
                </p>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn-secondary p-2 hover-lift focus-native"
            style={{
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5 text-contrast-medium" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-contrast-medium" />
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4 border-subtle">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-contrast-low"
            />
            <input
              type="text"
              placeholder="Search API keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-native focus-native w-full"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-2 scrollbar-native overflow-auto">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className={`btn-primary hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center space-x-3 p-3'
            }`}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            fontWeight: '500'
          }}
        >
          <Plus className="h-5 w-5" />
          {!sidebarCollapsed && <span>New API Key</span>}
        </motion.button>

        {!sidebarCollapsed && (
          <div className="space-y-1 pt-4">
            <div className="flex items-center space-x-2 px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Key className="h-4 w-4" />
              <span className="text-body font-medium">My API Keys</span>
            </div>

            <div className="space-y-1 ml-6">
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

      {/* Footer Actions */}
      <div className="p-4 space-y-2" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <button
          onClick={handleExport}
          disabled={isLoading}
          className={`btn-secondary hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center space-x-3 p-3'
            }`}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            opacity: isLoading ? '0.5' : '1'
          }}
        >
          <Download className="h-4 w-4" />
          {!sidebarCollapsed && <span className="text-body">Export Vault</span>}
        </button>

        {!sidebarCollapsed && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary hover-lift focus-native flex items-center space-x-3 p-3"
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <Settings className="h-4 w-4" />
            <span className="text-body">Settings</span>
          </button>
        )}

        {/* Theme Toggle */}
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-body text-contrast-medium">Theme</span>
            <ThemeToggle />
          </div>
        )}

        <button
          onClick={lockVault}
          className={`hover-lift focus-native ${sidebarCollapsed ? 'flex justify-center p-3' : 'flex items-center space-x-3 p-3'
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
          <Lock className="h-4 w-4" />
          {!sidebarCollapsed && <span className="text-body">Lock Vault</span>}
        </button>
      </div>
    </div>
  )
}