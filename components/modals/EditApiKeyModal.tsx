import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Tag, Eye, EyeOff, Edit3 } from 'lucide-react'
import { useAppStore } from '../../lib/store'

export default function EditApiKeyModal() {
  const { selectedKey, setShowEditModal, updateApiKey, isLoading } = useAppStore()

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

  useEffect(() => {
    if (selectedKey) {
      setFormData({
        name: selectedKey.name,
        service: selectedKey.service,
        key: selectedKey.key,
        description: selectedKey.description || '',
        environment: selectedKey.environment,
        rate_limit: selectedKey.rate_limit || '',
        expires_at: selectedKey.expires_at ? selectedKey.expires_at.split('T')[0] : '',
        scopes: [...selectedKey.scopes],
        tags: [...selectedKey.tags],
        is_active: selectedKey.is_active
      })
    }
  }, [selectedKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedKey && formData.name && formData.service && formData.key) {
      await updateApiKey({
        ...selectedKey,
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

  if (!selectedKey) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-primary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-accent-100 rounded-lg">
                  <Edit3 className="h-5 w-5 text-accent-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-900">Edit API Key</h2>
                  <p className="text-sm text-primary-600">{selectedKey.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-primary-600" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="es. Stripe Production"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Service *
                </label>
                <input
                  type="text"
                  required
                  value={formData.service}
                  onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                  className="input-field"
                  placeholder="es. Stripe, OpenAI, AWS"
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                API Key *
              </label>
              <div className="relative">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  required
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                  className="input-field pr-12"
                  placeholder="Insert your API key"
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(!keyVisible)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {keyVisible ? (
                    <EyeOff className="h-5 w-5 text-primary-400 hover:text-primary-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-primary-400 hover:text-primary-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
                className="input-field"
              >
                <option value="dev">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-field resize-none"
                rows={3}
                placeholder="Optional API key description"
              />
            </div>

            {/* Rate Limit & Expiry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Rate Limit
                </label>
                <input
                  type="text"
                  value={formData.rate_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, rate_limit: e.target.value }))}
                  className="input-field"
                  placeholder="es. 1000 req/min"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            {/* Scopes */}
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Scopes
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addScope())}
                    className="input-field flex-1"
                    placeholder="Add scope"
                  />
                  <button
                    type="button"
                    onClick={addScope}
                    className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {formData.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.scopes.map((scope, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-accent-100 text-accent-700 text-sm rounded-full border border-accent-200 flex items-center space-x-1"
                      >
                        <span>{scope}</span>
                        <button
                          type="button"
                          onClick={() => removeScope(scope)}
                          className="text-accent-500 hover:text-accent-700"
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
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Tags
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="input-field flex-1"
                    placeholder="Add tag"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full border border-primary-200 flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-primary-500 hover:text-primary-700"
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
                <h3 className="font-medium text-primary-900">Active Key</h3>
                <p className="text-sm text-primary-500">The key is currently usable</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-primary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-primary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name || !formData.service || !formData.key}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}