import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Plus,
  BookOpen,
  Globe,
  FileText,
  Tag,
  Clock,
  BarChart3,
  Download,
  Upload,
  RefreshCw,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { DocumentationLibrary, DocumentationSearchResult, ContentType } from '../../lib/types'
import ManualDocumentationEntry from './ManualDocumentationEntry'
// import LibrarySettingsModal from './LibrarySettingsModal' // TODO: Create this component

interface DocumentationLibraryInterfaceProps {
  className?: string
}

export default function DocumentationLibraryInterface({ className = '' }: DocumentationLibraryInterfaceProps) {
  const {
    documentationLibrary,
    loadDocumentationLibraries,
    searchDocumentationLibrary,
    setCurrentDocumentationLibrary,
    setDocumentationSearchQuery,
    setDocumentationFilters,
    loadLibraryStatistics,
    deleteDocumentationLibrary,
    refreshDocumentationLibrary,
    exportDocumentationLibrary,
    clearDocumentationError
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showLibrarySettings, setShowLibrarySettings] = useState(false)
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showManualEntry, setShowManualEntry] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadDocumentationLibraries()
    loadLibraryStatistics()
  }, [loadDocumentationLibraries, loadLibraryStatistics])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchDocumentationLibrary(searchQuery, {
          providerIds: selectedProviders.length > 0 ? selectedProviders : undefined,
          contentTypes: selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
          maxResults: 50
        })
      }
      setDocumentationSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedProviders, selectedContentTypes, searchDocumentationLibrary, setDocumentationSearchQuery])

  // Update filters in store
  useEffect(() => {
    setDocumentationFilters(selectedProviders, selectedContentTypes)
  }, [selectedProviders, selectedContentTypes, setDocumentationFilters])

  // Get unique providers from libraries
  const availableProviders = useMemo(() => {
    const providers = new Set<string>()
    documentationLibrary.libraries.forEach(lib => {
      if (lib.provider_id) {
        providers.add(lib.provider_id)
      }
    })
    return Array.from(providers)
  }, [documentationLibrary.libraries])

  const contentTypeOptions: ContentType[] = [
    'overview', 'tutorial', 'reference', 'example', 
    'configuration', 'troubleshooting', 'migration', 'changelog'
  ]

  const handleDeleteLibrary = async (libraryId: string) => {
    if (window.confirm('Are you sure you want to delete this library? This action cannot be undone.')) {
      await deleteDocumentationLibrary(libraryId)
    }
  }

  const handleRefreshLibrary = async (libraryId: string) => {
    await refreshDocumentationLibrary(libraryId)
  }

  const handleExportLibrary = async (libraryId: string, format: 'json' | 'markdown' | 'csv' = 'json') => {
    try {
      const exportData = await exportDocumentationLibrary(libraryId, format)
      
      // Create download
      const blob = new Blob([exportData], { 
        type: format === 'json' ? 'application/json' : 
             format === 'csv' ? 'text/csv' : 'text/markdown' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `library-${libraryId}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export library:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexed':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      case 'processing':
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'failed':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      case 'outdated':
        return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const renderLibraryCard = (library: DocumentationLibrary) => (
    <motion.div
      key={library.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => setCurrentDocumentationLibrary(library.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {library.name}
          </h3>
        </div>
        
        <div className="flex items-center space-x-1">
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(library.status)}`}>
            {library.status}
          </span>
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedLibraryId(selectedLibraryId === library.id ? null : library.id)
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            <AnimatePresence>
              {selectedLibraryId === library.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentDocumentationLibrary(library.id)
                      setSelectedLibraryId(null)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshLibrary(library.id)
                      setSelectedLibraryId(null)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExportLibrary(library.id, 'json')
                      setSelectedLibraryId(null)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowLibrarySettings(true)
                      setSelectedLibraryId(null)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteLibrary(library.id)
                      setSelectedLibraryId(null)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
        {library.description}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-3">
          <span>{library.total_chunks} chunks</span>
          <span>v{library.version}</span>
          {library.url !== 'manual' && library.url !== 'bulk_import' && (
            <div className="flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>URL</span>
            </div>
          )}
        </div>
        <span>{formatDate(library.updated_at)}</span>
      </div>
      
      {library.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {library.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
            >
              {tag}
            </span>
          ))}
          {library.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{library.tags.length - 3}</span>
          )}
        </div>
      )}
    </motion.div>
  )

  const renderSearchResult = (result: DocumentationSearchResult) => (
    <motion.div
      key={result.chunk_id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {result.title}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {Math.round(result.similarity_score * 100)}% match
          </span>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
        {result.content}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-2">
          <span className="capitalize">{result.content_type.replace('_', ' ')}</span>
          <span>•</span>
          <span>{result.metadata.word_count} words</span>
        </div>
        
        {result.section_path.length > 0 && (
          <div className="flex items-center space-x-1">
            <span>Section:</span>
            <span className="font-mono">{result.section_path.join(' > ')}</span>
          </div>
        )}
      </div>
    </motion.div>
  )

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Documentation Library
            </h1>
            <p className="text-sm text-gray-500">
              Manage and search through your API documentation
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showManualEntry
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Documentation</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters || selectedProviders.length > 0 || selectedContentTypes.length > 0
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>

          <button
            onClick={() => loadLibraryStatistics()}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Stats</span>
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Providers
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableProviders.map((providerId) => (
                      <button
                        key={providerId}
                        onClick={() => {
                          setSelectedProviders(prev =>
                            prev.includes(providerId)
                              ? prev.filter(id => id !== providerId)
                              : [...prev, providerId]
                          )
                        }}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          selectedProviders.includes(providerId)
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {providerId}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content Types
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {contentTypeOptions.map((contentType) => (
                      <button
                        key={contentType}
                        onClick={() => {
                          setSelectedContentTypes(prev =>
                            prev.includes(contentType)
                              ? prev.filter(type => type !== contentType)
                              : [...prev, contentType]
                          )
                        }}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors capitalize ${
                          selectedContentTypes.includes(contentType)
                            ? 'bg-purple-500 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {contentType.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => {
                    setSelectedProviders([])
                    setSelectedContentTypes([])
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear all filters
                </button>
                
                <div className="text-sm text-gray-500">
                  {selectedProviders.length + selectedContentTypes.length} filters active
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Documentation Entry */}
        <AnimatePresence>
          {showManualEntry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <ManualDocumentationEntry />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Display */}
      {documentationLibrary.lastError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300">{documentationLibrary.lastError}</span>
            </div>
            <button
              onClick={clearDocumentationError}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      {documentationLibrary.statistics && (
        <div className="mx-4 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Libraries</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {documentationLibrary.statistics.total_libraries}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total Chunks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {documentationLibrary.statistics.total_chunks}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Avg Size</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {Math.round(documentationLibrary.statistics.average_chunk_size)}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {documentationLibrary.isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-500">Searching documentation...</p>
            </div>
          </div>
        ) : searchQuery && documentationLibrary.searchResults.length > 0 ? (
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Search Results ({documentationLibrary.searchResults.length})
            </h2>
            <div className="space-y-4">
              {documentationLibrary.searchResults.map(renderSearchResult)}
            </div>
          </div>
        ) : searchQuery && documentationLibrary.searchResults.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No results found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : documentationLibrary.libraries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Documentation Libraries
            </h3>
            <p className="text-gray-500 mb-4">
              Start by adding your first documentation library
            </p>
            <button
              onClick={() => setShowManualEntry(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add Documentation
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Libraries ({documentationLibrary.libraries.length})
              </h2>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                  </div>
                </button>
                
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="w-4 h-4 flex flex-col space-y-1">
                    <div className="h-0.5 bg-current rounded"></div>
                    <div className="h-0.5 bg-current rounded"></div>
                    <div className="h-0.5 bg-current rounded"></div>
                  </div>
                </button>
              </div>
            </div>
            
            <div className={`grid gap-4 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1'
            }`}>
              {documentationLibrary.libraries.map(renderLibraryCard)}
            </div>
          </div>
        )}
      </div>

      {/* TODO: Uncomment when LibrarySettingsModal is created
      {selectedLibraryId && (
        <LibrarySettingsModal
          isOpen={showLibrarySettings}
          onClose={() => {
            setShowLibrarySettings(false)
            setSelectedLibraryId(null)
          }}
          libraryId={selectedLibraryId}
        />
      )}
      */}
    </div>
  )
}