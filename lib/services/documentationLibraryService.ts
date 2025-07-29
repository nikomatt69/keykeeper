
import { TauriAPI } from '../tauri-api'
import type {
    DocumentationLibrary,
    DocumentationChunk,
    DocumentationSearchResult,
    AddDocumentationRequest,
    AddManualDocumentationRequest,
    SearchDocumentationLibraryRequest,
    BulkImportRequest,
    BulkDocumentEntry,
    LibraryStatistics,
    ContentType
} from '../types'

/**
 * Documentation Library Service - Type-safe service layer for documentation functionality
 * Provides a clean interface between the frontend and Rust backend documentation commands
 */
export class DocumentationLibraryService {
    /**
     * Add documentation from a URL
     */
    static async addFromUrl(
        providerId: string,
        providerName: string,
        providerCategory: string,
        docsUrl: string,
        description?: string,
        tags: string[] = [],
        version?: string
    ): Promise<string> {
        const request: AddDocumentationRequest = {
            provider_id: providerId,
            provider_name: providerName,
            provider_category: providerCategory,
            docs_url: docsUrl,
            description,
            tags,
            version
        }
        return await TauriAPI.addDocumentationFromUrl(request)
    }

    /**
     * Add manual documentation content
     */
    static async addManual(
        providerId: string,
        providerName: string,
        title: string,
        content: string,
        sectionPath: string[] = [],
        contentType: ContentType = 'overview',
        tags: string[] = [],
        importanceScore?: number
    ): Promise<string> {
        const request: AddManualDocumentationRequest = {
            provider_id: providerId,
            provider_name: providerName,
            title,
            content,
            section_path: sectionPath,
            content_type: contentType,
            tags,
            importance_score: importanceScore
        }
        return await TauriAPI.addManualDocumentation(request)
    }

    /**
     * Search documentation library
     */
    static async search(
        query: string,
        options: {
            libraryIds?: string[]
            providerIds?: string[]
            contentTypes?: ContentType[]
            sectionFilter?: string[]
            minSimilarity?: number
            maxResults?: number
            includeMetadata?: boolean
            boostRecent?: boolean
        } = {}
    ): Promise<DocumentationSearchResult[]> {
        const request: SearchDocumentationLibraryRequest = {
            query,
            library_ids: options.libraryIds,
            provider_ids: options.providerIds,
            content_types: options.contentTypes,
            section_filter: options.sectionFilter,
            min_similarity: options.minSimilarity ?? 0.6,
            max_results: options.maxResults ?? 20,
            include_metadata: options.includeMetadata ?? true,
            boost_recent: options.boostRecent ?? false
        }

        return await TauriAPI.searchDocumentationLibrary(request)
    }

    /**
     * Get all documentation libraries
     */
    static async getLibraries(): Promise<DocumentationLibrary[]> {
        return await TauriAPI.getDocumentationLibraries()
    }

    /**
     * Get a specific documentation library
     */
    static async getLibrary(libraryId: string): Promise<DocumentationLibrary | null> {
        return await TauriAPI.getDocumentationLibrary(libraryId)
    }

    /**
     * Get chunks for a documentation library with pagination
     */
    static async getLibraryChunks(
        libraryId: string,
        offset: number = 0,
        limit: number = 50
    ): Promise<DocumentationChunk[]> {
        return await TauriAPI.getLibraryChunks(libraryId, offset, limit)
    }

    /**
     * Update documentation library metadata
     */
    static async updateLibrary(
        libraryId: string,
        name?: string,
        description?: string,
        tags?: string[]
    ): Promise<boolean> {
        return await TauriAPI.updateDocumentationLibrary(libraryId, name, description, tags)
    }

    /**
     * Delete a documentation library
     */
    static async deleteLibrary(libraryId: string): Promise<boolean> {
        return await TauriAPI.deleteDocumentationLibrary(libraryId)
    }

    /**
     * Refresh documentation from its original URL
     */
    static async refreshLibrary(libraryId: string): Promise<boolean> {
        return await TauriAPI.refreshDocumentationLibrary(libraryId)
    }

    /**
     * Get library statistics
     */
    static async getStatistics(): Promise<LibraryStatistics> {
        return await TauriAPI.getLibraryStatistics()
    }

