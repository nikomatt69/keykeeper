// lib/services/nativeStorageService.ts
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { UserPreferences } from '../types';

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  createdAt: string;
  lastAccessed: string;
  deviceId: string;
  expiresAt: string;
  isActive: boolean;
}

export interface AppState {
  isUserLoggedIn: boolean;
  hasSessionData: boolean;
  lastUser: string | null;
  deviceId: string;
  rememberSession: boolean;
  sessionData: SessionData | null;
}

class NativeStorageService {
  private store: Store | null = null;
  private keyringService = 'keykeeper';
  private initialized = false;

  // Initialize the native storage service
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Tauri Store
      this.store = await Store.load('keykeeper-app.dat');
      
      // Initialize device ID if not exists
      const deviceId = await this.getDeviceId();
      if (!deviceId) {
        await this.generateDeviceId();
      }

      this.initialized = true;
      console.log('Native storage service initialized');
    } catch (error) {
      console.error('Failed to initialize native storage service:', error);
      throw error;
    }
  }

  // Device ID management
  async getDeviceId(): Promise<string | null> {
    try {
      return await this.store?.get<string>('deviceId') || null;
    } catch (error) {
      console.error('Failed to get device ID:', error);
      return null;
    }
  }

  async generateDeviceId(): Promise<string> {
    try {
      const deviceId = crypto.randomUUID();
      await this.store?.set('deviceId', deviceId);
      await this.store?.save();
      return deviceId;
    } catch (error) {
      console.error('Failed to generate device ID:', error);
      throw error;
    }
  }

  // Session management
  async saveSessionData(sessionData: SessionData): Promise<void> {
    try {
      await this.store?.set('sessionData', sessionData);
      await this.store?.set('lastUser', sessionData.email);
      await this.store?.set('hasSessionData', true);
      await this.store?.save();
      console.log('Session data saved successfully');
    } catch (error) {
      console.error('Failed to save session data:', error);
      throw error;
    }
  }

  async getSessionData(): Promise<SessionData | null> {
    try {
      return await this.store?.get<SessionData>('sessionData') || null;
    } catch (error) {
      console.error('Failed to get session data:', error);
      return null;
    }
  }

  async clearSessionData(): Promise<void> {
    try {
      await this.store?.delete('sessionData');
      await this.store?.set('hasSessionData', false);
      await this.store?.save();
      console.log('Session data cleared');
    } catch (error) {
      console.error('Failed to clear session data:', error);
    }
  }

  // App state management
  async getAppState(): Promise<AppState> {
    try {
      const sessionData = await this.getSessionData();
      const hasSessionData = await this.store?.get<boolean>('hasSessionData') || false;
      const lastUser = await this.store?.get<string>('lastUser') || null;
      const deviceId = await this.getDeviceId() || '';
      const rememberSession = await this.store?.get<boolean>('rememberSession') || false;
      
      return {
        isUserLoggedIn: Boolean(sessionData && this.isSessionValid(sessionData)),
        hasSessionData,
        lastUser,
        deviceId,
        rememberSession,
        sessionData
      };
    } catch (error) {
      console.error('Failed to get app state:', error);
      return {
        isUserLoggedIn: false,
        hasSessionData: false,
        lastUser: null,
        deviceId: '',
        rememberSession: false,
        sessionData: null
      };
    }
  }

  async setRememberSession(remember: boolean): Promise<void> {
    try {
      await this.store?.set('rememberSession', remember);
      await this.store?.save();
    } catch (error) {
      console.error('Failed to set remember session:', error);
    }
  }

  // Session validation
  private isSessionValid(sessionData: SessionData): boolean {
    if (!sessionData.isActive) return false;
    
    const now = new Date();
    const expiresAt = new Date(sessionData.expiresAt);
    
    return now < expiresAt;
  }

  // Secure credential storage using keyring
  async storeSecureCredential(key: string, value: string): Promise<void> {
    try {
      await invoke('keyring_set', {
        service: this.keyringService,
        account: key,
        password: value
      });
    } catch (error) {
      console.error('Failed to store secure credential:', error);
      throw error;
    }
  }

  async getSecureCredential(key: string): Promise<string | null> {
    try {
      return await invoke<string>('keyring_get', {
        service: this.keyringService,
        account: key
      });
    } catch (error) {
      console.error('Failed to get secure credential:', error);
      return null;
    }
  }

  async deleteSecureCredential(key: string): Promise<void> {
    try {
      await invoke('keyring_delete', {
        service: this.keyringService,
        account: key
      });
    } catch (error) {
      console.error('Failed to delete secure credential:', error);
    }
  }

  // User preferences
  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      await this.store?.set('userPreferences', preferences);
      await this.store?.save();
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      return await this.store?.get<UserPreferences>('userPreferences') || null;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  // Window state management
  async saveWindowState(state: any): Promise<void> {
    try {
      await this.store?.set('windowState', state);
      await this.store?.save();
    } catch (error) {
      console.error('Failed to save window state:', error);
    }
  }

  async getWindowState(): Promise<any> {
    try {
      return await this.store?.get('windowState') || null;
    } catch (error) {
      console.error('Failed to get window state:', error);
      return null;
    }
  }

  // Store management
  async saveStore(): Promise<void> {
    try {
      await this.store?.save();
    } catch (error) {
      console.error('Failed to save store:', error);
      throw error;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await this.clearSessionData();
      await this.store?.clear();
      await this.store?.save();
      console.log('Native storage cleaned up');
    } catch (error) {
      console.error('Failed to cleanup native storage:', error);
    }
  }
}

// Singleton instance
export const nativeStorageService = new NativeStorageService();

// Export utility functions
export const initializeNativeStorage = async () => {
  await nativeStorageService.initialize();
};

export const createPersistentSession = async (
  userId: string,
  email: string,
  expirationHours: number = 24 * 7 // 7 days default
): Promise<SessionData> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);
  const deviceId = await nativeStorageService.getDeviceId() || '';
  
  const sessionData: SessionData = {
    sessionId: crypto.randomUUID(),
    userId,
    email,
    createdAt: now.toISOString(),
    lastAccessed: now.toISOString(),
    deviceId,
    expiresAt: expiresAt.toISOString(),
    isActive: true
  };

  await nativeStorageService.saveSessionData(sessionData);
  return sessionData;
};

export const validateStoredSession = async (): Promise<boolean> => {
  const sessionData = await nativeStorageService.getSessionData();
  if (!sessionData) return false;

  const now = new Date();
  const expiresAt = new Date(sessionData.expiresAt);
  
  if (now >= expiresAt || !sessionData.isActive) {
    await nativeStorageService.clearSessionData();
    return false;
  }

  // Update last accessed time
  sessionData.lastAccessed = now.toISOString();
  await nativeStorageService.saveSessionData(sessionData);
  return true;
};

export const clearAllPersistentData = async (): Promise<void> => {
  await nativeStorageService.cleanup();
};
