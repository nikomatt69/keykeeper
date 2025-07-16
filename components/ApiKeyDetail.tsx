import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Edit3,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Calendar,
  Globe,
  Tag,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText
} from 'lucide-react'
import { useAppStore } from '../lib/store'
import ProjectPathDisplay from './ProjectPathDisplay'

export default function ApiKeyDetail() {
  const {
    selectedKey,
    setSelectedKey,
    setShowEditModal,
    setShowDeleteModal,
    getProjectVSCodeStatus
  } = useAppStore()

  const [keyVisible, setKeyVisible] = useState(false)
  const [vscodeStatus, setVscodeStatus] = useState<string>('unknown')

  // Carica lo stato VSCode per la chiave selezionata
  useEffect(() => {
    const loadVSCodeStatus = async () => {
      if (selectedKey?.source_type === 'env_file' && selectedKey?.project_path) {
        try {
          const status = await getProjectVSCodeStatus(selectedKey.project_path)
          setVscodeStatus(status)
        } catch (error) {
          console.error('Error getting VSCode status:', error)
          setVscodeStatus('unknown')
        }
      }
    }

    loadVSCodeStatus()
  }, [selectedKey, getProjectVSCodeStatus])

  if (!selectedKey) return null

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Toast notification could go here
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
    return key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.slice(-4)
  }


  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-title mb-1">
              {selectedKey.name}
            </h2>
            <p className="text-subheading">{selectedKey.service}</p>

            <div className="flex items-center space-x-3 mt-3">
              <span className={`tag-native ${getEnvironmentColor(selectedKey.environment)}`}>
                {selectedKey.environment.toUpperCase()}
              </span>

              <div className="flex items-center space-x-1 text-body">
                {selectedKey.is_active ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                    <span>Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditModal(true)}
              className="btn-secondary p-2 hover-lift focus-native"
              style={{
                background: 'rgba(0, 122, 255, 0.1)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(0, 122, 255, 0.2)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Edit3 className="h-4 w-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeleteModal(true)}
              className="btn-secondary p-2 hover-lift focus-native"
              style={{
                background: 'rgba(255, 59, 48, 0.1)',
                color: 'var(--color-danger)',
                border: '1px solid rgba(255, 59, 48, 0.2)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedKey(null)}
              className="btn-secondary p-2 hover-lift focus-native"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 scrollbar-native" style={{ overflow: 'auto' }}>
        {/* API Key */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-heading flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>API Key</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(selectedKey.key)}
                className="btn-secondary p-2 hover-lift focus-native"
                style={{
                  minWidth: '32px',
                  minHeight: '32px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => setKeyVisible(!keyVisible)}
                className="btn-secondary p-2 hover-lift focus-native"
                style={{
                  minWidth: '32px',
                  minHeight: '32px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div
            className="glass-effect p-3"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0, 0, 0, 0.08)'
            }}
          >
            <code
              className="text-body"
              style={{
                fontFamily: 'Monaco, "Courier New", monospace',
                wordBreak: 'break-all',
                fontSize: '13px'
              }}
            >
              {formatKey(selectedKey.key, keyVisible)}
            </code>
          </div>
        </div>

        {/* Description */}
        {selectedKey.description && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3">Description</h3>
            <p className="text-body leading-relaxed">{selectedKey.description}</p>
          </div>
        )}

        {/* Source Information (for env_file keys) */}
        {selectedKey.source_type === 'env_file' && selectedKey.project_path && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3 flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Source Information</span>
            </h3>
            <div className="space-y-4">
              <ProjectPathDisplay
                envFilePath={selectedKey.env_file_path || ''}
                projectPath={selectedKey.project_path}
                fileName={selectedKey.env_file_name || '.env'}
                vscodeStatus={vscodeStatus}
                showActions={true}
                className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Expiry Information */}
        {selectedKey.expires_at && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Expiration</span>
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-subheading">Expiration Date</span>
                <span className="text-body font-medium">
                  {new Date(selectedKey.expires_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              {(() => {
                const days = getDaysUntilExpiry(selectedKey.expires_at)
                if (days === null) return null

                if (days < 0) {
                  return (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-danger)' }}>
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-body font-medium">Expired {Math.abs(days)} days ago</span>
                    </div>
                  )
                } else if (days <= 30) {
                  return (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-warning)' }}>
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-body font-medium">Expires in {days} days</span>
                    </div>
                  )
                } else {
                  return (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-success)' }}>
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-body font-medium">Expires in {days} days</span>
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        )}

        {/* Rate Limiting */}
        {selectedKey.rate_limit && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3 flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Rate Limiting</span>
            </h3>
            <p className="text-body">{selectedKey.rate_limit}</p>
          </div>
        )}

        {/* Scopes */}
        {selectedKey.scopes.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3">Scopes</h3>
            <div className="flex flex-wrap gap-2">
              {selectedKey.scopes.map((scope, index) => (
                <span
                  key={index}
                  className="tag-native"
                  style={{
                    background: 'rgba(0, 122, 255, 0.1)',
                    color: 'var(--color-accent)',
                    border: '1px solid rgba(0, 122, 255, 0.2)'
                  }}
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {selectedKey.tags.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-heading mb-3 flex items-center space-x-2">
              <Tag className="h-4 w-4" />
              <span>Tags</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedKey.tags.map((tag, index) => (
                <span
                  key={index}
                  className="tag-native"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="glass-card p-4">
          <h3 className="text-heading mb-3 flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Information</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-subheading">Created at</span>
              <span className="text-body font-medium">
                {new Date(selectedKey.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-subheading">Last modified</span>
              <span className="text-body font-medium">
                {new Date(selectedKey.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-subheading">ID</span>
              <code
                className="text-body"
                style={{
                  fontFamily: 'Monaco, "Courier New", monospace',
                  background: 'var(--color-surface)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px'
                }}
              >
                {selectedKey.id}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}