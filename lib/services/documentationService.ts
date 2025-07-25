import { ApiProvider } from './apiProviderService';

export interface ApiDocumentation {
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

export interface DocSection {
    id: string;
    title: string;
    content: string;
    level: number;
    anchor?: string;
    parent_id?: string;
}

export interface DocSearchResult {
    doc_id: string;
    section_id?: string;
    title: string;
    snippet: string;
    url: string;
    relevance_score: number;
    provider_id: string;
}

export interface DocsResponse {
    success: boolean;
    message: string;
    data?: any;
}

export class DocumentationService {
    private invoke: any;

    constructor(invoke: any) {
        this.invoke = invoke;
    }

    /**
     * Add documentation for an API provider
     */
    async addProviderDocumentation(providerId: string, docsUrl: string): Promise<ApiDocumentation> {
        const response: DocsResponse = await this.invoke('add_provider_documentation', {
            provider_id: providerId,
            docs_url: docsUrl
        });

        if (!response.success) {
            throw new Error(response.message);
        }

        return response.data;
    }

    /**
     * Get documentation for a specific provider
     */
    async getProviderDocumentation(providerId: string): Promise<ApiDocumentation[]> {
        const response: DocsResponse = await this.invoke('get_provider_documentation', providerId);
        
        if (!response.success) {
            throw new Error(response.message);
        }

        return response.data || [];
    }

    /**
     * Search documentation content
     */
    async searchDocumentation(query: string, providerId?: string): Promise<DocSearchResult[]> {
        return await this.invoke('search_documentation', {
            query,
            provider_id: providerId
        });
    }

    /**
     * Get specific documentation by ID
     */
    async getDocumentationById(docId: string): Promise<ApiDocumentation> {
        const response: DocsResponse = await this.invoke('get_documentation_by_id', docId);
        
        if (!response.success) {
            throw new Error(response.message);
        }

        return response.data;
    }

    /**
     * Update documentation for a provider
     */
    async updateProviderDocumentation(providerId: string, docsUrl: string): Promise<void> {
        const response: DocsResponse = await this.invoke('update_provider_documentation', providerId, docsUrl);
        
        if (!response.success) {
            throw new Error(response.message);
        }
    }

    /**
     * Remove documentation for a provider
     */
    async removeProviderDocumentation(providerId: string): Promise<void> {
        const response: DocsResponse = await this.invoke('remove_provider_documentation', providerId);
        
        if (!response.success) {
            throw new Error(response.message);
        }
    }

    /**
     * Get all providers that have documentation
     */
    async getIndexedProviders(): Promise<string[]> {
        return await this.invoke('get_indexed_providers');
    }

    /**
     * Auto-add documentation for all known providers
     */
    async autoIndexProviderDocs(): Promise<{ success_count: number; error_count: number; errors: string[] }> {
        const response: DocsResponse = await this.invoke('auto_index_provider_docs');
        
        return response.data || { success_count: 0, error_count: 0, errors: [] };
    }

    /**
     * Get documentation suggestions based on current context
     */
    async getContextDocumentationSuggestions(
        providerIds: string[], 
        contextKeywords: string[]
    ): Promise<DocSearchResult[]> {
        return await this.invoke('get_context_documentation_suggestions', providerIds, contextKeywords);
    }

    /**
     * Get documentation for multiple providers that match the current context
     */
    async getRelevantDocumentation(providers: ApiProvider[], contextKeywords: string[] = []): Promise<{
        provider: ApiProvider;
        documentation: ApiDocumentation[];
        suggestions: DocSearchResult[];
    }[]> {
        const results = [];

        for (const provider of providers) {
            try {
                // Get existing documentation for this provider
                const documentation = await this.getProviderDocumentation(provider.id);
                
                // Get context-specific suggestions
                const suggestions = contextKeywords.length > 0 ? 
                    await this.getContextDocumentationSuggestions([provider.id], contextKeywords) : 
                    [];

                results.push({
                    provider,
                    documentation,
                    suggestions
                });
            } catch (error) {
                console.warn(`Failed to get documentation for provider ${provider.name}:`, error);
                results.push({
                    provider,
                    documentation: [],
                    suggestions: []
                });
            }
        }

        return results;
    }

    /**
     * Check if a provider has documentation available
     */
    async hasDocumentation(providerId: string): Promise<boolean> {
        try {
            const docs = await this.getProviderDocumentation(providerId);
            return docs.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get quick documentation snippets for common topics
     */
    async getQuickHelp(providerId: string, topics: string[] = ['setup', 'authentication', 'api', 'examples']): Promise<DocSearchResult[]> {
        const results: DocSearchResult[] = [];
        
        for (const topic of topics) {
            try {
                const topicResults = await this.searchDocumentation(topic, providerId);
                results.push(...topicResults.slice(0, 2)); // Get top 2 results per topic
            } catch (error) {
                console.warn(`Failed to get quick help for topic ${topic}:`, error);
            }
        }

        // Deduplicate and sort by relevance
        const uniqueResults = results.filter((result, index, array) => 
            array.findIndex(r => r.doc_id === result.doc_id && r.section_id === result.section_id) === index
        );

        return uniqueResults.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 8);
    }
}