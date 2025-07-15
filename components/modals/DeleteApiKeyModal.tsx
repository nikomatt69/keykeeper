import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../lib/store'

export default function DeleteApiKeyModal() {
  const { selectedKey, setShowDeleteModal, deleteApiKey, isLoading } = useAppStore()

  if (!selectedKey) return null

  const handleDelete = async () => {
    await deleteApiKey(selectedKey.id)
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production':
        return 'bg-danger-100 text-danger-700 border-danger-200'
      case 'staging':
        return 'bg-warning-100 text-warning-700 border-warning-200'
      case 'dev':
        return 'bg-success-100 text-success-700 border-success-200'
      default:
        return 'bg-primary-100 text-primary-700 border-primary-200'
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-primary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-danger-100 rounded-lg">
                  <Trash2 className="h-5 w-5 text-danger-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-900">Delete API Key</h2>
                  <p className="text-sm text-primary-600">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-primary-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning */}
            <div className="flex items-start space-x-3 p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-warning-800 mb-1">Warning</h3>
                <p className="text-sm text-warning-700">
                  You are about to delete this API key. All associated data will be lost.
                </p>
              </div>
            </div>

            {/* API Key Details */}
            <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary-900">{selectedKey.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getEnvironmentColor(selectedKey.environment)}`}>
                    {selectedKey.environment}
                  </span>
                </div>

                <div className="text-sm text-primary-600">
                  <div className="flex justify-between items-center">
                    <span>Service:</span>
                    <span className="font-medium">{selectedKey.service}</span>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span>Created at:</span>
                    <span className="font-medium">
                      {new Date(selectedKey.created_at).toLocaleDateString('en-US')}
                    </span>
                  </div>

                  {selectedKey.tags.length > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span>Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedKey.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="text-xs bg-primary-200 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                        {selectedKey.tags.length > 3 && (
                          <span className="text-xs text-primary-500">
                            +{selectedKey.tags.length - 3} others
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="flex-1 bg-danger-600 hover:bg-danger-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}