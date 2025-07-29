import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Wifi,
  WifiOff,
  Key,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Download,
  Server
} from 'lucide-react'
import { TauriAPI } from '../../lib/tauri-api'

interface ChatConnectionModalProps {
  isOpen: boolean
  onClose: () => void
}

interface OllamaStatus {
  is_running: boolean
  models: { name: string; size: number; modified: string }[]
  server_url: string
}

export default function ChatConnectionModal({ isOpen, onClose }: ChatConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<'openai' | 'anthropic' | 'ollama' | 'local'>('local')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState('')

  // Check Ollama status on modal open
  useEffect(() => {
    if (isOpen && activeTab === 'ollama') {
      checkOllamaStatus()
    }
  }, [isOpen, activeTab])

  const checkOllamaStatus = async () => {
    try {
      const status = await TauriAPI.checkOllamaStatus()
      setOllamaStatus(status)
      if (status.models.length > 0 && !selectedModel) {
        // Prefer Qwen models
        const qwenModel = status.models.find(m => m.name.includes('qwen'))
        setSelectedModel(qwenModel?.name || status.models[0].name)
      }
    } catch (error) {
      console.error('Failed to check Ollama status:', error)
      setOllamaStatus({ is_running: false, models: [], server_url: 'http://localhost:11434' })
    }
  }

  const testConnection = async () => {
    setIsConnecting(true)
    setConnectionStatus('testing')
    setErrorMessage('')

    try {
      let result
      switch (activeTab) {
        case 'local':
          result = await TauriAPI.testLLMConnection('local')
          break

        case 'openai':
          if (!openaiKey.trim()) {
            throw new Error('Please enter your OpenAI API key')
          }
          // Set environment variable (this is temporary - should be stored securely)
          await TauriAPI.setEnvVar('OPENAI_API_KEY', openaiKey)
          result = await TauriAPI.testLLMConnection('openai')
          break

        case 'anthropic':
          if (!anthropicKey.trim()) {
            throw new Error('Please enter your Anthropic API key')
          }
          await TauriAPI.setEnvVar('ANTHROPIC_API_KEY', anthropicKey)
          result = await TauriAPI.testLLMConnection('anthropic')
          break

        case 'ollama':
          if (!selectedModel) {
            throw new Error('Please select an Ollama model')
          }
          result = await TauriAPI.testLLMConnection('ollama')
          break
      }

      setConnectionStatus('success')

      // Configure the LLM provider
      await TauriAPI.configureLLMProvider({
        provider: activeTab,
        model: activeTab === 'local' ? 'qwen2.5-7b-instruct' :
          activeTab === 'ollama' ? selectedModel :
          activeTab === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 2000
      })

      setTimeout(() => {
        onClose()
      }, 1500)

    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionStatus('error')
      setErrorMessage(error as string)
    } finally {
      setIsConnecting(false)
    }
  }

  const downloadOllama = () => {
    window.open('https://ollama.ai', '_blank')
  }

  const pullModel = async (model: string) => {
    try {
      setIsConnecting(true)
      await TauriAPI.pullOllamaModel(model)
      await checkOllamaStatus() // Refresh status
    } catch (error) {
      console.error('Failed to pull model:', error)
      setErrorMessage(error as string)
    } finally {
      setIsConnecting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-sm bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative mx-4 w-full max-w-2xl bg-white rounded-xl shadow-xl dark:bg-gray-900"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wifi className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Connect AI Provider
              </h2>
              <p className="text-sm text-gray-500">
                Choose and configure your AI provider to start chatting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 rounded-lg hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'local', label: 'Local Qwen', icon: Server },
            { id: 'ollama', label: 'Ollama (Local)', icon: Server },
            { id: 'openai', label: 'OpenAI', icon: Key },
            { id: 'anthropic', label: 'Anthropic', icon: Key }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Local Qwen Tab */}
            {activeTab === 'local' && (
              <motion.div
                key="local"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center mb-4 space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Local Qwen model ready</span>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <h4 className="mb-2 font-medium text-blue-800 dark:text-blue-200">
                    Local AI Model
                  </h4>
                  <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
                    Uses the integrated Qwen model running locally. No API key required and your data stays private.
                  </p>
                  <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <p>✓ No internet connection required</p>
                    <p>✓ Complete privacy - data never leaves your device</p>
                    <p>✓ No API costs or rate limits</p>
                    <p>✓ Works offline</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Ollama Tab */}
            {activeTab === 'ollama' && (
              <motion.div
                key="ollama"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center mb-4 space-x-2">
                  {ollamaStatus?.is_running ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Ollama is running</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-5 h-5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Ollama is not running</span>
                    </>
                  )}
                </div>

                {!ollamaStatus?.is_running ? (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-200">
                      Ollama Setup Required
                    </h4>
                    <p className="mb-3 text-sm text-yellow-700 dark:text-yellow-300">
                      To use local AI models, you need to install and run Ollama first.
                    </p>
                    <div className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <p>1. Download and install Ollama</p>
                      <p>2. Run: <code className="px-1 bg-yellow-100 rounded dark:bg-yellow-800">ollama serve</code></p>
                      <p>3. Pull a model: <code className="px-1 bg-yellow-100 rounded dark:bg-yellow-800">ollama pull qwen2.5:7b</code></p>
                    </div>
                    <button
                      onClick={downloadOllama}
                      className="flex items-center mt-3 space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Download Ollama</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Model
                      </label>
                      {ollamaStatus?.models.length > 0 ? (
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="px-3 py-2 w-full text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        >
                          {ollamaStatus.models.map((model) => (
                            <option key={model.name} value={model.name}>
                              {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">No models installed. Popular models:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {['qwen2.5:7b', 'llama3.1:8b', 'mistral:7b', 'codellama:7b'].map((model) => (
                              <button
                                key={model}
                                onClick={() => pullModel(model)}
                                disabled={isConnecting}
                                className="flex items-center p-2 space-x-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                              >
                                <Download className="w-4 h-4" />
                                <span className="text-sm">{model}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* OpenAI Tab */}
            {activeTab === 'openai' && (
              <motion.div
                key="openai"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="px-3 py-2 w-full text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your API key from{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      OpenAI Platform
                    </a>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Anthropic Tab */}
            {activeTab === 'anthropic' && (
              <motion.div
                key="anthropic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Anthropic API Key
                  </label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="px-3 py-2 w-full text-gray-900 bg-white rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your API key from{' '}
                    <a
                      href="https://console.anthropic.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Anthropic Console
                    </a>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status Messages */}
          {connectionStatus === 'error' && (
            <div className="p-3 mt-4 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">{errorMessage}</span>
              </div>
            </div>
          )}

          {connectionStatus === 'success' && (
            <div className="p-3 mt-4 bg-green-50 rounded-lg border border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Connection successful! You can now start chatting.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-6 space-x-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={testConnection}
            disabled={
              isConnecting ||
              (activeTab === 'openai' && !openaiKey.trim()) ||
              (activeTab === 'anthropic' && !anthropicKey.trim()) ||
              (activeTab === 'ollama' && (!ollamaStatus?.is_running || !selectedModel))
              // Local tab is never disabled - always ready
            }
            className="flex items-center px-4 py-2 space-x-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : connectionStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            <span>
              {isConnecting
                ? 'Testing...'
                : connectionStatus === 'success'
                  ? 'Connected'
                  : 'Test Connection'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}