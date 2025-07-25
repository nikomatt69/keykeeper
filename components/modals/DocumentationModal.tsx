import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, FileText, Link, Download, Loader2, CheckCircle, Code } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { ApiProviderService } from '../../lib/services/apiProviderService';
import { DocScraperService } from '../../lib/services/docScraperService';
import { debounce } from 'lodash';

interface DocSuggestion {
  title: string;
  url: string;
  provider: string;
  confidence: number;
  description: string;
}

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyId?: string;
}

export default function DocumentationModal({ isOpen, onClose, apiKeyId }: DocumentationModalProps) {
  const { apiKeys, updateApiKey, saveDocumentation } = useAppStore();
  const [selectedKey, setSelectedKey] = useState<string | null>(apiKeyId || null);
  const [docUrl, setDocUrl] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [isScrapingDocs, setIsScrapingDocs] = useState(false);
  const [docSuggestions, setDocSuggestions] = useState<DocSuggestion[]>([]);
  const [scrapedContent, setScrapedContent] = useState<any>(null);
  const [formattedContent, setFormattedContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'manual' | 'suggestions' | 'scraped'>('suggestions');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentKey = apiKeys.find(key => key.id === selectedKey);

  // Memoize the suggestions generation
  const generateDocSuggestions = useCallback(async () => {
    if (!currentKey || !isOpen || activeTab !== 'suggestions') return;

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsTabLoading(true);

      // Detect provider from key name/service with timeout
      const detection = await Promise.race([
        ApiProviderService.detectProviderFromEnvVar(currentKey.name),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Detection timeout')), 5000)
        )
      ]);

      if (controller.signal.aborted) return;

      const suggestions: DocSuggestion[] = [];

      if (detection) {
        suggestions.push({
          title: `${detection.provider.name} Documentation`,
          url: detection.provider.docsUrl,
          provider: detection.provider.name,
          confidence: detection.confidence,
          description: detection.provider.description
        });
      }

      // Add common documentation patterns (non-blocking)
      const serviceLower = currentKey.service.toLowerCase();
      const commonPatterns = [
        {
          condition: serviceLower.includes('openai'),
          suggestion: {
            title: 'OpenAI API Reference',
            url: 'https://platform.openai.com/docs/api-reference',
            provider: 'OpenAI',
            confidence: 0.9,
            description: 'Complete API reference for OpenAI services'
          }
        },
        {
          condition: serviceLower.includes('stripe'),
          suggestion: {
            title: 'Stripe API Documentation',
            url: 'https://stripe.com/docs/api',
            provider: 'Stripe',
            confidence: 0.9,
            description: 'Payment processing API documentation'
          }
        },
        {
          condition: serviceLower.includes('supabase'),
          suggestion: {
            title: 'Supabase Documentation',
            url: 'https://supabase.com/docs',
            provider: 'Supabase',
            confidence: 0.9,
            description: 'Open source Firebase alternative docs'
          }
        }
      ];

      // Add all matching patterns
      commonPatterns.forEach(({ condition, suggestion }) => {
        if (condition) {
          suggestions.push(suggestion);
        }
      });

      if (!controller.signal.aborted) {
        setDocSuggestions(suggestions);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to generate doc suggestions:', error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsTabLoading(false);
      }
    }
  }, [currentKey, isOpen, activeTab]);

  // Store the debounced function in a ref to maintain it between renders
  const debouncedTabChangeRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Handle tab changes with cleanup
  useEffect(() => {
    if (!isOpen) return;

    // Clean up any existing debounced function
    if (debouncedTabChangeRef.current) {
      debouncedTabChangeRef.current.cancel();
    }

    // Create a new AbortController for this operation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create a new debounced function
    debouncedTabChangeRef.current = debounce(() => {
      if (controller.signal.aborted) return;

      if (activeTab === 'suggestions') {
        generateDocSuggestions();
      } else {
        // Clean up any pending requests when switching away
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setIsTabLoading(false);
      }
    }, 300);

    // Execute the debounced function
    debouncedTabChangeRef.current();

    // Cleanup function
    return () => {
      if (debouncedTabChangeRef.current) {
        debouncedTabChangeRef.current.cancel();
      }
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };
  }, [activeTab, isOpen, generateDocSuggestions]);

  // Format the scraped content for better readability
  const formatScrapedContent = (content: any): string => {
    if (!content) return '';

    // If content is already a string, try to parse it
    let parsedContent = content;
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        // If it's not JSON, return as is
        return content;
      }
    }

    // Handle different content types
    if (parsedContent.sections && Array.isArray(parsedContent.sections)) {
      // Format sections with headers and content
      return parsedContent.sections
        .map((section: any) => {
          const title = section.title ? `## ${section.title}\n\n` : '';
          const content = section.content || '';
          return `${title}${content}\n\n`;
        })
        .join('\n---\n\n');
    } else if (parsedContent.content) {
      // If there's a content field, use that
      return parsedContent.content;
    }

    // Fallback to stringified JSON
    return JSON.stringify(parsedContent, null, 2);
  };

  const handleScrapeDocumentation = async (url: string) => {
    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsScrapingDocs(true);
      setActiveTab('scraped');

      const result = await Promise.race([
        DocScraperService.scrapeProviderDocs(
          currentKey?.service || 'unknown',
          url
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Scraping timeout')), 10000)
        )
      ]);

      if (controller.signal.aborted) return;

      setScrapedContent(result);
      setFormattedContent(formatScrapedContent(result));
      setDocUrl(url);
      setDocTitle(result.title || 'Documentation');
    } catch (error) {
      console.error('Failed to scrape documentation:', error);
    } finally {
      if (!controller.signal.aborted) {
        setIsScrapingDocs(false);
      }
    }
  };

  const handleSaveDocumentation = async () => {
    if (!selectedKey || !docUrl || !currentKey) return;

    try {
      // Update the API key with documentation URL and title
      await updateApiKey({
        ...currentKey,
        documentation_url: docUrl,
        documentation_title: docTitle || 'Documentation'
      });

      // Save the full documentation content to the store
      if (scrapedContent) {
        const docData = {
          title: docTitle || 'Documentation',
          content: JSON.stringify(scrapedContent),
          doc_type: 'scraped',
          project_id: currentKey.project_path,
          provider_id: currentKey.service,
          url: docUrl,
          tags: [currentKey.service],
          language: 'en',
          is_favorite: false,
          search_keywords: [currentKey.service, currentKey.name],
          linked_keys: [selectedKey] // Link to the current API key
        };

        await saveDocumentation(docData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save documentation:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="flex flex-col w-full max-w-7xl max-h-[95vh] overflow-hidden bg-white rounded-xl shadow-xl dark:bg-gray-800"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex justify-center items-center w-10 h-10 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentKey ? `Documentation for ${currentKey.name}` : 'Documentation'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex overflow-hidden flex-1">
            {/* Left Panel - Key Selection */}
            <div className="overflow-y-auto p-4 w-80 border-r border-gray-200 dark:border-gray-700">
              <h3 className="mb-3 font-medium text-gray-900 dark:text-white">Select API Key</h3>
              <div className="overflow-y-auto space-y-2 max-h-40">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedKey === key.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
                      }`}
                    onClick={() => setSelectedKey(key.id)}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
                    <div className="text-sm text-gray-500 truncate dark:text-gray-400">
                      {key.service}
                    </div>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    No API keys found. Add an API key first.
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="mb-3 font-medium text-gray-900 dark:text-white">Documentation URL</h3>
                <input
                  type="text"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.example.com"
                  className="px-3 py-2 w-full text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => docUrl && handleScrapeDocumentation(docUrl)}
                  disabled={!docUrl || !selectedKey || isScrapingDocs}
                  className="flex justify-center items-center px-4 py-2 mt-2 w-full text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScrapingDocs ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    'Scrape Documentation'
                  )}
                </button>
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex overflow-hidden flex-col flex-1">
              {/* Tabs */}
              <div className="px-6 pt-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'suggestions'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                  >
                    Suggestions
                    {isTabLoading && activeTab === 'suggestions' && (
                      <Loader2 className="w-3 h-3 ml-1.5 inline-block animate-spin" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'manual'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                  >
                    Manual Entry
                  </button>
                  <button
                    onClick={() => setActiveTab('scraped')}
                    disabled={!scrapedContent}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'scraped'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                  >
                    Scraped Content
                    {isScrapingDocs && activeTab === 'scraped' && (
                      <Loader2 className="w-3 h-3 ml-1.5 inline-block animate-spin" />
                    )}
                  </button>
                </div>

              </div>

              {/* Tab Content */}
              {activeTab === 'suggestions' && (
                <div>
                  {docSuggestions.length > 0 ? (
                    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {docSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-lg border transition-shadow hover:shadow-md dark:border-gray-700"
                          onClick={() => handleScrapeDocumentation(suggestion.url)}
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {suggestion.title}
                            </h3>
                            <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                              {suggestion.provider}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {suggestion.description}
                          </p>
                          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center">
                              <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-500" />
                              {Math.round(suggestion.confidence * 100)}% match
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No documentation suggestions found for this API key.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'manual' && (
                <div className="p-6">
                  <div className="mb-4">
                    <label
                      htmlFor="doc-title"
                      className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Title
                    </label>
                    <input
                      type="text"
                      id="doc-title"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Documentation Title"
                      className="px-3 py-2 w-full text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="doc-content"
                      className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Content
                    </label>
                    <textarea
                      id="doc-content"
                      rows={10}
                      value={formattedContent}
                      onChange={(e) => setFormattedContent(e.target.value)}
                      placeholder="Enter documentation content here..."
                      className="px-3 py-2 w-full font-mono text-sm text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'scraped' && (
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-900 dark:text-white">Scraped Content</h3>
                    {scrapedContent?.url && (
                      <a
                        href={scrapedContent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View Original
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>
                    )}
                  </div>

                  {isScrapingDocs ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="text-center">
                        <Loader2 className="mx-auto mb-2 w-8 h-8 text-gray-400 animate-spin" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Scraping documentation...
                        </p>
                      </div>
                    </div>
                  ) : scrapedContent ? (
                    <div className="max-w-none prose dark:prose-invert">
                      <h1>{scrapedContent.title || 'Documentation'}</h1>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: formattedContent || 'No content available.'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                      No scraped content available. Enter a URL and click &quot;Scrape Documentation&quot; to begin.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedKey && currentKey ? (
                <>
                  Documenting: <span className="font-medium">{currentKey.name}</span>
                </>
              ) : (
                'Select an API key to continue'
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDocumentation}
                disabled={!selectedKey || !docUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md border border-transparent shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Documentation
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
