import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../lib/store'
import LoginScreen from '../components/LoginScreen'
import MainLayout from '../components/MainLayout'
import SetMasterPasswordScreen from '../components/SetMasterPasswordScreen'
import { TauriAPI } from '../lib/tauri-api'

type AuthStep = 'loading' | 'registerOrLogin' | 'userLogin' | 'setMasterPassword' | 'unlockVault' | 'mainApp'

export default function Home() {
  const { isUnlocked, setIsUnlocked, isUserLoggedIn, setIsUserLoggedIn, hasMasterPassword, setHasMasterPassword } = useAppStore()
  const [currentAuthStep, setCurrentAuthStep] = useState<AuthStep>('loading')

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const userAccountCreated = await TauriAPI.isUserAccountCreated()
        if (!userAccountCreated) {
          setCurrentAuthStep('registerOrLogin')
          return
        }

        // If user account exists, check if logged in
        // For simplicity, we assume if userAccountCreated is true, they need to login
        // In a real app, you might have a persistent login session
        if (!isUserLoggedIn) {
          setCurrentAuthStep('userLogin')
          return
        }

        const masterPasswordSet = await TauriAPI.isMasterPasswordSet()
        if (!masterPasswordSet) {
          setCurrentAuthStep('setMasterPassword')
          return
        }

        const vaultUnlocked = await TauriAPI.isVaultUnlocked()
        if (!vaultUnlocked) {
          setCurrentAuthStep('unlockVault')
          return
        }

        setCurrentAuthStep('mainApp')
      } catch (error) {
        console.error('Failed to check authentication status:', error)
        // Fallback to login screen on error
        setCurrentAuthStep('registerOrLogin')
      }
    }

    checkAuthStatus()
  }, [isUnlocked, isUserLoggedIn, hasMasterPassword, setIsUnlocked, setIsUserLoggedIn, setHasMasterPassword])

  if (currentAuthStep === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-accent-200 border-t-accent-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary-600 text-lg font-medium">Starting KeyKeeper...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <AnimatePresence mode="wait">
        {currentAuthStep === 'registerOrLogin' && (
          <motion.div
            key="registerOrLogin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <LoginScreen mode="registerOrLogin" />
          </motion.div>
        )}
        {currentAuthStep === 'userLogin' && (
          <motion.div
            key="userLogin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <LoginScreen mode="userLogin" />
          </motion.div>
        )}
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
            <LoginScreen mode="unlockVault" />
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
