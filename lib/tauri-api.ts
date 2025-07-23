import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ApiKey {
    id: string;
    name: string;
    service: string;
    key: string;
    description?: string;
    environment: string;
    rate_limit?: string;
    expires_at?: string;
    scopes: string[];
    created_at: string;
    updated_at: string;
    tags: string[];
    is_active: boolean;
}

export interface VaultStatus {
    is_unlocked: boolean;
}

export interface EnvVariable {
    name: string;
    value: string;
    is_secret: boolean;
}

export interface DroppedEnvFile {
    path: string;
    project_path: string;
    file_name: string;
    keys: EnvVariable[];
}

export interface ProjectEnvAssociation {
    id: string;
    project_path: string;
    env_file_path: string;
    env_file_name: string;
    created_at: string;
    last_accessed: string;
    is_active: boolean;
}

export interface PersistentSession {
    session_id: string;
    user_id: string;
    created_at: string;
    expires_at: string;
    last_accessed: string;
    device_info: string;
    is_remember_me: boolean;
    is_active: boolean;
}

export interface VSCodeWorkspace {
    path: string;
    name: string;
    is_open: boolean;
    last_updated: string;
}

// ================================
// Documentation Interfaces (Aligned with Rust backend)
// ================================

export interface Documentation {
    linked_keys: any;
    id: string;
    title: string;
    content: string;
    doc_type: string; // "api" | "guide" | "reference" | "notes" | "snippet" | "scraped"
    project_id?: string;
    provider_id?: string;
    url?: string;
    tags: string[];
    created_at: string; // ISO 8601 string from Rust DateTime<Utc>
    updated_at: string; // ISO 8601 string from Rust DateTime<Utc>
    language: string; // "en" | "it" | "es" etc.
    is_favorite: boolean;
    search_keywords: string[];
}

export interface DocSection {
    id: string;
    title: string;
    content: string;
    level: number; // 1-6 for heading levels (maps to Rust u8)
    anchor?: string;
    parent_section_id?: string;
}

