import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Shield, Eye, EyeOff, CheckCircle2, AlertTriangle, Lock, Sparkles } from 'lucide-react'
import { useAppStore } from '../lib/store'
import { invoke } from '@tauri-apps/api/core'
import KeyringService from '../lib/services/keyringService'

export default function SetMasterPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const { error, setError, setHasMasterPassword, setIsUnlocked } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccessMessage('')
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.')
      setIsLoading(false)
      return
    }

    try {
      // Set master password in the vault system
      const success = await invoke<boolean>('set_master_password', { password })
      if (success) {
        // Save master password to keyring for future authentication
        await KeyringService.saveMasterPassword(password)
        
        setHasMasterPassword(true)
        setIsUnlocked(true)
        setSuccessMessage('Master password set successfully! 🎉')
        setPassword('')
        setConfirmPassword('')

        // Give time for the event to be processed and UI to update
        await new Promise(resolve => setTimeout(resolve, 150))
      } else {
        setError('Failed to set master password. Please try again.')
      }
    } catch (err) {
      setError(`Error setting master password: ${err}`)
      console.error('Error setting master password:', err)
    } finally {
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
              className="flex overflow-hidden relative justify-center items-center w-full h-full glass-card"
              style={{
                borderRadius: 'var(--radius-xl)',

                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <img
                src="/assets/icon.png"
                alt="KeyKeeper Icon"
                className="h-30 w-30"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}
              />

            </div>
          </motion.div>


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-3"
          >
            <img
              src="/assets/logo.png"
              alt="KeyKeeper Logo"
              className="h-30 w-30"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}
            />

            <p className="text-subheading text-contrast-medium">
              Secure vault for your API keys
            </p>
          </motion.div>
        </div>

        {/* Set Master Password Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="p-8 space-y-6 modal-native"
        >
          <div className="flex items-center mb-6 space-x-3 text-contrast-medium">
            <Shield className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <span className="font-medium text-body">
              Set Your Master Password
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="font-medium text-body text-contrast-medium"
              >
                Master Password
              </label>
              <div className="relative">
                <motion.input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12 input-native focus-native text-contrast-high"
                  placeholder="Enter your master password"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex absolute inset-y-0 right-0 items-center pr-3 focus-native"
                  style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    background: 'none',
                    border: 'none'
                  }}
                  whileHover={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    scale: 1.1
                  }}
                  whileTap={{ scale: 0.9 }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="font-medium text-body text-contrast-medium"
              >
                Confirm Master Password
              </label>
              <div className="relative">
                <motion.input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-12 input-native focus-native text-contrast-high"
                  placeholder="Confirm your master password"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex absolute inset-y-0 right-0 items-center pr-3 focus-native"
                  style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    background: 'none',
                    border: 'none'
                  }}
                  whileHover={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    scale: 1.1
                  }}
                  whileTap={{ scale: 0.9 }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
            </div>

            <AnimatePresence mode="wait">
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

            <div className="space-y-3">
              <motion.button
                type="submit"
                disabled={isLoading || !password.trim() || !confirmPassword.trim()}
                className="overflow-hidden relative py-3 w-full text-base font-semibold btn-primary hover-lift focus-native"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  opacity: (isLoading || !password.trim() || !confirmPassword.trim()) ? '0.5' : '1',
                  cursor: (isLoading || !password.trim() || !confirmPassword.trim()) ? 'not-allowed' : 'pointer'
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
                      <span>Setting Master Password...</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-center items-center space-x-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>Set Master Password</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </form>
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