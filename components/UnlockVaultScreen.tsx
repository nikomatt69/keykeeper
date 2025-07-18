import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Shield, Eye, EyeOff, Lock } from 'lucide-react'
import { useAppStore } from '../lib/store'
import KeyringService from '../lib/services/keyringService'

export default function UnlockVaultScreen() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const { unlockVault, error, setError } = useAppStore()

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
      setError(`An error occurred while unlocking the vault: ${error}`)
    } finally {
      console.log('🔓 Unlock process completed, setting loading to false')
      setIsLoading(false)
    }
  }



  return (
    <div className="flex justify-center items-center p-4 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8 text-center"
        >
          <motion.div
            className="flex justify-center items-center mx-auto mb-4 w-16 h-16 rounded-full glass-card"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Lock className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
          </motion.div>

          <h1 className="mb-2 text-3xl font-bold text-contrast-high">
            Unlock Your Vault
          </h1>
          <p className="text-contrast-medium">
            Enter your master password to access your API keys
          </p>
        </motion.div>

        {/* Main Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="p-8 glass-card"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-xl)'
          }}
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
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <p className="text-body" style={{ color: '#f87171' }}>
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
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-contrast-medium">
                Master Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-4 py-3 pr-12 w-full rounded-lg border-2 transition-all duration-200 bg-white/5 border-white/20 text-contrast-high placeholder-contrast-medium focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 focus:outline-none"
                  placeholder="Enter your master password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transition-colors transform -translate-y-1/2 text-contrast-medium hover:text-contrast-high"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Unlock Button */}
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
            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          >
            Your master password encrypts all your API keys locally
          </motion.p>
        </motion.div>

        {/* Security Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 space-y-4 text-center"
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