export interface ApiDocumentation {
    id: string;
    provider_id: string;
    title: string;
    url: string;
    content: string;
    sections: DocSection[];
    tags: string[];
    last_updated: string; // ISO 8601 string from Rust DateTime<Utc>
    version?: string;
    language: string;
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

export interface MLEngineStatus {
    initialized: boolean;
    model_loaded: boolean;
    context_enabled: boolean;
    stats?: {
        total_analyses: number;
        cache_hits: number;
        cache_size: number;
    };
}

export interface LLMRequest {
    prompt: string;
    context?: any;
    config: LLMConfig;
}

export interface LLMConfig {
    provider: string; // "openai" | "local"
    model: string;
    temperature: number;
    max_tokens: number;
    api_key?: string;
}

export interface LLMResponse {
    content: string;
    metadata: {
        model: string;
        tokens: number;
        completion_reason: string;
        cached: boolean;
    };
    error?: string;
}

// ML Engine Types for Frontend
export interface MLEngineStatus {
    initialized: boolean;
    model_loaded: boolean;
    context_enabled: boolean;
    stats?: {
        total_analyses: number;
        cache_hits: number;
        cache_size: number;
    };
}

export interface ContextInfo {
    active_app?: string;
    file_path?: string;
    file_extension?: string;
    project_type?: string;
    language?: string;
    content_snippet?: string;
}

export interface MLPrediction {
    api_key_suggestions: KeySuggestion[];
    context_confidence: number;
    usage_prediction: UsagePrediction;
    security_score: SecurityScore;
}

export interface KeySuggestion {
    key_id: string;
    confidence: number;
    reasoning: string;
}

export interface UsagePrediction {
    likelihood: number;
    estimated_usage: number;
    peak_times: string[];
}

export interface SecurityScore {
    score: number;
    risk_factors: string[];
    recommendations: string[];
}

export interface MLConfig {
    model_type: string;
    confidence_threshold: number;
    cache_enabled: boolean;
    context_analysis: boolean;
    // LLM Integration Options
    use_llm_backend?: boolean;
    llm_model_path?: string;
    llm_config?: LLMEngineConfig;
}

// Enhanced LLM Engine Configuration
export interface LLMEngineConfig {
    model_path: string;
    context_size: number;
    n_layers?: number;
    max_tokens: number;
    temperature: number;
    top_p: number;
    top_k: number;
    repeat_penalty: number;
}

// Documentation Generation Types
export interface DocumentationGenerationRequest {
    provider: string;
    context: string;
    api_key_format?: string;
    environment?: string;
}

export interface GeneratedDocumentation {
    content: string;
    sections: DocumentationSection[];
    usage_examples: CodeExample[];
    configuration_template: string;
}

export interface DocumentationSection {
    title: string;
    content: string;
    level: number;
    type: 'overview' | 'authentication' | 'endpoints' | 'examples' | 'configuration' | 'best_practices';
}

export interface CodeExample {
    language: string;
    title: string;
    code: string;
    description?: string;
}

// Configuration Template Generation
export interface ConfigTemplateRequest {
    provider: string;
    framework: string;
    environment: string;
    features?: string[];
}

export interface GeneratedConfigTemplate {
    files: ConfigTemplateFile[];
    environment_variables: EnvironmentVariable[];
    setup_instructions: string[];
    dependencies: string[];
}

export interface ConfigTemplateFile {
    path: string;
    content: string;
    description: string;
    file_type: 'config' | 'code' | 'documentation';
}

export interface EnvironmentVariable {
    name: string;
    description: string;
    example_value?: string;
    required: boolean;
}

// Enhanced ML Prediction Types
export interface EnhancedMLPrediction extends MLPrediction {
    suggested_documentation?: DocumentationSuggestion[];
    configuration_recommendations?: ConfigurationRecommendation[];
    llm_insights?: LLMInsight[];
}

export interface DocumentationSuggestion {
    title: string;
    url: string;
    relevance_score: number;
    section_type: string;
    provider: string;
}

export interface ConfigurationRecommendation {
    framework: string;
    confidence: number;
    reasoning: string;
    template_available: boolean;
}

export interface LLMInsight {
    category: 'security' | 'performance' | 'best_practice' | 'integration';
    insight: string;
    confidence: number;
    actionable: boolean;
}

// API Generator Types
export interface GenerationRequest {
    provider_id: string;
    env_vars: Record<string, string>;
    features: string[];
    framework: string;
    output_path: string;
}

export interface GeneratedConfig {
    files: GeneratedFile[];
    dependencies: string[];
    setup_instructions: string[];
    next_steps: string[];
}

export interface GeneratedFile {
    path: string;
    content: string;
    file_type: string;
    language: string;
}

export interface DetectionResult {
    provider: ApiProvider;
    confidence: number;
    matched_patterns: string[];
    detected_env_vars: string[];
}

export interface ApiProvider {
    id: string;
    name: string;
    description: string;
    key_patterns: string[];
    env_patterns: string[];
    docs_url: string;
    setup_type: string;
    category: string;
    dependencies: string[];
    config_templates: any[];
}

export class TauriAPI {
    // Authentication & Vault Management
    static async unlockVault(password: string): Promise<boolean> {
        return await invoke('unlock_vault', { password });
    }

    static async setMasterPassword(password: string): Promise<boolean> {
        return await invoke('set_master_password', { password });
    }

    static async isVaultUnlocked(): Promise<boolean> {
        return await invoke('is_vault_unlocked');
    }

    static async lockVault(): Promise<void> {
        return await invoke('lock_vault');
    }

    static async isUserAccountCreated(): Promise<boolean> {
        return await invoke('is_user_account_created');
    }

    static async isMasterPasswordSet(): Promise<boolean> {
        return await invoke('is_master_password_set');
    }

    // ✅ User Authentication Commands (missing from original API)
    static async authenticateUser(email: string, password: string): Promise<boolean> {
        return await invoke('authenticate_user', { email, password });
    }

