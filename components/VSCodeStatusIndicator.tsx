import React from 'react'
import { motion } from 'framer-motion'

interface VSCodeStatusIndicatorProps {
  status: 'open' | 'closed' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function VSCodeStatusIndicator({ 
  status, 
  size = 'sm', 
  showLabel = false,
  className = ''
}: VSCodeStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const statusConfig = {
    open: {
      color: 'bg-green-500',
      label: 'Open in VSCode',
      description: 'This project is currently open in VSCode'
    },
    closed: {
      color: 'bg-red-500',
      label: 'Not in VSCode',
      description: 'This project is not currently open in VSCode'
    },
    unknown: {
      color: 'bg-gray-400',
      label: 'Status Unknown',
      description: 'VSCode workspace status is unknown'
    }
  }

  const config = statusConfig[status]

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div
        className="relative flex items-center justify-center overflow-hidden"
        title={config.description}
        style={{ width: '16px', height: '16px' }} // Contenitore fisso per evitare overflow
      >
        <motion.div
          className={`${sizeClasses[size]} ${config.color} rounded-full relative z-10`}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        />
        {status === 'open' && (
          <motion.div
            className={`absolute ${sizeClasses[size]} bg-green-500 rounded-full opacity-30 z-0`}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              overflow: 'hidden'
            }}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {config.label}
        </span>
      )}
    </div>
  )
}

export default VSCodeStatusIndicator