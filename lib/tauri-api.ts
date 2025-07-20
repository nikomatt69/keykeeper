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