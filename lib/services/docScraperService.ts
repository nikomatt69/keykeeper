import { invoke } from '@tauri-apps/api/core';
import { llmProxy, LLMResponse } from './llmProxyService';

export interface DocScrapingResult {
    url: string;
    title: string;
    content: string;
    summary?: string;
    codeExamples: CodeExample[];
    configOptions: ConfigOption[];
    setupSteps: string[];
    dependencies: string[];
    lastScraped: Date;
    enhancedWithLLM?: boolean;
    lastEnhanced?: string;
    categories?: Array<{
        name: string;
        description: string;
        endpoints: string[];
    }>;
    commonUseCases?: string[];
    authentication?: string;
    rateLimiting?: string;
}

export interface CodeExample {
    language: string;
    code: string;
    description?: string;
    filename?: string;
    category: 'config' | 'client' | 'server' | 'example' | 'test';
}

export interface ConfigOption {
    name: string;
    type: string;
    required: boolean;
    default?: string;
    description: string;
    example?: string;
}

export interface ScrapingConfig {
    url: string;
    selectors: {
        codeBlocks: string[];
        configSections: string[];
        setupSteps: string[];
        dependencies: string[];
    };
    customRules?: ScrapingRule[];
}

export interface ScrapingRule {
    pattern: RegExp;
    extract: 'config' | 'code' | 'dependency' | 'step';
    processor?: (match: string) => any;
}

/**
 * Documentation Scraper Service
 * Intelligently extracts configuration patterns from API documentation
 */
