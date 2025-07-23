import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Book, ExternalLink, Plus, Search, Filter, Clock, Tag, Key } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Documentation as TauriDocumentation } from '@/lib/tauri-api';

interface ApiKey {
  id: string;
  name: string;
  service: string;
  environment: 'dev' | 'staging' | 'production';
}

// Extend the base Documentation type to include frontend-specific properties
type ApiDocumentation = Omit<TauriDocumentation, 'content'> & {
  // Content is required in the base type but we'll handle it safely
  content: string;
  // Add frontend-specific properties
  sections?: DocSection[];
  last_updated?: string; // Alias for updated_at
  linked_keys?: any[]; // Ensure linked_keys is properly typed if needed
};

interface DocSection {
  id: string;
  title: string;
  content: string;
  level: number;
  anchor?: string;
}

interface DocSearchResult {
  doc_id: string;
  section_id?: string;
  title: string;
  snippet: string;
  url: string;
  relevance_score: number;
  provider_id: string;
}

interface ProjectDocsSectionProps {
  projectId: string;
  apiKeys: ApiKey[];
  onOpenDocsModal: () => void;
  onSearchDocumentation?: (query: string) => Promise<DocSearchResult[]>;
}

export const ProjectDocsSection: React.FC<ProjectDocsSectionProps> = ({
  projectId,
  apiKeys,
  onOpenDocsModal,
  onSearchDocumentation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DocSearchResult[]>([]);
  const [filterBy, setFilterBy] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Get documentation and related functions from the store
  const {
    documentation,
    loadDocumentation,
    saveDocumentation,
    updateDocumentation,
    deleteDocumentation,
    searchDocumentation: searchStoreDocs,
    getDocumentationByProvider
  } = useAppStore();

  // Filter documentation for the current project
  const projectDocs = useMemo(() => {
    return documentation.filter((doc: TauriDocumentation) => doc.project_id === projectId);
  }, [documentation, projectId]);

  // Load documentation when component mounts or project changes
  useEffect(() => {
    const loadDocs = async () => {
      setLoading(true);
      try {
        // Load all documentation first
        await loadDocumentation();

        // If we have a provider_id, load provider-specific docs
        if (projectId) {
          await getDocumentationByProvider(projectId);
        }
      } catch (error) {
        console.error('Failed to load documentation:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDocs();
  }, [projectId, loadDocumentation, getDocumentationByProvider]);

  const handleDeleteDocumentation = async (id: string) => {
    try {
      await deleteDocumentation(id);
    } catch (error) {
      console.error('Failed to delete documentation:', error);
      throw error;
    }
  };

  const handleSaveDocumentation = async (docData: Omit<ApiDocumentation, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Ensure we have required fields with defaults
      const docToSave: Omit<TauriDocumentation, 'id' | 'created_at' | 'updated_at'> = {
        title: docData.title,
        content: docData.content || '', // Ensure content is always a string
        doc_type: docData.doc_type || 'scraped',
        project_id: projectId,
        provider_id: docData.provider_id || 'unknown',
        url: docData.url || '',
        tags: docData.tags || [],
        language: docData.language || 'en',
        is_favorite: docData.is_favorite || false,
        search_keywords: docData.search_keywords || [],
        linked_keys: docData.linked_keys || []
      };

      return await saveDocumentation(docToSave);
    } catch (error) {
      console.error('Failed to save documentation:', error);
      throw error;
    }
  };



  // Filter documentation by project
  const projectDocumentation = documentation.filter(doc =>
    doc.project_id === projectId
  );

  // Format content for better readability
  const formatContent = useCallback((content: string): string => {
    if (!content) return '';

    // If content is markdown, return it as is
    if (content.includes('# ') || content.includes('## ') || content.includes('### ')) {
      return content;
    }

    // If content is a JSON string, format it as markdown code block
    try {
      const parsed = JSON.parse(content);
      return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
    } catch {
      // For plain text, ensure we return a string with proper line breaks
      return content.split('\n').join('  \n'); // Two spaces at end of line for markdown line break
    }
  }, []);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !onSearchDocumentation) return;

    setIsSearching(true);
    try {
      const results = await onSearchDocumentation(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, onSearchDocumentation]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const getFilteredDocs = useCallback(() => {
    let filtered = documentation;

    switch (filterBy) {
      case 'linked':
        filtered = documentation.filter(doc => doc.linked_keys.length > 0);
        break;
      case 'unlinked':
        filtered = documentation.filter(doc => doc.linked_keys.length === 0);
        break;
      default:
        break;
    }

    return filtered;
  }, [documentation, filterBy]);

  const displayedDocs = useMemo(() => getFilteredDocs(), [getFilteredDocs]);

  const getLinkedKeyNames = useCallback((keyIds: string[]): string[] => {
    return keyIds
      .map((id) => apiKeys.find((k) => k.id === id)?.name || id)
      .filter((name): name is string => Boolean(name));
  }, [apiKeys]);

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return projectDocs;

    const query = searchQuery.toLowerCase();
    return projectDocs.filter((doc) =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query) ||
      doc.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [projectDocs, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <Book className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Project Documentation
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredDocs.length} docs
          </span>
        </div>

        <button onClick={onOpenDocsModal} className="flex gap-2 items-center">
          <Plus className="w-4 h-4" />
          Add Documentation
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2" />
          <input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pr-20 pl-10"
          />
          {searchQuery && (
            <div className="flex absolute right-2 top-1/2 gap-1 transform -translate-y-1/2">
              <button
                onClick={clearSearch}
                className="px-2 h-6 text-xs"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as "all" | "linked" | "unlinked")}>
          <option value="all">All Docs</option>
          <option value="linked">Linked to Keys</option>
          <option value="unlinked">Not Linked</option>
        </select>

        <button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div>
          <div>
            <Search className="w-5 h-5 text-blue-600" />
            Search Results ({searchResults.length})
          </div>
          <div>
            <div className="space-y-3">
              {searchResults.map((result) => (
                <div
                  key={`${result.doc_id}-${result.section_id || 'main'}`}
                  className="p-3 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => window.open(result.url, '_blank')}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {result.title}
                        </h4>
                        <span className="text-xs">
                          {Math.round(result.relevance_score * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {result.snippet}
                      </p>
                    </div>
                    <ExternalLink className="ml-2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-full py-8 text-center">
            <div className="mx-auto mb-2 w-8 h-8 rounded-full border-4 border-blue-600 animate-spin border-t-transparent"></div>
            <p className="text-gray-500">Loading documentation...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="col-span-full py-8 text-center">
            <Book className="mx-auto mb-3 w-12 h-12 text-gray-400" />
            <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-white">
              No documentation found
            </h3>
            <p className="mb-4 text-gray-500">
              {filterBy === 'linked'
                ? 'No documentation is currently linked to API keys'
                : filterBy === 'unlinked'
                  ? 'All documentation is linked to API keys'
                  : 'Start by adding documentation for your APIs'
              }
            </p>
            <button onClick={onOpenDocsModal}>
              <Plus className="mr-2 w-4 h-4" />
              Add Documentation
            </button>
          </div>
        ) : (
          filteredDocs.map((doc: ApiDocumentation) => (
            <div key={doc.id} className="transition-shadow hover:shadow-md">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
                      <div className="max-w-none prose prose-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {formatContent(doc.content)}
                        </ReactMarkdown>
                      </div>
                    </h3>
                    <p className="mb-2 text-sm text-gray-500">
                      Provider: {doc.provider_id}
                    </p>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Tag className="mr-1 w-4 h-4" />
                        {doc.tags.slice(0, 3).join(', ')}
                        {doc.tags.length > 3 && ` +${doc.tags.length - 3} more`}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => window.open(doc.url, '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Sections - Safely render sections if they exist */}
                {Array.isArray(doc.sections) && doc.sections.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {doc.sections.length} section{doc.sections.length !== 1 ? 's' : ''} available
                    </p>
                    <div className="mt-1 text-xs text-gray-500">
                      {doc.sections
                        .slice(0, 3)
                        .map(section => section?.title || 'Untitled')
                        .filter(Boolean)
                        .join(', ')}
                      {doc.sections.length > 3 && (
                        <span className="text-gray-400"> +{doc.sections.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Linked Keys */}
                {Array.isArray(doc.linked_keys) && doc.linked_keys.length > 0 && (
                  <div className="p-2 mb-3 bg-blue-50 rounded dark:bg-blue-900/20">
                    <div className="flex gap-2 items-center mb-1">
                      <Key className="w-3 h-3 text-blue-600" />
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Key className="mr-1 w-4 h-4" />
                        {doc.linked_keys.length} linked {doc.linked_keys.length === 1 ? 'key' : 'keys'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {getLinkedKeyNames(doc.linked_keys).map((keyName) => (
                        <span key={keyName} className="text-xs">
                          {keyName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center pt-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="mr-1 w-4 h-4" />
                    Last updated: {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs">
                      {Array.isArray(doc.linked_keys) && doc.linked_keys.length > 0 ? 'Linked' : 'Unlinked'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      {getFilteredDocs().length > 0 && (
        <div>
          <div className="p-4">
            <h3 className="mb-3 font-medium text-gray-900 dark:text-white">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={onOpenDocsModal}>
                <Plus className="mr-1 w-4 h-4" />
                Add More Documentation
              </button>
              <button onClick={() => setFilterBy('unlinked')}>
                <Key className="mr-1 w-4 h-4" />
                View Unlinked Docs
              </button>
              <button
                onClick={() => {
                  const allTags = Array.from(new Set(documentation.flatMap(d => d.tags)));
                  setSearchQuery(allTags[Math.floor(Math.random() * allTags.length)]);
                }}
              >
                <Search className="mr-1 w-4 h-4" />
                Random Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};