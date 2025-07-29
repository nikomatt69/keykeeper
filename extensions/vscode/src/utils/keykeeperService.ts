import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import * as vscode from 'vscode';

export interface ApiKey {
    id: string;
    name: string;
    service: string;
    key: string;
    description?: string;
    environment: 'dev' | 'staging' | 'production';
    project_id?: string;
    created_at: string;
    updated_at: string;
    scopes: string[];
    tags: string[];
    is_active: boolean;
    expires_at?: string;
    rate_limit?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    settings: {
        defaultEnvironment: 'dev' | 'staging' | 'production';
        autoSync: boolean;
        vscodeIntegration: boolean;
        cursorIntegration: boolean;
        notifications: boolean;
    };
}

export interface RecentActivity {
    id: string;
    type: 'key_used' | 'key_created' | 'key_updated';
    keyId: string;
    keyName: string;
    timestamp: string;
}

export interface AuthResult {
    success: boolean;
    message?: string;
    token?: string;
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

export interface VSCodeWorkspace {
    path: string;
    name: string;
    is_open: boolean;
    last_updated: string;
}

// ML Engine Types for VSCode Extension
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
    reason: string;
    suggested_format: KeyFormat;
}

export enum KeyFormat {
    Plain = 'Plain',
    EnvironmentVariable = 'EnvironmentVariable',
    ProcessEnv = 'ProcessEnv',
    ConfigFile = 'ConfigFile'
}

export interface UsagePrediction {
    frequency_score: number;
    recency_score: number;
    context_match_score: number;
    predicted_next_usage?: string;
}

export interface SecurityScore {
    risk_level: RiskLevel;
    confidence: number;
    reasons: string[];
}

export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Critical = 'Critical'
}

// Chat Types for VSCode Extension
export interface ChatSession {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    message_count: number;
    llm_provider?: string;
    system_prompt?: string;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    include_docs?: boolean;
    sources?: DocumentSource[];
}

export interface DocumentSource {
    id: string;
    title: string;
    content_snippet: string;
    relevance_score: number;
    doc_type: string;
}

export interface ChatResponse {
    user_message: ChatMessage;
    ai_response: ChatMessage;
}

export interface ChatSessionRequest {
    user_id: string;
    title?: string;
    project_id?: string;
    system_prompt?: string;
}

export interface ChatMessageRequest {
    user_id: string;
    content: string;
    message_type: 'user';
    include_docs?: boolean;
}

export interface ChatSearchRequest {
    user_id: string;
    query: string;
    limit?: number;
    doc_types?: string[];
}

export class KeyKeeperService {
    private client: AxiosInstance;
    private ws: WebSocket | null = null;
    private readonly baseUrl: string;
    private connectionAttempts = 0;
    private maxRetries = 3;
    private authToken: string | null = null;
    private isEnterpriseMode: boolean = false;
    private lastHeartbeat: Date | null = null;
    private connectionId: string;
    private _isLoggedIn: boolean = false;