    static async createUserAccount(email: string, password: string): Promise<string> {
        return await invoke('create_user_account', { email, password });
    }

    // API Key Management
    static async getApiKeys(): Promise<ApiKey[]> {
        return await invoke('get_api_keys');
    }

    static async addApiKey(apiKey: ApiKey): Promise<void> {
        return await invoke('add_api_key', { apiKey });
    }

    static async updateApiKey(apiKey: ApiKey): Promise<void> {
        return await invoke('update_api_key', { apiKey });
    }

    static async deleteApiKey(id: string): Promise<void> {
        return await invoke('delete_api_key', { id });
    }

    static async searchApiKeys(query: string): Promise<ApiKey[]> {
        return await invoke('search_api_keys', { query });
    }

    // Backup & Export
    static async exportVault(): Promise<string> {
        return await invoke('export_vault');
    }

    // VSCode Integration
    static async startVSCodeServer(): Promise<string> {
        return await invoke('start_vscode_server');
    }

    static async stopVSCodeServer(): Promise<string> {
        return await invoke('stop_vscode_server');
    }

    static async getVSCodeServerStatus(): Promise<boolean> {
        return await invoke('get_vscode_server_status');
    }

    // Update functionality
    static async checkForUpdates(): Promise<any> {
        return await invoke('check_for_updates');
    }

    static async installUpdate(): Promise<void> {
        return await invoke('install_update');
    }

    // Audit logging
    static async getAuditLogs(): Promise<any[]> {
        return await invoke('get_audit_logs');
    }

    // Environment file parsing and project association
    static async parseAndRegisterEnvFile(filePath: string): Promise<DroppedEnvFile> {
        return await invoke('parse_and_register_env_file', { filePath });
    }

    static async associateProjectWithEnv(projectPath: string, envPath: string, fileName: string): Promise<void> {
        return await invoke('associate_project_with_env', { projectPath, envPath, fileName });
    }

    static async getProjectEnvAssociations(projectPath?: string): Promise<ProjectEnvAssociation[]> {
        return await invoke('get_project_env_associations', { projectPath });
    }

    static async activateProjectContext(projectPath: string): Promise<boolean> {
        return await invoke('activate_project_context', { projectPath });
    }

    // Session Management
    static async createRememberMeSession(userId: string, timeoutMinutes: number): Promise<string> {
        return await invoke('create_remember_me_session', { userId, timeoutMinutes });
    }

    static async validateRememberMeSession(sessionId: string): Promise<boolean> {
        return await invoke('validate_remember_me_session', { sessionId });
    }

    static async restoreSessionOnStartup(): Promise<boolean> {
        return await invoke('restore_session_on_startup');
    }

    static async getPersistentSessions(): Promise<PersistentSession[]> {
        return await invoke('get_persistent_sessions');
    }

    static async revokePersistentSession(sessionId: string): Promise<void> {
        return await invoke('revoke_persistent_session', { sessionId });
    }

    static async cleanupAllSessions(): Promise<void> {
        return await invoke('cleanup_all_sessions');
    }

    // VSCode Workspace Tracking
    static async updateVSCodeWorkspaces(workspaces: string[]): Promise<void> {
        return await invoke('update_vscode_workspaces', { workspaces });
    }

    static async getVSCodeWorkspaces(): Promise<VSCodeWorkspace[]> {
        return await invoke('get_vscode_workspaces');
    }

    static async getProjectVSCodeStatus(projectPath: string): Promise<string | null> {
        return await invoke('get_project_vscode_status', { projectPath });
    }

    // File System Operations
    static async openFolder(path: string): Promise<void> {
        return await invoke('open_folder', { path });
    }

    static async openFile(path: string): Promise<void> {
        return await invoke('open_file', { path });
    }

    static async openInVSCode(path: string): Promise<void> {
        return await invoke('open_in_vscode', { path });
    }

    // Window Management
    static async showWindow(): Promise<void> {
        return await invoke('show_window');
    }

