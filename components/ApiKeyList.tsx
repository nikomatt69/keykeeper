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
  FileText
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../lib/store'
import type { ApiKey } from '../lib/store'
import VSCodeStatusIndicator from './VSCodeStatusIndicator'

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
      case 'dev':
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-native mx-auto mb-4"></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading API keys...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-heading">
              {searchQuery ? 'Search results' : 'API Keys'}
            </h2>
            <p className="text-caption mt-1">
              {filteredKeys.length} {filteredKeys.length === 1 ? 'key' : 'keys'}
              {searchQuery && ` for "${searchQuery}"`}
            </p>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="flex-1 scrollbar-native" style={{ overflow: 'auto' }}>
        {filteredKeys.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <Key className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <h3 className="text-heading mb-2">
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-body font-semibold truncate">
                          {apiKey.name}
                        </h3>
                        <p className="text-caption truncate">
                          {apiKey.service}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 ml-3">
                        {(isExpired(apiKey.expires_at) || isExpiringSoon(apiKey.expires_at)) && (
                          <AlertCircle
                            className="h-4 w-4"
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
                      <div className="flex items-center justify-between">
                        <span className="text-caption font-medium">API Key</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => copyToClipboard(apiKey.key, e)}
                            className="btn-secondary p-1 hover-lift focus-native"
                            style={{
                              minWidth: '28px',
                              minHeight: '28px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => toggleKeyVisibility(apiKey.id, e)}
                            className="btn-secondary p-1 hover-lift focus-native"
                            style={{
                              minWidth: '28px',
                              minHeight: '28px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {visibleKeys.has(apiKey.id) ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
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
                    <div className="flex items-center justify-between text-caption">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(apiKey.created_at).toLocaleDateString('en-US')}
                        </span>
                      </div>

                      {apiKey.tags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
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
                      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-caption font-medium">Source Project</span>
                          <VSCodeStatusIndicator
                            status={vscodeStatuses[apiKey.id] as 'open' | 'closed' | 'unknown' || 'unknown'}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Folder className="h-3 w-3 text-gray-400" />
                          <span className="text-caption truncate">
                            {apiKey.project_path.split('/').pop() || 'Unknown Project'}
                          </span>
                        </div>
                        {apiKey.env_file_name && (
                          <div className="flex items-center space-x-2">
                            <FileText className="h-3 w-3 text-gray-400" />
                            <span className="text-caption truncate">
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
    </div>
  )
}