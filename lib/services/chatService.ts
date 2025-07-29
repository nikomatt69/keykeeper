import { TauriAPI } from '../tauri-api'
import type {
    ChatSession,
    ChatMessage,
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    SendChatMessageRequest,
    ChatUserPreferences,
    ChatGenerationContext,
    SearchDocumentationRequest,
    GenerateIntegrationRequest,
    IntegrationGeneration,
    DocumentationSearchResult,
    LibraryStatistics
} from '../types'

/**
 * Chat Service - Type-safe service layer for chat functionality
 * Provides a clean interface between the frontend and Rust backend chat commands
 */
export class ChatService {
    /**
     * Create a new chat session
     */
    static async createSession(
        userId: string,
        title: string,
        description?: string,
        contextLibraries: string[] = []
    ): Promise<CreateChatSessionResponse> {
        const request = {
            userId,
            title,
            description,
            contextLibraries
        }

        return await TauriAPI.createChatSession(request)
    }

    /**
     * Send a message in a chat session
     */
    static async sendMessage(
        sessionId: string,
        message: string,
        userPreferences: ChatUserPreferences,
        contextLibraries: string[] = [],
        generationContext?: ChatGenerationContext,
        includeCodeGeneration: boolean = false
    ): Promise<any> {
        const request = {
            sessionId,
            message,
            contextLibraries,
            userPreferences,
            generationContext,
            includeCodeGeneration
        }

        return await TauriAPI.sendChatMessage(request)
    }

    /**
     * Get messages for a chat session
     */
    static async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
        return await TauriAPI.getChatMessages(sessionId)
    }

    /**
     * Get all chat sessions for a user
     */
    static async getUserSessions(userId: string): Promise<ChatSession[]> {
        return await TauriAPI.getUserChatSessions(userId)
    }

    /**
     * Search documentation for chat context
     */
    static async searchDocumentationForContext(
        query: string,
        providerId?: string,
        contentTypes?: string[],
        maxResults: number = 10,
        minSimilarity: number = 0.6
    ): Promise<DocumentationSearchResult[]> {
        const request: SearchDocumentationRequest = {
            query,
            providerId: providerId,
            contentTypes: contentTypes,
            maxResults: maxResults,
            minSimilarity: minSimilarity
        }

        return await TauriAPI.searchDocumentationForChat(request)
    }

    /**
     * Generate integration code
     */
    static async generateIntegration(
        sessionId: string,
        providerName: string,
        framework: string,
        language: string,
        requirements: string[],
        constraints: string[] = [],
        projectContext?: string,
        existingCode?: string
    ): Promise<IntegrationGeneration> {
        const request = {
            session_id: sessionId,
            provider_name: providerName,
            framework,
            language,
            requirements,
            constraints,
            project_context: projectContext,
            existing_code: existingCode
        }

        return await TauriAPI.generateIntegration(request)
    }

    /**
     * Archive a chat session
     */
    static async archiveSession(sessionId: string): Promise<boolean> {
        return await TauriAPI.archiveChatSession(sessionId)
    }

    /**
     * Delete a chat session
     */
    static async deleteSession(sessionId: string): Promise<boolean> {
        return await TauriAPI.deleteChatSession(sessionId)
    }

    /**
     * Get chat engine statistics
     */
    static async getStatistics(): Promise<Record<string, number>> {
        return await TauriAPI.getChatStatistics()
    }

    /**
     * Update session preferences
     */
    static async updateSessionPreferences(
        sessionId: string,
        preferences: ChatUserPreferences
    ): Promise<boolean> {
        return await TauriAPI.updateSessionPreferences(sessionId, preferences)
    }

    /**
     * Get available documentation libraries
     */
    static async getAvailableLibraries(): Promise<any[]> {
        return await TauriAPI.getAvailableDocumentationLibraries()
    }

    /**
     * Export chat session
     */
    static async exportSession(
        sessionId: string,
        format: 'json' | 'markdown' | 'text' = 'markdown'
    ): Promise<string> {
        return await TauriAPI.exportChatSession(sessionId, format)
    }

    /**
     * Create default user preferences
     */
    static createDefaultPreferences(): ChatUserPreferences {
        return {
            preferredLanguage: 'typescript',
            preferredFramework: 'react',
            codeStyle: 'functional',
            detailLevel: 'standard',
            includeExamples: true,
            includeTests: false,
            securityFocused: true
        }
    }

    /**
     * Validate chat message before sending
     */
    static validateMessage(message: string): { isValid: boolean; error?: string } {
        if (!message.trim()) {
            return { isValid: false, error: 'Message cannot be empty' }
        }

        if (message.length > 10000) {
            return { isValid: false, error: 'Message is too long (max 10,000 characters)' }
        }

        return { isValid: true }
    }

    /**
     * Parse integration requirements from natural language
     */
    static parseRequirements(input: string): string[] {
        // Simple parser for common patterns
        const requirements: string[] = []
        
        // Look for explicit requirements markers
        const requirementPatterns = [
            /I need to (.+?)(?:\.|$)/gi,
            /I want to (.+?)(?:\.|$)/gi,
            /Should be able to (.+?)(?:\.|$)/gi,
            /Must (.+?)(?:\.|$)/gi,
            /Requirements?:?\s*(.+?)(?:\n|$)/gi,
            /Features?:?\s*(.+?)(?:\n|$)/gi
        ]

        requirementPatterns.forEach(pattern => {
            let match
            while ((match = pattern.exec(input)) !== null) {
                if (match[1]) {
                    requirements.push(match[1].trim())
                }
            }
        })

        // If no explicit requirements found, use the entire input as a single requirement
        if (requirements.length === 0 && input.trim()) {
            requirements.push(input.trim())
        }

        return requirements
    }

    /**
     * Extract framework and language from user input
     */
    static extractTechStack(input: string): {
        framework?: string
        language?: string
        confidence: number
    } {
        const frameworks = [
            'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt',
            'express', 'fastapi', 'django', 'rails', 'spring',
            'flutter', 'react-native', 'ionic'
        ]

        const languages = [
            'javascript', 'typescript', 'python', 'java', 'csharp',
            'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart'
        ]

        const inputLower = input.toLowerCase()
        let detectedFramework: string | undefined
        let detectedLanguage: string | undefined
        let confidence = 0

        // Check for framework mentions
        for (const framework of frameworks) {
            if (inputLower.includes(framework)) {
                detectedFramework = framework
                confidence += 0.5
                break
            }
        }

        // Check for language mentions
        for (const language of languages) {
            if (inputLower.includes(language)) {
                detectedLanguage = language
                confidence += 0.5
                break
            }
        }

        return {
            framework: detectedFramework,
            language: detectedLanguage,
            confidence
        }
    }
}