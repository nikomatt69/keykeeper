import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  X, 
  Download, 
  Copy, 
  CheckCircle2, 
  FileText, 
  Code,
  Package,
  Settings,
  PlayCircle,
  ExternalLink
} from 'lucide-react'
import type { GeneratedCode, CodeBlock } from '../../lib/types'

interface CodePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  generatedCode: GeneratedCode
}

export default function CodePreviewModal({ isOpen, onClose, generatedCode }: CodePreviewModalProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [copiedFiles, setCopiedFiles] = useState<Set<number>>(new Set())

  const handleCopyFile = async (content: string, fileIndex: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedFiles(prev => new Set(prev).add(fileIndex))
      setTimeout(() => {
        setCopiedFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileIndex)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('Failed to copy file:', error)
    }
  }

  const handleDownloadAll = () => {
    generatedCode.code_blocks.forEach((block) => {
      const blob = new Blob([block.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = block.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'config':
        return <Settings className="w-4 h-4" />
      case 'code':
        return <Code className="w-4 h-4" />
      case 'test':
        return <PlayCircle className="w-4 h-4" />
      case 'documentation':
        return <FileText className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getLanguageFromFilename = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'py':
        return 'python'
      case 'java':
        return 'java'
      case 'cs':
        return 'csharp'
      case 'go':
        return 'go'
      case 'rs':
        return 'rust'
      case 'php':
        return 'php'
      case 'rb':
        return 'ruby'
      case 'json':
        return 'json'
      case 'yaml':
      case 'yml':
        return 'yaml'
      case 'md':
        return 'markdown'
      default:
        return 'text'
    }
  }

  if (!isOpen) return null

  const currentFile = generatedCode.code_blocks[selectedFileIndex]

  return (
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Generated Code
            </h2>
            <p className="text-sm text-gray-500">
              {generatedCode.language} • {generatedCode.framework} • {generatedCode.code_blocks.length} files
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadAll}
              className="flex items-center space-x-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download All</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Sidebar - File List */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            {/* Overview */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Integration Details
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Language:</span>
                  <span className="text-gray-900 dark:text-gray-100">{generatedCode.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Framework:</span>
                  <span className="text-gray-900 dark:text-gray-100">{generatedCode.framework}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Files:</span>
                  <span className="text-gray-900 dark:text-gray-100">{generatedCode.code_blocks.length}</span>
                </div>
              </div>
            </div>

            {/* Dependencies */}
            {generatedCode.dependencies.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
                  <Package className="w-4 h-4" />
                  <span>Dependencies</span>
                </h3>
                <div className="space-y-1">
                  {generatedCode.dependencies.map((dep, index) => (
                    <div key={index} className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {dep}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File List */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Files ({generatedCode.code_blocks.length})
              </h3>
              <div className="space-y-1">
                {generatedCode.code_blocks.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedFileIndex(index)}
                    className={`w-full p-3 text-left rounded-lg transition-colors ${
                      selectedFileIndex === index
                        ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      {getFileIcon(file.file_type)}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.filename}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {file.description}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 capitalize">
                        {file.file_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {file.content.split('\n').length} lines
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Code Viewer */}
          <div className="flex-1 flex flex-col">
            {/* File Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                {getFileIcon(currentFile.file_type)}
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {currentFile.filename}
                </h3>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {getLanguageFromFilename(currentFile.filename)}
                </span>
              </div>
              
              <button
                onClick={() => handleCopyFile(currentFile.content, selectedFileIndex)}
                className="flex items-center space-x-2 px-3 py-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copiedFiles.has(selectedFileIndex) ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="text-sm">Copy</span>
              </button>
            </div>

            {/* File Description */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentFile.description}
              </p>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto">
              <pre className="p-4 text-sm font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 overflow-auto">
                <code>{currentFile.content}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        {(generatedCode.test_cases || generatedCode.documentation) && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4">
              <div className="flex items-center space-x-4">
                {generatedCode.test_cases && (
                  <button className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400 hover:underline">
                    <PlayCircle className="w-4 h-4" />
                    <span>View Test Cases</span>
                  </button>
                )}
                
                {generatedCode.documentation && (
                  <button className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <FileText className="w-4 h-4" />
                    <span>View Documentation</span>
                  </button>
                )}
                
                <button className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 hover:underline">
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Editor</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}