import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  BookOpen,
  FileText,
  Save,
  X,
  Upload,
  Globe,
  Edit3,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  Tag,
  Trash2
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { ContentType } from '../../lib/types'

interface ActivityLogEntry {
  id: string;
  action: 'added' | 'updated' | 'deleted' | 'imported';
  title: string;
  provider: string;
  timestamp: string;
  user: string;
  details?: string;
}

interface ManualDocumentationEntryProps {
  className?: string;
}

export default function ManualDocumentationEntry({ className = '' }: ManualDocumentationEntryProps) {
  const {
    addManualDocumentation,
    addDocumentationFromUrl,
    documentationLibrary
  } = useAppStore()

  // Form state
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [provider, setProvider] = useState('')
  const [url, setUrl] = useState('')
  const [contentType, setContentType] = useState<ContentType>('overview')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Input method
  const [inputMethod, setInputMethod] = useState<'manual' | 'url' | 'pdf'>('manual')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  
  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [showActivityLog, setShowActivityLog] = useState(false)

  // Load activity log from localStorage on mount
  useEffect(() => {
    const savedLog = localStorage.getItem('documentation-activity-log')
    if (savedLog) {
      try {
        setActivityLog(JSON.parse(savedLog))
      } catch (error) {
        console.error('Failed to load activity log:', error)
      }
    }
  }, [])

  // Save activity log to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('documentation-activity-log', JSON.stringify(activityLog))
  }, [activityLog])

  const addToActivityLog = (action: ActivityLogEntry['action'], title: string, provider: string, details?: string) => {
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      action,
      title,
      provider,
      timestamp: new Date().toISOString(),
      user: 'Current User', // TODO: Get from auth context
      details
    }
    setActivityLog(prev => [entry, ...prev.slice(0, 49)]) // Keep last 50 entries
  }

  const clearActivityLog = () => {
    setActivityLog([])
    localStorage.removeItem('documentation-activity-log')
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setProvider('')
    setUrl('')
    setContentType('overview')
    setTags([])
    setNewTag('')
    setInputMethod('manual')
    setSelectedFile(null)
    setIsProcessingPdf(false)
  }

  const processPdfFile = async (file: File): Promise<string> => {
    // For now, return a placeholder text. In a real implementation,
    // you would use a PDF parser library or backend service
    setIsProcessingPdf(true)
    
    try {
      // Simulate PDF processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Placeholder content - in real implementation, extract text from PDF
      const extractedText = `# ${file.name.replace('.pdf', '')}

This documentation was extracted from the PDF file: ${file.name}

## Content Summary
This is placeholder content extracted from the PDF file. In a real implementation, you would:

1. Use a PDF parsing library (like PDF.js or pdf-parse)
2. Extract text content from the PDF
3. Format it appropriately for documentation
4. Handle images and tables if needed

## File Information
- File Name: ${file.name}
- File Size: ${(file.size / 1024 / 1024).toFixed(2)} MB
- Processed: ${new Date().toLocaleString()}

Please edit this content as needed to create proper documentation.`
      
      return extractedText
    } finally {
      setIsProcessingPdf(false)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !provider.trim()) return

    setIsSubmitting(true)
    try {
      if (inputMethod === 'manual') {
        if (!content.trim()) return
        
        await addManualDocumentation({
          providerId: provider.toLowerCase().replace(/\s+/g, '-'),
          providerName: provider,
          title,
          content,
          sectionPath: [],
          contentType,
          tags
        });
        
        addToActivityLog('added', title, provider, `Manual entry with ${content.length} characters`)
      } else if (inputMethod === 'url') {
        if (!url.trim()) return
        
        await addDocumentationFromUrl({
          providerId: provider.toLowerCase().replace(/\s+/g, '-'),
          providerName: provider,
          providerCategory: contentType,
          docsUrl: url,
          description: title,
          tags
        });
        
        addToActivityLog('imported', title, provider, `From URL: ${url}`)
      } else if (inputMethod === 'pdf') {
        if (!selectedFile) return
        
        // Process PDF file to extract content
        const extractedContent = await processPdfFile(selectedFile)
        
        await addManualDocumentation({
          providerId: provider.toLowerCase().replace(/\s+/g, '-'),
          providerName: provider,
          title,
          content: extractedContent,
          sectionPath: [],
          contentType,
          tags
        })
        
        addToActivityLog('imported', title, provider, `From PDF: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`)
      }

      resetForm()
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to add documentation:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionIcon = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'added': return <Plus className="w-4 h-4 text-green-500" />
      case 'updated': return <Edit3 className="w-4 h-4 text-blue-500" />
      case 'deleted': return <Trash2 className="w-4 h-4 text-red-500" />
      case 'imported': return <Globe className="w-4 h-4 text-purple-500" />
      default: return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionColor = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'added': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      case 'updated': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
      case 'deleted': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      case 'imported': return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const contentTypeOptions: { value: ContentType; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'tutorial', label: 'Tutorial' },
    { value: 'reference', label: 'Reference' },
    { value: 'example', label: 'Example' },
    { value: 'configuration', label: 'Configuration' },
    { value: 'troubleshooting', label: 'Troubleshooting' },
    { value: 'migration', label: 'Migration' },
    { value: 'changelog', label: 'Changelog' }
  ]

  return (
    <div className={className}>
      {/* Header with buttons */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Manual Documentation Entry
          </h2>
          <p className="text-sm text-gray-500">
            Add documentation manually, from URL, or by uploading PDF files, with activity tracking
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowActivityLog(!showActivityLog)}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            <span>Activity Log ({activityLog.length})</span>
          </button>
          
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Documentation</span>
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <AnimatePresence>
        {showActivityLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Activity Log
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {activityLog.length} entries
                  </span>
                  {activityLog.length > 0 && (
                    <button
                      onClick={clearActivityLog}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {activityLog.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <History className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {activityLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        {getActionIcon(entry.action)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getActionColor(entry.action)}`}>
                            {entry.action}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {entry.title}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Provider: {entry.provider}</span>
                          <span>By: {entry.user}</span>
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        
                        {entry.details && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current documentation stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total Libraries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {documentationLibrary.libraries.length}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Manual Entries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {activityLog.filter(entry => entry.action === 'added').length}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">URL Imports</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {activityLog.filter(entry => entry.action === 'imported' && entry.details?.includes('From URL:')).length}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">PDF Imports</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {activityLog.filter(entry => entry.action === 'imported' && entry.details?.includes('From PDF:')).length}
          </p>
        </div>
      </div>

      {/* Add Documentation Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Add Documentation
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Input method selector */}
                <div className="flex space-x-4 mb-6">
                  <button
                    onClick={() => setInputMethod('manual')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      inputMethod === 'manual'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Manual Entry</span>
                  </button>
                  
                  <button
                    onClick={() => setInputMethod('url')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      inputMethod === 'url'
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>From URL</span>
                  </button>
                  
                  <button
                    onClick={() => setInputMethod('pdf')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      inputMethod === 'pdf'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>From PDF</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Basic fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., OpenAI API Authentication Guide"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Provider *
                      </label>
                      <input
                        type="text"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        placeholder="e.g., OpenAI, Stripe, AWS"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {/* Content type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Content Type
                    </label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as ContentType)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {contentTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* URL, Content, or PDF based on input method */}
                  {inputMethod === 'url' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Documentation URL *
                      </label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://docs.example.com/api"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  ) : inputMethod === 'pdf' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Upload PDF File *
                      </label>
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file && file.type === 'application/pdf') {
                                setSelectedFile(file)
                              } else {
                                setSelectedFile(null)
                                if (file) {
                                  alert('Please select a valid PDF file.')
                                }
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-400 dark:hover:border-orange-500 transition-colors">
                            <div className="text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedFile ? selectedFile.name : 'Click to upload PDF file'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF files only, max 10MB
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {selectedFile && (
                          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-orange-500" />
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {selectedFile.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        
                        {isProcessingPdf && (
                          <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              Processing PDF file...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Content *
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter your documentation content here... You can use Markdown formatting."
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                      />
                    </div>
                  )}

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags
                    </label>
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        placeholder="Add a tag..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-sm"
                          >
                            <span>{tag}</span>
                            <button
                              onClick={() => removeTag(tag)}
                              className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={
                      !title.trim() || 
                      !provider.trim() || 
                      (inputMethod === 'manual' && !content.trim()) || 
                      (inputMethod === 'url' && !url.trim()) || 
                      (inputMethod === 'pdf' && !selectedFile) ||
                      isSubmitting ||
                      isProcessingPdf
                    }
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting || isProcessingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>
                      {isProcessingPdf ? 'Processing PDF...' : isSubmitting ? 'Adding...' : 'Add Documentation'}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}