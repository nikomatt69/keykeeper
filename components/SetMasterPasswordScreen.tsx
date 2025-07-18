import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Eye, EyeOff, Sparkles, Lock } from 'lucide-react'
import { useAppStore } from '../lib/store'
import { TauriAPI } from '../lib/tauri-api'

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
      const success = await TauriAPI.setMasterPassword(password)
      if (success) {
        setSuccessMessage('Master password set successfully! Vault unlocked.')
        // ✅ IMPROVED: Update states in correct order and wait for completion
        setHasMasterPassword(true)
        setIsUnlocked(true)
        
        // ✅ IMPROVED: Clear form and wait for auth status refresh
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
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
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
          className="absolute bottom-20 right-20 w-96 h-96 rounded-full"
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
        className="w-full max-w-md space-y-8"
      >
        {/* Logo and Title */}
        <div className="text-center space-y-6">
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
            className="relative mx-auto w-20 h-20 mb-8"
          >
            <div
              className="glass-card w-full h-full flex items-center justify-center relative overflow-hidden"
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
          className="modal-native p-8 space-y-6"
        >
          <div className="flex items-center space-x-3 mb-6 text-contrast-medium">
            <Shield className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            <span className="text-body font-medium">
              Set Your Master Password
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-body font-medium text-contrast-medium"
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
                  className="input-native pr-12 focus-native text-contrast-high"
                  placeholder="Enter your master password"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus-native"
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
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </motion.button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-body font-medium text-contrast-medium"
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
                  className="input-native pr-12 focus-native text-contrast-high"
                  placeholder="Confirm your master password"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus-native"
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
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
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
                  className="glass-card p-4"
                  style={{
                    background: 'rgba(255, 59, 48, 0.1)',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p className="text-body flex items-center gap-2" style={{ color: '#ff453a' }}>
                    <Lock className="h-4 w-4" />
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
                  className="glass-card p-4"
                  style={{
                    background: 'rgba(52, 199, 89, 0.1)',
                    border: '1px solid rgba(52, 199, 89, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p className="text-body flex items-center gap-2" style={{ color: '#30d158' }}>
                    <Shield className="h-4 w-4" />
                    {successMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              <motion.button
                type="submit"
                disabled={isLoading || !password.trim() || !confirmPassword.trim()}
                className="btn-primary w-full py-3 text-base font-semibold hover-lift focus-native relative overflow-hidden"
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
                      className="flex items-center justify-center space-x-2"
                    >
                      <div className="spinner-native" style={{ borderTopColor: 'white', borderColor: 'rgba(255, 255, 255, 0.3)' }} />
                      <span>Setting Master Password...</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center space-x-2"
                    >
                      <Sparkles className="h-5 w-5" />
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
          className="text-center space-y-4"
        >
          <div
            className="flex items-center justify-center space-x-2"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            <Shield className="h-4 w-4" />
            <span className="text-body">End-to-end encryption</span>
          </div>

          <p
            className="text-caption max-w-sm mx-auto leading-relaxed"
            style={{ color: 'rgba(255, 255, 255, 0.4)' }}
          >
            Your API keys are encrypted locally and never leave your device.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}