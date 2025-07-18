import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Shield,
    Database,
    Palette,
    Plug,
    BarChart3,
    Users,
    Key,
    Smartphone,
    Cloud,
    Bell,
    Code,
    Zap,
    Monitor,
    Lock,
    Download,
    Upload,
    Settings as SettingsIcon,
    CheckCircle2,
    AlertTriangle,
    Info,
    Fingerprint,
    User,
    Plus,
    Trash2
} from 'lucide-react'
import { useAppStore } from '../lib/store'
import type { EnterpriseSettings } from '../lib/types'
import { integrationService, formatTimeAgo } from '../lib/services/integrationService'
import { TauriAPI } from '../lib/tauri-api'

interface SettingsSection {
    id: string
    title: string
    icon: any
    description: string
}

const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: 'security',
        title: 'Security',
        icon: Shield,
        description: 'Authentication, encryption and access controls'
    },
    {
        id: 'backup',
        title: 'Backup & Sync',
        icon: Database,
        description: 'Automatic backups and cloud synchronization'
    },
    {
        id: 'ui',
        title: 'Interface',
        icon: Palette,
        description: 'Theme, layout and visual preferences'
    },
    {
        id: 'integrations',
        title: 'Integrations',
        icon: Plug,
        description: 'VSCode, Cursor and other integrations'
    },
    {
        id: 'analytics',
        title: 'Analytics',
        icon: BarChart3,
        description: 'Usage monitoring and analytics'
    },
    {
        id: 'team',
        title: 'Team',
        icon: Users,
        description: 'Collaboration and team management'
    },
    {
        id: 'user',
        title: 'User Management',
        icon: User,
        description: 'Account settings, data management and local file cleanup'
    },
    {
        id: 'security-audit',
        title: 'Security Audit',
        icon: Shield,
        description: 'Security analysis, vulnerability scans and audit logs'
    },
    {
        id: 'system-info',
        title: 'System Info',
        icon: Monitor,
        description: 'System performance, diagnostics and resource usage'
    },
    {
        id: 'developer',
        title: 'Developer Tools',
        icon: Code,
        description: 'Debug tools, API testing and development utilities'
    }
]

