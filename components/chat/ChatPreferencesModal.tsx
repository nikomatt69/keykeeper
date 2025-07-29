import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Save, RotateCcw } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { ChatUserPreferences, DetailLevel } from '../../lib/types'
import { ChatService } from '../../lib/services/chatService'

interface ChatPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatPreferencesModal({ isOpen, onClose }: ChatPreferencesModalProps) {
  const { chat, updateChatPreferences } = useAppStore()
  
  const [preferences, setPreferences] = useState<ChatUserPreferences>(chat.userPreferences)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setPreferences(chat.userPreferences)
    setHasChanges(false)
  }, [chat.userPreferences, isOpen])

  const handlePreferenceChange = (key: keyof ChatUserPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value }
    setPreferences(newPreferences)
    setHasChanges(JSON.stringify(newPreferences) !== JSON.stringify(chat.userPreferences))
  }

  const handleSave = () => {
    updateChatPreferences(preferences)
    setHasChanges(false)
    onClose()
  }

  const handleReset = () => {
    const defaultPrefs = ChatService.createDefaultPreferences()
    setPreferences(defaultPrefs)
    setHasChanges(JSON.stringify(defaultPrefs) !== JSON.stringify(chat.userPreferences))
  }

  const handleCancel = () => {
    setPreferences(chat.userPreferences)
    setHasChanges(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Chat Preferences
          </h2>
          <button
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Language Preferences */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Language & Framework
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Language
                </label>
                <select
                  value={preferences.preferredLanguage}
                  onChange={(e) => handlePreferenceChange('preferredLanguage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="csharp">C#</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="php">PHP</option>
                  <option value="ruby">Ruby</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Framework
                </label>
                <select
                  value={preferences.preferredFramework}
                  onChange={(e) => handlePreferenceChange('preferredFramework', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="react">React</option>
                  <option value="vue">Vue.js</option>
                  <option value="angular">Angular</option>
                  <option value="svelte">Svelte</option>
                  <option value="nextjs">Next.js</option>
                  <option value="nuxt">Nuxt.js</option>
                  <option value="express">Express.js</option>
                  <option value="fastapi">FastAPI</option>
                  <option value="django">Django</option>
                  <option value="rails">Ruby on Rails</option>
                  <option value="spring">Spring Boot</option>
                </select>
              </div>
            </div>
          </div>

          {/* Code Style */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Code Style
            </label>
            <select
              value={preferences.codeStyle}
              onChange={(e) => handlePreferenceChange('codeStyle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="functional">Functional</option>
              <option value="object-oriented">Object-Oriented</option>
              <option value="procedural">Procedural</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          {/* Detail Level */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Response Detail Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['minimal', 'standard', 'comprehensive', 'expert'] as DetailLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handlePreferenceChange('detailLevel', level)}
                  className={`p-3 text-sm rounded-lg border transition-colors ${
                    preferences.detailLevel === level
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium capitalize">{level}</div>
                  <div className="text-xs opacity-75 mt-1">
                    {level === 'minimal' && 'Brief responses'}
                    {level === 'standard' && 'Balanced detail'}
                    {level === 'comprehensive' && 'Detailed explanations'}
                    {level === 'expert' && 'Technical depth'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feature Toggles */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Features
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">Include Examples</div>
                  <div className="text-xs text-gray-500">Show code examples in responses</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.includeExamples}
                  onChange={(e) => handlePreferenceChange('includeExamples', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">Include Tests</div>
                  <div className="text-xs text-gray-500">Generate test cases with code</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.includeTests}
                  onChange={(e) => handlePreferenceChange('includeTests', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">Security Focused</div>
                  <div className="text-xs text-gray-500">Emphasize security best practices</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.securityFocused}
                  onChange={(e) => handlePreferenceChange('securityFocused', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}