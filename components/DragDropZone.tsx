import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudArrowUpIcon, DocumentIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../lib/store'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import ProjectPathDisplay from './ProjectPathDisplay'

interface DragDropZoneProps {
  onFileImport?: (filePath: string, projectPath: string) => void
}

interface EnvVariable {
  name: string
  value: string
  is_secret: boolean
}

interface DroppedEnvFile {
  path: string
  project_path: string
  file_name: string
  keys: EnvVariable[]
}

interface EnvFileWithStatus extends DroppedEnvFile {
  vscode_status: string
}

export default function DragDropZone({ onFileImport }: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<EnvFileWithStatus | null>(null)
  const { addApiKey, setError, getProjectVSCodeStatus } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (filePaths: string[]) => {
    setIsProcessing(true)

    try {
      const envFiles = filePaths.filter(path => {
        const fileName = path.split('/').pop() || ''
        const supportedNames = ['.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test']
        return supportedNames.some(name => fileName.startsWith(name))
      })

      if (envFiles.length === 0) {
        setError('No .env files found in selection.')
        return
      }

      for (const filePath of envFiles) {
        try {
          const result = await invoke<DroppedEnvFile>('parse_and_register_env_file', {
            filePath: filePath
          })

          // Get VSCode status for the project
          const vscodeStatus = await getProjectVSCodeStatus(result.project_path)

          const resultWithStatus: EnvFileWithStatus = {
            ...result,
            vscode_status: vscodeStatus
          }

          setImportResult(resultWithStatus)
          onFileImport?.(result.path, result.project_path)
          break
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
          const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred'
          setError(`Error processing file: ${errorMessage}`)
          continue
        }
      }
    } catch (error) {
      console.error('Error processing files:', error)
      const errorMessage = typeof error === 'string' ? error : 'Failed to process files'
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }, [setError, onFileImport])

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

      if (files.length === 0) {
        setError('No files detected. Please try dragging files from your file system.')
        return
      }

      const envFiles = files.filter(file =>
        file.name.endsWith('.env') ||
        file.name.endsWith('.env.local') ||
        file.name.endsWith('.env.development') ||
        file.name.endsWith('.env.production') ||
        file.name.endsWith('.env.staging') ||
        file.name.endsWith('.env.test')
      )

      if (envFiles.length === 0) {
        const fileNames = files.map(f => f.name).join(', ')
        setError(`No .env files found. Detected files: ${fileNames}. Please drag supported .env files.`)
        return
      }

      const filePaths = envFiles.map(file => (file as any).path).filter(Boolean)

      if (filePaths.length === 0) {
        setError('Cannot determine file paths. Please drag files directly from your file system explorer.')
        return
      }

      await processFiles(filePaths)

    } catch (error) {
      console.error('Error processing dropped files:', error)
      const errorMessage = typeof error === 'string' ? error : 'Failed to process dropped files'
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }, [setError, processFiles])

  const handleFileClick = useCallback(async (e: React.MouseEvent) => {
    // Prevent click when dragging
    if (isDragOver) return

    e.preventDefault()
    e.stopPropagation()

    try {
      const selected = await open({
        title: 'Select Environment Files',
        filters: [
          {
            name: 'Environment Files',
            extensions: ['env', 'local', 'development', 'production', 'staging', 'test', 'txt'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
        multiple: true
      })

      if (!selected) return

      const filePaths = Array.isArray(selected) ? selected : [selected]
      await processFiles(filePaths)
    } catch (error) {
      console.error('Error selecting file:', error)
      setError('Error selecting file. Please try again.')
    }
  }, [setError, isDragOver, processFiles])

  const handleImportKeys = async () => {
    if (!importResult) return

    try {
      for (const key of importResult.keys) {
        if (key.is_secret) {
          await addApiKey({
            name: key.name,
            service: 'Environment Variable',
            key: key.value,
            environment: detectEnvironment(importResult.file_name) as 'development' | 'staging' | 'production',
            description: `Imported from ${importResult.file_name}`,
            scopes: ['env'],
            tags: ['imported', 'env-file'],
            is_active: true,
            source_type: 'env_file',
            env_file_path: importResult.path,
            project_path: importResult.project_path,
            env_file_name: importResult.file_name
          })
        }
      }

      // Register project association
      await invoke('associate_project_with_env', {
        projectPath: importResult.project_path,
        envPath: importResult.path,
        fileName: importResult.file_name
      })

      setImportResult(null)
      setError(null)
    } catch (error) {
      console.error('Error importing keys:', error)
      const errorMessage = typeof error === 'string' ? error : 'Failed to import API keys'
      setError(errorMessage)
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
        onClick={handleFileClick}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer
          ${isDragOver
            ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20'
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
              className="flex absolute inset-0 justify-center items-center rounded-lg bg-blue-500/10"
            >
              <div className="text-blue-600 dark:text-blue-400">
                <CloudArrowUpIcon className="mx-auto mb-4 w-16 h-16" />
                <p className="text-xl font-semibold">Drop your .env file here</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isProcessing && !importResult && (
          <div className="space-y-4">
            <DocumentIcon className="mx-auto w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Drag .env files here or click to browse
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Supports .env, .env.local, .env.development, .env.production, .env.staging, .env.test
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileClick(e)
                }}
                className="px-4 py-2 mt-3 text-sm font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
              >
                Browse Files
              </button>
            </div>
            <div className="space-y-1 text-xs text-gray-400">
              <p>• Automatically detects project from path</p>
              <p>• Imports API keys and secret variables</p>
              <p>• Activates VSCode extension automatically</p>
              <p>• Click anywhere to browse files</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent"
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
            className="p-6 mt-6 bg-white rounded-lg border shadow-lg dark:bg-gray-800"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <FolderIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    .env file detected
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ready to import API keys
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                  File and Project Information:
                </h4>
                <div className="p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                  <ProjectPathDisplay
                    envFilePath={importResult.path}
                    projectPath={importResult.project_path}
                    fileName={importResult.file_name}
                    vscodeStatus={importResult.vscode_status}
                    showActions={false}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
                  Variables found ({importResult.keys.length}):
                </h4>
                <div className="overflow-y-auto space-y-1 max-h-40">
                  {importResult.keys.map((key, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-sm ${key.is_secret
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-50 dark:bg-gray-700'
                        }`}
                    >
                      <span className="font-mono">{key.name}</span>
                      <span className={`px-2 py-1 rounded text-xs ${key.is_secret
                        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                        {key.is_secret ? 'Secret' : 'Config'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex pt-4 space-x-3">
                <button
                  onClick={handleImportKeys}
                  className="flex-1 px-4 py-2 font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
                >
                  Import {importResult.keys.filter(k => k.is_secret).length} API Keys
                </button>
                <button
                  onClick={() => setImportResult(null)}
                  className="px-4 py-2 text-gray-600 transition-colors dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
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