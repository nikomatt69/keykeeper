import React, { useState, useEffect } from 'react';
import { X, Book, ExternalLink, Search, FileText, RefreshCw, Bot, Sparkles, Save, Download, Code, Settings, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../lib/store';
import { TauriAPI } from '../../lib/tauri-api';
import { useMLEngine, useLLMDocumentation } from '../../lib/hooks/useMLEngine';
import { llmProxy } from '../../lib/services/llmProxyService';
import type { GeneratedDocumentation, CodeExample, DocumentationSection } from '../../lib/tauri-api';

interface ApiDocumentation {
  id: string;
  provider_id: string;
  title: string;
  url: string;
  content: string;
  sections: DocSection[];
  tags: string[];
  last_updated: string;
  version?: string;
  language: string;
}

interface DocSection {
  id: string;
  title: string;
  content: string;
  level: number;
  anchor?: string;
}

interface AllDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LLMGenerationOptions {
  provider: string;
  context: string;
  includeExamples: boolean;
  includeConfig: boolean;
  framework?: string;
  environment?: string;
}

export const AllDocumentationModal: React.FC<AllDocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [documentations, setDocumentations] = useState<ApiDocumentation[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<ApiDocumentation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ApiDocumentation | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'generate'>('browse');
  const [showLLMPanel, setShowLLMPanel] = useState(false);
  const [generationOptions, setGenerationOptions] = useState<LLMGenerationOptions>({
    provider: '',
    context: '',
    includeExamples: true,
    includeConfig: true,
    framework: 'react',
    environment: 'development'
  });
  
  const { apiKeys, saveDocumentation } = useAppStore();
  const { llmAvailable, generateDocumentation } = useMLEngine({ enableLLM: true });
  const {
    isGenerating,
    generatedDocs,
    codeExamples,
    configTemplate,
    error: llmError,
    generateComprehensiveDocumentation,
    clearDocumentation
  } = useLLMDocumentation();

  // Load all documentations
  const loadDocumentations = async () => {
    setIsLoading(true);
    try {
      // Get all documentations from the native store
      const allDocs = await TauriAPI.getNativeDocumentation();
      setDocumentations(allDocs);
      setFilteredDocs(allDocs);
    } catch (error) {
      console.error('Failed to load documentations:', error);
      setDocumentations([]);
      setFilteredDocs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter documentations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocs(documentations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = documentations.filter(
      doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        doc.provider_id.toLowerCase().includes(query)
    );
    setFilteredDocs(filtered);
  }, [searchQuery, documentations]);

  // Load documentations when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDocumentations();
    }
  }, [isOpen]);

  // Handle document selection
  const handleSelectDoc = (doc: ApiDocumentation) => {
    setSelectedDoc(doc);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedDoc(null);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await loadDocumentations();
  };

  // Generate documentation using LLM
  const handleGenerateDocumentation = async () => {
    if (!generationOptions.provider || !generationOptions.context) {
      return;
    }

    try {
      await generateComprehensiveDocumentation(
        generationOptions.provider,
        generationOptions.context,
        {
          apiKeyFormat: 'API_KEY',
          framework: generationOptions.framework,
          environment: generationOptions.environment,
          includeExamples: generationOptions.includeExamples,
          includeConfig: generationOptions.includeConfig
        }
      );
      setActiveTab('browse'); // Switch to browse tab to see results
    } catch (error) {
      console.error('Failed to generate documentation:', error);
    }
  };

  // Save generated documentation
  const handleSaveGeneratedDoc = async (doc: GeneratedDocumentation) => {
    try {
      const docData = {
        title: `${generationOptions.provider} API Documentation`,
        content: doc.content,
        doc_type: 'api' as const,
        provider_id: generationOptions.provider,
        tags: [generationOptions.provider, 'generated', 'llm'],
        language: 'en',
        is_favorite: false,
        search_keywords: [generationOptions.provider, 'api', 'documentation'],
        linked_keys: [] // Could link to relevant API keys
      };

      await saveDocumentation(docData);
      await loadDocumentations(); // Refresh the list
      clearDocumentation(); // Clear the generated content
    } catch (error) {
      console.error('Failed to save generated documentation:', error);
    }
  };

  // Export documentation as markdown
  const handleExportDocumentation = (doc: ApiDocumentation | GeneratedDocumentation) => {
    const content = 'sections' in doc && doc.sections ? 
      doc.sections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n') :
      doc.content;
    
    const markdown = `# ${doc.title || 'Documentation'}\n\n${content}`;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(doc.title || 'documentation').replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get unique providers from API keys
  const getProviderSuggestions = () => {
    const providers = [...new Set(apiKeys.map(key => key.service))];
    return providers.filter(provider => provider && provider.trim() !== '');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Animation variants
  const modalVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 }
    },
    exit: {
      opacity: 0,
      y: 20,
      transition: { duration: 0.1 }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black bg-opacity-50">
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={modalVariants}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {activeTab === 'generate' ? (
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            ) : (
              <Book className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {selectedDoc ? selectedDoc.title : 
               activeTab === 'generate' ? 'Generate Documentation' : 'All Documentations'}
            </h2>
            {selectedDoc && 'url' in selectedDoc && (
              <a
                href={selectedDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ExternalLink className="mr-1 w-4 h-4" />
                Open in Browser
              </a>
            )}
            {llmAvailable && (
              <div className="flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full dark:bg-green-900/30 dark:text-green-300">
                <Bot className="w-3 h-3 mr-1" />
                LLM Ready
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!selectedDoc && (
              <>
                <button
                  onClick={() => setActiveTab('browse')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'browse' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Browse
                </button>
                <button
                  onClick={() => setActiveTab('generate')}
                  disabled={!llmAvailable}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === 'generate'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <Wand2 className="w-4 h-4 mr-1.5" />
                  Generate
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
            {selectedDoc && (
              <>
                <button
                  onClick={() => handleExportDocumentation(selectedDoc)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Export as Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleBackToList}
                  className="px-3 py-1 text-sm text-gray-700 rounded-md transition-colors dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Back to List
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar - Only show for browse tab */}
        {!selectedDoc && activeTab === 'browse' && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <div className="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block py-2 pr-3 pl-10 w-full leading-5 placeholder-gray-500 bg-white rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm"
                placeholder="Search documentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex absolute inset-y-0 right-0 items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-hidden flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-8 h-8 rounded-full border-b-2 border-blue-500 animate-spin"></div>
            </div>
          ) : selectedDoc ? (
            // Document Detail View
            <div className="overflow-y-auto p-6 h-full">
              <div className="max-w-none prose dark:prose-invert">
                <div className="mb-6">
                  <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedDoc.title}
                  </h1>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {selectedDoc.provider_id}
                    </span>
                    {'version' in selectedDoc && selectedDoc.version && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        v{selectedDoc.version}
                      </span>
                    )}
                    {'language' in selectedDoc && selectedDoc.language && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {selectedDoc.language}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {formatDate(selectedDoc.last_updated)}
                    </span>
                  </div>
                </div>

                {/* Document Sections */}
                <div className="space-y-6">
                  {selectedDoc.sections?.map((section) => (
                    <div key={section.id} id={section.anchor} className="scroll-mt-20">
                      <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
                        {section.title}
                      </h2>
                      <div
                        className="max-w-none prose dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'generate' ? (
            // LLM Documentation Generation View
            <div className="overflow-y-auto p-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Generation Form */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg">
                    <div className="flex items-center space-x-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">AI Documentation Generator</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Generate comprehensive API documentation using our local LLM engine. Choose a provider and context to get started.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Provider
                      </label>
                      <select
                        value={generationOptions.provider}
                        onChange={(e) => setGenerationOptions(prev => ({ ...prev, provider: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">Select a provider...</option>
                        {getProviderSuggestions().map(provider => (
                          <option key={provider} value={provider}>{provider}</option>
                        ))}
                        <option value="custom">Custom Provider</option>
                      </select>
                      {generationOptions.provider === 'custom' && (
                        <input
                          type="text"
                          placeholder="Enter custom provider name"
                          value={generationOptions.provider === 'custom' ? '' : generationOptions.provider}
                          onChange={(e) => setGenerationOptions(prev => ({ ...prev, provider: e.target.value }))}
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Context & Description
                      </label>
                      <textarea
                        value={generationOptions.context}
                        onChange={(e) => setGenerationOptions(prev => ({ ...prev, context: e.target.value }))}
                        placeholder="Describe the API, its purpose, key features, and any specific requirements..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Framework
                        </label>
                        <select
                          value={generationOptions.framework}
                          onChange={(e) => setGenerationOptions(prev => ({ ...prev, framework: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="react">React</option>
                          <option value="nextjs">Next.js</option>
                          <option value="vue">Vue.js</option>
                          <option value="nodejs">Node.js</option>
                          <option value="python">Python</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Environment
                        </label>
                        <select
                          value={generationOptions.environment}
                          onChange={(e) => setGenerationOptions(prev => ({ ...prev, environment: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="development">Development</option>
                          <option value="staging">Staging</option>
                          <option value="production">Production</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Include Options
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={generationOptions.includeExamples}
                            onChange={(e) => setGenerationOptions(prev => ({ ...prev, includeExamples: e.target.checked }))}
                            className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Code Examples</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={generationOptions.includeConfig}
                            onChange={(e) => setGenerationOptions(prev => ({ ...prev, includeConfig: e.target.checked }))}
                            className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Configuration Templates</span>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateDocumentation}
                      disabled={!generationOptions.provider || !generationOptions.context || isGenerating}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Documentation
                        </>
                      )}
                    </button>

                    {llmError && (
                      <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md dark:bg-red-900/50 dark:border-red-700 dark:text-red-300">
                        <p className="text-sm">{llmError}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generated Content Preview */}
                <div className="space-y-6">
                  {generatedDocs ? (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Generated Documentation</h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSaveGeneratedDoc(generatedDocs)}
                            className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </button>
                          <button
                            onClick={() => handleExportDocumentation(generatedDocs)}
                            className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </button>
                        </div>
                      </div>
                      <div className="prose dark:prose-invert max-w-none text-sm">
                        <div dangerouslySetInnerHTML={{ __html: generatedDocs.content }} />
                      </div>
                      
                      {codeExamples.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Code Examples</h4>
                          <div className="space-y-3">
                            {codeExamples.map((example, index) => (
                              <div key={index} className="bg-gray-100 dark:bg-gray-900 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {example.language}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-500">
                                    {example.title}
                                  </span>
                                </div>
                                <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                                  <code>{example.code}</code>
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                      <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        AI-Generated Content
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Fill out the form and click generate to create comprehensive API documentation using our local LLM.
                      </p>
                      {!llmAvailable && (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          ⚠️ LLM engine is not available. Some features may be limited.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Document Browse View
            <div className="overflow-y-auto h-full">
              {filteredDocs.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-64 text-gray-500 dark:text-gray-400">
                  <FileText className="mb-4 w-12 h-12 opacity-30" />
                  <p className="text-lg font-medium">No documentations found</p>
                  <p className="mt-1 text-sm">
                    {searchQuery ? 'Try a different search term' : 'Add documentations to get started'}
                  </p>
                  {llmAvailable && (
                    <button
                      onClick={() => setActiveTab('generate')}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Documentation
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDocs.map((doc) => (
                    <li key={doc.id}>
                      <button
                        onClick={() => handleSelectDoc(doc)}
                        className="p-4 w-full text-left transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              {doc.title}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {doc.content.substring(0, 150)}{doc.content.length > 150 ? '...' : ''}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {doc.provider_id}
                              </span>
                              {'version' in doc && doc.version && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  v{doc.version}
                                </span>
                              )}
                              {doc.tags?.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end ml-4">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(doc.last_updated)}
                            </span>
                            <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {doc.sections?.length || 0} sections
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-3 bg-gray-50 border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {!selectedDoc && activeTab === 'browse' && (
              <span>{filteredDocs.length} {filteredDocs.length === 1 ? 'documentation' : 'documentations'} found</span>
            )}
            {!selectedDoc && activeTab === 'generate' && llmAvailable && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>LLM engine ready for documentation generation</span>
              </div>
            )}
            {!selectedDoc && activeTab === 'generate' && !llmAvailable && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span>LLM engine not available</span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            {generatedDocs && activeTab === 'generate' && (
              <button
                onClick={clearDocumentation}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 shadow-sm transition-colors dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-900"
              >
                Clear Generated
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 shadow-sm transition-colors dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AllDocumentationModal;
