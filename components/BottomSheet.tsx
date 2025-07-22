import React, { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronUp, ChevronDown } from 'lucide-react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  onToggle?: () => void
  title: string
  subtitle?: string
  children: ReactNode
  collapsible?: boolean
  defaultHeight?: string
  maxHeight?: string
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  onToggle,
  title,
  subtitle,
  children,
  collapsible = true,
  defaultHeight = '40vh',
  maxHeight = '80vh'
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  const handleToggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed)
      onToggle?.()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{
              y: isCollapsed ? `calc(100% - 46px)` : '0%',
            }}
            exit={{ y: '100%' }}
            transition={{
              duration: 0.3,
              ease: 'easeOut'
            }}
            className="flex overflow-hidden fixed right-0 bottom-0 left-0 z-50 flex-col rounded-b-none border shadow-2xl border-b-none border-gray-500/20 dark:border-gray-700/20 glass-card"
            style={{
              height: isCollapsed ? '46px' : defaultHeight,
              maxHeight: maxHeight
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-1 border-b border-b-gray-200/20 dark:border-gray-700/20">
              {/* Drag Handle */}
              <div
                className="absolute top-2 left-1/2 w-12 h-1 bg-gray-300 transform -translate-x-1/2 cursor-pointer dark:bg-gray-600"
                onClick={handleToggleCollapse}
              />

              {isCollapsed ? (
                // Status Bar Mode - Compact horizontal layout
                <div className="flex justify-between items-center px-4 py-3 w-full border-sky-400">
                  <div className="flex items-center space-x-4">
                    {/* Project Name */}
                    <h3 className="text-sm font-bold text-contrast-high">
                      <span>Project:</span>
                      <span className="ml-1 text-blue-400">{title}</span>
                    </h3>

                    {/* Key Stats - Inline */}
                    <div className="flex items-center space-x-3 text-xs text-contrast-medium">
                      <span className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500"></div>
                        <span>Active</span>
                      </span>
                      <span>•</span>
                      <span className="opacity-75">{subtitle}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center space-x-1">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleToggleCollapse}
                      className="p-1.5 rounded-md transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                      title="Expand"
                    >
                      <ChevronUp className="w-4 h-4 text-contrast-medium" />
                    </motion.button>
                  </div>
                </div>
              ) : (
                // Expanded Mode - Original layout
                <>
                  <div className="flex items-center mt-4 ml-3 space-x-4">
                    {/* Project Name */}
                    <h3 className="text-sm font-bold text-contrast-high">
                      <span>Project:</span>
                      <span className="ml-1 text-blue-400">{title}</span>
                    </h3>

                    {/* Key Stats - Inline */}
                    <div className="flex items-center space-x-3 text-xs text-contrast-medium">
                      <span className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500"></div>
                        <span>Active</span>
                      </span>
                      <span>•</span>
                      <span className="opacity-75">{subtitle}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {collapsible && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleToggleCollapse}
                        className="p-2 rounded-lg transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                        title="Collapse"
                      >
                        <ChevronDown className="w-5 h-5 text-contrast-medium" />
                      </motion.button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="p-2 rounded-lg transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                      title="Close"
                    >
                      <X className="w-5 h-5 text-contrast-medium" />
                    </motion.button>
                  </div>
                </>
              )}
            </div>

            {/* Content */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut'
                  }}
                  className="overflow-y-auto flex-1 p-4"
                  style={{
                    maxHeight: `calc(${maxHeight} - 80px)`
                  }}
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default BottomSheet
