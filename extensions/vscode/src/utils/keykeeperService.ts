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
                'User-Agent': 'KeyKeeper-VSCode-Extension/2.2.3-Enterprise', // TODO: Update version
                'X-Extension-Version': '2.2.3-enterprise',
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
} 