// components/AuthManager.tsx
import { useEffect } from 'react'
import { useAppStore } from '../lib/store'
import { TauriAPI } from '../lib/tauri-api'

interface AuthManagerProps {
  children: React.ReactNode
}

export default function AuthManager({ children }: AuthManagerProps) {
  const {
    setHasMasterPassword,
    setIsUnlocked,
    initializeNativeStorage
  } = useAppStore()

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication system...')

        // Initialize native storage first
        await initializeNativeStorage()

        // Check master password status
        const masterPasswordSet = await TauriAPI.isMasterPasswordSet()
        console.log('Master password set:', masterPasswordSet)
        setHasMasterPassword(masterPasswordSet)

        // Check vault status
        const vaultUnlocked = await TauriAPI.isVaultUnlocked()
        console.log('Vault unlocked:', vaultUnlocked)
        setIsUnlocked(vaultUnlocked)

        console.log('Authentication initialization complete')
      } catch (error) {
        console.error('Failed to initialize authentication:', error)
        // Clear states on error
        setHasMasterPassword(false)
        setIsUnlocked(false)
      }
    }

    initializeAuth()
  }, [initializeNativeStorage, setHasMasterPassword, setIsUnlocked])

  return <>{children}</>
}
