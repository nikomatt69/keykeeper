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
  FileText,
  Unlock
} from 'lucide-react'
import { useAppStore } from '../lib/store'
import ProjectPathDisplay from './ProjectPathDisplay'
import { TauriAPI } from '../lib/tauri-api'
import { nativeStorageService } from '../lib/services/nativeStorageService'

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
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [showDecryptModal, setShowDecryptModal] = useState(false)
  const [masterPassword, setMasterPassword] = useState('')

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

  const decryptApiKey = () => {
    if (!selectedKey) return
    setShowDecryptModal(true)
  }

  const handleDecryptSubmit = async () => {
    if (!masterPassword.trim()) return

    setIsDecrypting(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const decrypted = await invoke<string>('get_decrypted_api_key', {
        keyId: selectedKey!.id,
        masterPassword
      })

      setDecryptedKey(decrypted)
      setShowDecryptModal(false)
      setMasterPassword('')
    } catch (error) {
      console.error('Failed to decrypt API key:', error)
      alert('Failed to decrypt API key. Please check your master password.')
    } finally {
      setIsDecrypting(false)
    }
  }

  const closeDecryptModal = () => {
    setShowDecryptModal(false)
    setMasterPassword('')
    setIsDecrypting(false)
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

  const formatKey = (key?: string, isVisible?: boolean) => {
    // Se abbiamo la chiave decriptata, usala invece della chiave criptata
    const keyToShow = decryptedKey || key

    if (isVisible) return keyToShow
    return keyToShow?.slice(0, 8) + '•'.repeat(Math.max(0, keyToShow?.length || - 12)) + keyToShow?.slice(-4)
  }


  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h2 className="mb-1 text-title">
              {selectedKey.name}
            </h2>
            <p className="text-subheading">{selectedKey.service}</p>

            <div className="flex items-center mt-3 space-x-3">
              <span className={`tag-native ${getEnvironmentColor(selectedKey.environment)}`}>
                {selectedKey.environment.toUpperCase()}
              </span>

              <div className="flex items-center space-x-1 text-body">
                {selectedKey.is_active ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                    <span>Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center ml-4 space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditModal(true)}
              className="p-2 btn-secondary hover-lift focus-native"
              style={{
                background: 'rgba(0, 122, 255, 0.1)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(0, 122, 255, 0.2)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Edit3 className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeleteModal(true)}
              className="p-2 btn-secondary hover-lift focus-native"
              style={{
                background: 'rgba(255, 59, 48, 0.1)',
                color: 'var(--color-danger)',
                border: '1px solid rgba(255, 59, 48, 0.2)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedKey(null)}
              className="p-2 btn-secondary hover-lift focus-native"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 scrollbar-native" style={{ overflow: 'auto' }}>
        {/* API Key */}
        <div className="p-4 glass-card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="flex items-center space-x-2 text-heading">
              <Shield className="w-4 h-4" />
              <span>API Key</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(decryptedKey || selectedKey.key)}
                className="p-2 btn-secondary hover-lift focus-native"
                style={{
                  minWidth: '32px',
                  minHeight: '32px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setKeyVisible(!keyVisible)}
                className="p-2 btn-secondary hover-lift focus-native"
                style={{
                  minWidth: '32px',
                  minHeight: '32px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {selectedKey.key === '[ENCRYPTED]' && (
                <button
                  onClick={decryptApiKey}
                  disabled={isDecrypting}
                  className="p-2 btn-secondary hover-lift focus-native"
                  style={{
                    minWidth: '32px',
                    minHeight: '32px',
                    borderRadius: 'var(--radius-md)',
                    background: decryptedKey ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 165, 0, 0.1)',
                    color: decryptedKey ? 'var(--color-success)' : 'var(--color-warning)',
                    border: decryptedKey ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255, 165, 0, 0.2)',
                    opacity: isDecrypting ? 0.5 : 1
                  }}
                  title={decryptedKey ? 'Key decrypted' : isDecrypting ? 'Decrypting...' : 'Decrypt API key'}
                >
                  {isDecrypting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-current animate-spin border-t-transparent" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div
            className="p-3 glass-effect"
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
          <div className="p-4 glass-card">
            <h3 className="mb-3 text-heading">Description</h3>
            <p className="leading-relaxed text-body">{selectedKey.description}</p>
          </div>
        )}

        {/* Source Information (for env_file keys) */}
        {selectedKey.source_type === 'env_file' && selectedKey.project_path && (
          <div className="p-4 glass-card">
            <h3 className="flex items-center mb-3 space-x-2 text-heading">
              <FileText className="w-4 h-4" />
              <span>Source Information</span>
            </h3>
            <div className="space-y-4">
              <ProjectPathDisplay
                envFilePath={selectedKey.env_file_path || ''}
                projectPath={selectedKey.project_path}
                fileName={selectedKey.env_file_name || '.env'}
                vscodeStatus={vscodeStatus}
                showActions={true}
                className="p-3 bg-gray-50 rounded-lg dark:bg-gray-800"
              />
            </div>
          </div>
        )}

        {/* Expiry Information */}
        {selectedKey.expires_at && (
          <div className="p-4 glass-card">
            <h3 className="flex items-center mb-3 space-x-2 text-heading">
              <Clock className="w-4 h-4" />
              <span>Expiration</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-subheading">Expiration Date</span>
                <span className="font-medium text-body">
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
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium text-body">Expired {Math.abs(days)} days ago</span>
                    </div>
                  )
                } else if (days <= 30) {
                  return (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-warning)' }}>
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium text-body">Expires in {days} days</span>
                    </div>
                  )
                } else {
                  return (
                    <div className="flex items-center space-x-2" style={{ color: 'var(--color-success)' }}>
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium text-body">Expires in {days} days</span>
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        )}

        {/* Rate Limiting */}
        {selectedKey.rate_limit && (
          <div className="p-4 glass-card">
            <h3 className="flex items-center mb-3 space-x-2 text-heading">
              <Globe className="w-4 h-4" />
              <span>Rate Limiting</span>
            </h3>
            <p className="text-body">{selectedKey.rate_limit}</p>
          </div>
        )}

        {/* Scopes */}
        {selectedKey.scopes.length > 0 && (
          <div className="p-4 glass-card">
            <h3 className="mb-3 text-heading">Scopes</h3>
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
          <div className="p-4 glass-card">
            <h3 className="flex items-center mb-3 space-x-2 text-heading">
              <Tag className="w-4 h-4" />
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
        <div className="p-4 glass-card">
          <h3 className="flex items-center mb-3 space-x-2 text-heading">
            <Calendar className="w-4 h-4" />
            <span>Information</span>
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-subheading">Created at</span>
              <span className="font-medium text-body">
                {new Date(selectedKey.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-subheading">Last modified</span>
              <span className="font-medium text-body">
                {new Date(selectedKey.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex justify-between items-center">
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

      {/* Master Password Modal */}
      {showDecryptModal && (
        <div className="flex fixed inset-0 z-50 justify-center items-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mx-4 w-full max-w-md rounded-lg shadow-2xl"
            style={{
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div className="p-6">
              <h2 className="flex items-center mb-4 space-x-2" style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                <Unlock className="w-5 h-5" style={{ color: '#3b82f6' }} />
                <span>Decrypt API Key</span>
              </h2>

              <p className="mb-4" style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Enter your master password to decrypt the API key for <strong style={{ color: '#1f2937' }}>{selectedKey?.name}</strong>.
              </p>

              <div className="mb-6">
                <label className="block mb-2" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Master Password</label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDecryptSubmit()}
                  placeholder="Enter your master password"
                  className="px-3 py-3 w-full rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    color: '#1f2937',
                    fontSize: '14px'
                  }}
                  disabled={isDecrypting}
                  autoFocus
                />
              </div>

              <div className="flex items-center space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDecryptSubmit}
                  disabled={!masterPassword.trim() || isDecrypting}
                  className="flex-1"
                  style={{
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: (!masterPassword.trim() || isDecrypting) ? 'not-allowed' : 'pointer',
                    opacity: (!masterPassword.trim() || isDecrypting) ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  {isDecrypting ? (
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white animate-spin border-t-transparent" />
                      <span>Decrypting...</span>
                    </div>
                  ) : (
                    'Decrypt'
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeDecryptModal}
                  disabled={isDecrypting}
                  style={{
                    background: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isDecrypting ? 'not-allowed' : 'pointer',
                    opacity: isDecrypting ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}