import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Shield, Eye, EyeOff, Lock } from 'lucide-react'
import { useAppStore } from '../lib/store'
import KeyringService from '../lib/services/keyringService'

export default function UnlockVaultScreen() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isDark, setIsDark] = useState(false)
  const { unlockVault, error, setError } = useAppStore()

  const updateTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }



  useEffect(() => {
    // Check localStorage for saved theme; default to light
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      setIsDark(savedTheme === 'dark')
      updateTheme(savedTheme === 'dark')
    } else {
      setIsDark(false)
      updateTheme(false)
    }
  }, [])




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔓 Starting vault unlock process...')

      // Unlock the vault directly - let backend handle password verification
      console.log('🔓 Calling unlockVault with password...')
      const success = await unlockVault(password)
      console.log('🔓 Unlock result:', success)

      if (success) {
        console.log('✅ Vault unlocked successfully!')
        setSuccessMessage('Vault unlocked successfully!')
        setPassword('')
      } else {
        console.log('❌ Vault unlock failed')
        setError('Invalid master password. Please try again.')
      }
    } catch (error) {
      console.error('❌ Failed to unlock vault:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(`An error occurred while unlocking the vault: ${errorMessage}`)
    } finally {
      console.log('🔓 Unlock process completed, setting loading to false')
      setIsLoading(false)
    }
  }



  return (
    <div
      className="flex overflow-hidden relative justify-center items-center p-6 min-h-screen"
      style={{
        background: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-background-secondary) 50%, var(--color-background) 100%)'
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 122, 255, 0.2) 0%, transparent 70%)',
            filter: 'blur(60px)'
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute right-20 bottom-20 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
            filter: 'blur(60px)'
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="space-y-8 w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="space-y-6 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 20
            }}
            className="relative mx-auto mb-8 w-20 h-20"
          >
            <div
              className="flex justify-center items-center w-full h-full rounded-full glass-card"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, rgba(0, 122, 255, 0.8) 100%)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <Lock className="w-10 h-10 text-white" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(0, 122, 255, 0.3), transparent)',
                filter: 'blur(8px)'
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h1 className="mb-3 text-title" style={{ color: 'var(--color-text-primary)' }}>
              Unlock Your Vault
            </h1>
            <p className="text-subheading" style={{ color: 'var(--color-text-secondary)' }}>
              Enter your master password to access your API keys
            </p>
          </motion.div>
        </div>

        {/* Main Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="p-8 glass-card"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 glass-card"
                  style={{
                    background: 'rgba(255, 59, 48, 0.1)',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p className="flex gap-2 items-center text-body" style={{ color: '#ff453a' }}>
                    <Lock className="w-4 h-4" />
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Message */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 glass-card"
                  style={{
                    background: 'rgba(52, 199, 89, 0.1)',
                    border: '1px solid rgba(52, 199, 89, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p className="flex gap-2 items-center text-body" style={{ color: '#30d158' }}>
                    <Shield className="w-4 h-4" />
                    {successMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Master Password Input */}
            <div className="space-y-3">
              <label htmlFor="password" className="block font-medium text-body" style={{ color: 'var(--color-text-primary)' }}>
                Master Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12 input-native"
                  placeholder="Enter your master password"
                  required
                  disabled={isLoading}
                  style={{
                    fontSize: '16px',
                    padding: '12px 48px 12px 16px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex absolute right-3 top-1/2 justify-center items-center transition-colors transform -translate-y-1/2"
                  style={{
                    color: 'var(--color-text-secondary)',
                    opacity: isLoading ? '0.5' : '1',
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                  disabled={isLoading}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.color = 'var(--color-text-primary)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                  }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <motion.button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="overflow-hidden relative py-3 w-full text-base font-semibold btn-primary hover-lift focus-native"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  opacity: (isLoading || !password.trim()) ? '0.5' : '1',
                  cursor: (isLoading || !password.trim()) ? 'not-allowed' : 'pointer'
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-center items-center space-x-2"
                    >
                      <div className="spinner-native" style={{ borderTopColor: 'white', borderColor: 'rgba(255, 255, 255, 0.3)' }} />
                      <span>Unlocking...</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-center items-center space-x-2"
                    >
                      <Key className="w-5 h-5" />
                      <span>Unlock Vault</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </form>

          {/* Security Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 text-center text-caption"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Your master password encrypts all your API keys locally
          </motion.p>
        </motion.div>

        {/* Security Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="space-y-4 text-center"
        >
          <div
            className="flex justify-center items-center space-x-2"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            <Shield className="w-4 h-4" />
            <span className="text-body">End-to-end encryption</span>
          </div>

          <p
            className="mx-auto max-w-sm leading-relaxed text-caption"
            style={{ color: 'rgba(255, 255, 255, 0.4)' }}
          >
            Your API keys are encrypted locally and never leave your device.
          </p>
        </motion.div>
      </motion.div>


    </div>
  )
}
