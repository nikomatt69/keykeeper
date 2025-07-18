// lib/services/nativeFeatures.ts
import { invoke } from '@tauri-apps/api/core'
import { TauriAPI } from '../tauri-api'

export interface DeviceInfo {
  platform: string
  arch: string
  hostname: string
  username: string
  device_id: string
}

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  sound?: boolean
  urgent?: boolean
}

class NativeFeaturesService {
  private initialized = false
  private deviceInfo: DeviceInfo | null = null

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Get device information
      this.deviceInfo = await this.getDeviceInfo()

      // Set up any initial native features
      await this.setupInitialFeatures()

      this.initialized = true
      console.log('Native features service initialized')
    } catch (error) {
      console.error('Failed to initialize native features:', error)
      throw error
    }
  }

  // Device Information
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    if (this.deviceInfo) return this.deviceInfo

    try {
      this.deviceInfo = await TauriAPI.getDeviceInfo()
      return this.deviceInfo || null
    } catch (error) {
      console.error('Failed to get device info:', error)
      throw error
    }
  }

  // Notifications
  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      await TauriAPI.showNotification(options.title, options.body)
      console.log('Notification shown:', options.title)
    } catch (error) {
      console.error('Failed to show notification:', error)
      throw error
    }
  }

  async showSuccessNotification(message: string): Promise<void> {
    await this.showNotification({
      title: 'KeyKeeper Success',
      body: message,
      sound: true
    })
  }

  async showErrorNotification(message: string): Promise<void> {
    await this.showNotification({
      title: 'KeyKeeper Error',
      body: message,
      urgent: true
    })
  }

  async showInfoNotification(message: string): Promise<void> {
    await this.showNotification({
      title: 'KeyKeeper Info',
      body: message
    })
  }

  // Auto-start Management
  async enableAutoStart(): Promise<void> {
    try {
      await TauriAPI.setupAutoStart(true)
      console.log('Auto-start enabled')
    } catch (error) {
      console.error('Failed to enable auto-start:', error)
      throw error
    }
  }

  async disableAutoStart(): Promise<void> {
    try {
      await TauriAPI.disableAutoStart()
      console.log('Auto-start disabled')
    } catch (error) {
      console.error('Failed to disable auto-start:', error)
      throw error
    }
  }

  async isAutoStartEnabled(): Promise<boolean> {
    try {
      return await TauriAPI.isAutoStartEnabled()
    } catch (error) {
      console.error('Failed to check auto-start status:', error)
      return false
    }
  }

  // Keyring Management
  async storeSecureData(key: string, data: string): Promise<void> {
    try {
      await TauriAPI.keyringSet('keykeeper', key, data)
      console.log('Secure data stored:', key)
    } catch (error) {
      console.error('Failed to store secure data:', error)
      throw error
    }
  }

  async getSecureData(key: string): Promise<string | null> {
    try {
      const data = await TauriAPI.keyringGet('keykeeper', key)
      return data || null
    } catch (error) {
      console.error('Failed to get secure data:', error)
      return null
    }
  }

  async deleteSecureData(key: string): Promise<void> {
    try {
      await TauriAPI.keyringDelete('keykeeper', key)
      console.log('Secure data deleted:', key)
    } catch (error) {
      console.error('Failed to delete secure data:', error)
      throw error
    }
  }

  // System Integration
  async setupInitialFeatures(): Promise<void> {
    try {
      // Check if this is the first run
      const isFirstRun = await this.getSecureData('first_run')

      if (!isFirstRun) {
        // Set up default features for first run
        await this.storeSecureData('first_run', 'false')

        // Show welcome notification
        await this.showInfoNotification('Welcome to KeyKeeper! Your secure API key manager.')
      }
    } catch (error) {
      console.error('Failed to set up initial features:', error)
    }
  }

  // App State Management
  async saveAppState(state: any): Promise<void> {
    try {
      await this.storeSecureData('app_state', JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save app state:', error)
      throw error
    }
  }

  async loadAppState(): Promise<any> {
    try {
      const stateJson = await this.getSecureData('app_state')
      return stateJson ? JSON.parse(stateJson) : null
    } catch (error) {
      console.error('Failed to load app state:', error)
      return null
    }
  }

  // Vault-related notifications
  async notifyVaultUnlocked(): Promise<void> {
    await this.showSuccessNotification('Vault unlocked successfully')
  }

  async notifyVaultLocked(): Promise<void> {
    await this.showInfoNotification('Vault locked for security')
  }

  async notifyApiKeyAdded(keyName: string): Promise<void> {
    await this.showSuccessNotification(`API key "${keyName}" added successfully`)
  }

  async notifyApiKeyUpdated(keyName: string): Promise<void> {
    await this.showSuccessNotification(`API key "${keyName}" updated successfully`)
  }

  async notifyApiKeyDeleted(keyName: string): Promise<void> {
    await this.showInfoNotification(`API key "${keyName}" deleted`)
  }

  // Authentication notifications
  async notifyUserLoggedIn(): Promise<void> {
    await this.showSuccessNotification('Logged in successfully')
  }

  async notifyUserLoggedOut(): Promise<void> {
    await this.showInfoNotification('Logged out successfully')
  }

  async notifySessionExpired(): Promise<void> {
    await this.showNotification({
      title: 'Session Expired',
      body: 'Your session has expired. Please log in again.',
      urgent: true
    })
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      this.deviceInfo = null
      this.initialized = false
      console.log('Native features service cleaned up')
    } catch (error) {
      console.error('Failed to cleanup native features:', error)
    }
  }
}

// Singleton instance
export const nativeFeaturesService = new NativeFeaturesService()

// Export utility functions
export const initializeNativeFeatures = async (): Promise<void> => {
  await nativeFeaturesService.initialize()
}

export const showNotification = async (options: NotificationOptions): Promise<void> => {
  await nativeFeaturesService.showNotification(options)
}

export const enableAutoStart = async (): Promise<void> => {
  await nativeFeaturesService.enableAutoStart()
}

export const disableAutoStart = async (): Promise<void> => {
  await nativeFeaturesService.disableAutoStart()
}

export const getDeviceInfo = async (): Promise<DeviceInfo | null> => {
  return await nativeFeaturesService.getDeviceInfo()
}

export const storeSecureData = async (key: string, data: string): Promise<void> => {
  await nativeFeaturesService.storeSecureData(key, data)
}

export const getSecureData = async (key: string): Promise<string | null> => {
  return await nativeFeaturesService.getSecureData(key)
}

export const deleteSecureData = async (key: string): Promise<void> => {
  await nativeFeaturesService.deleteSecureData(key)
}