    static async hideWindow(): Promise<void> {
        return await invoke('hide_window');
    }

    static async quitApplication(): Promise<void> {
        return await invoke('quit_application');
    }

    // Helper methods for common operations
    static async getKeysByEnvironment(environment: string): Promise<ApiKey[]> {
        const keys = await this.getApiKeys();
        return keys.filter(key => key.environment === environment);
    }

    static async getKeysByService(service: string): Promise<ApiKey[]> {
        const keys = await this.getApiKeys();
        return keys.filter(key => key.service === service);
    }

    static async getRecentKeys(limit: number = 10): Promise<ApiKey[]> {
        const keys = await this.getApiKeys();
        return keys
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, limit);
    }

    // Generate unique ID for new keys
    static generateKeyId(): string {
        return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create a new API key with default values
    static createNewApiKey(data: Partial<ApiKey>): ApiKey {
        const now = new Date().toISOString();
        return {
            id: this.generateKeyId(),
            name: data.name || '',
            service: data.service || '',
            key: data.key || '',
            description: data.description,
            environment: data.environment || 'development',
            rate_limit: data.rate_limit,
            expires_at: data.expires_at,
            scopes: data.scopes || [],
            created_at: now,
            updated_at: now,
            tags: data.tags || [],
            is_active: data.is_active ?? true,
        };
    }

    // Biometric & User Management
    static async checkBiometricSupport(): Promise<boolean> {
        return await invoke('check_biometric_support');
    }

    static async getBiometricCredentials(): Promise<any[]> {
        return await invoke('get_biometric_credentials');
    }

    static async authenticateBiometric(credentialId: string): Promise<string> {
        return await invoke('authenticate_biometric', { credentialId });
    }

    static async updateUserPreferences(preferences: UserPreferences): Promise<void> {
        return await invoke('update_user_preferences', { preferences });
    }

    static async getUserPreferences(): Promise<UserPreferences> {
        return await invoke('get_user_preferences');
    }

    static async createPasskeyChallenge(userId: string, challengeType: string): Promise<string> {
        return await invoke('create_passkey_challenge', { userId, challengeType });
    }

    static async verifyPasskeyChallenge(challengeId: string, response: string): Promise<boolean> {
        return await invoke('verify_passkey_challenge', { challengeId, response });
    }

    static async invalidateBiometricSessions(userId: string): Promise<void> {
        return await invoke('invalidate_biometric_sessions', { userId });
    }

    static async updateUsername(newUsername: string): Promise<void> {
        return await invoke('update_username', { newUsername });
    }
    static async enableBiometricAuth(userId: string, credentialName: string): Promise<string> {
        return await invoke('enable_biometric_auth', { userId, credentialName });
    }
    static async disableBiometricAuth(userId: string): Promise<void> {
        return await invoke('invalidate_biometric_sessions', { userId });
    }
    static async getUserAccount(): Promise<any> {
        return await invoke('get_user_account');
    }

    // ===============================
    //  ENHANCED PROJECT MANAGEMENT
    // ===============================

    // Project CRUD Operations
    static async createProject(name: string, description?: string, path?: string): Promise<any> {
        return await invoke('create_project', { name, description, path });
    }

    static async updateProject(id: string, name?: string, description?: string, settings?: any): Promise<any> {
        return await invoke('update_project', { id, name, description, settings });
    }

    static async deleteProject(id: string, reassignKeysTo?: string): Promise<void> {
        return await invoke('delete_project', { id, reassignKeysTo });
    }

    static async getProjectById(id: string): Promise<any> {
        return await invoke('get_project_by_id', { id });
    }

    // Key-Project Assignment
    static async assignKeysToProject(projectId: string, keyIds: string[]): Promise<void> {
        return await invoke('assign_keys_to_project', { projectId, keyIds });
    }

    static async getKeysByProject(projectId?: string): Promise<ApiKey[]> {
        return await invoke('get_keys_by_project', { projectId });
    }

    static async getUnassignedKeys(): Promise<ApiKey[]> {
        return await invoke('get_unassigned_keys');
    }

    static async searchKeysInProject(projectId: string, query: string): Promise<ApiKey[]> {
        return await invoke('search_keys_in_project', { projectId, query });
    }

    // VSCode Auto-Sync Functions
    static async syncKeyToEnvFile(keyId: string, projectPath: string, envFileName?: string): Promise<string> {
        return await invoke('sync_key_to_env_file', { keyId, projectPath, envFileName });
    }

    static async checkKeyInEnvFile(keyId: string, projectPath: string, envFileName?: string): Promise<boolean> {
        return await invoke('check_key_in_env_file', { keyId, projectPath, envFileName });
    }

    static async getEnvFileSuggestions(projectPath: string): Promise<string[]> {
        return await invoke('get_env_file_suggestions', { projectPath });
    }

    static async autoSyncWorkspaceEnvFiles(workspacePath: string): Promise<string> {
        return await invoke('auto_sync_workspace_env_files', { workspacePath });
    }

    // ✅ Event Listeners for real-time communication
    static async onVaultStateChanged(callback: (isUnlocked: boolean) => void) {
        return await listen('vault-state-changed', (event) => {
            callback(event.payload as boolean);
        });
    }

    static async onAuthStateChanged(callback: (state: any) => void) {
        return await listen('auth-state-changed', (event) => {
            callback(event.payload);
        });
    }

    static async onApiKeysChanged(callback: (keys: ApiKey[]) => void) {
        return await listen('api-keys-changed', (event) => {
            callback(event.payload as ApiKey[]);
        });
    }

    static async onUserAccountChanged(callback: (account: any) => void) {
        return await listen('user-account-changed', (event) => {
            callback(event.payload);
        });
    }

    // Native storage commands
    static async keyringSet(service: string, account: string, password: string): Promise<void> {
        return await invoke('keyring_set', { service, account, password });
    }

    static async keyringGet(service: string, account: string): Promise<string> {
        return await invoke('keyring_get', { service, account });
    }

    static async keyringDelete(service: string, account: string): Promise<void> {
        return await invoke('keyring_delete', { service, account });
    }

    static async getDeviceInfo(): Promise<any> {
        return await invoke('get_device_info');
    }

    static async setupAutoStart(enabled: boolean): Promise<void> {
        return await invoke('setup_auto_start', { enabled });
    }

    static async disableAutoStart(): Promise<void> {
        return await invoke('disable_auto_start');
    }

    static async isAutoStartEnabled(): Promise<boolean> {
        return await invoke('is_auto_start_enabled');
    }

    static async showNotification(title: string, body: string): Promise<void> {
        return await invoke('show_notification', { title, body });
    }

    // ===============================
    //  ML ENGINE INTEGRATION
    // ===============================

    // ML Configuration and Prediction interfaces
    static async initializeMLEngine(config?: any): Promise<string> {
        return await invoke('initialize_ml_engine', { request: { config } });
    }

    static async analyzeContextML(context: any, availableKeys: string[]): Promise<any> {
        return await invoke('analyze_context_ml', { request: { context, available_keys: availableKeys } });
    }

    static async recordMLUsage(keyId: string, context: any, success: boolean): Promise<string> {
        return await invoke('record_ml_usage', { record: { key_id: keyId, context, success } });
    }

    static async getMLStats(): Promise<any> {
        return await invoke('get_ml_stats');
    }

    static async checkMLStatus(): Promise<boolean> {
        return await invoke('check_ml_status');
    }

    static async reinitializeMLEngine(config?: any): Promise<string> {
        return await invoke('reinitialize_ml_engine', { request: { config } });
    }

    static async getMLConfig(): Promise<any> {
        return await invoke('get_ml_config');
    }

    static async detectContext(): Promise<any> {
        return await invoke('detect_context');
    }

    // ===============================
    //  LLM PROXY INTEGRATION
    // ===============================

    static async processWithLLM(request: LLMRequest): Promise<LLMResponse> {
        return await invoke('process_with_llm', { request });
    }

    static async clearLLMCache(): Promise<string> {
        return await invoke('clear_llm_cache');
    }

    static async getLLMCacheStats(): Promise<any> {
        return await invoke('get_llm_cache_stats');
    }

    // ===============================
    //  API GENERATOR INTEGRATION
    // ===============================

    static async getAPIProviders(): Promise<ApiProvider[]> {
        return await invoke('get_api_providers');
    }

    static async scrapeAPIDocumentation(providerId: string, docsUrl: string): Promise<any> {
        return await invoke('scrape_api_documentation', { provider_id: providerId, docs_url: docsUrl });
    }

    static async generateAPIConfiguration(request: any): Promise<any> {
        return await invoke('generate_api_configuration', { request });
    }

    static async detectProviderFromEnv(envVarName: string): Promise<any> {
        return await invoke('detect_provider_from_env', { env_var_name: envVarName });
    }

    static async previewGeneratedConfig(request: any): Promise<any> {
        return await invoke('preview_generated_config', { request });
    }

    static async generateBetterAuthConfig(providerId: string, env_vars: Record<string, string>): Promise<any> {
        return await invoke('generate_better_auth_config', { provider_id: providerId, env_vars });
    }

    static async generateOpenAIConfig(env_vars: Record<string, string>): Promise<any> {
        return await invoke('generate_openai_config', { env_vars });
    }

    static async getProviderTemplates(): Promise<any> {
        return await invoke('get_provider_templates');
    }

    // ===============================
    //  NATIVE DOCUMENTATION STORE INTEGRATION
    // ===============================

    static async getNativeDocumentation(): Promise<Documentation[]> {
        return await invoke('get_documentation');
    }

    static async createNativeDocumentation(doc: Omit<Documentation, 'id' | 'created_at' | 'updated_at'>): Promise<Documentation> {
        return await invoke('create_documentation', { doc });
    }

    static async updateNativeDocumentation(id: string, updates: Partial<Documentation>): Promise<void> {
        return await invoke('update_documentation', { id, updates });
    }

    static async deleteNativeDocumentation(id: string): Promise<void> {
        return await invoke('delete_documentation', { id });
    }

    static async searchNativeDocumentation(query: string, projectId?: string, docType?: string): Promise<any> {
        return await invoke('search_native_documentation', { query, project_id: projectId, doc_type: docType });
    }

    static async getDocumentationByProject(projectId: string): Promise<Documentation[]> {
        return await invoke('get_documentation_by_project', { project_id: projectId });
    }

    static async getDocumentationByProvider(providerId: string): Promise<Documentation[]> {
        return await invoke('get_documentation_by_provider', { provider_id: providerId });
    }

    static async toggleDocumentationFavorite(id: string): Promise<void> {
        return await invoke('toggle_documentation_favorite', { id });
    }

    static async scrapeAndSaveDocumentation(url: string, title?: string): Promise<Documentation> {
        return await invoke('scrape_and_save_documentation', { url, title });
    }

    // ===============================
    //  ENHANCED DOCUMENTATION COMMANDS
    // ===============================

    static async addProviderDocumentation(providerId: string, docsUrl: string): Promise<any> {
        return await invoke('add_provider_documentation', { request: { provider_id: providerId, docs_url: docsUrl } });
    }

    static async getProviderDocumentation(providerId: string): Promise<any> {
        return await invoke('get_provider_documentation', { provider_id: providerId });
    }

    static async searchDocumentationAdvanced(query: string, providerId?: string): Promise<any> {
        return await invoke('search_documentation', { request: { query, provider_id: providerId } });
    }

    static async getDocumentationById(docId: string): Promise<any> {
        return await invoke('get_documentation_by_id', { doc_id: docId });
    }

    static async updateProviderDocumentation(providerId: string, docsUrl: string): Promise<any> {
        return await invoke('update_provider_documentation', { provider_id: providerId, docs_url: docsUrl });
    }

    static async removeProviderDocumentation(providerId: string): Promise<any> {
        return await invoke('remove_provider_documentation', { provider_id: providerId });
    }

    static async getIndexedProviders(): Promise<string[]> {
        return await invoke('get_indexed_providers');
    }

    static async autoIndexProviderDocs(): Promise<any> {
        return await invoke('auto_index_provider_docs');
    }

    static async getContextDocumentationSuggestions(providerIds: string[], contextKeywords: string[]): Promise<any> {
        return await invoke('get_context_documentation_suggestions', { provider_ids: providerIds, context_keywords: contextKeywords });
    }

    // ===============================
    //  LLM-ENHANCED ML ENGINE METHODS
    // ===============================

    // Documentation Generation via LLM
    static async generateDocumentation(request: DocumentationGenerationRequest): Promise<GeneratedDocumentation> {
        return await invoke('generate_documentation', { request });
    }

    static async generateUsageExamples(provider: string, apiKeyFormat: string): Promise<CodeExample[]> {
        return await invoke('generate_usage_examples', { provider, api_key_format: apiKeyFormat });
    }

    static async generateConfigurationTemplate(request: ConfigTemplateRequest): Promise<GeneratedConfigTemplate> {
        return await invoke('generate_config_template', { request });
    }

    // Enhanced ML Analysis with LLM Insights
    static async getEnhancedMLPrediction(context: ContextInfo, availableKeys: string[]): Promise<EnhancedMLPrediction> {
        return await invoke('get_enhanced_ml_prediction', { 
            request: { context, available_keys: availableKeys } 
        });
    }

    static async getContextualDocumentationSuggestions(provider: string, context: ContextInfo): Promise<DocumentationSuggestion[]> {
        return await invoke('get_contextual_doc_suggestions', { provider, context });
    }

    static async getConfigurationRecommendations(provider: string, context: ContextInfo): Promise<ConfigurationRecommendation[]> {
        return await invoke('get_config_recommendations', { provider, context });
    }

    // LLM Engine Management
    static async initializeLLMEngine(config: LLMEngineConfig): Promise<string> {
        return await invoke('initialize_llm_engine', { config });
    }

    static async isLLMEngineLoaded(): Promise<boolean> {
        return await invoke('is_llm_engine_loaded');
    }

    static async getLLMEngineStatus(): Promise<{ loaded: boolean; model_path?: string; config?: LLMEngineConfig }> {
        return await invoke('get_llm_engine_status');
    }

    static async unloadLLMEngine(): Promise<string> {
        return await invoke('unload_llm_engine');
    }

    // Configuration Template Management
    static async previewConfigurationTemplate(request: ConfigTemplateRequest): Promise<{ preview: string; files: ConfigTemplateFile[] }> {
        return await invoke('preview_config_template', { request });
    }

    static async saveConfigurationTemplate(template: GeneratedConfigTemplate, outputPath: string): Promise<string> {
        return await invoke('save_config_template', { template, output_path: outputPath });
    }

    // Documentation Enhancement
    static async enhanceDocumentationWithLLM(docId: string, content: string): Promise<{ enhanced_content: string; sections: DocumentationSection[] }> {
        return await invoke('enhance_documentation_with_llm', { doc_id: docId, content });
    }

    static async summarizeDocumentation(content: string, maxLength?: number): Promise<string> {
        return await invoke('summarize_documentation', { content, max_length: maxLength });
    }

    static async extractKeyInformation(content: string, extractionType: 'authentication' | 'endpoints' | 'examples' | 'configuration'): Promise<DocumentationSection[]> {
        return await invoke('extract_key_information', { content, extraction_type: extractionType });
    }
}

// Types for biometric and user management
export interface UserPreferences {
    theme: string;
    language: string;
    auto_lock_timeout: number;
    clipboard_clear_timeout: number;
    show_notifications: boolean;
    audit_logging: boolean;
    biometric_unlock: boolean;
    auto_backup: boolean;
    encryption_level: string;
} 