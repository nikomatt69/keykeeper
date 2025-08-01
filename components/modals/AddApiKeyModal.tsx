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
    environment: 'development' as 'development' | 'staging' | 'production',
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
      <div className="flex fixed inset-0 z-50 justify-center items-center p-4 modal-backdrop">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-native w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-moderate">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-contrast-high">New API Key</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-contrast-medium rounded-lg transition-colors hover:text-contrast-high hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-auto p-6 space-y-6" style={{
            maxHeight: 'calc(90vh - 120px)'
          }}>
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-contrast-medium">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-native"
                  placeholder="es. Stripe Production, OpenAI Dev Key"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-contrast-medium">
                  Service *
                </label>
                <input
                  type="text"
                  required
                  value={formData.service}
                  onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                  className="input-native"
                  placeholder="es. Stripe, OpenAI, AWS, GitHub"
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block mb-2 text-sm font-medium text-contrast-medium">
                API Key *
              </label>
              <div className="relative">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  required
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                  className="input-native pr-12 font-mono"
                  placeholder="es. sk-live-1234abcd..."
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(!keyVisible)}
                  className="flex absolute inset-y-0 right-0 items-center pr-3 text-contrast-medium hover:text-contrast-high focus:outline-none"
                >
                  {keyVisible ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Environment */}
            <div>
              <label className="block mb-2 text-sm font-medium text-contrast-medium">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
                className="input-native"
              >
                <option value="dev">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block mb-2 text-sm font-medium text-contrast-medium">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-native resize-none"
                rows={3}
                placeholder="es. Chiave per ambiente di produzione, accesso limitato ai pagamenti"
              />
            </div>

            {/* Rate Limit & Expiry */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-contrast-medium">
                  Rate Limit
                </label>
                <input
                  type="text"
                  value={formData.rate_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, rate_limit: e.target.value }))}
                  className="input-native"
                  placeholder="es. 1000 req/min, unlimited"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-contrast-medium">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="input-native"
                />
              </div>
            </div>

            {/* Scopes */}
            <div>
              <label className="block mb-2 text-sm font-medium text-contrast-medium">
                Scopes
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addScope())}
                    className="flex-1 input-native"
                    placeholder="es. read, write, admin, payments"
                  />
                  <button
                    type="button"
                    onClick={addScope}
                    className="btn-native btn-primary px-4 py-2"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {formData.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.scopes.map((scope, index) => (
                      <span
                        key={index}
                        className="tag-native inline-flex items-center space-x-1 text-sm"
                      >
                        <span>{scope}</span>
                        <button
                          type="button"
                          onClick={() => removeScope(scope)}
                          className="text-current hover:opacity-75 focus:outline-none"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block mb-2 text-sm font-medium text-contrast-medium">
                Tags
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 input-native"
                    placeholder="es. production, urgent, billing"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="btn-native btn-secondary px-4 py-2"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 space-x-1 text-sm bg-surface border-subtle rounded-md text-contrast-medium"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-current hover:opacity-75 focus:outline-none"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Chiave attiva</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">La chiave è attualmente utilizzabile</p>
              </div>
              <label className="inline-flex relative items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600`}></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex pt-4 space-x-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg transition-colors dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name || !formData.service || !formData.key}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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