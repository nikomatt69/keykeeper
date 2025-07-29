import React from 'react'
import { FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline'
import { invoke } from '@tauri-apps/api/core'
import { VSCodeStatusIndicator } from './VSCodeStatusIndicator'
import { FileText } from 'lucide-react'

interface ProjectPathDisplayProps {
  envFilePath: string
  projectPath: string
  fileName: string
  vscodeStatus?: string
  className?: string
  showActions?: boolean
}

export default function ProjectPathDisplay({
  envFilePath,
  projectPath,
  fileName,
  vscodeStatus = 'unknown',
  className = '',
  showActions = true
}: ProjectPathDisplayProps) {
  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path })
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file', { path })
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }

  const getProjectName = (path: string) => {
    return path.split('/').pop() || 'Unknown Project'
  }

  const truncatePath = (path: string, maxLength: number = 60) => {
    if (path.length <= maxLength) return path
    const parts = path.split('/')
    if (parts.length <= 2) return path

    const start = parts[0]
    const end = parts.slice(-2).join('/')
    return `${start}/.../${end}`
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* .env File Path */}
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <div className="flex justify-center items-center w-8 h-8 bg-green-100 rounded-lg dark:bg-green-900">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {fileName}
            </p>
            <VSCodeStatusIndicator status={vscodeStatus as 'unknown' | 'closed' | 'open'} />
          </div>
          <button
            onClick={() => handleOpenFile(envFilePath)}
            className="block max-w-full text-xs text-gray-500 truncate transition-colors dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title={envFilePath}
          >
            {truncatePath(envFilePath)}
          </button>
        </div>
      </div>

      {/* Project Folder */}
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {vscodeStatus === 'open' ? (
            <FolderOpenIcon className="w-5 h-5 text-blue-500" />
          ) : (
            <FolderIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getProjectName(projectPath)}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {vscodeStatus === 'open' ? 'Open in VSCode' : 'Not in VSCode'}
            </span>
          </div>
          <button
            onClick={() => handleOpenFolder(projectPath)}
            className="block max-w-full text-xs text-gray-500 truncate transition-colors dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title={projectPath}
          >
            {truncatePath(projectPath)}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => handleOpenFolder(projectPath)}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Open Folder
          </button>
          <button
            onClick={() => handleOpenFile(envFilePath)}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Open File
          </button>
          {vscodeStatus === 'closed' && (
            <button
              onClick={() => invoke('open_in_vscode', { path: projectPath }).catch(console.error)}
              className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Open in VSCode
            </button>
          )}
        </div>
      )}
    </div>
  )
}