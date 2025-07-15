import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudArrowUpIcon, DocumentIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../lib/store'
import { invoke } from '@tauri-apps/api/core'

interface DragDropZoneProps {
  onFileImport?: (filePath: string, projectPath: string) => void
}

interface DroppedEnvFile {
  path: string
  projectPath: string
  fileName: string
  keys: Array<{
    name: string
    value: string
    isSecret: boolean
  }>
}

export default function DragDropZone({ onFileImport }: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<DroppedEnvFile | null>(null)
  const { addApiKey, setError } = useAppStore()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setIsProcessing(true)

    try {
      const files = Array.from(e.dataTransfer.files)
      const envFiles = files.filter(file =>
        file.name.endsWith('.env') ||
        file.name.endsWith('.env.local') ||
        file.name.endsWith('.env.development') ||
        file.name.endsWith('.env.production')
      )

      if (envFiles.length === 0) {
        setError('Please drag only supported .env files')
        return
      }

      const file = envFiles[0]
      const filePath = (file as any).path // Tauri provides the file path

      // Parse the .env file and detect project
      const result = await invoke<DroppedEnvFile>('parse_and_register_env_file', {
        filePath: filePath
      })

      setImportResult(result)
      onFileImport?.(result.path, result.projectPath)

    } catch (error) {
      console.error('Error processing dropped file:', error)
      setError(error as string)
    } finally {
      setIsProcessing(false)
    }
  }, [setError, onFileImport])

  const handleImportKeys = async () => {
    if (!importResult) return

    try {
      for (const key of importResult.keys) {
        if (key.isSecret) {
          await addApiKey({
            name: key.name,
            service: 'Environment Variable',
            key: key.value,
            environment: detectEnvironment(importResult.fileName) as 'dev' | 'staging' | 'production',
            description: `Imported from ${importResult.fileName}`,
            scopes: ['env'],
            tags: ['imported', 'env-file'],
            is_active: true
          })
        }
      }

      // Register project association
      await invoke('associate_project_with_env', {
        projectPath: importResult.projectPath,
        envPath: importResult.path,
        fileName: importResult.fileName
      })

      setImportResult(null)
      setError(null)
    } catch (error) {
      setError(error as string)
    }
  }

  const detectEnvironment = (fileName: string): string => {
    if (fileName.includes('.production')) return 'production'
    if (fileName.includes('.development')) return 'development'
    if (fileName.includes('.local')) return 'development'
    return 'development'
  }

  return (
    <div className="relative">
      {/* Main Drop Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-lg"
            >
              <div className="text-blue-600 dark:text-blue-400">
                <CloudArrowUpIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="text-xl font-semibold">Drop your .env file here</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isProcessing && !importResult && (
          <div className="space-y-4">
            <DocumentIcon className="w-12 h-12 mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Drag .env files here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Supports .env, .env.local, .env.development, .env.production
              </p>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <p>• Automatically detects project from path</p>
              <p>• Imports API keys and secret variables</p>
              <p>• Activates VSCode extension automatically</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full"
            />
            <p className="text-lg font-medium">Processing .env file...</p>
          </div>
        )}
      </motion.div>

      {/* Import Result Modal */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 bg-white dark:bg-gray-800 rounded-lg border shadow-lg p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <FolderIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    .env file detected
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {importResult.fileName}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Detected project:
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono">
                  {importResult.projectPath}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Variables found ({importResult.keys.length}):
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.keys.map((key, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-sm ${key.isSecret
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                          : 'bg-gray-50 dark:bg-gray-700'
                        }`}
                    >
                      <span className="font-mono">{key.name}</span>
                      <span className={`px-2 py-1 rounded text-xs ${key.isSecret
                          ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                        {key.isSecret ? 'Secret' : 'Config'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleImportKeys}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Import {importResult.keys.filter(k => k.isSecret).length} API Keys
                </button>
                <button
                  onClick={() => setImportResult(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}