import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Shield, Eye, EyeOff, Sparkles, Lock, Mail, User, ArrowLeft } from 'lucide-react'
import { useAppStore } from '../lib/store'
import { invoke } from '@tauri-apps/api/core'

type LoginScreenProps = {
  mode: 'registerOrLogin' | 'userLogin' | 'unlockVault' | 'recovery'
}



export default function LoginScreen({ mode: initialMode }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [recoveryToken, setRecoveryToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { unlockVault, loginUser, registerUser, error, setError, setIsUserLoggedIn, setHasMasterPassword } = useAppStore()
  const [mode, setMode] = useState<LoginScreenProps['mode']>(initialMode)

  // ✅ Sync internal mode with prop changes to prevent conflicts
  useEffect(() => {
    setMode(initialMode)
    // Clear previous state when mode changes
    setSuccessMessage('')
    setError(null)
  }, [initialMode, setError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccessMessage('')
    setError(null)

    try {
      let success = false

      if (mode === 'unlockVault') {
        if (password.trim()) {
          success = await unlockVault(password)
          if (success) {
            setSuccessMessage('Vault unlocked successfully!')
          }
        }
      } else if (mode === 'registerOrLogin') {
        if (email.trim() && password.trim()) {
          success = await registerUser(email, password)
          if (success) {
            setSuccessMessage('Account created successfully!')
          }
        }
      } else if (mode === 'userLogin') {
        if (email.trim() && password.trim()) {
          success = await loginUser(email, password)
          if (success) {
            setSuccessMessage('Logged in successfully!')
            // ✅ IMPROVED: Wait for auth status refresh to complete
            await new Promise(resolve => {

              setTimeout(resolve, 100)
            })
          }
        }
      } else if (mode === 'recovery') {
        if (recoveryToken.trim() && newPassword.trim()) {
          await invoke('reset_master_password', { token: recoveryToken, newPassword })
          setSuccessMessage('Master password reset successfully!')
          setRecoveryToken('')
          setNewPassword('')
          success = true
          // ✅ IMPROVED: Trigger auth refresh after recovery
          await new Promise(resolve => {

            setTimeout(resolve, 100)
          })
        }
      }

      // ✅ Clear form only on success for non-vault modes
      if (success && mode !== 'unlockVault') {
        setPassword('')
        setEmail('')
      }
    } catch (err) {
      console.error('Authentication error:', err)
      // Error is handled by useAppStore for most cases
      if (mode === 'recovery') {
        setError(`Recovery failed: ${err}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestRecovery = async () => {
    if (!email.trim()) return

    setIsLoading(true)
    try {
      const token = await invoke('request_password_recovery', { email })
      setRecoveryToken(token as string)
      setSuccessMessage('Recovery token generated! Use this token to reset your password.')
      // No change in mode here, as recovery is a sub-flow
    } catch (err) {
      console.error('Recovery error:', err)
      // Error message is already set by useAppStore or handled by specific invoke calls
    } finally {
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    switch (mode) {
      case 'registerOrLogin': return 'Create Account or Login'
      case 'userLogin': return 'Login to Your Account'
      case 'unlockVault': return 'Unlock Your Vault'
      case 'recovery': return 'Recover Master Password'
      default: return 'Authentication'
    }
  }

  const getButtonText = () => {
    switch (mode) {
      case 'registerOrLogin': return isLoading ? 'Creating/Logging in...' : 'Create Account / Login'
      case 'userLogin': return isLoading ? 'Logging in...' : 'Login'
      case 'unlockVault': return isLoading ? 'Unlocking...' : 'Unlock Vault'
      case 'recovery': return isLoading ? 'Recovering...' : 'Reset Password'
      default: return 'Submit'
    }
  }

  const showEmailField = mode === 'registerOrLogin' || mode === 'userLogin' || mode === 'recovery'
  const showPasswordField = mode === 'registerOrLogin' || mode === 'userLogin' || mode === 'unlockVault' || mode === 'recovery'
  const showRecoveryTokenField = mode === 'recovery'
  const isNewPasswordMode = mode === 'recovery'

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

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="p-8 space-y-6 modal-native"
        >
          <div className="flex items-center mb-6 space-x-3 text-contrast-medium">
            {mode === 'unlockVault' && <Shield className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
            {(mode === 'registerOrLogin' || mode === 'userLogin') && <User className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
            {mode === 'recovery' && <Mail className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
            <span className="font-medium text-body">
              {getTitle()}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {showEmailField && (
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="font-medium text-body text-contrast-medium"
                >
                  Email
                </label>
                <motion.input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="input-native focus-native text-contrast-high"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}

            {showRecoveryTokenField && (
              <div className="space-y-2">
                <label
                  htmlFor="recoveryToken"
                  className="font-medium text-body text-contrast-medium"
                >
                  Recovery Token
                </label>
                <motion.input
                  id="recoveryToken"
                  name="recoveryToken"
                  type="text"
                  required
                  value={recoveryToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecoveryToken(e.target.value)}
                  className="input-native focus-native text-contrast-high"
                  placeholder="Enter recovery token"
                  disabled={isLoading}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}

            {showPasswordField && (
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="font-medium text-body text-contrast-medium"
                >
                  {isNewPasswordMode ? 'New Master Password' : 'Password'}
                </label>
                <div className="relative">
                  <motion.input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={isNewPasswordMode ? newPassword : password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => isNewPasswordMode ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                    className="pr-12 input-native focus-native text-contrast-high"
                    placeholder={isNewPasswordMode ? 'Enter new master password' : 'Enter your password'}
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
            )}

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
                disabled={isLoading || (showEmailField && !email.trim()) || (showPasswordField && !password.trim() && !newPassword.trim()) || (showRecoveryTokenField && !recoveryToken.trim())}
                className="overflow-hidden relative py-3 w-full text-base font-semibold btn-primary hover-lift focus-native"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  opacity: (isLoading || (showEmailField && !email.trim()) || (showPasswordField && !password.trim() && !newPassword.trim()) || (showRecoveryTokenField && !recoveryToken.trim())) ? '0.5' : '1',
                  cursor: (isLoading || (showEmailField && !email.trim()) || (showPasswordField && !password.trim() && !newPassword.trim()) || (showRecoveryTokenField && !recoveryToken.trim())) ? 'not-allowed' : 'pointer'
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
                      <span>{getButtonText()}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-center items-center space-x-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>{getButtonText()}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {(mode === 'registerOrLogin' || mode === 'userLogin') && (
                <motion.button
                  type="button"
                  onClick={() => {
                    // This button will now toggle between register and login if in registerOrLogin mode
                    // Or, if in userLogin mode, it might lead to a recovery flow
                    if (mode === 'registerOrLogin') {
                      // For now, we'll keep it simple and assume the user will just try to login/register
                      // The index.tsx will manage the overall flow
                    } else if (mode === 'userLogin') {
                      // This button could lead to the recovery flow
                      // For now, we'll remove it as the recovery is handled by the 'recovery' mode
                    }
                  }}
                  disabled={isLoading || !email.trim()}
                  className="py-2 w-full text-sm font-medium btn-secondary hover-lift focus-native"
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    opacity: (isLoading || !email.trim()) ? '0.5' : '1',
                    cursor: (isLoading || !email.trim()) ? 'not-allowed' : 'pointer'
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex justify-center items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>Request Recovery Token</span>
                  </div>
                </motion.button>
              )}
            </div>
          </form>

          <div className="pt-4 space-y-3 text-center">
            {mode === 'registerOrLogin' && (
              <div className="flex justify-center space-x-6">
                <motion.button
                  type="button"
                  onClick={() => setMode('userLogin')}
                  className="text-sm transition-colors text-contrast-medium hover:text-contrast-high"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Already have an account? Login
                </motion.button>
              </div>
            )}

            {mode === 'userLogin' && (
              <div className="flex justify-center space-x-6">
                <motion.button
                  type="button"
                  onClick={() => setMode('registerOrLogin')}
                  className="text-sm transition-colors text-contrast-medium hover:text-contrast-high"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Don&apos;t have an account? Register
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setMode('recovery')}
                  className="text-sm transition-colors text-contrast-medium hover:text-contrast-high"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Forgot Password?
                </motion.button>
              </div>
            )}

            {mode === 'recovery' && (
              <motion.button
                type="button"
                onClick={() => setMode('userLogin')}
                className="flex justify-center items-center mx-auto space-x-2 text-sm transition-colors text-contrast-medium hover:text-contrast-high"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </motion.button>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-caption"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              {mode === 'registerOrLogin' && 'Create a new account or log in with an existing one.'}
              {mode === 'userLogin' && 'Enter your credentials to access your KeyKeeper account.'}
              {mode === 'unlockVault' && 'Enter your master password to unlock your vault.'}
              {mode === 'recovery' && 'Use the recovery token to reset your master password.'}
            </motion.p>
          </div>
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