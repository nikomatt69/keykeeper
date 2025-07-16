import { useAppStore } from '../store'
import type { EnterpriseSettings } from '../types'
import { TauriAPI, ApiKey } from '../tauri-api'

export interface VSCodeStatus {
    connected: boolean
    lastHeartbeat: Date | null
    connectionCount: number
    version?: string
}

export interface NotificationData {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
    read: boolean
    actions?: { label: string; action: () => void }[]
}

class IntegrationService {
    private vscodeStatus: VSCodeStatus = {
        connected: false,
        lastHeartbeat: null,
        connectionCount: 0
    }

    private notifications: NotificationData[] = []
    private backupInProgress = false
    private lastBackup: Date | null = null
    private initialized = false

    // VSCode Integration
    async checkVSCodeConnection(): Promise<boolean> {
        // Prefer Tauri API for desktop
        try {
            const running = await TauriAPI.getVSCodeServerStatus();
            this.vscodeStatus = {
                connected: !!running,
                lastHeartbeat: running ? new Date() : null,
                connectionCount: running ? 1 : 0,
                version: running ? 'native-tauri' : undefined
            };
            return running;
        } catch (tauriErr) {
            // Fallback to HTTP for extension/legacy
            try {
                const response = await fetch('http://localhost:27182/health', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    this.vscodeStatus = {
                        connected: true,
                        lastHeartbeat: new Date(),
                        connectionCount: 1,
                        version: response.headers.get('X-Extension-Version') || 'unknown'
                    };
                    return true;
                }
            } catch (error) {
                // ignore
            }
            this.vscodeStatus = {
                connected: false,
                lastHeartbeat: null,
                connectionCount: 0
            };
            return false;
        }
    }

    async enableVSCodeIntegration(enabled: boolean): Promise<boolean> {
        try {
            if (enabled) {
                // Start VSCode API server via Tauri
                await TauriAPI.startVSCodeServer()
                return await this.startAPIServer()
            } else {
                // Stop VSCode API server via Tauri
                await TauriAPI.stopVSCodeServer()
                return await this.stopAPIServer()
            }
        } catch (error) {
            console.error('Error managing VSCode integration:', error)
            return false
        }
    }

    private async startAPIServer(): Promise<boolean> {
        // With Tauri, we don't need an external API server
        // Just check if vault is accessible
        try {
            await TauriAPI.isVaultUnlocked()
            return true
        } catch (error) {
            console.error('Tauri API not accessible:', error)
            return false
        }
    }

    private async stopAPIServer(): Promise<boolean> {
        // VSCode server is stopped via Tauri command
        return true
    }

    getVSCodeStatus(): VSCodeStatus {
        return { ...this.vscodeStatus }
    }