    /**
     * Bulk import documentation
     */
    static async bulkImport(
        providerId: string,
        providerName: string,
        documents: BulkDocumentEntry[]
    ): Promise<string> {
        const request: BulkImportRequest = {
            provider_id: providerId,
            provider_name: providerName,
            documents
        }
        return await TauriAPI.bulkImportDocumentation(request)
    }

    /**
     * Export documentation library
     */
    static async exportLibrary(
        libraryId: string,
        format: 'json' | 'markdown' | 'csv' = 'json'
    ): Promise<string> {
        return await TauriAPI.exportDocumentationLibrary(libraryId, format)
    }

    /**
     * Get a specific documentation chunk
     */
    static async getChunk(chunkId: string): Promise<DocumentationChunk | null> {
        return await TauriAPI.getDocumentationChunk(chunkId)
    }

    /**
     * Update a documentation chunk
     */
    static async updateChunk(
        chunkId: string,
        title?: string,
        content?: string,
        tags?: string[],
        importanceScore?: number
    ): Promise<boolean> {
        return await TauriAPI.updateDocumentationChunk(chunkId, title, content, tags, importanceScore)
    }

    /**
     * Delete a documentation chunk
     */
    static async deleteChunk(chunkId: string): Promise<boolean> {
        return await TauriAPI.deleteDocumentationChunk(chunkId)
    }

    /**
     * Validate a documentation URL
     */
    static async validateUrl(url: string): Promise<boolean> {
        return await TauriAPI.validateDocumentationUrl(url)
    }

    /**
     * Get libraries by provider
     */
    static async getLibrariesByProvider(providerId: string): Promise<DocumentationLibrary[]> {
        const allLibraries = await this.getLibraries()
        return allLibraries.filter(lib => lib.provider_id === providerId)
    }

    /**
     * Search with semantic understanding
     */
    static async semanticSearch(
        query: string,
        providerId?: string,
        maxResults: number = 10
    ): Promise<DocumentationSearchResult[]> {
        return await this.search(query, {
            providerIds: providerId ? [providerId] : undefined,
            maxResults,
            minSimilarity: 0.7,
            includeMetadata: true,
            boostRecent: true
        })
    }

    /**
     * Get related documentation chunks
     */
    static async getRelatedChunks(
        chunkId: string,
        maxResults: number = 5
    ): Promise<DocumentationSearchResult[]> {
        const chunk = await this.getChunk(chunkId)
        if (!chunk) return []

        // Use the chunk's content to find related chunks
        return await this.search(chunk.content, {
            maxResults,
            minSimilarity: 0.6
        })
    }

    /**
     * Extract content type from text
     */
    static inferContentType(title: string, content: string): ContentType {
        const titleLower = title.toLowerCase()
        const contentLower = content.toLowerCase()

        // Tutorial indicators
        if (titleLower.includes('tutorial') ||
            titleLower.includes('getting started') ||
            titleLower.includes('quickstart') ||
            contentLower.includes('step by step') ||
            contentLower.includes('let\'s start')) {
            return 'tutorial'
        }

        // Example indicators
        if (titleLower.includes('example') ||
            titleLower.includes('sample') ||
            contentLower.includes('for example') ||
            contentLower.includes('here\'s how')) {
            return 'example'
        }

        // Configuration indicators
        if (titleLower.includes('config') ||
            titleLower.includes('setup') ||
            titleLower.includes('install') ||
            contentLower.includes('configuration') ||
            contentLower.includes('environment')) {
            return 'configuration'
        }

        // Reference indicators
        if (titleLower.includes('reference') ||
            titleLower.includes('api') ||
            titleLower.includes('docs') ||
            contentLower.includes('parameters') ||
            contentLower.includes('returns')) {
            return 'reference'
        }

        // Troubleshooting indicators
        if (titleLower.includes('troubleshoot') ||
            titleLower.includes('error') ||
            titleLower.includes('problem') ||
            titleLower.includes('issue') ||
            contentLower.includes('if you encounter')) {
            return 'troubleshooting'
        }

        // Migration indicators
        if (titleLower.includes('migration') ||
            titleLower.includes('upgrade') ||
            titleLower.includes('moving from') ||
            contentLower.includes('migrate')) {
            return 'migration'
        }

        // Changelog indicators
        if (titleLower.includes('changelog') ||
            titleLower.includes('release') ||
            titleLower.includes('version') ||
            titleLower.includes('what\'s new')) {
            return 'changelog'
        }

        // Default to overview
        return 'overview'
    }

