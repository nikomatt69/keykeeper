import { motion, AnimatePresence } from 'framer-motion'
import {
  Key,
  Calendar,
  Tag,
  MoreHorizontal,
  Eye,
  EyeOff,
  Copy,
  AlertCircle,
  Folder,
  FileText,
  BookOpen
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../lib/store'
import type { ApiKey } from '../lib/store'
import VSCodeStatusIndicator from './VSCodeStatusIndicator'
import DocumentationModal from './modals/DocumentationModal'

export default function ApiKeyList() {
  const {
    filteredKeys,
    selectedKey,
    setSelectedKey,
    isLoading,
    searchQuery,
    getProjectVSCodeStatus
  } = useAppStore()

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [vscodeStatuses, setVscodeStatuses] = useState<Record<string, string>>({})
  const [showDocumentationModal, setShowDocumentationModal] = useState(false)

  // Carica gli stati VSCode per le chiavi importate da .env
  useEffect(() => {
    const loadVSCodeStatuses = async () => {
      const statuses: Record<string, string> = {}

      for (const key of filteredKeys) {
        if (key.source_type === 'env_file' && key.project_path) {
          try {
            const status = await getProjectVSCodeStatus(key.project_path)
            statuses[key.id] = status
          } catch (error) {
            console.error('Error getting VSCode status:', error)
            statuses[key.id] = 'unknown'
          }
        }
      }

      setVscodeStatuses(statuses)
    }

    if (filteredKeys.length > 0) {
      loadVSCodeStatuses()
    }
  }, [filteredKeys, getProjectVSCodeStatus])

  const toggleKeyVisibility = (keyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId)
    } else {
      newVisible.add(keyId)
    }
    setVisibleKeys(newVisible)
  }

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production':
        return 'badge-production'
      case 'staging':
        return 'badge-staging'
      case 'development':
        return 'badge-dev'
      default:
        return 'tag-native'
    }
  }

  const formatKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key
    // Show a fixed number of dots, e.g., 16
    return '•'.repeat(16)
  }

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center">
          <div className="mx-auto mb-4 spinner-native"></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading API keys...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-heading">
              {searchQuery ? 'Search results' : 'API Keys'}
            </h2>
            <p className="mt-1 text-caption">
              {filteredKeys.length} {filteredKeys.length === 1 ? 'key' : 'keys'}
              {searchQuery && ` for "${searchQuery}"`}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDocumentationModal(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Add Documentation"
            >
              <BookOpen className="w-4 h-4" />
              <span>Add Docs</span>
            </button>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="flex-1 scrollbar-native" style={{ overflow: 'auto' }}>
        {filteredKeys.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="max-w-sm text-center">
              <Key className="mx-auto mb-4 w-12 h-12" style={{ color: 'var(--color-text-tertiary)' }} />
              <h3 className="mb-2 text-heading">
                {searchQuery ? 'No results' : 'No API key'}
              </h3>
              <p className="text-caption">
                {searchQuery
                  ? 'Try modifying the search terms'
                  : 'Start by adding your first API key'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <AnimatePresence>
              {filteredKeys.map((apiKey, index) => (
                <motion.div
                  key={apiKey.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedKey(apiKey)}
                  className={`list-item-native hover-lift focus-native ${selectedKey?.id === apiKey.id ? 'selected' : ''
                    }`}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-body">
                          {apiKey.name}
                        </h3>
                        <p className="truncate text-caption">
                          {apiKey.service}
                        </p>
                      </div>

                      <div className="flex items-center ml-3 space-x-2">
                        {(isExpired(apiKey.expires_at) || isExpiringSoon(apiKey.expires_at)) && (
                          <AlertCircle
                            className="w-4 h-4"
                            style={{
                              color: isExpired(apiKey.expires_at) ? 'var(--color-danger)' : 'var(--color-warning)'
                            }}
                          />
                        )}

                        <span className={`tag-native ${getEnvironmentColor(apiKey.environment)}`}>
                          {apiKey.environment}
                        </span>
                      </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-caption">API Key</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => copyToClipboard(apiKey.key, e)}
                            className="flex justify-center items-center p-1 btn-secondary hover-lift focus-native"
                            style={{
                              minWidth: '28px',
                              minHeight: '28px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <Copy className="flex-shrink-0 w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => toggleKeyVisibility(apiKey.id, e)}
                            className="flex justify-center items-center p-1 btn-secondary hover-lift focus-native"
                            style={{
                              minWidth: '28px',
                              minHeight: '28px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {visibleKeys.has(apiKey.id) ? (
                              <EyeOff className="flex-shrink-0 w-3 h-3" />
                            ) : (
                              <Eye className="flex-shrink-0 w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-body" style={{
                        fontFamily: 'Monaco, "Courier New", monospace',
                        background: 'var(--color-surface)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        wordBreak: 'break-all',
                        fontSize: '13px',
                        whiteSpace: 'pre-wrap', // allow wrapping
                        overflowWrap: 'break-word', // extra safety
                        maxWidth: '100%', // never overflow
                      }}>
                        {formatKey(apiKey.key, visibleKeys.has(apiKey.id))}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between items-center text-caption">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(apiKey.created_at).toLocaleDateString('en-US')}
                        </span>
                      </div>

                      {apiKey.tags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Tag className="w-3 h-3" />
                          <span>{apiKey.tags.length} tags</span>
                        </div>
                      )}
                    </div>

                    {/* Description Preview */}
                    {apiKey.description && (
                      <p
                        className="text-caption"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {apiKey.description}
                      </p>
                    )}

                    {/* Informazioni path .env */}
                    {apiKey.source_type === 'env_file' && apiKey.project_path && (
                      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-caption">Source Project</span>
                          <VSCodeStatusIndicator
                            status={vscodeStatuses[apiKey.id] as 'open' | 'closed' | 'unknown' || 'unknown'}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Folder className="w-3 h-3 text-gray-400" />
                          <span className="truncate text-caption">
                            {apiKey.project_path.split('/').pop() || 'Unknown Project'}
                          </span>
                        </div>
                        {apiKey.env_file_name && (
                          <div className="flex items-center space-x-2">
                            <FileText className="w-3 h-3 text-gray-400" />
                            <span className="truncate text-caption">
                              {apiKey.env_file_name}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {/* Documentation Modal */}
      <DocumentationModal
        isOpen={showDocumentationModal}
        onClose={() => setShowDocumentationModal(false)}
      />
    </div>
  )
}