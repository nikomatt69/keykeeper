import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Tag, Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '../../lib/store'

export default function AddApiKeyModal() {
  const { setShowAddModal, addApiKey, isLoading } = useAppStore()

  const [formData, setFormData] = useState({
    name: '',
    service: '',
    key: '',
    description: '',
    environment: 'dev' as 'dev' | 'staging' | 'production',
    rate_limit: '',
    expires_at: '',
    scopes: [] as string[],
    tags: [] as string[],
    is_active: true
  })

  const [newScope, setNewScope] = useState('')
  const [newTag, setNewTag] = useState('')
  const [keyVisible, setKeyVisible] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name && formData.service && formData.key) {
      await addApiKey({
        ...formData,
        expires_at: formData.expires_at || undefined,
        rate_limit: formData.rate_limit || undefined,
        description: formData.description || undefined
      })
    }
  }

  const addScope = () => {
    if (newScope.trim() && !formData.scopes.includes(newScope.trim())) {
      setFormData(prev => ({
        ...prev,
        scopes: [...prev.scopes, newScope.trim()]
      }))
      setNewScope('')
    }
  }

  const removeScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.filter(s => s !== scope)
    }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-native w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-heading">New API Key</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary p-2 hover-lift focus-native"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 scrollbar-native" style={{
            overflow: 'auto',
            maxHeight: 'calc(90vh - 120px)'
          }}>
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-body font-medium mb-2 block">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-native focus-native"
                  placeholder="es. Stripe Production, OpenAI Dev Key"
                />
              </div>

              <div>
                <label className="text-body font-medium mb-2 block">
                  Service *
                </label>
                <input
                  type="text"
                  required
                  value={formData.service}
                  onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                  className="input-native focus-native"
                  placeholder="es. Stripe, OpenAI, AWS, GitHub"
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-body font-medium mb-2 block">
                API Key *
              </label>
              <div className="relative">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  required
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                  className="input-native focus-native pr-12"
                  placeholder="es. sk-live-1234abcd..."
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(!keyVisible)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus-native"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-tertiary)'
                  }}
                >
                  {keyVisible ? (
                    <EyeOff className="h-5 w-5 hover:opacity-70" />
                  ) : (
                    <Eye className="h-5 w-5 hover:opacity-70" />
                  )}
                </button>
              </div>
            </div>

            {/* Environment */}
            <div>
              <label className="text-body font-medium mb-2 block">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
                className="input-native focus-native"
              >
                <option value="dev">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-body font-medium mb-2 block">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-native focus-native resize-none"
                rows={3}
                placeholder="es. Chiave per ambiente di produzione, accesso limitato ai pagamenti"
              />
            </div>

            {/* Rate Limit & Expiry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-body font-medium mb-2 block">
                  Rate Limit
                </label>
                <input
                  type="text"
                  value={formData.rate_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, rate_limit: e.target.value }))}
                  className="input-native focus-native"
                  placeholder="es. 1000 req/min, unlimited"
                />
              </div>

              <div>
                <label className="text-body font-medium mb-2 block">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="input-native focus-native"
                />
              </div>
            </div>

            {/* Scopes */}
            <div>
              <label className="text-body font-medium mb-2 block">
                Scopes
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addScope())}
                    className="input-native focus-native flex-1"
                    placeholder="es. read, write, admin, payments"
                  />
                  <button
                    type="button"
                    onClick={addScope}
                    className="btn-primary px-4 py-2 hover-lift focus-native"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {formData.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.scopes.map((scope, index) => (
                      <span
                        key={index}
                        className="tag-native flex items-center space-x-1"
                        style={{
                          background: 'rgba(0, 122, 255, 0.1)',
                          color: 'var(--color-accent)',
                          border: '1px solid rgba(0, 122, 255, 0.2)'
                        }}
                      >
                        <span>{scope}</span>
                        <button
                          type="button"
                          onClick={() => removeScope(scope)}
                          className="hover:opacity-70 focus-native"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            padding: '0',
                            margin: '0'
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-body font-medium mb-2 block">
                Tags
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="input-native focus-native flex-1"
                    placeholder="es. production, urgent, billing"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="btn-secondary px-4 py-2 hover-lift focus-native"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(0, 122, 255, 0.1)',
                      color: 'var(--color-accent)',
                      border: '1px solid rgba(0, 122, 255, 0.2)'
                    }}
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="tag-native flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:opacity-70 focus-native"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            padding: '0',
                            margin: '0'
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-body font-medium">Chiave attiva</h3>
                <p className="text-caption">La chiave è attualmente utilizzabile</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className={`toggle-native ${formData.is_active ? 'active' : ''}`}></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-secondary flex-1 py-2 hover-lift focus-native"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name || !formData.service || !formData.key}
                className="btn-primary flex-1 py-2 hover-lift focus-native"
                style={{
                  borderRadius: 'var(--radius-md)',
                  opacity: (isLoading || !formData.name || !formData.service || !formData.key) ? '0.5' : '1',
                  cursor: (isLoading || !formData.name || !formData.service || !formData.key) ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? 'Salvataggio...' : 'Salva API Key'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}