    constructor() {
        const config = vscode.workspace.getConfiguration('keykeeper');
        const port = config.get<number>('appPort', 27182);
        this.baseUrl = `http://localhost:${port}`;
        this.connectionId = `vscode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.isEnterpriseMode = config.get<boolean>('enterprise.auditLogging', true);

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000, // Increased timeout for enterprise
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'KeyKeeper-VSCode-Extension/0.1.0-Enterprise',
                'X-Extension-Version': '0.1.0-enterprise',
                'X-VSCode-Version': vscode.version,
                'X-Client-Type': 'vscode-extension',
                'X-Connection-ID': this.connectionId,
                'X-Enterprise-Mode': this.isEnterpriseMode ? 'true' : 'false',
                'X-Audit-Enabled': vscode.workspace.getConfiguration('keykeeper').get<boolean>('enterprise.auditLogging', true) ? 'true' : 'false'
            }
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use((config) => {
            if (this.authToken) {
                config.headers.Authorization = `Bearer ${this.authToken}`;
            }
            return config;
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    this.authToken = null;
                    vscode.window.showWarningMessage(
                        'KeyKeeper session expired. Please restart the desktop app.',
                        'Retry'
                    ).then(selection => {
                        if (selection === 'Retry') {
                            this.isAppRunning();
                        }
                    });
                }
                return Promise.reject(error);
            }
        );
    }

    async isAppRunning(): Promise<boolean> {
        try {
            const response = await this.client.get('/health');
            if (response.status === 200) {
                this.lastHeartbeat = new Date();
                this.logAuditEvent('health_check', 'success', 'Desktop app connection verified');
                return true;
            }
            return false;
        } catch (error) {
            this.logAuditEvent('health_check', 'error', `Connection failed: ${error}`);
            return false;
        }
    }

    async authenticateWithMasterPassword(masterPass: string): Promise<AuthResult> {
        try {
            const response = await this.client.post('/api/auth/master-password', {
                masterPass,
            });

            if (response.data.success) {
                this.authToken = response.data.token;
                this._isLoggedIn = true;
                this.logAuditEvent('auth', 'success', `Master password authentication successful`);
                return { success: true, token: response.data.token };
            } else {
                this._isLoggedIn = false;
                this.logAuditEvent('auth', 'error', `Master password authentication failed: ${response.data.message}`);
                return { success: false, message: response.data.message };
            }
        } catch (error: any) {
            this._isLoggedIn = false;
            this.logAuditEvent('auth', 'error', `Master password authentication error: ${error.message}`);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }

    isLoggedIn(): boolean {
        return this._isLoggedIn;
    }

    private logAuditEvent(action: string, status: 'success' | 'error' | 'warning', details?: string): void {
        if (!this.isEnterpriseMode) return;

        const auditLog = {
            timestamp: new Date().toISOString(),
            connectionId: this.connectionId,
            action,
            status,
            details,
            workspace: vscode.workspace.workspaceFolders?.[0]?.name || 'unknown',
            user: process.env.USER || process.env.USERNAME || 'unknown'
        };

        console.log('[KeyKeeper Enterprise Audit]', JSON.stringify(auditLog));
    }

    // ===============================
    //  AUTO-SYNC FUNCTIONALITY
    // ===============================

    async syncKeyToEnvFile(keyId: string, projectPath: string, envFileName?: string): Promise<string> {
        try {
            const response = await this.client.post('/api/keys/sync-to-env', {
                keyId,
                projectPath,
                envFileName: envFileName || '.env'
            });

            if (response.data.success) {
                this.logAuditEvent('sync_key_to_env', 'success', `Key ${keyId} synced to ${envFileName || '.env'}`);
                return response.data.message || 'Key synced successfully';
            } else {
                throw new Error(response.data.message || 'Sync failed');
            }
        } catch (error: any) {
            this.logAuditEvent('sync_key_to_env', 'error', `Failed to sync key ${keyId}: ${error.message}`);
            throw error;
        }
    }

    async checkKeyInEnvFile(keyId: string, projectPath: string, envFileName?: string): Promise<boolean> {
        try {
            const response = await this.client.get('/api/keys/check-in-env', {
                params: {
                    keyId,
                    projectPath,
                    envFileName: envFileName || '.env'
                }
            });

            return response.data.exists || false;
        } catch (error: any) {
            console.warn(`Failed to check key in env file: ${error.message}`);
            return false;
        }
    }

    async getEnvFileSuggestions(projectPath: string): Promise<string[]> {
        try {
            const response = await this.client.get('/api/projects/env-files', {
                params: { projectPath }
            });

            return response.data.envFiles || [];
        } catch (error: any) {
            console.warn(`Failed to get env file suggestions: ${error.message}`);
            return ['.env'];
        }
    }

    async autoSyncWorkspaceEnvFiles(workspacePath: string): Promise<string> {
        try {
            const response = await this.client.post('/api/workspace/auto-sync', {
                workspacePath
            });

            if (response.data.success) {
                this.logAuditEvent('auto_sync_workspace', 'success', `Workspace ${workspacePath} auto-synced`);
                return response.data.message || 'Workspace synced successfully';
            } else {
                throw new Error(response.data.message || 'Auto-sync failed');
            }
        } catch (error: any) {
            this.logAuditEvent('auto_sync_workspace', 'error', `Failed to auto-sync workspace: ${error.message}`);
            throw error;
        }
    }

    async intelligentKeyInsertion(keyId: string): Promise<{
        keyInserted: boolean;
        envSynced: boolean;
        message: string;
    }> {
        try {
            // Get current workspace
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const projectPath = workspaceFolder.uri.fsPath;
            
            // Check if key exists in .env file
            const existsInEnv = await this.checkKeyInEnvFile(keyId, projectPath);
            
            let envSynced = false;
            let message = 'Key inserted successfully';

            // If key doesn't exist in .env, ask user if they want to add it
            if (!existsInEnv) {
                const choice = await vscode.window.showInformationMessage(
                    'This API key is not in your .env file. Would you like to add it?',
                    'Yes, add to .env',
                    'No, just insert'
                );

                if (choice === 'Yes, add to .env') {
                    // Get available .env files
                    const envFiles = await this.getEnvFileSuggestions(projectPath);
                    
                    let selectedEnvFile = '.env';
                    if (envFiles.length > 1) {
                        selectedEnvFile = await vscode.window.showQuickPick(envFiles, {
                            placeHolder: 'Select .env file to update'
                        }) || '.env';
                    }

                    // Sync key to selected .env file
                    const syncResult = await this.syncKeyToEnvFile(keyId, projectPath, selectedEnvFile);
                    envSynced = true;
                    message = `Key inserted and added to ${selectedEnvFile}`;
                    
                    vscode.window.showInformationMessage(syncResult);
                }
            }

            return {
                keyInserted: true,
                envSynced,
                message
            };

        } catch (error: any) {
            this.logAuditEvent('intelligent_insertion', 'error', `Failed: ${error.message}`);
            throw error;
        }
    }

    private async validateKeyUsageSecurity(key: ApiKey): Promise<void> {
        const config = vscode.workspace.getConfiguration('keykeeper');
        const showWarnings = config.get<boolean>('enterprise.securityWarnings', true);

        if (!showWarnings) return;

        // Check if key is being used in a potentially unsafe context
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const fileName = document.fileName;

        // Security checks
        const securityIssues: string[] = [];

        // Check for plaintext exposure
        if (fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.log')) {
            securityIssues.push('Potential plaintext exposure in documentation/log file');
        }

        // Check for version control exposure
        if (fileName.includes('README') || fileName.includes('CHANGELOG')) {
            securityIssues.push('Risk of committing sensitive data to version control');
        }

        // Check for production environment
        if (key.environment === 'production') {
            securityIssues.push('Using production API key - ensure proper security measures');
        }

        // Show warnings if any issues found
        if (securityIssues.length > 0) {
            const action = await vscode.window.showWarningMessage(
                `Security Warning: ${securityIssues[0]}`,
                'Proceed Anyway',
                'Cancel',
                'Learn More'
            );

            if (action === 'Cancel') {
                throw new Error('Key insertion cancelled due to security concerns');
            } else if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.keykeeper.dev/security-best-practices'));
                throw new Error('Key insertion cancelled');
            }
        }
    }

    async getApiKeys(projectId?: string): Promise<ApiKey[]> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const url = projectId ? `/api/keys?projectId=${projectId}` : '/api/keys';
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching API keys:', error);
            throw new Error('Failed to fetch API keys from KeyKeeper');
        }
    }

    async getProjects(): Promise<Project[]> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const response = await this.client.get('/api/projects');
            return response.data;
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw new Error('Failed to fetch projects from KeyKeeper');
        }
    }

    async getRecentActivity(): Promise<RecentActivity[]> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const response = await this.client.get('/api/activity/recent');
            return response.data;
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            throw new Error('Failed to fetch recent activity from KeyKeeper');
        }
    }

    async searchKeys(query: string): Promise<ApiKey[]> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const response = await this.client.get(`/api/keys/search?q=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            console.error('Error searching API keys:', error);
            throw new Error('Failed to search API keys');
        }
    }

    async createKey(keyData: Partial<ApiKey>): Promise<ApiKey> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const response = await this.client.post('/api/keys', keyData);
            return response.data;
        } catch (error) {
            console.error('Error creating API key:', error);
            throw new Error('Failed to create API key');
        }
    }

    async updateKey(keyId: string, keyData: Partial<ApiKey>): Promise<ApiKey> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            const response = await this.client.put(`/api/keys/${keyId}`, keyData);
            return response.data;
        } catch (error) {
            console.error('Error updating API key:', error);
            throw new Error('Failed to update API key');
        }
    }

    async recordKeyUsage(keyId: string): Promise<void> {
        if (!this.isLoggedIn()) {
            console.warn('Not logged in to KeyKeeper. Key usage not recorded.');
            return;
        }
        try {
            await this.client.post(`/api/keys/${keyId}/usage`);
        } catch (error) {
            console.error('Error recording key usage:', error);
            // Don't throw here as this is not critical
        }
    }

    async syncProject(projectPath: string): Promise<void> {
        if (!this.isLoggedIn()) {
            throw new Error('Not logged in to KeyKeeper. Please log in first.');
        }
        try {
            await this.client.post('/api/projects/sync', { path: projectPath });
        } catch (error) {
            console.error('Error syncing project:', error);
            throw new Error('Failed to sync project with KeyKeeper');
        }
    }

    connectWebSocket(onMessage?: (data: any) => void): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('KeyKeeper WebSocket connected');
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (onMessage) {
                        onMessage(message);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('error', (error: Error) => {
                console.error('KeyKeeper WebSocket error:', error);
            });

            this.ws.on('close', () => {
                console.log('KeyKeeper WebSocket disconnected');
                this.ws = null;
            });
        } catch (error) {
            console.error('Error connecting to KeyKeeper WebSocket:', error);
        }
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    formatKeyForInsertion(key: ApiKey, format: string): string {
        switch (format) {
            case 'value':
                return key.key;
            case 'environment':
                return `${key.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
            case 'process.env':
                return `process.env.${key.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
            default:
                return key.key;
        }
    }

    // ===============================
    //  ENV FILE AND PROJECT METHODS
    // ===============================

    async parseAndRegisterEnvFile(filePath: string): Promise<DroppedEnvFile> {
        try {
            const response = await this.client.post('/api/env/parse', {
                filePath: filePath
            });
            return response.data;
        } catch (error: any) {
            console.error('Error parsing .env file:', error);
            throw new Error(error.response?.data?.message || 'Failed to parse .env file');
        }
    }

    async associateProjectWithEnv(projectPath: string, envPath: string, fileName: string): Promise<void> {
        try {
            await this.client.post('/api/env/associate', {
                projectPath,
                envPath,
                fileName
            });
        } catch (error: any) {
            console.error('Error associating project with env:', error);
            throw new Error(error.response?.data?.message || 'Failed to associate project with env file');
        }
    }

    async getProjectEnvAssociations(projectPath?: string): Promise<ProjectEnvAssociation[]> {
        try {
            const url = projectPath ?
                `/api/env/associations?projectPath=${encodeURIComponent(projectPath)}` :
                '/api/env/associations';
            const response = await this.client.get(url);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching project env associations:', error);
            throw new Error(error.response?.data?.message || 'Failed to fetch project associations');
        }
    }

    async activateProjectContext(projectPath: string): Promise<boolean> {
        try {
            const response = await this.client.post('/api/projects/activate', {
                projectPath
            });
            return response.data.success || false;
        } catch (error: any) {
            console.error('Error activating project context:', error);
            return false;
        }
    }

    async sendWorkspaceFolders(workspacePaths: string[]): Promise<boolean> {
        try {
            const response = await this.client.post('/api/vscode/workspaces', {
                workspaces: workspacePaths
            });
            this.logAuditEvent('workspace_update', 'success', `Updated ${workspacePaths.length} workspace folders`);
            return response.data.success !== false;
        } catch (error: any) {
            this.logAuditEvent('workspace_update', 'error', `Failed to update workspace folders: ${error.message}`);
            console.error('Error sending workspace folders:', error);
            return false;
        }
    }

    async getVSCodeWorkspaces(): Promise<VSCodeWorkspace[]> {
        try {
            const response = await this.client.get('/api/vscode/workspaces');
            return response.data || [];
        } catch (error: any) {
            console.error('Error getting VSCode workspaces:', error);
            return [];
        }
    }

    async getProjectVSCodeStatus(projectPath: string): Promise<string> {
        try {
            const response = await this.client.get(`/api/vscode/status?projectPath=${encodeURIComponent(projectPath)}`);
            return response.data.status || 'unknown';
        } catch (error: any) {
            console.error('Error getting project VSCode status:', error);
            return 'unknown';
        }
    }

    // ===============================
    //  ML ENGINE INTEGRATION
    // ===============================

    async initializeMLEngine(config?: any): Promise<boolean> {
        try {
            const response = await this.client.post('/api/ml/initialize', { config });
            this.logAuditEvent('ml_init', 'success', 'ML Engine initialized successfully');
            return response.data.success !== false;
        } catch (error: any) {
            this.logAuditEvent('ml_init', 'error', `ML Engine initialization failed: ${error.message}`);
            console.error('Error initializing ML Engine:', error);
            return false;
        }
    }

    async checkMLEngineStatus(): Promise<boolean> {
        try {
            const response = await this.client.get('/api/ml/status');
            return response.data.initialized === true;
        } catch (error: any) {
            console.error('Error checking ML Engine status:', error);
            return false;
        }
    }

    /**
     * Get ML-powered smart suggestions for API keys based on current context
     */
    async getSmartSuggestions(): Promise<MLPrediction | null> {
        try {
            const context = await this.detectCurrentContext();
            const keys = await this.getApiKeys();
            const keyIds = keys.map(k => k.id);

            const response = await this.client.post('/api/ml/analyze', {
                context,
                available_keys: keyIds
            });

            this.logAuditEvent('ml_suggestion', 'success', `Generated ${response.data.api_key_suggestions?.length || 0} suggestions`);
            return response.data;
        } catch (error: any) {
            this.logAuditEvent('ml_suggestion', 'error', `Failed to get ML suggestions: ${error.message}`);
            console.error('Error getting smart suggestions:', error);
            return null;
        }
    }

    /**
     * Detect current VSCode context for ML analysis
     */
    async detectCurrentContext(): Promise<ContextInfo> {
        const editor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        let context: ContextInfo = {
            active_app: 'VSCode'
        };

        if (editor) {
            const document = editor.document;
            const filePath = document.fileName;
            const fileExtension = filePath.split('.').pop()?.toLowerCase();
            
            context.file_path = filePath;
            context.file_extension = fileExtension;
            context.language = document.languageId;
            
            // Get a small content snippet for context (first 200 chars)
            const text = document.getText();
            context.content_snippet = text.substring(0, 200);
        }

        if (workspaceFolder) {
            context.project_type = await this.inferProjectType(workspaceFolder.uri.fsPath);
        }

        return context;
    }

    /**
     * Record ML usage for learning
     */
    async recordMLUsage(keyId: string, context: ContextInfo, success: boolean): Promise<void> {
        try {
            await this.client.post('/api/ml/record-usage', {
                key_id: keyId,
                context,
                success
            });
        } catch (error: any) {
            console.error('Error recording ML usage:', error);
            // Don't throw, this is not critical
        }
    }

    /**
     * Get ML usage statistics
     */
    async getMLStats(): Promise<Record<string, any>> {
        try {
            const response = await this.client.get('/api/ml/stats');
            return response.data || {};
        } catch (error: any) {
            console.error('Error getting ML stats:', error);
            return {};
        }
    }

    /**
     * Intelligent key insertion with ML-powered context awareness
     */
    async intelligentMLKeyInsertion(keyId?: string): Promise<{
        keyInserted: boolean;
        envSynced: boolean;
        message: string;
    }> {
        try {
            const context = await this.detectCurrentContext();
            
            // Get ML suggestions if no keyId provided
            if (!keyId) {
                const prediction = await this.getSmartSuggestions();
                if (!prediction || prediction.api_key_suggestions.length === 0) {
                    throw new Error('No suitable keys found for current context');
                }
                
                // Use the highest confidence suggestion
                const bestSuggestion = prediction.api_key_suggestions[0];
                keyId = bestSuggestion.key_id;
                
                // Show security warning if high risk
                if (prediction.security_score.risk_level === RiskLevel.High || 
                    prediction.security_score.risk_level === RiskLevel.Critical) {
                    const proceed = await vscode.window.showWarningMessage(
                        `Security Alert: ${prediction.security_score.risk_level} risk detected.\n${prediction.security_score.reasons.join(', ')}`,
                        'Proceed Anyway',
                        'Cancel'
                    );
                    if (proceed !== 'Proceed Anyway') {
                        throw new Error('Key insertion cancelled due to security concerns');
                    }
                }
                
                vscode.window.showInformationMessage(
                    `🤖 Smart suggestion: ${bestSuggestion.reason} (${Math.round(bestSuggestion.confidence * 100)}% confidence)`
                );
            }

            // Get the selected key
            const keys = await this.getApiKeys();
            const selectedKey = keys.find(k => k.id === keyId);
            if (!selectedKey) {
                throw new Error('Selected key not found');
            }

            // Security validation
            await this.validateKeyUsageSecurity(selectedKey);

            // Format key based on context
            const format = this.getOptimalKeyFormat(context);
            const formattedKey = this.formatKeyForInsertion(selectedKey, format);

            // Insert key at cursor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, formattedKey);
                });
            }

            // Standard intelligent insertion logic
            const result = await this.intelligentKeyInsertion(keyId);
            
            // Record ML usage
            await this.recordMLUsage(keyId, context, true);
            
            // Log success
            this.logAuditEvent('intelligent_ml_insertion', 'success', 
                `Key ${selectedKey.name} inserted with format ${format}`);

            return {
                ...result,
                message: `${result.message} (ML-optimized format: ${format})`
            };

        } catch (error: any) {
            this.logAuditEvent('intelligent_ml_insertion', 'error', `Failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get optimal key format based on context
     */
    private getOptimalKeyFormat(context: ContextInfo): string {
        // Map ML KeyFormat to VSCode formats
        switch (context.file_extension) {
            case 'env':
                return 'environment';
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
                return 'process.env';
            case 'json':
            case 'yaml':
            case 'yml':
                return 'value'; // For config files, use raw value
            default:
                return 'value';
        }
    }

    /**
     * Infer project type from workspace
     */
    private async inferProjectType(workspacePath: string): Promise<string | undefined> {
        const fs = require('fs');
        const path = require('path');
        
        try {
            // Check for common project files
            const files = fs.readdirSync(workspacePath);
            
            if (files.includes('package.json')) {
                return 'node';
            } else if (files.includes('Cargo.toml')) {
                return 'rust';
            } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
                return 'python';
            } else if (files.includes('pom.xml') || files.includes('build.gradle')) {
                return 'java';
            } else if (files.includes('go.mod')) {
                return 'go';
            }
            
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Enhanced key insertion with ML context awareness
     */
    async insertKeyWithContext(keyId: string): Promise<void> {
        try {
            const context = await this.detectCurrentContext();
            const keys = await this.getApiKeys();
            const key = keys.find(k => k.id === keyId);
            
            if (!key) {
                throw new Error('Key not found');
            }

            // Get ML analysis for this specific key
            const prediction = await this.getSmartSuggestions();
            const suggestion = prediction?.api_key_suggestions.find(s => s.key_id === keyId);
            
            let format = 'value';
            if (suggestion) {
                // Use ML suggested format
                switch (suggestion.suggested_format) {
                    case KeyFormat.EnvironmentVariable:
                        format = 'environment';
                        break;
                    case KeyFormat.ProcessEnv:
                        format = 'process.env';
                        break;
                    default:
                        format = 'value';
                        break;
                }
                
                vscode.window.showInformationMessage(
                    `🤖 Using ML-optimized format: ${suggestion.reason}`
                );
            }

            // Insert with the determined format
            const formattedKey = this.formatKeyForInsertion(key, format);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, formattedKey);
                });
                
                // Record usage
                await this.recordMLUsage(keyId, context, true);
                await this.recordKeyUsage(keyId);
            }
            
        } catch (error: any) {
            console.error('Error inserting key with context:', error);
            throw error;
        }
    }

    // ===============================
    //  PUBLIC API ACCESS METHODS
    // ===============================

    /**
     * Make a GET request to the API
     */
    async get(url: string): Promise<any> {
        return await this.client.get(url);
    }

    /**
     * Make a POST request to the API
     */
    async post(url: string, data?: any): Promise<any> {
        return await this.client.post(url, data);
    }

    /**
     * Make a PUT request to the API
     */
    async put(url: string, data?: any): Promise<any> {
        return await this.client.put(url, data);
    }

    /**
     * Make a DELETE request to the API
     */
    async delete(url: string): Promise<any> {
        return await this.client.delete(url);
    }

    // ================================
    // Documentation Management (New)
    // ================================

    /**
     * Add documentation for current API/context
     */
    async addDocumentationForCurrentAPI(title: string, content: string, url?: string, tags?: string[]): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        let projectId: string | undefined;
        
        if (activeEditor?.document.uri.scheme === 'file') {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
            if (workspaceFolder) {
                // Try to detect project context
                projectId = await this.detectProjectIdFromPath(workspaceFolder.uri.fsPath);
            }
        }

        await this.post('/api/docs/create', {
            title,
            content,
            doc_type: 'api',
            project_id: projectId,
            url,
            tags: tags || [],
            language: 'en'
        });
    }

    /**
     * Get all documentation
     */
    async getAllDocumentation(): Promise<any[]> {
        return await this.get('/api/docs');
    }

    /**
     * Search documentation
     */
    async searchDocumentation(query: string, projectId?: string, docType?: string): Promise<any[]> {
        const params = new URLSearchParams();
        params.append('query', query);
        if (projectId) params.append('project_id', projectId);
        if (docType) params.append('doc_type', docType);
        
        return await this.get(`/api/docs/search?${params.toString()}`);
    }

    /**
     * Get documentation by project
     */
    async getDocumentationByProject(projectId: string): Promise<any[]> {
        return await this.get(`/api/docs/project/${projectId}`);
    }

    /**
     * Update documentation
     */
    async updateDocumentation(docId: string, updates: any): Promise<any> {
        return await this.put(`/api/docs/${docId}`, updates);
    }

    /**
     * Delete documentation
     */
    async deleteDocumentation(docId: string): Promise<void> {
        await this.delete(`/api/docs/${docId}`);
    }

    /**
     * Toggle documentation favorite
     */
    async toggleDocumentationFavorite(docId: string): Promise<any> {
        return await this.post(`/api/docs/${docId}/toggle-favorite`);
    }

    /**
     * Scrape and save documentation from URL
     */
    async scrapeAndSaveDocumentation(url: string, title?: string, projectId?: string, tags?: string[]): Promise<any> {
        return await this.post('/api/docs/scrape', {
            url,
            title,
            project_id: projectId,
            tags: tags || [],
            doc_type: 'scraped'
        });
    }

    /**
     * Get API providers for documentation
     */
    async getAPIProviders(): Promise<any[]> {
        return await this.get('/api/providers');
    }

    /**
     * Auto-detect API provider from current context
     */
    async autoDetectAPIProvider(filePath?: string): Promise<any> {
        const activeEditor = vscode.window.activeTextEditor;
        const currentFile = filePath || activeEditor?.document.uri.fsPath;
        
        if (currentFile) {
            return await this.post('/api/providers/detect', {
                file_path: currentFile,
                content: activeEditor?.document.getText()
            });
        }
        
        return null;
    }

    /**
     * Generate API configuration 
     */
    async generateAPIConfiguration(providerId: string, options?: any): Promise<any> {
        return await this.post('/api/generate/config', {
            provider_id: providerId,
            options: options || {}
        });
    }

    /**
     * Preview generated configuration
     */
    async previewGeneratedConfig(providerId: string, options?: any): Promise<any> {
        return await this.post('/api/generate/preview', {
            provider_id: providerId,
            options: options || {}
        });
    }

    // ================================
    // Helper Methods
    // ================================

    /**
     * Detect project ID from file path
     */
    private async detectProjectIdFromPath(workspacePath: string): Promise<string | undefined> {
        try {
            const projects = await this.getProjects();
            const matchingProject = projects.find((project: any) => 
                workspacePath.includes(project.path) || project.path.includes(workspacePath)
            );
            return matchingProject?.id;
        } catch (error) {
            console.warn('Failed to detect project ID:', error);
            return undefined;
        }
    }

    // ================================
    // Additional ML Engine Methods for VSCode Provider Commands
    // ================================

    /**
     * Reinitialize ML Engine
     */
    async reinitializeMLEngine(): Promise<boolean> {
        try {
            const response = await this.client.post('/api/ml/reinitialize');
            this.logAuditEvent('ml_reinit', 'success', 'ML Engine reinitialized successfully');
            return response.data.success !== false;
        } catch (error: any) {
            this.logAuditEvent('ml_reinit', 'error', `ML Engine reinitialization failed: ${error.message}`);
            console.error('Error reinitializing ML Engine:', error);
            return false;
        }
    }

    /**
     * Export ML usage data
     */
    async exportMLData(): Promise<any> {
        try {
            const response = await this.client.get('/api/ml/export');
            this.logAuditEvent('ml_export', 'success', 'ML data exported successfully');
            return response.data;
        } catch (error: any) {
            this.logAuditEvent('ml_export', 'error', `ML data export failed: ${error.message}`);
            console.error('Error exporting ML data:', error);
            throw error;
        }
    }

    /**
     * Reset ML learning data
     */
    async resetMLData(): Promise<boolean> {
        try {
            const response = await this.client.post('/api/ml/reset');
            this.logAuditEvent('ml_reset', 'success', 'ML data reset successfully');
            return response.data.success !== false;
        } catch (error: any) {
            this.logAuditEvent('ml_reset', 'error', `ML data reset failed: ${error.message}`);
            console.error('Error resetting ML data:', error);
            return false;
        }
    }

    /**
     * Get ML configuration
     */
    async getMLConfig(): Promise<any> {
        try {
            const response = await this.client.get('/api/ml/config');
            return response.data || {};
        } catch (error: any) {
            console.error('Error getting ML config:', error);
            return {};
        }
    }

    /**
     * Show ML statistics in VS Code
     */
    async showMLStatsInVSCode(): Promise<void> {
        try {
            const stats = await this.getMLStats();
            const statsText = JSON.stringify(stats, null, 2);
            
            // Create a new untitled document to show stats
            const document = await vscode.workspace.openTextDocument({
                content: `# KeyKeeper ML Engine Statistics\n\n\`\`\`json\n${statsText}\n\`\`\``,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to show ML stats: ${error.message}`);
        }
    }

    // ================================
    // Chat System Methods
    // ================================

    /**
     * Create a new chat session
     */
    async createChatSession(request: ChatSessionRequest): Promise<ChatSession> {
        try {
            const response = await this.client.post('/api/chat/sessions', request);
            this.logAuditEvent('chat_session_create', 'success', `Created chat session for user ${request.user_id}`);
            return response.data.data;
        } catch (error: any) {
            this.logAuditEvent('chat_session_create', 'error', `Failed to create chat session: ${error.message}`);
            console.error('Error creating chat session:', error);
            throw error;
        }
    }

    /**
     * List all chat sessions for a user
     */
    async listChatSessions(userId: string): Promise<ChatSession[]> {
        try {
            const response = await this.client.get(`/api/chat/sessions?user_id=${userId}`);
            return response.data.data || [];
        } catch (error: any) {
            console.error('Error listing chat sessions:', error);
            return [];
        }
    }

    /**
     * Send a message to a chat session
     */
    async sendChatMessage(sessionId: string, request: ChatMessageRequest): Promise<ChatResponse> {
        try {
            const response = await this.client.post(`/api/chat/sessions/${sessionId}/messages`, request);
            this.logAuditEvent('chat_message_send', 'success', `Sent message to session ${sessionId}`);
            return response.data.data;
        } catch (error: any) {
            this.logAuditEvent('chat_message_send', 'error', `Failed to send message: ${error.message}`);
            console.error('Error sending chat message:', error);
            throw error;
        }
    }

    /**
     * Get messages from a chat session
     */
    async getChatMessages(sessionId: string, userId: string, limit?: number): Promise<ChatMessage[]> {
        try {
            const params = new URLSearchParams({
                user_id: userId,
                ...(limit && { limit: limit.toString() })
            });
            const response = await this.client.get(`/api/chat/sessions/${sessionId}/messages?${params}`);
            return response.data.data || [];
        } catch (error: any) {
            console.error('Error getting chat messages:', error);
            return [];
        }
    }

    /**
     * Delete a chat session
     */
    async deleteChatSession(sessionId: string, userId: string): Promise<boolean> {
        try {
            await this.client.delete(`/api/chat/sessions/${sessionId}?user_id=${userId}`);
            this.logAuditEvent('chat_session_delete', 'success', `Deleted chat session ${sessionId}`);
            return true;
        } catch (error: any) {
            this.logAuditEvent('chat_session_delete', 'error', `Failed to delete chat session: ${error.message}`);
            console.error('Error deleting chat session:', error);
            return false;
        }
    }

    /**
     * Search documentation for chat integration
     */
    async searchDocumentationForChat(request: ChatSearchRequest): Promise<DocumentSource[]> {
        try {
            const response = await this.client.post('/api/chat/search-docs', request);
            return response.data.data.results || [];
        } catch (error: any) {
            console.error('Error searching documentation for chat:', error);
            return [];
        }
    }

    /**
     * Get chat session by ID
     */
    async getChatSession(sessionId: string, userId: string): Promise<ChatSession | null> {
        try {
            const response = await this.client.get(`/api/chat/sessions/${sessionId}?user_id=${userId}`);
            return response.data.data;
        } catch (error: any) {
            console.error('Error getting chat session:', error);
            return null;
        }
    }

    /**
     * Update chat session settings
     */
    async updateChatSession(sessionId: string, userId: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
        try {
            const response = await this.client.put(`/api/chat/sessions/${sessionId}`, {
                user_id: userId,
                ...updates
            });
            this.logAuditEvent('chat_session_update', 'success', `Updated chat session ${sessionId}`);
            return response.data.data;
        } catch (error: any) {
            this.logAuditEvent('chat_session_update', 'error', `Failed to update chat session: ${error.message}`);
            console.error('Error updating chat session:', error);
            return null;
        }
    }

    /**
     * Show chat interface in VS Code
     */
    async showChatInterface(): Promise<void> {
        try {
            // This will be implemented with a webview panel
            vscode.window.showInformationMessage('Chat interface will be implemented with webview panel');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to show chat interface: ${error.message}`);
        }
    }

    /**
     * Quick chat - send a message and get immediate response
     */
    async quickChat(message: string, userId: string = 'vscode-user'): Promise<string> {
        try {
            // Create a temporary session for quick chat
            const session = await this.createChatSession({
                user_id: userId,
                title: 'Quick Chat',
                project_id: await this.detectProjectIdFromPath(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '')
            });

            // Send the message
            const response = await this.sendChatMessage(session.id, {
                user_id: userId,
                content: message,
                message_type: 'user',
                include_docs: true
            });

            // Clean up the temporary session
            await this.deleteChatSession(session.id, userId);

            return response.ai_response.content;
        } catch (error: any) {
            console.error('Error in quick chat:', error);
            throw error;
        }
    }
} 