    /**
     * Validate bulk import data
     */
    static validateBulkImport(documents: BulkDocumentEntry[]): {
        isValid: boolean
        errors: string[]
        warnings: string[]
    } {
        const errors: string[] = []
        const warnings: string[] = []

        if (documents.length === 0) {
            errors.push('No documents provided for import')
            return { isValid: false, errors, warnings }
        }

        if (documents.length > 100) {
            warnings.push('Large bulk import detected. Consider splitting into smaller batches.')
        }

        documents.forEach((doc, index) => {
            if (!doc.title.trim()) {
                errors.push(`Document ${index + 1}: Title is required`)
            }

            if (!doc.content.trim()) {
                errors.push(`Document ${index + 1}: Content is required`)
            }

            if (doc.content.length > 50000) {
                warnings.push(`Document ${index + 1}: Content is very long (${doc.content.length} chars)`)
            }

            if (!doc.content_type) {
                warnings.push(`Document ${index + 1}: Content type not specified, will use 'overview'`)
            }

            if (doc.url && !this.isValidUrl(doc.url)) {
                warnings.push(`Document ${index + 1}: Invalid URL format`)
            }
        })

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Validate URL format
     */
    static isValidUrl(url: string): boolean {
        try {
            const urlObj = new URL(url)
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
        } catch {
            return false
        }
    }

    /**
     * Extract provider information from URL
     */
    static extractProviderFromUrl(url: string): {
        providerId: string
        providerName: string
        providerCategory: string
    } {
        try {
            const urlObj = new URL(url)
            const hostname = urlObj.hostname.toLowerCase()

            // Common documentation sites
            if (hostname.includes('github.com')) {
                return {
                    providerId: 'github',
                    providerName: 'GitHub',
                    providerCategory: 'development'
                }
            }

            if (hostname.includes('docs.openai.com')) {
                return {
                    providerId: 'openai',
                    providerName: 'OpenAI',
                    providerCategory: 'ai'
                }
            }

            if (hostname.includes('stripe.com')) {
                return {
                    providerId: 'stripe',
                    providerName: 'Stripe',
                    providerCategory: 'payments'
                }
            }

            // Extract from domain
            const domain = hostname.replace('www.', '').replace('docs.', '').replace('api.', '')
            const parts = domain.split('.')
            const name = parts[0]

            return {
                providerId: name.toLowerCase(),
                providerName: name.charAt(0).toUpperCase() + name.slice(1),
                providerCategory: 'api'
            }
        } catch {
            return {
                providerId: 'unknown',
                providerName: 'Unknown Provider',
                providerCategory: 'other'
            }
        }
    }

    /**
     * Generate section path from content structure
     */
    static generateSectionPath(content: string, title: string): string[] {
        const lines = content.split('\n')
        const path: string[] = []

        // Look for markdown headers before the current section
        for (const line of lines) {
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
            if (headerMatch) {
                const level = headerMatch[1].length
                const headerTitle = headerMatch[2].trim()

                // If this is our target title, break
                if (headerTitle === title) break

                // Adjust path based on header level
                while (path.length >= level) {
                    path.pop()
                }
                path.push(headerTitle)
            }
        }

        return path
    }

    /**
     * Calculate importance score based on content analysis
     */
    static calculateImportanceScore(
        title: string,
        content: string,
        contentType: ContentType
    ): number {
        let score = 0.5 // Base score

        // Content type weights
        const typeWeights: Record<ContentType, number> = {
            'overview': 0.3,
            'tutorial': 0.2,
            'reference': 0.4,
            'example': 0.1,
            'configuration': 0.3,
            'troubleshooting': 0.2,
            'migration': 0.1,
            'changelog': 0.05
        }

        score += typeWeights[contentType]

        // Title keywords that indicate importance
        const importantKeywords = [
            'getting started', 'quickstart', 'introduction', 'overview',
            'authentication', 'authorization', 'security', 'api key',
            'rate limiting', 'errors', 'troubleshooting'
        ]

        const titleLower = title.toLowerCase()
        importantKeywords.forEach(keyword => {
            if (titleLower.includes(keyword)) {
                score += 0.1
            }
        })

        // Content length (longer content might be more comprehensive)
        if (content.length > 1000) score += 0.1
        if (content.length > 3000) score += 0.1

        // Code examples boost
        if (content.includes('```') || content.includes('<code>')) {
            score += 0.1
        }

        // Ensure score is between 0 and 1
        return Math.min(Math.max(score, 0), 1)
    }
}