import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../lib/store'
import UnlockVaultScreen from '../components/UnlockVaultScreen'
import MainLayout from '../components/MainLayout'
import SetMasterPasswordScreen from '../components/SetMasterPasswordScreen'
import { TauriAPI } from '../lib/tauri-api'
import KeyringService from '../lib/services/keyringService'

type AuthStep = 'loading' | 'setMasterPassword' | 'unlockVault' | 'mainApp'

export default function Home() {
  const { isUnlocked, hasMasterPassword, setHasMasterPassword, setIsUnlocked } = useAppStore()
  const [currentAuthStep, setCurrentAuthStep] = useState<AuthStep>('loading')

  // Initial authentication check - simplified flow
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Initialize native storage first
        await useAppStore.getState().initializeNativeStorage()
        
        // Check if master password exists in vault
        const masterPasswordSet = await TauriAPI.isMasterPasswordSet()
        setHasMasterPassword(masterPasswordSet)
        
        if (!masterPasswordSet) {
          // First time setup - need to create master password
          setCurrentAuthStep('setMasterPassword')
          return
        }

        // Master password exists in keyring, need to unlock vault
        // Always require unlock on app start for security
        setCurrentAuthStep('unlockVault')
      } catch (error) {
        console.error('Failed to check authentication status:', error)
        // Fallback to master password creation on error
        setCurrentAuthStep('setMasterPassword')
      }
    }

    checkAuthStatus()
  }, [setHasMasterPassword, setIsUnlocked])

  // React to authentication state changes - simplified
  useEffect(() => {
    if (currentAuthStep === 'loading') return

    // If master password was just set and vault is unlocked, go to main app
    if (hasMasterPassword && isUnlocked && currentAuthStep === 'setMasterPassword') {
      setCurrentAuthStep('mainApp')
      return
    }

    // If vault was just unlocked from unlock screen, go to main app
    if (hasMasterPassword && isUnlocked && currentAuthStep === 'unlockVault') {
      setCurrentAuthStep('mainApp')
      return
    }

    // If vault was locked, go back to unlock
    if (hasMasterPassword && !isUnlocked && currentAuthStep === 'mainApp') {
      setCurrentAuthStep('unlockVault')
      return
    }
  }, [hasMasterPassword, isUnlocked, currentAuthStep])

  if (currentAuthStep === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br via-white from-primary-50 to-accent-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 w-16 h-16 rounded-full border-4 animate-spin border-accent-200 border-t-accent-600"></div>
          <p className="text-lg font-medium text-primary-600">Starting KeyKeeper...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br via-white from-primary-50 to-accent-50">
      <AnimatePresence mode="wait">
        {currentAuthStep === 'setMasterPassword' && (
          <motion.div
            key="setMasterPassword"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <SetMasterPasswordScreen />
          </motion.div>
        )}
        {currentAuthStep === 'unlockVault' && (
          <motion.div
            key="unlockVault"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <UnlockVaultScreen />
          </motion.div>
        )}
        {currentAuthStep === 'mainApp' && (
          <motion.div
            key="mainApp"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <MainLayout />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
