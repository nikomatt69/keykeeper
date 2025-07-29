import React, { useState, useEffect } from 'react';
import { X, Book, Plus, Search, ExternalLink, Trash2, Link2, FileText, Badge } from 'lucide-react';


interface ApiKey {
  id: string;
  name: string;
  service: string;
  description?: string;
  environment: 'dev' | 'staging' | 'production';
}

interface ApiProvider {
  id: string;
  name: string;
  description: string;
  docs_url: string;
  category: string;
}

interface ApiDocumentation {
  id: string;
  provider_id: string;
  title: string;
  url: string;
  content: string;
  sections: DocSection[];
  tags: string[];
  last_updated: string;
  linked_keys: string[];
}

interface DocSection {
  id: string;
  title: string;
  content: string;
  level: number;
  anchor?: string;
}

interface DocsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKey[];
  onAddDocumentation: (providerId: string, docsUrl: string, linkedKeys: string[]) => Promise<void>;
  onLinkApiKey: (docId: string, keyId: string) => Promise<void>;
  onUnlinkApiKey: (docId: string, keyId: string) => Promise<void>;
}

export const DocsManagementModal: React.FC<DocsManagementModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onAddDocumentation,
  onLinkApiKey,
  onUnlinkApiKey,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'add' | 'link'>('browse');
  const [documentation, setDocumentation] = useState<ApiDocumentation[]>([]);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add documentation form
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [customDocsUrl, setCustomDocsUrl] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Link management
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [selectedKeyForLink, setSelectedKeyForLink] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
      fetchDocumentation();
    }
  }, [isOpen]);

  const fetchProviders = async () => {
    try {
      // Mock data - replace with actual API call
      setProviders([
        {
          id: 'better-auth',
          name: 'Better Auth',
          description: 'Modern authentication for web apps',
          docs_url: 'https://www.better-auth.com/docs',
          category: 'auth'
        },
        {
          id: 'stripe',
          name: 'Stripe',
          description: 'Online payment processing',
          docs_url: 'https://stripe.com/docs',
          category: 'payment'
        },
        {
          id: 'openai',
          name: 'OpenAI',
          description: 'AI and machine learning APIs',
          docs_url: 'https://platform.openai.com/docs',
          category: 'ai'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const fetchDocumentation = async () => {
    try {
      // Mock data - replace with actual API call
      setDocumentation([
        {
          id: 'doc1',
          provider_id: 'better-auth',
          title: 'Better Auth Documentation',
          url: 'https://www.better-auth.com/docs',
          content: 'Authentication setup and configuration...',
          sections: [
            {
              id: 'setup',
              title: 'Setup',
              content: 'Getting started with Better Auth...',
              level: 1,
              anchor: 'setup'
            }
          ],
          tags: ['auth', 'setup', 'configuration'],
          last_updated: new Date().toISOString(),
          linked_keys: ['key1', 'key2']
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch documentation:', error);
    }
  };

  const handleAddDocumentation = async () => {
    if (!selectedProvider && !customDocsUrl) return;

    setLoading(true);
    try {
      const provider = providers.find(p => p.id === selectedProvider);
      const docsUrl = customDocsUrl || provider?.docs_url || '';

      await onAddDocumentation(selectedProvider, docsUrl, selectedKeys);

      // Reset form
      setSelectedProvider('');
      setCustomDocsUrl('');
      setSelectedKeys([]);
      setActiveTab('browse');

      // Refresh documentation
      await fetchDocumentation();
    } catch (error) {
      console.error('Failed to add documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkKey = async () => {
    if (!selectedDoc || !selectedKeyForLink) return;

    try {
      await onLinkApiKey(selectedDoc, selectedKeyForLink);
      setSelectedDoc('');
      setSelectedKeyForLink('');
      await fetchDocumentation();
    } catch (error) {
      console.error('Failed to link API key:', error);
    }
  };

  const handleUnlinkKey = async (docId: string, keyId: string) => {
    try {
      await onUnlinkApiKey(docId, keyId);
      await fetchDocumentation();
    } catch (error) {
      console.error('Failed to unlink API key:', error);
    }
  };

  const filteredDocumentation = documentation.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getLinkedKeyNames = (keyIds: string[]) => {
    return keyIds.map(id => apiKeys.find(k => k.id === id)?.name || id).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-3 items-center">
            <Book className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Documentation Management
            </h2>
          </div>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'browse'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <Book className="inline-block mr-2 w-4 h-4" />
            Browse Docs
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'add'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <Plus className="inline-block mr-2 w-4 h-4" />
            Add Documentation
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'link'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <Link2 className="inline-block mr-2 w-4 h-4" />
            Link API Keys
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2" />
                <input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Documentation List */}
              <div className="space-y-4">
                {filteredDocumentation.map((doc) => (
                  <div key={doc.id}>
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {doc.title}
                            </h3>
                            <span className="text-gray-500">
                              {providers.find(p => p.id === doc.provider_id)?.name || doc.provider_id}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2">
                            {doc.tags.map((tag) => (
                              <span key={tag} className="text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>

                          {doc.linked_keys.length > 0 && (
                            <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Linked API Keys: </span>
                              {getLinkedKeyNames(doc.linked_keys)}
                            </div>
                          )}

                          <div className="flex gap-4 items-center text-sm text-gray-500">
                            <span>Updated: {new Date(doc.last_updated).toLocaleDateString()}</span>
                            <span>{doc.sections.length} sections</span>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            className="outline"
                            onClick={() => window.open(doc.url, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Linked Keys Management */}
                      {doc.linked_keys.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-wrap gap-2">
                            {doc.linked_keys.map((keyId) => {
                              const key = apiKeys.find(k => k.id === keyId);
                              if (!key) return null;
                              return (
                                <div
                                  key={keyId}
                                  className="flex gap-1 items-center px-2 py-1 text-sm text-blue-700 bg-blue-50 rounded dark:bg-blue-900/20 dark:text-blue-300"
                                >
                                  <span>{key.name}</span>
                                  <button
                                    onClick={() => handleUnlinkKey(doc.id, keyId)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="provider">Select API Provider</label>
                  <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                    <option value="">Choose a provider...</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>

                </div>

                <div>
                  <label htmlFor="docs-url">Documentation URL (Optional)</label>
                  <input
                    id="docs-url"
                    placeholder="https://docs.example.com/api"
                    value={customDocsUrl}
                    onChange={(e) => setCustomDocsUrl(e.target.value)}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave empty to use provider&apos;s default documentation URL
                  </p>
                </div>

                <div>
                  <label>Link API Keys (Optional)</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {apiKeys.map((key) => (
                      <label
                        key={key.id}
                        className="flex gap-2 items-center p-2 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeys([...selectedKeys, key.id]);
                            } else {
                              setSelectedKeys(selectedKeys.filter(id => id !== key.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{key.name}</div>
                          <div className="text-xs text-gray-500">{key.service}</div>
                        </div>
                        <span className={key.environment === 'production' ? 'text-red-500' : 'text-blue-500'}>
                          {key.environment}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button className="" onClick={onClose}>
                  Cancel
                </button>
                <button
                  onClick={handleAddDocumentation}
                  disabled={loading || (!selectedProvider && !customDocsUrl)}
                >
                  {loading ? 'Adding...' : 'Add Documentation'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div>
                  <label>Select Documentation</label>
                  <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}>
                    <option value="">Choose documentation...</option>
                    {documentation.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        <div>
                          <div className="font-medium">{doc.title}</div>
                          <div className="text-sm text-gray-500">
                            {providers.find(p => p.id === doc.provider_id)?.name}
                          </div>
                        </div>
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Select API Key to Link</label>
                  <select value={selectedKeyForLink} onChange={(e) => setSelectedKeyForLink(e.target.value)}>
                    <option value="">Choose API key...</option>
                    {apiKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        <div className="flex justify-between items-center w-full">
                          <div>
                            <div className="font-medium">{key.name}</div>
                            <div className="text-sm text-gray-500">{key.service}</div>
                          </div>
                          <span className={key.environment === 'production' ? 'text-red-500' : 'text-blue-500'}>
                            {key.environment}
                          </span>
                        </div>
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={onClose}>
                  Cancel
                </button>
                <button
                  onClick={handleLinkKey}
                  disabled={!selectedDoc || !selectedKeyForLink}
                >
                  Link API Key
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};