export default function SettingsScreen() {
    const { settings, updateSettings, showSettingsModal, setShowSettingsModal } = useAppStore()
    const [activeSection, setActiveSection] = useState('security')
    const [unsavedChanges, setUnsavedChanges] = useState(false)
    const [localSettings, setLocalSettings] = useState<EnterpriseSettings>(settings)

    // Integration status states
    const [vscodeStatus, setVSCodeStatus] = useState<{
        connected: boolean
        lastHeartbeat: Date | null
        connectionCount: number
        version?: string
    }>({ connected: false, lastHeartbeat: null, connectionCount: 0 })
    const [notifications, setNotifications] = useState(integrationService.getNotifications())
    const [backupInProgress, setBackupInProgress] = useState(false)
    const [lastBackup, setLastBackup] = useState<Date | null>(null)

    // Initialize integration service
    useEffect(() => {
        const initializeService = async () => {
            try {
                // Integration service is now initialized when vault is unlocked
                // Just check VSCode connection status
                const connected = await integrationService.checkVSCodeConnection()
                setVSCodeStatus(integrationService.getVSCodeStatus())

                // Update notifications
                setNotifications(integrationService.getNotifications())
            } catch (error) {
                console.error('Failed to initialize integration service:', error)
            }
        }

        if (showSettingsModal) {
            initializeService()
        }
    }, [showSettingsModal, settings])

    // Poll for VSCode status updates
    useEffect(() => {
        if (!showSettingsModal) return

        const interval = setInterval(async () => {
            await integrationService.checkVSCodeConnection()
            setVSCodeStatus(integrationService.getVSCodeStatus())
            setNotifications(integrationService.getNotifications())
        }, 5000)

        return () => clearInterval(interval)
    }, [showSettingsModal])

    const handleSettingChange = (section: keyof EnterpriseSettings, key: string, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }))
        setUnsavedChanges(true)
    }

    const handleSave = async () => {
        try {
            // Validate settings
            const validation = integrationService.validateSettings(localSettings)
            if (!validation.valid) {
                integrationService.addNotification({
                    type: 'error',
                    title: 'Invalid settings',
                    message: validation.errors.join(', ')
                })
                return
            }

            // Apply VSCode integration changes
            if (localSettings.integrations.vscode.enabled !== settings.integrations.vscode.enabled) {
                await integrationService.enableVSCodeIntegration(localSettings.integrations.vscode.enabled)
            }

            // Save settings
            await updateSettings(localSettings)
            setUnsavedChanges(false)

            // Show success notification
            integrationService.addNotification({
                type: 'success',
                title: 'Settings Saved',
                message: 'Settings have been updated successfully'
            })

            setNotifications(integrationService.getNotifications())

        } catch (error) {
            integrationService.addNotification({
                type: 'error',
                title: 'Save Error',
                message: `Unable to save settings: ${error}`
            })
            setNotifications(integrationService.getNotifications())
        }
    }

    const handleCreateBackup = async () => {
        try {
            setBackupInProgress(true)
            const backupData = await integrationService.createBackup()

            // Trigger download
            const blob = new Blob([backupData], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `keykeeper-backup-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setLastBackup(new Date())
            setNotifications(integrationService.getNotifications())

        } catch (error) {
            console.error('Backup failed:', error)
        } finally {
            setBackupInProgress(false)
        }
    }

    const handleCancel = () => {
        setLocalSettings(settings)
        setUnsavedChanges(false)
        setShowSettingsModal(false)
    }


    if (!showSettingsModal) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="modal-native w-full max-w-6xl max-h-[90vh] overflow-hidden flex"
                >
                    {/* Sidebar */}
                    <div
                        className="w-80 p-6 scrollbar-native"
                        style={{
                            backgroundColor: 'var(--color-background-secondary)',
                            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
                            overflow: 'auto'
                        }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-heading flex items-center space-x-2">
                                <SettingsIcon className="h-5 w-5" />
                                <span>Settings</span>
                            </h2>
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="btn-secondary p-2 hover-lift focus-native"
                                style={{ borderRadius: 'var(--radius-md)' }}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {SETTINGS_SECTIONS.map((section) => {
                                const Icon = section.icon
                                return (
                                    <motion.button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-all hover-lift focus-native ${activeSection === section.id ? 'selected' : ''
                                            }`}
                                        style={{
                                            background: activeSection === section.id
                                                ? 'rgba(0, 122, 255, 0.1)'
                                                : 'transparent',
                                            border: activeSection === section.id
                                                ? '1px solid rgba(0, 122, 255, 0.2)'
                                                : '1px solid transparent'
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <Icon
                                                className="h-5 w-5 mt-0.5"
                                                style={{
                                                    color: activeSection === section.id
                                                        ? 'var(--color-accent)'
                                                        : 'var(--color-text-secondary)'
                                                }}
                                            />
                                            <div>
                                                <h3
                                                    className="text-body font-medium"
                                                    style={{
                                                        color: activeSection === section.id
                                                            ? 'var(--color-accent)'
                                                            : 'var(--color-text-primary)'
                                                    }}
                                                >
                                                    {section.title}
                                                </h3>
                                                <p className="text-caption mt-1">
                                                    {section.description}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.button>
                                )
                            })}
                        </div>

                        {unsavedChanges && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 glass-card p-4"
                                style={{
                                    background: 'rgba(255, 159, 10, 0.1)',
                                    border: '1px solid rgba(255, 159, 10, 0.2)'
                                }}
                            >
                                <div className="flex items-start space-x-2">
                                    <AlertTriangle
                                        className="h-4 w-4 mt-0.5"
                                        style={{ color: 'var(--color-warning)' }}
                                    />
                                    <div>
                                        <p className="text-body font-medium" style={{ color: 'var(--color-warning)' }}>
                                            Unsaved changes
                                        </p>
                                        <p className="text-caption mt-1">
                                            You have unsaved changes that have not been saved.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                        {/* Content Header */}
                        <div
                            className="p-6"
                            style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-title">
                                        {SETTINGS_SECTIONS.find(s => s.id === activeSection)?.title}
                                    </h3>
                                    <p className="text-caption mt-1">
                                        {SETTINGS_SECTIONS.find(s => s.id === activeSection)?.description}
                                    </p>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleCancel}
                                        className="btn-secondary px-4 py-2 hover-lift focus-native"
                                        style={{ borderRadius: 'var(--radius-md)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!unsavedChanges}
                                        className="btn-primary px-4 py-2 hover-lift focus-native"
                                        style={{
                                            borderRadius: 'var(--radius-md)',
                                            opacity: !unsavedChanges ? '0.5' : '1'
                                        }}
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 p-6 scrollbar-native" style={{ overflow: 'auto' }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSection}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {activeSection === 'security' && (
                                        <SecuritySettings
                                            settings={localSettings.security}
                                            onChange={(key, value) => handleSettingChange('security', key, value)}
                                        />
                                    )}

                                    {activeSection === 'backup' && (
                                        <BackupSettings
                                            settings={localSettings.backup}
                                            backupInProgress={backupInProgress}
                                            lastBackup={lastBackup}
                                            onCreateBackup={handleCreateBackup}
                                            onChange={(key, value) => handleSettingChange('backup', key, value)}
                                        />
                                    )}

                                    {activeSection === 'ui' && (
                                        <UISettings
                                            settings={localSettings.ui}
                                            onChange={(key, value) => handleSettingChange('ui', key, value)}
                                        />
                                    )}

                                    {activeSection === 'integrations' && (
                                        <IntegrationsSettings
                                            settings={localSettings.integrations}
                                            vscodeStatus={vscodeStatus}
                                            onChange={(key, value) => handleSettingChange('integrations', key, value)}
                                        />
                                    )}

                                    {activeSection === 'analytics' && (
                                        <AnalyticsSettings
                                            settings={localSettings.analytics}
                                            onChange={(key, value) => handleSettingChange('analytics', key, value)}
                                        />
                                    )}

                                    {activeSection === 'team' && (
                                        <TeamSettings />
                                    )}

                                    {activeSection === 'user' && (
                                        <UserManagementSettings />
                                    )}

                                    {activeSection === 'security-audit' && (
                                        <SecurityAuditSettings />
                                    )}

                                    {activeSection === 'system-info' && (
                                        <SystemInfoSettings />
                                    )}

                                    {activeSection === 'developer' && (
                                        <DeveloperToolsSettings />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

// Security Settings Component
function SecuritySettings({ settings, onChange }: {
    settings: any,
    onChange: (key: string, value: any) => void
}) {
    const [biometricSupported, setBiometricSupported] = useState(false)
    const [passkeys, setPasskeys] = useState<any[]>([])
    const [userPreferences, setUserPreferences] = useState<any>(null)
    const [biometricLoading, setBiometricLoading] = useState(false)

    useEffect(() => {
        checkBiometricSupport()
        loadUserPreferences()
    }, [])

    const checkBiometricSupport = async () => {
        try {
            const supported = await TauriAPI.checkBiometricSupport()
            setBiometricSupported(supported)
        } catch (error) {
            console.error('Failed to check biometric support:', error)
        }
    }

    const loadUserPreferences = async () => {
        try {
            const prefs = await TauriAPI.getUserPreferences()
            setUserPreferences(prefs)
        } catch (error) {
            console.error('Failed to load user preferences:', error)
        }
    }

    const enableBiometricAuth = async () => {
        setBiometricLoading(true)
        try {
            const credentialId = await TauriAPI.enableBiometricAuth('current_user', 'Default Device')
            // Refresh preferences after enabling
            await loadUserPreferences()
            // Show success notification
        } catch (error) {
            console.error('Failed to enable biometric auth:', error)
        } finally {
            setBiometricLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Biometric Authentication */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Fingerprint className="h-4 w-4" />
                    <span>Biometric Authentication</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Biometric Unlock</label>
                            <p className="text-caption">
                                {biometricSupported
                                    ? "Use Touch ID, Face ID or Windows Hello to unlock your vault"
                                    : "Biometric authentication is not available on this device"
                                }
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={userPreferences?.biometric_unlock || false}
                                onChange={async (e) => {
                                    const checked = e.target.checked;
                                    await enableBiometricAuth();
                                }}
                                disabled={!biometricSupported || biometricLoading}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${userPreferences?.biometric_unlock ? 'active' : ''} ${!biometricSupported ? 'disabled' : ''}`}></div>
                        </label>
                    </div>

                    {biometricSupported && userPreferences?.biometric_unlock && (
                        <div className="glass-card p-4" style={{
                            background: 'rgba(52, 199, 89, 0.1)',
                            border: '1px solid rgba(52, 199, 89, 0.2)'
                        }}>
                            <div className="flex items-center space-x-2">
                                <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                                <div>
                                    <p className="text-body font-medium">Biometric authentication enabled</p>
                                    <p className="text-caption">You can now use biometric authentication to unlock your vault</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Passkey Management */}
                    {userPreferences?.biometric_unlock && (
                        <div className="border-t pt-4" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="text-body font-medium">Registered Devices</h5>
                                <button
                                    className="btn-secondary text-sm px-3 py-1 hover-lift focus-native flex items-center space-x-1"
                                    style={{ borderRadius: 'var(--radius-sm)' }}
                                >
                                    <Plus className="h-3 w-3" />
                                    <span>Add Device</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 glass-card">
                                    <div className="flex items-center space-x-3">
                                        <Smartphone className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                                        <div>
                                            <p className="text-body font-medium">This Device</p>
                                            <p className="text-caption">macOS • Last used 2 minutes ago</p>
                                        </div>
                                    </div>
                                    <button
                                        className="text-danger-600 hover:text-danger-700 p-1"
                                        title="Remove device"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* User Profile */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>User Profile</span>
                </h4>

                <div className="space-y-4">
                    <div>
                        <label className="text-body font-medium mb-2 block">Username</label>
                        <input
                            type="text"
                            value={userPreferences?.username || ''}
                            onChange={e => setUserPreferences({ ...userPreferences, username: e.target.value })}
                            className="input-native focus-native"
                            placeholder="Enter username"
                            style={{ width: '100%' }}
                            readOnly={false}
                        />
                        {userPreferences && userPreferences.username !== (async () => await TauriAPI.getUserAccount()) && (
                            <button onClick={async () => {
                                try {
                                    await TauriAPI.updateUsername(userPreferences.username)
                                    await loadUserPreferences()
                                    // Show success notification
                                } catch (err) {
                                    // Show error notification
                                }
                            }}>Save</button>
                        )}
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">Theme Preference</label>
                        <select
                            value={userPreferences?.theme || 'system'}
                            onChange={(e) => {
                                const newPrefs = { ...userPreferences, theme: e.target.value }
                                TauriAPI.updateUserPreferences(newPrefs)
                                setUserPreferences(newPrefs)
                            }}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">System</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">Language</label>
                        <select
                            value={userPreferences?.language || 'en'}
                            onChange={(e) => {
                                const newPrefs = { ...userPreferences, language: e.target.value }
                                TauriAPI.updateUserPreferences(newPrefs)
                                setUserPreferences(newPrefs)
                            }}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        >
                            <option value="en">English</option>
                            <option value="it">Italiano</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>Session Management</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Biometric Authentication</label>
                            <p className="text-caption">Use Face ID, Touch ID or Windows Hello</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.biometricAuth}
                                onChange={(e) => onChange('biometricAuth', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.biometricAuth ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">
                            Auto-Lock Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="1440"
                            value={settings.autoLockTimeout}
                            onChange={(e) => onChange('autoLockTimeout', parseInt(e.target.value))}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        />
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">
                            Session Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="480"
                            value={settings.sessionTimeout}
                            onChange={(e) => onChange('sessionTimeout', parseInt(e.target.value))}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Advanced Security</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Audit Logging</label>
                            <p className="text-caption">Log all activities for compliance</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.auditLogging}
                                onChange={(e) => onChange('auditLogging', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.auditLogging ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Device Fingerprinting</label>
                            <p className="text-caption">Identify and track unique devices</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.deviceFingerprinting}
                                onChange={(e) => onChange('deviceFingerprinting', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.deviceFingerprinting ? 'active' : ''}`}></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Backup Settings Component
function BackupSettings({
    settings,
    backupInProgress,
    lastBackup,
    onCreateBackup,
    onChange
}: {
    settings: any,
    backupInProgress: boolean,
    lastBackup: Date | null,
    onCreateBackup: () => Promise<void>,
    onChange: (key: string, value: any) => void
}) {
    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Automatic Backup</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Automatic Backup</label>
                            <p className="text-caption">Automatic periodic data backup</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoBackup}
                                onChange={(e) => onChange('autoBackup', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.autoBackup ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">
                            Backup Interval (hours)
                        </label>
                        <select
                            value={settings.backupInterval}
                            onChange={(e) => onChange('backupInterval', parseInt(e.target.value))}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        >
                            <option value={1}>Every hour</option>
                            <option value={6}>Every 6 hours</option>
                            <option value={12}>Every 12 hours</option>
                            <option value={24}>Every day</option>
                            <option value={168}>Every week</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">
                            Retention (days)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={settings.retentionDays}
                            onChange={(e) => onChange('retentionDays', parseInt(e.target.value))}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Cloud className="h-4 w-4" />
                    <span>Cloud Synchronization</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Sync Cloud</label>
                            <p className="text-caption">Synchronize with encrypted cloud storage</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.cloudSync}
                                onChange={(e) => onChange('cloudSync', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.cloudSync ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">End-to-End Encryption</label>
                            <p className="text-caption">Data is encrypted locally</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                            <span className="text-caption">Always active</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backup Status */}
            {lastBackup && (
                <div className="p-4 glass-card" style={{
                    background: 'rgba(52, 199, 89, 0.1)',
                    border: '1px solid rgba(52, 199, 89, 0.2)'
                }}>
                    <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                        <div>
                            <p className="text-body font-medium">Last backup completed</p>
                            <p className="text-caption">{formatTimeAgo(lastBackup)}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex space-x-3">
                <button
                    onClick={onCreateBackup}
                    disabled={backupInProgress}
                    className="btn-secondary flex items-center space-x-2 px-4 py-2 hover-lift focus-native"
                    style={{
                        opacity: backupInProgress ? '0.6' : '1',
                        cursor: backupInProgress ? 'not-allowed' : 'pointer'
                    }}
                >
                    {backupInProgress ? (
                        <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span>Creating backup...</span>
                        </>
                    ) : (
                        <>
                            <Download className="h-4 w-4" />
                            <span>Create Manual Backup</span>
                        </>
                    )}
                </button>
                <button
                    className="btn-secondary flex items-center space-x-2 px-4 py-2 hover-lift focus-native"
                    onClick={() => {
                        // TODO: Implement import backup functionality
                        alert('Import functionality coming in the next version!')
                    }}
                >
                    <Upload className="h-4 w-4" />
                    <span>Import Backup</span>
                </button>
            </div>
        </div>
    )
}

// UI Settings Component
function UISettings({ settings, onChange }: {
    settings: any,
    onChange: (key: string, value: any) => void
}) {
    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Palette className="h-4 w-4" />
                    <span>Appearance</span>
                </h4>

                <div className="space-y-4">
                    <div>
                        <label className="text-body font-medium mb-2 block">Theme</label>
                        <div className="grid grid-cols-3 gap-3">
                            {['light', 'dark', 'auto'].map((theme) => (
                                <button
                                    key={theme}
                                    onClick={() => onChange('theme', theme)}
                                    className={`p-3 text-center rounded-lg border-2 transition-all hover-lift focus-native ${settings.theme === theme ? 'selected' : ''
                                        }`}
                                    style={{
                                        borderColor: settings.theme === theme ? 'var(--color-accent)' : 'rgba(0, 0, 0, 0.1)',
                                        background: settings.theme === theme ? 'rgba(0, 122, 255, 0.1)' : 'var(--color-surface)'
                                    }}
                                >
                                    <Monitor className="h-6 w-6 mx-auto mb-2" />
                                    <span className="text-caption capitalize">{theme === 'auto' ? 'System' : theme}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-body font-medium mb-2 block">Font Size</label>
                        <select
                            value={settings.fontSize}
                            onChange={(e) => onChange('fontSize', e.target.value)}
                            className="input-native focus-native"
                            style={{ width: '200px' }}
                        >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Compact Mode</label>
                            <p className="text-caption">Denser interface</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.compactMode}
                                onChange={(e) => onChange('compactMode', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.compactMode ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Animations</label>
                            <p className="text-caption">Transition effects and animations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.animationsEnabled}
                                onChange={(e) => onChange('animationsEnabled', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.animationsEnabled ? 'active' : ''}`}></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Integrations Settings Component
function IntegrationsSettings({
    settings,
    vscodeStatus,
    onChange
}: {
    settings: any,
    vscodeStatus: { connected: boolean, lastHeartbeat: Date | null, connectionCount: number, version?: string },
    onChange: (key: string, value: any) => void
}) {
    const [serverLoading, setServerLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    // Optionally, get vault lock state from store
    // const { isUnlocked } = useAppStore();
    // const isDisabled = !isUnlocked;
    const isDisabled = false; // Set to true if you want to disable when locked

    const handleServerToggle = async () => {
        setServerLoading(true);
        setServerError(null);
        try {
            if (vscodeStatus.connected) {
                await TauriAPI.stopVSCodeServer();
            } else {
                await TauriAPI.startVSCodeServer();
            }
            // Status will auto-update via polling
        } catch (err: any) {
            setServerError(err?.message || 'Failed to toggle server');
        } finally {
            setServerLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>VSCode Integration</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">VSCode Extension</label>
                            <p className="text-caption">Native integration with Visual Studio Code</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.vscode?.enabled}
                                onChange={(e) => onChange('vscode', { ...settings.vscode, enabled: e.target.checked })}
                                className="sr-only peer"
                                disabled={isDisabled}
                            />
                            <div className={`toggle-native ${settings.vscode?.enabled ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    {/* VSCode Connection Status */}
                    <div className="p-4 glass-card" style={{
                        background: vscodeStatus.connected
                            ? 'rgba(52, 199, 89, 0.1)'
                            : 'rgba(255, 159, 10, 0.1)',
                        border: `1px solid ${vscodeStatus.connected ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 159, 10, 0.2)'}`
                    }}>
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${vscodeStatus.connected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <div className="flex-1">
                                <p className="text-body font-medium">
                                    {vscodeStatus.connected ? 'Connected' : 'Disconnected'}
                                </p>
                                <p className="text-caption">
                                    {vscodeStatus.connected
                                        ? `${vscodeStatus.connectionCount} active connections • ${vscodeStatus.version || 'Unknown version'}`
                                        : 'Start VSCode with KeyKeeper extension to connect'
                                    }
                                </p>
                                {vscodeStatus.lastHeartbeat && (
                                    <p className="text-caption text-contrast-medium">
                                        Last heartbeat: {formatTimeAgo(vscodeStatus.lastHeartbeat)}
                                    </p>
                                )}
                            </div>
                            {/* Start/Stop Server Button */}
                            <button
                                className={`btn-secondary px-4 py-2 ml-4 hover-lift focus-native ${serverLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={handleServerToggle}
                                disabled={serverLoading || isDisabled}
                                style={{ borderRadius: 'var(--radius-md)' }}
                            >
                                {serverLoading
                                    ? (vscodeStatus.connected ? 'Stopping...' : 'Starting...')
                                    : (vscodeStatus.connected ? 'Stop Server' : 'Start Server')}
                            </button>
                        </div>
                        {serverError && (
                            <div className="mt-2 text-danger-600 text-sm">
                                {serverError}
                            </div>
                        )}
                    </div>

                    {/* VSCode Connection Status */}
                    <div className="p-4 glass-card" style={{
                        background: vscodeStatus.connected
                            ? 'rgba(52, 199, 89, 0.1)'
                            : 'rgba(255, 159, 10, 0.1)',
                        border: `1px solid ${vscodeStatus.connected ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 159, 10, 0.2)'}`
                    }}>
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${vscodeStatus.connected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <div className="flex-1">
                                <p className="text-body font-medium">
                                    {vscodeStatus.connected ? 'Connected' : 'Disconnected'}
                                </p>
                                <p className="text-caption">
                                    {vscodeStatus.connected
                                        ? `${vscodeStatus.connectionCount} active connections • ${vscodeStatus.version || 'Unknown version'}`
                                        : 'Start VSCode with KeyKeeper extension to connect'
                                    }
                                </p>
                                {vscodeStatus.lastHeartbeat && (
                                    <p className="text-caption text-contrast-medium">
                                        Last heartbeat: {formatTimeAgo(vscodeStatus.lastHeartbeat)}
                                    </p>
                                )}
                            </div>
                            {/* Start/Stop Server Button */}
                            <button
                                className={`btn-secondary px-4 py-2 ml-4 hover-lift focus-native ${serverLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={handleServerToggle}
                                disabled={serverLoading || isDisabled}
                                style={{ borderRadius: 'var(--radius-md)' }}
                            >
                                {serverLoading
                                    ? (vscodeStatus.connected ? 'Stopping...' : 'Starting...')
                                    : (vscodeStatus.connected ? 'Stop Server' : 'Start Server')}
                            </button>
                        </div>
                        {serverError && (
                            <div className="mt-2 text-danger-600 text-sm">
                                {serverError}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Context Aware</label>
                            <p className="text-caption">Project context-based suggestions</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.vscode?.contextAware}
                                onChange={(e) => onChange('vscode', { ...settings.vscode, contextAware: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.vscode?.contextAware ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Auto-Connect</label>
                            <p className="text-caption">Automatic connection when VSCode starts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.vscode?.autoConnect}
                                onChange={(e) => onChange('vscode', { ...settings.vscode, autoConnect: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.vscode?.autoConnect ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Quick Insert</label>
                            <p className="text-caption">Quick insertion with Cmd+Shift+K</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.vscode?.quickInsert}
                                onChange={(e) => onChange('vscode', { ...settings.vscode, quickInsert: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.vscode?.quickInsert ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Security Warnings</label>
                            <p className="text-caption">Warnings for insecure key usage</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.vscode?.securityWarnings}
                                onChange={(e) => onChange('vscode', { ...settings.vscode, securityWarnings: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.vscode?.securityWarnings ? 'active' : ''}`}></div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Cursor Integration</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Cursor Extension</label>
                            <p className="text-caption">AI-powered integration with Cursor</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.cursor?.enabled}
                                onChange={(e) => onChange('cursor', { ...settings.cursor, enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.cursor?.enabled ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="p-3 glass-card" style={{
                        background: 'rgba(147, 197, 253, 0.1)',
                        border: '1px solid rgba(147, 197, 253, 0.2)'
                    }}>
                        <div className="flex items-start space-x-2">
                            <Info className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                            <div>
                                <p className="text-body font-medium">Coming Soon</p>
                                <p className="text-caption">The Cursor integration will be available in the next version</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between opacity-50">
                        <div>
                            <label className="text-body font-medium">AI Suggestions</label>
                            <p className="text-caption">AI suggestions for API keys</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.cursor?.aiSuggestions}
                                onChange={(e) => onChange('cursor', { ...settings.cursor, aiSuggestions: e.target.checked })}
                                className="sr-only peer"
                                disabled
                            />
                            <div className={`toggle-native ${settings.cursor?.aiSuggestions ? 'active' : ''}`}></div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Bell className="h-4 w-4" />
                    <span>Notifiche</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Notifiche Desktop</label>
                            <p className="text-caption">System notifications for important events</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.notifications?.desktop}
                                onChange={(e) => onChange('notifications', { ...settings.notifications, desktop: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.notifications?.desktop ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Expiration Warnings</label>
                            <p className="text-caption">Notify when API keys are about to expire</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.notifications?.keyExpiration}
                                onChange={(e) => onChange('notifications', { ...settings.notifications, keyExpiration: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.notifications?.keyExpiration ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Sync Status</label>
                            <p className="text-caption">Sync status with extensions</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.notifications?.syncStatus}
                                onChange={(e) => onChange('notifications', { ...settings.notifications, syncStatus: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.notifications?.syncStatus ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Security Alerts</label>
                            <p className="text-caption">Security alerts and suspicious access</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.notifications?.securityAlerts}
                                onChange={(e) => onChange('notifications', { ...settings.notifications, securityAlerts: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.notifications?.securityAlerts ? 'active' : ''}`}></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Analytics Settings Component
function AnalyticsSettings({ settings, onChange }: {
    settings: any,
    onChange: (key: string, value: any) => void
}) {
    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Data Collection</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Analytics</label>
                            <p className="text-caption">Collect usage statistics for improvements</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.enabled}
                                onChange={(e) => onChange('enabled', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className={`toggle-native ${settings.enabled ? 'active' : ''}`}></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Anonymous Data</label>
                            <p className="text-caption">Anonymize all sensitive data</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                            <span className="text-caption">Always active</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h4 className="text-heading mb-4">Privacy Information</h4>
                <div className="space-y-3 text-caption">
                    <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                        <p>The collected data is used only to improve the user experience</p>
                    </div>
                    <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                        <p>No sensitive data (API keys, password) is ever transmitted</p>
                    </div>
                    <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                        <p>You can disable data collection at any time</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Team Settings Component
function TeamSettings() {
    return (
        <div className="space-y-6">
            <div className="glass-card p-6 text-center">
                <Users className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <h4 className="text-heading mb-2">Team Features</h4>
                <p className="text-caption mb-4">
                    The team collaboration features are coming in the next version.
                </p>
                <button className="btn-primary px-6 py-2 hover-lift focus-native">
                    Request Beta Access
                </button>
            </div>
        </div>
    )
}

// User Management Settings Component
function UserManagementSettings() {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteType, setDeleteType] = useState<'cache' | 'logs' | 'all' | null>(null)
    const [storageInfo, setStorageInfo] = useState<{
        vaultSize: string
        cacheSize: string
        logsSize: string
        totalSize: string
    } | null>(null)

    useEffect(() => {
        loadStorageInfo()
    }, [])

    const loadStorageInfo = async () => {
        try {
            // Mock data for now - in real implementation, call Tauri commands
            setStorageInfo({
                vaultSize: '2.4 MB',
                cacheSize: '1.2 MB', 
                logsSize: '0.8 MB',
                totalSize: '4.4 MB'
            })
        } catch (error) {
            console.error('Failed to load storage info:', error)
        }
    }

    const handleDeleteData = async (type: 'cache' | 'logs' | 'all') => {
        setIsDeleting(true)
        try {
            // In real implementation, call appropriate Tauri commands
            switch (type) {
                case 'cache':
                    // await TauriAPI.clearCache()
                    console.log('Clearing cache...')
                    break
                case 'logs':
                    // await TauriAPI.clearLogs()
                    console.log('Clearing logs...')
                    break
                case 'all':
                    // await TauriAPI.clearAllLocalData()
                    console.log('Clearing all local data...')
                    break
            }
            await loadStorageInfo()
            setShowDeleteConfirm(false)
            setDeleteType(null)
        } catch (error) {
            console.error('Failed to delete data:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    const confirmDelete = (type: 'cache' | 'logs' | 'all') => {
        setDeleteType(type)
        setShowDeleteConfirm(true)
    }

    return (
        <div className="space-y-6">
            {/* User Profile Section */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>User Profile</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Username</label>
                            <p className="text-caption">Update your display name</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Enter username"
                            className="input-native w-48"
                            style={{ background: 'var(--color-surface-secondary)' }}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Theme Preference</label>
                            <p className="text-caption">Choose your preferred theme</p>
                        </div>
                        <select className="input-native w-32">
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Language</label>
                            <p className="text-caption">Select your preferred language</p>
                        </div>
                        <select className="input-native w-32">
                            <option value="en">English</option>
                            <option value="it">Italiano</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                        <button className="btn-primary px-4 py-2 hover-lift focus-native">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Session Management */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>Session Management</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Biometric Authentication</label>
                            <p className="text-caption">Use Face ID, Touch ID or Windows Hello</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="toggle-native active"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Auto-Lock Timeout</label>
                            <p className="text-caption">Lock vault after inactivity</p>
                        </div>
                        <select className="input-native w-24">
                            <option value="5">5m</option>
                            <option value="15" selected>15m</option>
                            <option value="30">30m</option>
                            <option value="60">1h</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Session Timeout</label>
                            <p className="text-caption">Require re-authentication after</p>
                        </div>
                        <select className="input-native w-24">
                            <option value="30">30m</option>
                            <option value="60" selected>1h</option>
                            <option value="120">2h</option>
                            <option value="480">8h</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Current Sessions */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Monitor className="h-4 w-4" />
                    <span>Current Sessions</span>
                </h4>

                <div className="space-y-3">
                    <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-success)' }}></div>
                                <div>
                                    <p className="text-body font-medium">Current Session</p>
                                    <p className="text-caption">Started: {new Date().toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-caption px-2 py-1 rounded" style={{ background: 'var(--color-success)', color: 'white' }}>Active</span>
                                <button className="btn-secondary text-sm px-3 py-1 hover-lift focus-native">
                                    End Session
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-text-tertiary)' }}></div>
                                <div>
                                    <p className="text-body font-medium">Previous Session</p>
                                    <p className="text-caption">Ended: 2 hours ago</p>
                                </div>
                            </div>
                            <span className="text-caption px-2 py-1 rounded" style={{ background: 'var(--color-text-tertiary)', color: 'white' }}>Expired</span>
                        </div>
                    </div>

                    <div className="pt-3 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                            <Trash2 className="h-4 w-4" />
                            <span>Clear All Sessions</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Vault File Access */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Key className="h-4 w-4" />
                    <span>Vault File Access</span>
                </h4>

                <div className="space-y-4">
                    <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-body font-medium">Vault Location</p>
                                <p className="text-caption font-mono text-xs">~/Library/Application Support/KeyKeeper/vault.json</p>
                            </div>
                            <div className="flex space-x-2">
                                <button className="btn-secondary text-sm px-3 py-1 hover-lift focus-native flex items-center space-x-1">
                                    <Download className="h-3 w-3" />
                                    <span>Open Folder</span>
                                </button>
                                <button className="btn-secondary text-sm px-3 py-1 hover-lift focus-native flex items-center space-x-1">
                                    <Code className="h-3 w-3" />
                                    <span>View File</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-body font-medium">Backup Location</p>
                                <p className="text-caption font-mono text-xs">~/Library/Application Support/KeyKeeper/backups/</p>
                            </div>
                            <button className="btn-secondary text-sm px-3 py-1 hover-lift focus-native flex items-center space-x-1">
                                <Download className="h-3 w-3" />
                                <span>Open Folder</span>
                            </button>
                        </div>
                    </div>

                    <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-body font-medium">Logs Location</p>
                                <p className="text-caption font-mono text-xs">~/Library/Application Support/KeyKeeper/logs/</p>
                            </div>
                            <button className="btn-secondary text-sm px-3 py-1 hover-lift focus-native flex items-center space-x-1">
                                <Download className="h-3 w-3" />
                                <span>Open Folder</span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-3 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                        <div className="flex items-center space-x-2">
                            <Info className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                            <p className="text-caption">All files are stored locally on your device for maximum security</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Controls */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <SettingsIcon className="h-4 w-4" />
                    <span>Advanced Controls</span>
                </h4>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Export Vault Data</label>
                            <p className="text-caption">Create a backup of your vault in JSON format</p>
                        </div>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                            <Upload className="h-4 w-4" />
                            <span>Export</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Import Vault Data</label>
                            <p className="text-caption">Restore vault from a backup file</p>
                        </div>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                            <Download className="h-4 w-4" />
                            <span>Import</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Verify Vault Integrity</label>
                            <p className="text-caption">Check vault file for corruption or issues</p>
                        </div>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Verify</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Compact Database</label>
                            <p className="text-caption">Optimize vault file size and performance</p>
                        </div>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                            <Zap className="h-4 w-4" />
                            <span>Compact</span>
                        </button>
                    </div>

                    <div className="pt-3 border-t" style={{ borderColor: 'rgba(255, 165, 0, 0.2)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-body font-medium" style={{ color: 'var(--color-warning)' }}>Reset Application</label>
                                <p className="text-caption">⚠️ Reset all settings to default (keeps vault data)</p>
                            </div>
                            <button className="btn-warning px-4 py-2 hover-lift focus-native flex items-center space-x-2">
                                <SettingsIcon className="h-4 w-4" />
                                <span>Reset App</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Storage & Data Management */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Storage & Data Management</span>
                </h4>

                {storageInfo && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Vault Data</span>
                                    <span className="text-body font-medium">{storageInfo.vaultSize}</span>
                                </div>
                            </div>
                            <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Cache</span>
                                    <span className="text-body font-medium">{storageInfo.cacheSize}</span>
                                </div>
                            </div>
                            <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Logs</span>
                                    <span className="text-body font-medium">{storageInfo.logsSize}</span>
                                </div>
                            </div>
                            <div className="glass-card p-4" style={{ background: 'var(--color-accent)', color: 'white' }}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Total</span>
                                    <span className="font-bold">{storageInfo.totalSize}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-body font-medium">Clear Cache</label>
                                    <p className="text-caption">Remove temporary files and cached data</p>
                                </div>
                                <button
                                    onClick={() => confirmDelete('cache')}
                                    className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2"
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Clear Cache</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-body font-medium">Clear Logs</label>
                                    <p className="text-caption">Remove application logs and debug files</p>
                                </div>
                                <button
                                    onClick={() => confirmDelete('logs')}
                                    className="btn-secondary px-4 py-2 hover-lift focus-native flex items-center space-x-2"
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Clear Logs</span>
                                </button>
                            </div>

                            <div className="border-t pt-4" style={{ borderColor: 'rgba(255, 0, 0, 0.2)' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-body font-medium" style={{ color: 'var(--color-error)' }}>Reset All Data</label>
                                        <p className="text-caption">⚠️ This will remove all local data except vault</p>
                                    </div>
                                    <button
                                        onClick={() => confirmDelete('all')}
                                        className="btn-danger px-4 py-2 hover-lift focus-native flex items-center space-x-2"
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Reset Data</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="glass-card p-6 max-w-md w-full mx-4">
                        <h3 className="text-heading mb-4 flex items-center space-x-2">
                            <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
                            <span>Confirm Deletion</span>
                        </h3>
                        
                        <p className="text-body mb-6">
                            {deleteType === 'cache' && 'Are you sure you want to clear the cache? This will remove temporary files and may slow down the next app startup.'}
                            {deleteType === 'logs' && 'Are you sure you want to clear the logs? This will remove all application logs and debug information.'}
                            {deleteType === 'all' && '⚠️ Are you sure you want to reset all local data? This will clear cache, logs, and preferences but keep your vault data safe.'}
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="btn-secondary flex-1 py-2 hover-lift focus-native"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteData(deleteType!)}
                                className={`flex-1 py-2 hover-lift focus-native ${
                                    deleteType === 'all' ? 'btn-danger' : 'btn-primary'
                                }`}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Security Audit Settings Component
function SecurityAuditSettings() {
    const [auditResults, setAuditResults] = useState<any>(null)
    const [isScanning, setIsScanning] = useState(false)

    const runSecurityScan = async () => {
        setIsScanning(true)
        // Mock security scan results
        setTimeout(() => {
            setAuditResults({
                vaultIntegrity: 'PASS',
                encryptionStrength: 'STRONG',
                vulnerabilities: 0,
                lastScan: new Date().toLocaleString()
            })
            setIsScanning(false)
        }, 2000)
    }

    return (
        <div className="space-y-6">
            {/* Security Analysis */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Security Analysis</span>
                </h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Vault Integrity Check</label>
                            <p className="text-caption">Verify vault file integrity and encryption</p>
                        </div>
                        <button 
                            onClick={runSecurityScan}
                            disabled={isScanning}
                            className="btn-primary px-4 py-2 hover-lift focus-native"
                        >
                            {isScanning ? 'Scanning...' : 'Run Check'}
                        </button>
                    </div>
                    
                    {auditResults && (
                        <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Vault Integrity</span>
                                    <span className="text-body font-medium" style={{ color: 'var(--color-success)' }}>{auditResults.vaultIntegrity}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Encryption</span>
                                    <span className="text-body font-medium" style={{ color: 'var(--color-success)' }}>{auditResults.encryptionStrength}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Vulnerabilities</span>
                                    <span className="text-body font-medium">{auditResults.vulnerabilities}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-caption">Last Scan</span>
                                    <span className="text-body font-medium">{auditResults.lastScan}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Logs */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Audit Logs</span>
                </h4>
                <div className="space-y-3">
                    <div className="glass-card p-3" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }}></div>
                                <span className="text-body">Vault unlocked</span>
                            </div>
                            <span className="text-caption">2 minutes ago</span>
                        </div>
                    </div>
                    <div className="glass-card p-3" style={{ background: 'var(--color-surface-secondary)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }}></div>
                                <span className="text-body">API key accessed</span>
                            </div>
                            <span className="text-caption">5 minutes ago</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// System Info Settings Component
function SystemInfoSettings() {
    const [systemInfo, setSystemInfo] = useState<any>(null)

    useEffect(() => {
        // Mock system info - in real app, get from Tauri
        setSystemInfo({
            os: 'macOS 14.0',
            arch: 'arm64',
            memory: '16 GB',
            storage: '512 GB SSD',
            appVersion: '2.2.3',
            tauriVersion: '2.6.2',
            uptime: '2 hours 15 minutes'
        })
    }, [])

    return (
        <div className="space-y-6">
            {/* System Information */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Monitor className="h-4 w-4" />
                    <span>System Information</span>
                </h4>
                {systemInfo && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-body">Operating System</span>
                                <span className="text-caption">{systemInfo.os}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body">Architecture</span>
                                <span className="text-caption">{systemInfo.arch}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body">Memory</span>
                                <span className="text-caption">{systemInfo.memory}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body">Storage</span>
                                <span className="text-caption">{systemInfo.storage}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body">App Version</span>
                                <span className="text-caption">{systemInfo.appVersion}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body">Tauri Version</span>
                                <span className="text-caption">{systemInfo.tauriVersion}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Performance Metrics */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Performance</span>
                </h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-body">App Uptime</span>
                        <span className="text-caption">{systemInfo?.uptime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-body">Memory Usage</span>
                        <span className="text-caption">45.2 MB</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-body">CPU Usage</span>
                        <span className="text-caption">2.1%</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Developer Tools Settings Component
function DeveloperToolsSettings() {
    const [debugMode, setDebugMode] = useState(false)
    const [apiLogs, setApiLogs] = useState<any[]>([])

    useEffect(() => {
        // Mock API logs
        setApiLogs([
            { method: 'GET', endpoint: '/api/keys', status: 200, time: '12:34:56' },
            { method: 'POST', endpoint: '/api/keys', status: 201, time: '12:35:12' },
            { method: 'PUT', endpoint: '/api/keys/123', status: 200, time: '12:35:45' }
        ])
    }, [])

    return (
        <div className="space-y-6">
            {/* Debug Tools */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>Debug Tools</span>
                </h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Debug Mode</label>
                            <p className="text-caption">Enable detailed logging and debug info</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={debugMode}
                                onChange={(e) => setDebugMode(e.target.checked)}
                                className="sr-only peer" 
                            />
                            <div className={`toggle-native ${debugMode ? 'active' : ''}`}></div>
                        </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-body font-medium">Export Debug Info</label>
                            <p className="text-caption">Generate debug report for troubleshooting</p>
                        </div>
                        <button className="btn-secondary px-4 py-2 hover-lift focus-native">
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* API Logs */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Bell className="h-4 w-4" />
                    <span>API Logs</span>
                </h4>
                <div className="space-y-2">
                    {apiLogs.map((log, index) => (
                        <div key={index} className="glass-card p-3" style={{ background: 'var(--color-surface-secondary)' }}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <span className={`text-xs px-2 py-1 rounded font-mono ${
                                        log.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                                        log.method === 'POST' ? 'bg-green-100 text-green-800' :
                                        'bg-orange-100 text-orange-800'
                                    }`}>
                                        {log.method}
                                    </span>
                                    <span className="text-body font-mono text-sm">{log.endpoint}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        log.status < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {log.status}
                                    </span>
                                    <span className="text-caption">{log.time}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Console */}
            <div className="glass-card p-6">
                <h4 className="text-heading mb-4 flex items-center space-x-2">
                    <Monitor className="h-4 w-4" />
                    <span>Console</span>
                </h4>
                <div className="glass-card p-4" style={{ background: 'var(--color-surface-secondary)' }}>
                    <div className="font-mono text-sm space-y-1">
                        <div className="text-caption">[12:34:56] KeyKeeper initialized</div>
                        <div className="text-caption">[12:35:12] Vault loaded successfully</div>
                        <div className="text-caption">[12:35:45] VSCode integration active</div>
                    </div>
                </div>
            </div>
        </div>
    )
}