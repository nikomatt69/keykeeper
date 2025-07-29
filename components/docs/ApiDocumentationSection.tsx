import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Globe,
  Edit3,
  MessageSquare,
  ExternalLink,
  Upload,
  FileText,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { ApiKey, DocumentationLibrary, DocumentationSearchResult } from '../../lib/types'

interface ApiDocumentationSectionProps {
  apiKey: ApiKey
  className?: string
}

type DocumentationInputMode = 'url' | 'manual' | 'chat' | null

export default function ApiDocumentationSection({ apiKey, className = '' }: ApiDocumentationSectionProps) {
  const {
    documentationLibrary,
    addDocumentationFromUrl,
    addManualDocumentation,
    searchDocumentationLibrary,
    validateDocumentationUrl,
    chat,
    createChatSession,
    sendChatMessage,
    setCurrentChatSession
  } = useAppStore()

  const [inputMode, setInputMode] = useState<DocumentationInputMode>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isValidatingUrl, setIsValidatingUrl] = useState(false)
  const [urlValidation, setUrlValidation] = useState<{ isValid: boolean; message?: string } | null>(null)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [chatPrompt, setChatPrompt] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DocumentationSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Get existing documentation for this API provider
  const existingDocs = documentationLibrary.libraries.filter(
    lib => lib.provider_id === apiKey.service.toLowerCase()
  )

  // Load existing search results for this provider
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true)
      searchDocumentationLibrary(searchQuery, {
        providerIds: [apiKey.service.toLowerCase()],
        maxResults: 10
      }).then(() => {
        setSearchResults(documentationLibrary.searchResults)
        setIsSearching(false)
      })
    } else {
      setSearchResults([])
    }
  }, [searchQuery, apiKey.service, searchDocumentationLibrary, documentationLibrary.searchResults])

  const handleUrlValidation = async (url: string) => {
    if (!url.trim()) {
      setUrlValidation(null)
      return
    }

    setIsValidatingUrl(true)
    try {
      const isValid = await validateDocumentationUrl(url)
      setUrlValidation({
        isValid,
        message: isValid ? 'URL is valid and accessible' : 'URL is not accessible or invalid'
      })
    } catch (error) {
      setUrlValidation({
        isValid: false,
        message: 'Failed to validate URL'
      })
    } finally {
      setIsValidatingUrl(false)
    }
  }

  const handleUrlImport = async () => {
    if (!urlInput.trim() || !urlValidation?.isValid) return

    setIsImporting(true)
    try {
      await addDocumentationFromUrl({
        providerId: apiKey.service.toLowerCase(),
        providerName: apiKey.service,
        providerCategory: 'api',
        docsUrl: urlInput,
        description: `Documentation for ${apiKey.service} API`,
        tags: [apiKey.service.toLowerCase(), 'api', 'documentation']
      });
      setInputMode(null)
      setUrlInput('')
      setUrlValidation(null)
    } catch (error) {
      console.error('Failed to import documentation:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleManualImport = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) return

    setIsImporting(true)
    try {
      await addManualDocumentation({
        providerId: apiKey.service.toLowerCase(),
        providerName: apiKey.service,
        title: manualTitle,
        content: manualContent,
        sectionPath: [],
        contentType: 'overview',
        tags: [apiKey.service.toLowerCase(), 'api', 'manual']
      })
      setInputMode(null)
      setManualTitle('')
      setManualContent('')
    } catch (error) {
      console.error('Failed to add manual documentation:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleChatGeneration = async () => {
    if (!chatPrompt.trim()) return

    try {
      // Create a new chat session for documentation generation
      const sessionId = await createChatSession(
        `Generate docs for ${apiKey.service}`,
        `Generate documentation for ${apiKey.service} API`,
        existingDocs.map(doc => doc.id)
      )
      
      setCurrentChatSession(sessionId)
      
      // Send the prompt with context about the API
      const enhancedPrompt = `Generate comprehensive API documentation for ${apiKey.service}. ${chatPrompt}

Please provide:
1. Overview of the API
2. Authentication methods
3. Common endpoints and usage examples
4. Configuration examples for different frameworks
5. Best practices and tips

Make it practical and easy to understand for developers.`

      await sendChatMessage(sessionId, enhancedPrompt, false)
      
      setInputMode(null)
      setChatPrompt('')
    } catch (error) {
      console.error('Failed to generate documentation via chat:', error)
    }
  }

  const renderInputModeSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setInputMode('url')}
        className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors group"
      >
        <div className="text-center">
          <Globe className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">URL Scraping</h3>
          <p className="text-sm text-gray-500">Import from documentation URL (like Cursor)</p>
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setInputMode('manual')}
        className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors group"
      >
        <div className="text-center">
          <Edit3 className="w-8 h-8 text-gray-400 group-hover:text-green-500 mx-auto mb-2" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Manual Entry</h3>
          <p className="text-sm text-gray-500">Add documentation manually</p>
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setInputMode('chat')}
        className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors group"
      >
        <div className="text-center">
          <MessageSquare className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mx-auto mb-2" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">LLM Generation</h3>
          <p className="text-sm text-gray-500">Generate with AI assistance</p>
        </div>
      </motion.button>
    </div>
  )

  const renderUrlInput = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center space-x-2 mb-4">
        <Globe className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Import from URL</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Documentation URL
          </label>
          <div className="relative">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                handleUrlValidation(e.target.value)
              }}
              placeholder="https://docs.example.com/api"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {isValidatingUrl && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          {urlValidation && (
            <div className={`mt-1 flex items-center space-x-1 text-sm ${
              urlValidation.isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              {urlValidation.isValid ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{urlValidation.message}</span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Smart Import</span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Like Cursor, we&apos;ll automatically crawl and index all documentation pages from this URL.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleUrlImport}
            disabled={!urlValidation?.isValid || isImporting}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isImporting ? 'Importing...' : 'Import Documentation'}</span>
          </button>
          
          <button
            onClick={() => setInputMode(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )

  const renderManualInput = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center space-x-2 mb-4">
        <Edit3 className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Manual Documentation</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="e.g., Getting Started with OpenAI API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <textarea
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder="Enter your documentation content here... You can use Markdown formatting."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports Markdown formatting. Be descriptive to help the LLM understand your API better.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleManualImport}
            disabled={!manualTitle.trim() || !manualContent.trim() || isImporting}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{isImporting ? 'Adding...' : 'Add Documentation'}</span>
          </button>
          
          <button
            onClick={() => setInputMode(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )

  const renderChatInput = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center space-x-2 mb-4">
        <MessageSquare className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Generate with LLM</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What documentation do you need?
          </label>
          <textarea
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            placeholder="e.g., I need a comprehensive guide for authentication, common endpoints, rate limiting, and error handling for the OpenAI API. Include code examples in Python and JavaScript."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
          />
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">AI-Powered Generation</span>
          </div>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            The LLM will use existing documentation (if any) to generate comprehensive, accurate documentation based on your request.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleChatGeneration}
            disabled={!chatPrompt.trim() || chat.isCreatingSession}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {chat.isCreatingSession ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{chat.isCreatingSession ? 'Starting...' : 'Generate Documentation'}</span>
          </button>
          
          <button
            onClick={() => setInputMode(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )

  const renderExistingDocs = () => {
    if (existingDocs.length === 0) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Existing Documentation ({existingDocs.length})
          </h3>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
        </div>

        {searchQuery && searchResults.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Results ({searchResults.length})
            </h4>
            {searchResults.map((result) => (
              <div
                key={result.chunk_id}
                className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {result.title}
                  </h5>
                  <span className="text-xs text-gray-500">
                    {Math.round(result.similarity_score * 100)}% match
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {result.content}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 capitalize">
                    {result.content_type.replace('_', ' ')}
                  </span>
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {existingDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {doc.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {doc.description}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{doc.total_chunks} chunks</span>
                      <span>v{doc.version}</span>
                      <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      doc.status === 'indexed' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {doc.status}
                    </span>
                    
                    <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            API Documentation
          </h2>
        </div>
        
        {!inputMode && existingDocs.length > 0 && (
          <button
            onClick={() => setInputMode(null)}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="w-4 h-4" />
            <span>Add More</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {!inputMode && existingDocs.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Documentation Available
            </h3>
            <p className="text-gray-500 mb-6">
              Add documentation to help the LLM generate better integrations and provide context.
            </p>
            {renderInputModeSelector()}
          </div>
        )}

        {!inputMode && existingDocs.length > 0 && (
          <div className="space-y-6">
            {renderExistingDocs()}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Add More Documentation
              </h3>
              {renderInputModeSelector()}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {inputMode === 'url' && renderUrlInput()}
          {inputMode === 'manual' && renderManualInput()}
          {inputMode === 'chat' && renderChatInput()}
        </AnimatePresence>
      </div>
    </div>
  )
}