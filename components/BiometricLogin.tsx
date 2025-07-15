import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { TauriAPI } from '../lib/tauri-api'

interface BiometricLoginProps {
    onSuccess: () => void
    onFallback: () => void
    isVisible: boolean
}

export default function BiometricLogin({ onSuccess, onFallback, isVisible }: BiometricLoginProps) {
    const [isSupported, setIsSupported] = useState(false)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        checkBiometricSupport()
    }, [])

    const checkBiometricSupport = async () => {
        try {
            const supported = await TauriAPI.checkBiometricSupport()
            setIsSupported(supported)
        } catch (error) {
            console.error('Failed to check biometric support:', error)
            setIsSupported(false)
        }
    }

    const handleBiometricAuth = async () => {
        if (!isSupported) return

        setIsAuthenticating(true)
        setError(null)

        try {
            // In a real implementation, you would:
            // 1. Get the user's credential ID from storage
            // 2. Call the biometric authentication
            // 3. Handle the result
            
            // For now, simulate biometric authentication
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Mock successful authentication
            setSuccess(true)
            setTimeout(() => {
                onSuccess()
            }, 1000)

        } catch (error: any) {
            setError(error.message || 'Biometric authentication failed')
        } finally {
            setIsAuthenticating(false)
        }
    }

    if (!isVisible || !isSupported) {
        return null
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="text-center">
                <motion.div
                    className="relative mx-auto w-24 h-24 mb-6"
                    animate={isAuthenticating ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1.5, repeat: isAuthenticating ? Infinity : 0 }}
                >
                    <div 
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{
                            background: success 
                                ? 'linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(52, 199, 89, 0.1))'
                                : error
                                ? 'linear-gradient(135deg, rgba(255, 69, 58, 0.2), rgba(255, 69, 58, 0.1))'
                                : 'linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(0, 122, 255, 0.1))',
                            border: success
                                ? '2px solid rgba(52, 199, 89, 0.3)'
                                : error
                                ? '2px solid rgba(255, 69, 58, 0.3)'
                                : '2px solid rgba(0, 122, 255, 0.3)'
                        }}
                    >
                        {success ? (
                            <CheckCircle2 
                                className="h-12 w-12" 
                                style={{ color: 'var(--color-success)' }} 
                            />
                        ) : error ? (
                            <AlertTriangle 
                                className="h-12 w-12" 
                                style={{ color: 'var(--color-error)' }} 
                            />
                        ) : (
                            <Fingerprint 
                                className="h-12 w-12" 
                                style={{ color: 'var(--color-accent)' }} 
                            />
                        )}
                    </div>
                    
                    {isAuthenticating && (
                        <motion.div
                            className="absolute inset-0 rounded-full border-2 border-transparent"
                            style={{
                                borderTopColor: 'var(--color-accent)',
                                borderRightColor: 'var(--color-accent)',
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                    )}
                </motion.div>

                <h2 className="text-title mb-2">
                    {success ? 'Authentication Successful' : 'Biometric Authentication'}
                </h2>
                
                <p className="text-caption mb-6">
                    {success 
                        ? 'Welcome back! Unlocking your vault...'
                        : isAuthenticating 
                        ? 'Touch your fingerprint sensor or look at your camera'
                        : 'Use Touch ID, Face ID, or Windows Hello to unlock your vault'
                    }
                </p>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-4"
                    style={{
                        background: 'rgba(255, 69, 58, 0.1)',
                        border: '1px solid rgba(255, 69, 58, 0.2)'
                    }}
                >
                    <div className="flex items-start space-x-3">
                        <AlertTriangle 
                            className="h-5 w-5 mt-0.5" 
                            style={{ color: 'var(--color-error)' }} 
                        />
                        <div>
                            <p className="text-body font-medium" style={{ color: 'var(--color-error)' }}>
                                Authentication Failed
                            </p>
                            <p className="text-caption mt-1">{error}</p>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="space-y-3">
                <motion.button
                    onClick={handleBiometricAuth}
                    disabled={isAuthenticating || success}
                    className="btn-primary w-full py-3 hover-lift focus-native"
                    style={{
                        borderRadius: 'var(--radius-lg)',
                        opacity: isAuthenticating || success ? 0.7 : 1,
                        cursor: isAuthenticating || success ? 'not-allowed' : 'pointer'
                    }}
                    whileHover={!isAuthenticating && !success ? { scale: 1.02 } : {}}
                    whileTap={!isAuthenticating && !success ? { scale: 0.98 } : {}}
                >
                    {isAuthenticating ? (
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span>Authenticating...</span>
                        </div>
                    ) : success ? (
                        'Unlocking Vault...'
                    ) : (
                        'Authenticate with Biometrics'
                    )}
                </motion.button>

                <button
                    onClick={onFallback}
                    disabled={isAuthenticating || success}
                    className="btn-secondary w-full py-3 hover-lift focus-native"
                    style={{
                        borderRadius: 'var(--radius-lg)',
                        opacity: isAuthenticating || success ? 0.7 : 1,
                        cursor: isAuthenticating || success ? 'not-allowed' : 'pointer'
                    }}
                >
                    <div className="flex items-center justify-center space-x-2">
                        <Lock className="h-4 w-4" />
                        <span>Use Password Instead</span>
                    </div>
                </button>
            </div>

            <div className="text-center">
                <p className="text-caption">
                    Your biometric data is stored securely on your device and never shared.
                </p>
            </div>
        </motion.div>
    )
}