    // Notifications
    addNotification(notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>): string {
        const id = crypto.randomUUID()
        const newNotification: NotificationData = {
            ...notification,
            id,
            timestamp: new Date(),
            read: false
        }

        this.notifications.unshift(newNotification)

        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50)
        }

        return id
    }

    markNotificationRead(id: string): void {
        const notification = this.notifications.find(n => n.id === id)
        if (notification) {
            notification.read = true
        }
    }

    getNotifications(): NotificationData[] {
        return [...this.notifications]
    }

    clearNotifications(): void {
        this.notifications = []
    }

    // Backup System
    async createBackup(): Promise<string> {
        if (this.backupInProgress) {
            throw new Error('Backup already in progress')
        }

        try {
            this.backupInProgress = true
            const apiKeys = await TauriAPI.getApiKeys()
            const { settings } = useAppStore.getState()

            const backupData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                apiKeys: apiKeys.map(key => ({
                    ...key,
                    key: '*'.repeat(key.key.length) // Mask the actual key for security
                })),
                settings,
                metadata: {
                    totalKeys: apiKeys.length,
                    environments: Array.from(new Set(apiKeys.map(k => k.environment))),
                    services: Array.from(new Set(apiKeys.map(k => k.service))),
                    createdBy: 'KeyKeeper',
                    encryptionMethod: 'AES-256-GCM'
                }
            }

            const backupJson = JSON.stringify(backupData, null, 2)
            this.lastBackup = new Date()

            this.addNotification({
                type: 'success',
                title: 'Backup Created',
                message: `Backup completed with ${apiKeys.length} API keys`
            })

            return backupJson

        } catch (error) {
            this.addNotification({
                type: 'error',
                title: 'Backup Failed',
                message: `Failed to create backup: ${error}`
            })
            throw error
        } finally {
            this.backupInProgress = false
        }
    }

    async scheduleAutoBackup(settings: EnterpriseSettings): Promise<void> {
        if (!settings.backup.autoBackup) return

        const intervalHours = settings.backup.backupInterval
        const intervalMs = intervalHours * 60 * 60 * 1000

        // Check if it's time for backup
        if (this.lastBackup) {
            const timeSinceLastBackup = Date.now() - this.lastBackup.getTime()
            if (timeSinceLastBackup < intervalMs) {
                return // Not time yet
            }
        }

        try {
            await this.createBackup()
        } catch (error) {
            console.error('Auto backup failed:', error)
        }
    }

    // Security Functions
    async triggerAutoLock(timeoutMinutes: number): Promise<void> {
        setTimeout(() => {
            const { lockVault } = useAppStore.getState()
            lockVault()

            this.addNotification({
                type: 'info',
                title: 'Vault Locked',
                message: 'Vault was automatically locked due to inactivity'
            })
        }, timeoutMinutes * 60 * 1000)
    }

    async checkDeviceFingerprint(): Promise<string> {
        // Simple device fingerprinting
        const navigator = typeof window !== 'undefined' ? window.navigator : null
        if (!navigator) return 'server-side'

        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: typeof window !== 'undefined' ? {
                width: window.screen.width,
                height: window.screen.height,
                colorDepth: window.screen.colorDepth
            } : null
        }

        const fingerprintString = JSON.stringify(fingerprint)

        // Simple hash (in production use crypto.subtle.digest)
        let hash = 0
        for (let i = 0; i < fingerprintString.length; i++) {
            const char = fingerprintString.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32-bit integer
        }

        return hash.toString(16)
    }

    // Settings Validation
    validateSettings(settings: EnterpriseSettings): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        // Security validation
        if (settings.security.autoLockTimeout < 1) {
            errors.push('Auto-lock timeout must be at least 1 minute')
        }

        if (settings.security.sessionTimeout < 5) {
            errors.push('Session timeout must be at least 5 minutes')
        }

        // Backup validation
        if (settings.backup.autoBackup && settings.backup.backupInterval < 1) {
            errors.push('Backup interval must be at least 1 hour')
        }

        if (settings.backup.retentionDays < 1) {
            errors.push('Retention period must be at least 1 day')
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }

    // Analytics
    async gatherUsageAnalytics(): Promise<any> {
        const apiKeys = await TauriAPI.getApiKeys()

        return {
            totalKeys: apiKeys.length,
            environmentDistribution: {
                dev: apiKeys.filter(k => k.environment === 'development').length,
                staging: apiKeys.filter(k => k.environment === 'staging').length,
                production: apiKeys.filter(k => k.environment === 'production').length
            },
            serviceTypes: Array.from(new Set(apiKeys.map(k => k.service))),
            lastSync: new Date().toISOString(),
            activeConnections: this.vscodeStatus.connectionCount
        }
    }

    // Initialize service
    async initialize(settings: EnterpriseSettings): Promise<void> {
        // Prevent duplicate initialization
        if (this.initialized) {
            return
        }
        
        this.initialized = true

        // Start VSCode integration if enabled
        if (settings.integrations.vscode.enabled) {
            await this.enableVSCodeIntegration(true)

            // Check connection periodically
            setInterval(() => {
                this.checkVSCodeConnection()
            }, 30000) // Every 30 seconds
        }

        // Schedule auto backup
        if (settings.backup.autoBackup) {
            setInterval(() => {
                this.scheduleAutoBackup(settings)
            }, 60000) // Check every minute
        }

        // Setup auto-lock
        if (settings.security.autoLockTimeout > 0) {
            this.triggerAutoLock(settings.security.autoLockTimeout)
        }

        this.addNotification({
            type: 'success',
            title: 'KeyKeeper Started',
            message: 'All integrations have been initialized'
        })
    }

    // Reset service state when vault is locked
    reset(): void {
        this.initialized = false
        this.vscodeStatus = {
            connected: false,
            lastHeartbeat: null,
            connectionCount: 0
        }
    }
}

// Singleton instance
export const integrationService = new IntegrationService()

// Export utility functions
export function formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

export function formatTimeAgo(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Now'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US')
} 