export class DocScraperService {
    private static cache = new Map<string, DocScrapingResult>();
    private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Scrape documentation for an API provider
     */
    static async scrapeProviderDocs(providerId: string, docsUrl: string): Promise<DocScrapingResult> {
        const cacheKey = `${providerId}-${docsUrl}`;

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached.lastScraped)) {
            return cached;
        }

        try {
            // Scrape with backend first
            let result = await this.scrapeWithBackend(providerId, docsUrl);

            // Enhance with LLM if available
            try {
                const enhancedResult = await this.enhanceWithLLM(result);
                result = { ...result, ...enhancedResult };
            } catch (error) {
                console.warn('LLM enhancement failed, using basic scraping result:', error);
            }

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.warn('Backend scraping failed, falling back to frontend:', error);

            // Fallback to frontend  process.env.ENVIRONMENT_VARIABLE_API_KEYscraping
            return this.scrapeWithFrontend(providerId, docsUrl);
        }
    }



    /**
     * Backend scraping using Tauri
     */
    private static async scrapeWithBackend(providerId: string, docsUrl: string): Promise<DocScrapingResult> {
        return await invoke<DocScrapingResult>('scrape_api_documentation', {
            provider_id: providerId,
            docs_url: docsUrl
        });
    }

    /**
     * Frontend scraping fallback
     */
    /**
     * Enhance scraped documentation using LLM
     */
    private static async enhanceWithLLM(result: DocScrapingResult): Promise<Partial<DocScrapingResult>> {
        try {
            // Summarize the content if it's too long
            let summary = result.content;
            if (result.content.length > 500) {
                summary = await llmProxy.summarizeDocumentation(result.content, 500);
            }

            // Extract structured data if needed
            const structure = {
                categories: [{
                    name: 'string',
                    description: 'string',
                    endpoints: ['string']
                }],
                commonUseCases: ['string'],
                authentication: 'string',
                rateLimiting: 'string'
            };

            const extracted = await llmProxy.extractDocumentation(result.content, structure);

            return {
                summary,
                ...extracted,
                lastEnhanced: new Date().toISOString()
            };
        } catch (error) {
            console.error('LLM enhancement failed:', error);
            return {}; // Return empty object if enhancement fails
        }
    }

    private static async scrapeWithFrontend(providerId: string, docsUrl: string): Promise<DocScrapingResult> {
        // Use WebFetch tool to get documentation content
        const response = await fetch(docsUrl);
        const html = await response.text();

        return this.parseDocumentation(providerId, docsUrl, html);
    }

    /**
     * Parse HTML documentation content
     */
    private static parseDocumentation(providerId: string, url: string, html: string): DocScrapingResult {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const result: DocScrapingResult = {
            url,
            title: doc.title || `${providerId} Documentation`,
            content: this.extractTextContent(doc),
            codeExamples: this.extractCodeExamples(doc),
            configOptions: this.extractConfigOptions(doc, providerId),
            setupSteps: this.extractSetupSteps(doc),
            dependencies: this.extractDependencies(doc),
            lastScraped: new Date()
        };

        return result;
    }

    /**
     * Extract text content from documentation
     */
    private static extractTextContent(doc: Document): string {
        // Remove script, style, and navigation elements
        const unwantedSelectors = ['script', 'style', 'nav', 'header', 'footer', '.sidebar'];
        unwantedSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        return doc.body?.textContent?.trim() || '';
    }

    /**
     * Extract code examples from documentation
     */
    private static extractCodeExamples(doc: Document): CodeExample[] {
        const examples: CodeExample[] = [];

        // Common selectors for code blocks
        const codeSelectors = [
            'pre code',
            'code[class*="language-"]',
            '.highlight pre',
            '.code-block',
            'pre[class*="language-"]'
        ];

        codeSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(element => {
                const code = element.textContent?.trim();
                if (!code) return;

                const language = this.detectLanguage(element, code);
                const category = this.categorizeCode(code, language);
                const description = this.findNearbyDescription(element);

                examples.push({
                    language,
                    code,
                    description,
                    category
                });
            });
        });

        return this.deduplicateExamples(examples);
    }

    /**
     * Detect programming language of code block
     */
    private static detectLanguage(element: Element, code: string): string {
        // Check class names first
        const classNames = element.className || element.parentElement?.className || '';

        const languageMatches = classNames.match(/language-(\w+)|lang-(\w+)/);
        if (languageMatches) {
            return languageMatches[1] || languageMatches[2];
        }

        // Fallback to content detection
        if (code.includes('import ') && code.includes('from ')) return 'typescript';
        if (code.includes('const ') && code.includes('=>')) return 'javascript';
        if (code.includes('def ') && code.includes(':')) return 'python';
        if (code.includes('package ') && code.includes('func ')) return 'go';
        if (code.includes('use ') && code.includes('fn ')) return 'rust';
        if (code.startsWith('{') && code.includes(':')) return 'json';
        if (code.includes('apiVersion:') || code.includes('kind:')) return 'yaml';

        return 'text';
    }

    /**
     * Categorize code by purpose
     */
    private static categorizeCode(code: string, language: string): 'config' | 'client' | 'server' | 'example' | 'test' {
        const codeLC = code.toLowerCase();

        if (codeLC.includes('config') || codeLC.includes('setup') || codeLC.includes('initialize')) {
            return 'config';
        }
        if (codeLC.includes('client') || codeLC.includes('createclient')) {
            return 'client';
        }
        if (codeLC.includes('server') || codeLC.includes('app.') || codeLC.includes('express')) {
            return 'server';
        }
        if (codeLC.includes('test') || codeLC.includes('expect') || codeLC.includes('assert')) {
            return 'test';
        }

        return 'example';
    }

    /**
     * Find description near code block
     */
    private static findNearbyDescription(element: Element): string | undefined {
        // Look for preceding paragraph or heading
        let current: Element | null = element;

        while (current = current.previousElementSibling) {
            if (current.tagName.match(/^H[1-6]$/)) {
                return current.textContent?.trim();
            }
            if (current.tagName === 'P' && current.textContent) {
                const text = current.textContent.trim();
                if (text.length > 10 && text.length < 200) {
                    return text;
                }
            }
        }

        return undefined;
    }

    /**
     * Extract configuration options from documentation
     */
    private static extractConfigOptions(doc: Document, providerId: string): ConfigOption[] {
        const options: ConfigOption[] = [];

        // Provider-specific extraction logic
        switch (providerId) {
            case 'better-auth':
                options.push(...this.extractBetterAuthConfig(doc));
                break;
            case 'openai':
                options.push(...this.extractOpenAIConfig(doc));
                break;
            case 'stripe':
                options.push(...this.extractStripeConfig(doc));
                break;
            default:
                options.push(...this.extractGenericConfig(doc));
                break;
        }

        return options;
    }

    /**
     * Extract Better Auth specific configuration
     */
    private static extractBetterAuthConfig(doc: Document): ConfigOption[] {
        return [
            {
                name: 'baseURL',
                type: 'string',
                required: true,
                description: 'The base URL for the auth server',
                example: 'https://auth.example.com'
            },
            {
                name: 'secret',
                type: 'string',
                required: true,
                description: 'Secret key for signing tokens',
                example: 'your-secret-key-here'
            },
            {
                name: 'emailAndPassword.enabled',
                type: 'boolean',
                required: false,
                default: 'true',
                description: 'Enable email and password authentication',
                example: 'true'
            },
            {
                name: 'emailAndPassword.minPasswordLength',
                type: 'number',
                required: false,
                default: '8',
                description: 'Minimum password length',
                example: '8'
            }
        ];
    }

    /**
     * Extract OpenAI specific configuration
     */
    private static extractOpenAIConfig(doc: Document): ConfigOption[] {
        return [
            {
                name: 'apiKey',
                type: 'string',
                required: true,
                description: 'Your OpenAI API key',
                example: 'sk-...'
            },
            {
                name: 'baseURL',
                type: 'string',
                required: false,
                description: 'Custom base URL for API requests',
                example: 'https://api.openai.com/v1'
            },
            {
                name: 'organization',
                type: 'string',
                required: false,
                description: 'Organization ID for API requests'
            }
        ];
    }

    /**
     * Extract Stripe specific configuration
     */
    private static extractStripeConfig(doc: Document): ConfigOption[] {
        return [
            {
                name: 'secretKey',
                type: 'string',
                required: true,
                description: 'Your Stripe secret key',
                example: 'sk_...'
            },
            {
                name: 'publishableKey',
                type: 'string',
                required: true,
                description: 'Your Stripe publishable key',
                example: 'pk_...'
            },
            {
                name: 'webhookSecret',
                type: 'string',
                required: false,
                description: 'Webhook endpoint secret for validating webhooks'
            }
        ];
    }

    /**
     * Extract generic configuration options
     */
    private static extractGenericConfig(doc: Document): ConfigOption[] {
        const options: ConfigOption[] = [];

        // Look for configuration tables or lists
        doc.querySelectorAll('table').forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.toLowerCase() || '');

            if (headers.some(h => h.includes('option') || h.includes('config') || h.includes('parameter'))) {
                table.querySelectorAll('tr').forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length >= 2) {
                        const name = cells[0]?.textContent?.trim();
                        const description = cells[1]?.textContent?.trim();

                        if (name && description) {
                            options.push({
                                name,
                                type: 'string',
                                required: description.toLowerCase().includes('required'),
                                description
                            });
                        }
                    }
                });
            }
        });

        return options;
    }

    /**
     * Extract setup steps from documentation
     */
    private static extractSetupSteps(doc: Document): string[] {
        const steps: string[] = [];

        // Look for ordered lists or step-by-step instructions
        doc.querySelectorAll('ol li, .steps li, [class*="step"]').forEach(element => {
            const text = element.textContent?.trim();
            if (text && text.length > 10) {
                steps.push(text);
            }
        });

        // If no ordered steps found, look for headings with "step" or numbers
        if (steps.length === 0) {
            doc.querySelectorAll('h2, h3, h4').forEach(heading => {
                const text = heading.textContent?.trim();
                if (text && (text.match(/step \d+/i) || text.match(/^\d+\./))) {
                    // Get the content after this heading
                    let content = '';
                    let current = heading.nextElementSibling;
                    while (current && !current.tagName.match(/^H[1-6]$/)) {
                        content += current.textContent?.trim() + ' ';
                        current = current.nextElementSibling;
                    }

                    if (content.trim()) {
                        steps.push(`${text}: ${content.trim()}`);
                    }
                }
            });
        }

        return steps;
    }

    /**
     * Extract dependencies from documentation
     */
    private static extractDependencies(doc: Document): string[] {
        const dependencies: string[] = [];
        const text = doc.body?.textContent || '';

        // Common package manager patterns
        const patterns = [
            /npm install ([^\n\r]+)/g,
            /yarn add ([^\n\r]+)/g,
            /pnpm add ([^\n\r]+)/g,
            /pip install ([^\n\r]+)/g,
            /cargo add ([^\n\r]+)/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const packages = match[1]
                    .split(/\s+/)
                    .filter(pkg => pkg && !pkg.startsWith('-') && !pkg.includes('@'));
                dependencies.push(...packages);
            }
        });

        // Remove duplicates and common flags
        return [...Array.from(new Set(dependencies))]
            .filter(dep => !['--save', '--save-dev', '-D', '-g', '--global'].includes(dep));
    }

    /**
     * Deduplicate code examples
     */
    private static deduplicateExamples(examples: CodeExample[]): CodeExample[] {
        const seen = new Set<string>();
        return examples.filter(example => {
            const key = `${example.language}-${example.code.slice(0, 100)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Check if cache is still valid
     */
    private static isCacheValid(lastScraped: Date): boolean {
        return Date.now() - lastScraped.getTime() < this.CACHE_DURATION;
    }

    /**
     * Clear cache for a specific URL or all cache
     */
    static clearCache(url?: string): void {
        if (url) {
            // Remove all entries for this URL
            for (const [key, value] of Array.from(this.cache.entries())) {
                if (value.url === url) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get cache statistics
     */
    static getCacheStats(): { size: number; entries: Array<{ url: string; lastScraped: Date }> } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.values()).map(entry => ({
                url: entry.url,
                lastScraped: entry.lastScraped
            }))
        };
    }
}