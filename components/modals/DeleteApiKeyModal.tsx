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
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'staging':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'development':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
      default:
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    }
  }

  return (
    <AnimatePresence>
      <div className="flex fixed inset-0 z-50 justify-center items-center p-4 backdrop-blur-sm bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl dark:bg-gray-800 dark:border-gray-700"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delete API Key</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning */}
            <div className="flex items-start p-4 space-x-3 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="mb-1 font-medium text-yellow-800 dark:text-yellow-200">Warning</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You are about to delete this API key. All associated data will be lost.
                </p>
              </div>
            </div>

            {/* API Key Details */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedKey.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getEnvironmentColor(selectedKey.environment)}`}>
                    {selectedKey.environment}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>Service:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedKey.service}</span>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span>Created at:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(selectedKey.created_at).toLocaleDateString('en-US')}
                    </span>
                  </div>

                  {selectedKey.tags.length > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span>Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedKey.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                        {selectedKey.tags.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
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
            <div className="flex pt-4 space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg transition-colors dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="flex-1 px-4 py-2 font-medium text-white bg-red-600 rounded-lg transition-all duration-200 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {isLoading ? (
                  <div className="flex justify-center items-center space-x-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white animate-spin border-t-transparent"></div>
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