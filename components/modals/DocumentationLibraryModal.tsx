import { motion, AnimatePresence } from 'framer-motion'
import { X, BookOpen } from 'lucide-react'
import DocumentationLibraryInterface from '../documentation/DocumentationLibraryInterface'

interface DocumentationLibraryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DocumentationLibraryModal({ isOpen, onClose }: DocumentationLibraryModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-7xl mx-4 max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-6 h-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Documentation Library
                </h2>
                <p className="text-sm text-gray-500">
                  Manage all your API documentation and knowledge base
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="h-[calc(90vh-80px)] overflow-hidden">
            <DocumentationLibraryInterface className="h-full" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}