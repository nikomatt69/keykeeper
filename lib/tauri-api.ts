import { invoke } from '@tauri-apps/api/core';

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