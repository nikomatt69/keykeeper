import { invoke } from '@tauri-apps/api/core'

/**
 * KeyringService - Secure storage for master password using system keyring
 * Uses the system's secure keyring (Keychain on macOS, Credential Manager on Windows, etc.)
 */
export class KeyringService {
  private static readonly SERVICE_NAME = 'KeyKeeper'
  private static readonly USERNAME = 'master_password'

  /**
   * Save master password to system keyring
   */
  static async saveMasterPassword(password: string): Promise<void> {
    try {
      await invoke('save_master_password_to_keyring', { password })
      console.log('Master password saved to keyring successfully')
    } catch (error) {
      console.error('Failed to save master password to keyring:', error)
      throw new Error(`Failed to save master password to keyring: ${error}`)
    }
  }

  /**
   * Retrieve master password from system keyring
   */
  static async getMasterPassword(): Promise<string | null> {
    try {
      const password = await invoke<string | null>('get_master_password_from_keyring')
      if (password) {
        console.log('Master password retrieved from keyring successfully')
        return password
      } else {
        console.log('No master password found in keyring')
        return null
      }
    } catch (error) {
      console.error('Failed to retrieve master password from keyring:', error)
      throw new Error(`Failed to retrieve master password from keyring: ${error}`)
    }
  }

  /**
   * Delete master password from system keyring
   */
  static async deleteMasterPassword(): Promise<void> {
    try {
      await invoke('delete_master_password_from_keyring')
      console.log('Master password deleted from keyring successfully')
    } catch (error) {
      console.error('Failed to delete master password from keyring:', error)
      throw new Error(`Failed to delete master password from keyring: ${error}`)
    }
  }

  /**
   * Check if master password exists in keyring
   */
  static async hasMasterPassword(): Promise<boolean> {
    try {
      const password = await this.getMasterPassword()
      return password !== null
    } catch (error) {
      console.error('Failed to check if master password exists in keyring:', error)
      return false
    }
  }

  /**
   * Verify master password against stored keyring password
   */
  static async verifyMasterPassword(inputPassword: string): Promise<boolean> {
    try {
      const storedPassword = await this.getMasterPassword()
      if (!storedPassword) {
        return false
      }
      return inputPassword === storedPassword
    } catch (error) {
      console.error('Failed to verify master password:', error)
      return false
    }
  }

  /**
   * Update master password in keyring
   */
  static async updateMasterPassword(newPassword: string): Promise<void> {
    try {
      // Save new password (this will overwrite the existing one)
      await this.saveMasterPassword(newPassword)
      console.log('Master password updated in keyring successfully')
    } catch (error) {
      console.error('Failed to update master password in keyring:', error)
      throw new Error(`Failed to update master password in keyring: ${error}`)
    }
  }
}

export default KeyringService
