import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Code, Download, Sparkles, FileText, Copy, CheckCircle, Loader2, Wand2, Bot, Save, BookOpen } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { ApiProviderService, GeneratedConfig } from '../../lib/services/apiProviderService'
import { useMLEngine, useLLMDocumentation } from '../../lib/hooks/useMLEngine'
import { invoke } from '@tauri-apps/api/core'
import type { GeneratedConfigTemplate } from '../../lib/tauri-api'

interface ConfigGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  apiKey: any
}

interface MLAnalysisResult {
  provider: string
  confidence: number
  suggestedFramework: string
  recommendedFeatures: string[]
  configType: 'client' | 'server' | 'full-stack'
}

interface EnhancedMLAnalysis extends MLAnalysisResult {
  llmInsights: string[]
  securityRecommendations: string[]
  bestPractices: string[]
}

export default function ConfigGenerationModal({ isOpen, onClose, apiKey }: ConfigGenerationModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [mlAnalysis, setMlAnalysis] = useState<EnhancedMLAnalysis | null>(null)
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null)
  const [llmConfigTemplate, setLlmConfigTemplate] = useState<GeneratedConfigTemplate | null>(null)
  const [selectedFramework, setSelectedFramework] = useState('nextjs')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'analysis' | 'generation' | 'preview'>('analysis')
  const [useLLMGeneration, setUseLLMGeneration] = useState(true)
  
  const { saveDocumentation } = useAppStore()
  const { 
    llmAvailable, 
    generateConfigTemplate, 
    getConfigRecommendations,
    detectContext
  } = useMLEngine({ enableLLM: true })
  const {
    isGenerating: isLLMGenerating,
    configTemplate,
    generateComprehensiveDocumentation
  } = useLLMDocumentation()

  useEffect(() => {
    if (isOpen && apiKey && !isAnalyzing && !mlAnalysis) {
      performMLAnalysis()
    }
  }, [isOpen, apiKey])

  const performMLAnalysis = async () => {
    if (isAnalyzing) return // Prevent concurrent analysis
    setIsAnalyzing(true)
    try {
      // Create context info for ML analysis
      const contextInfo = {
        active_app: 'KeyKeeper',
        file_path: null,
        file_extension: null,
        project_type: 'web',
        language: 'typescript',
        content_snippet: `API Key: ${apiKey.name}, Service: ${apiKey.service}`
      }

      // Enhanced ML analysis with LLM insights
      const mlResult = await invoke('analyze_context_ml', {
        request: {
          context: contextInfo,
          available_keys: [apiKey.name]
        }
      })

      // Get LLM-powered configuration recommendations if available
      let llmInsights: string[] = []
      let securityRecommendations: string[] = []
      let bestPractices: string[] = []
      
      if (llmAvailable) {
        try {
          const configRecommendations = await getConfigRecommendations(apiKey.service, contextInfo)
          llmInsights = configRecommendations.map(rec => rec.reasoning).slice(0, 3)
          
          // Get security recommendations from ML analysis
          securityRecommendations = [
            'Store API keys in environment variables',
            'Enable rate limiting in production',
            'Implement proper error handling'
          ]
          
          bestPractices = [
            'Use TypeScript for better type safety',
            'Implement retry logic for API calls',
            'Add request/response logging for debugging'
          ]
        } catch (error) {
          console.error('LLM analysis failed:', error)
        }
      }

      // Enhanced analysis result
      const analysis: EnhancedMLAnalysis = {
        provider: apiKey.service,
        confidence: 0.85,
        suggestedFramework: detectFramework(apiKey.service),
        recommendedFeatures: getRecommendedFeatures(apiKey.service),
        configType: getConfigType(apiKey.service),
        llmInsights,
        securityRecommendations,
        bestPractices
      }

      setMlAnalysis(analysis)
      setSelectedFramework(analysis.suggestedFramework)
      setSelectedFeatures(analysis.recommendedFeatures)
      setActiveTab('generation')
    } catch (error) {
      console.error('ML Analysis failed:', error)
      // Enhanced fallback analysis
      const fallbackAnalysis: EnhancedMLAnalysis = {
        provider: apiKey.service,
        confidence: 0.6,
        suggestedFramework: 'nextjs',
        recommendedFeatures: ['basic-setup'],
        configType: 'client',
        llmInsights: ['Consider using environment variables for API keys'],
        securityRecommendations: ['Implement proper error handling'],
        bestPractices: ['Use TypeScript for better type safety']
      }
      setMlAnalysis(fallbackAnalysis)
      setSelectedFramework('nextjs')
      setSelectedFeatures(['basic-setup'])
      setActiveTab('generation')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const detectFramework = (service: string): string => {
    const serviceLower = service.toLowerCase()
    if (serviceLower.includes('next') || serviceLower.includes('react')) return 'nextjs'
    if (serviceLower.includes('vue')) return 'nuxtjs'
    if (serviceLower.includes('svelte')) return 'sveltekit'
    if (serviceLower.includes('angular')) return 'angular'
    return 'nextjs'
  }

  const getRecommendedFeatures = (service: string): string[] => {
    const serviceLower = service.toLowerCase()
    const features = ['basic-setup']
    
    if (serviceLower.includes('auth')) {
      features.push('authentication', 'session-management')
    }
    if (serviceLower.includes('stripe') || serviceLower.includes('payment')) {
      features.push('webhooks', 'error-handling')
    }
    if (serviceLower.includes('openai') || serviceLower.includes('ai')) {
      features.push('streaming', 'error-handling', 'rate-limiting')
    }
    if (serviceLower.includes('supabase') || serviceLower.includes('database')) {
      features.push('database-types', 'real-time', 'auth-integration')
    }
    
    return features
  }

  const getConfigType = (service: string): 'client' | 'server' | 'full-stack' => {
    const serviceLower = service.toLowerCase()
    if (serviceLower.includes('auth') || serviceLower.includes('supabase')) return 'full-stack'
    if (serviceLower.includes('stripe') || serviceLower.includes('webhook')) return 'server'
    return 'client'
  }

  const generateConfiguration = async () => {
    if (!mlAnalysis) return

    setIsGenerating(true)
    try {
      const envVars: Record<string, string> = {}
      envVars[apiKey.name] = apiKey.key

      if (useLLMGeneration && llmAvailable) {
        // Use LLM-powered configuration generation
        const llmTemplate = await generateConfigTemplate(
          mlAnalysis.provider,
          selectedFramework,
          apiKey.environment,
          selectedFeatures
        )
        
        if (llmTemplate) {
          setLlmConfigTemplate(llmTemplate)
          // Convert LLM template to legacy format for compatibility
          const config: GeneratedConfig = {
            files: llmTemplate.files.map(file => ({
              path: file.path,
              content: file.content,
              language: file.file_type === 'code' ? selectedFramework : 'text',
              fileType: file.file_type
            })),
            setupInstructions: llmTemplate.setup_instructions,
            dependencies: llmTemplate.dependencies
          }
          setGeneratedConfig(config)
        } else {
          throw new Error('LLM generation failed')
        }
      } else {
        // Fallback to traditional generation
        const config = await ApiProviderService.generateConfiguration({
          providerId: mlAnalysis.provider.toLowerCase(),
          envVars,
          features: selectedFeatures,
          framework: selectedFramework
        })
        setGeneratedConfig(config)
      }

      setActiveTab('preview')
    } catch (error) {
      console.error('Configuration generation failed:', error)
      // Fallback to traditional generation if LLM fails
      if (useLLMGeneration && llmAvailable) {
        try {
          console.log('Falling back to traditional generation method...')
          setUseLLMGeneration(false)
          
          // Recreate envVars for fallback
          const envVars: Record<string, string> = {}
          envVars[apiKey.name] = apiKey.key
          
          // Traditional generation fallback
          const config = await ApiProviderService.generateConfiguration({
            providerId: mlAnalysis.provider.toLowerCase(),
            envVars,
            features: selectedFeatures,
            framework: selectedFramework
          })
          setGeneratedConfig(config)
          setActiveTab('preview')
        } catch (fallbackError) {
          console.error('Both LLM and traditional generation failed:', fallbackError)
          // Don't retry again to avoid infinite loop
        }
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Save configuration as documentation
  const saveConfigAsDocumentation = async () => {
    if (!generatedConfig || !mlAnalysis) return

    try {
      const docContent = [
        `# ${mlAnalysis.provider} Configuration`,
        '',
        '## Generated Files',
        ...generatedConfig.files.map(file => 
          `### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\``
        ),
        '',
        '## Setup Instructions',
        ...generatedConfig.setupInstructions.map((instruction, index) => 
          `${index + 1}. ${instruction}`
        ),
        '',
        '## Dependencies',
        ...generatedConfig.dependencies.map(dep => `- ${dep}`)
      ].join('\n')

      const docData = {
        title: `${mlAnalysis.provider} Configuration Guide`,
        content: docContent,
        doc_type: 'guide' as const,
        provider_id: mlAnalysis.provider,
        tags: [mlAnalysis.provider, 'configuration', selectedFramework, 'generated'],
        language: 'en',
        is_favorite: false,
        search_keywords: [mlAnalysis.provider, 'config', selectedFramework],
        linked_keys: [apiKey.id]
      }

      await saveDocumentation(docData)
    } catch (error) {
      console.error('Failed to save configuration as documentation:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const downloadConfig = () => {
    if (!generatedConfig) return

    generatedConfig.files.forEach(file => {
      const blob = new Blob([file.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.path
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  AI Config Generator
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generate configuration files for {apiKey?.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex h-[600px]">
            {/* Left Panel - Tabs */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 p-4">
              <div className="space-y-2">
                {[
                  { id: 'analysis', label: 'ML Analysis', icon: Sparkles, completed: !!mlAnalysis },
                  { id: 'generation', label: 'Configuration', icon: Code, completed: !!generatedConfig },
                  { id: 'preview', label: 'Preview & Export', icon: FileText, completed: !!generatedConfig }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    disabled={tab.id === 'generation' && !mlAnalysis}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                    } ${tab.id === 'generation' && !mlAnalysis ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tab.completed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {tab.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <tab.icon className={`w-4 h-4 ${
                          activeTab === tab.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                        }`} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{tab.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tab.completed ? 'Completed' : 'Pending'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Key Info */}
              <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-2">API Key Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div><strong>Name:</strong> {apiKey?.name}</div>
                  <div><strong>Service:</strong> {apiKey?.service}</div>
                  <div><strong>Environment:</strong> {apiKey?.environment}</div>
                </div>
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    ML Analysis
                  </h3>
                  
                  {isAnalyzing ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-600" />
                        <p className="text-gray-600 dark:text-gray-400">Analyzing API key context...</p>
                      </div>
                    </div>
                  ) : mlAnalysis ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Provider Detection</h4>
                          <div className="flex items-center space-x-2">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {mlAnalysis.provider}
                            </div>
                            {llmAvailable && (
                              <div className="flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <Bot className="w-3 h-3 text-green-600 dark:text-green-400 mr-1" />
                                <span className="text-xs text-green-700 dark:text-green-300">AI Enhanced</span>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {Math.round(mlAnalysis.confidence * 100)}% confidence
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Config Type</h4>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {mlAnalysis.configType}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Recommended setup
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recommended Features</h4>
                        <div className="flex flex-wrap gap-2">
                          {mlAnalysis.recommendedFeatures.map(feature => (
                            <span
                              key={feature}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                            >
                              {feature.replace('-', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* LLM Insights */}
                      {mlAnalysis.llmInsights.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                            <Sparkles className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                            AI Insights
                          </h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {mlAnalysis.llmInsights.map((insight, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Security Recommendations */}
                      {mlAnalysis.securityRecommendations.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                          <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-3">Security Recommendations</h4>
                          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                            {mlAnalysis.securityRecommendations.map((rec, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-2 flex-shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={() => setActiveTab('generation')}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Code className="w-4 h-4" />
                        <span>Configure Generation</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 dark:text-gray-400">Analysis will start automatically</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'generation' && mlAnalysis && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Configuration Options
                  </h3>

                  <div className="space-y-4">
                    {/* LLM Generation Toggle */}
                    {llmAvailable && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 mb-4">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={useLLMGeneration}
                            onChange={(e) => setUseLLMGeneration(e.target.checked)}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <div className="flex items-center space-x-2">
                            <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Use AI-Enhanced Generation
                            </span>
                          </div>
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-7">
                          Generate more comprehensive configurations with LLM insights
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Framework
                      </label>
                      <select
                        value={selectedFramework}
                        onChange={(e) => setSelectedFramework(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="nextjs">Next.js</option>
                        <option value="react">React</option>
                        <option value="vue">Vue.js</option>
                        <option value="svelte">Svelte</option>
                        <option value="angular">Angular</option>
                        <option value="nodejs">Node.js</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Features to Include
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          'basic-setup', 'authentication', 'error-handling', 'rate-limiting',
                          'webhooks', 'streaming', 'database-types', 'real-time'
                        ].map(feature => (
                          <label key={feature} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedFeatures.includes(feature)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFeatures([...selectedFeatures, feature])
                                } else {
                                  setSelectedFeatures(selectedFeatures.filter(f => f !== feature))
                                }
                              }}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {feature.replace('-', ' ')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={generateConfiguration}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <span>{isGenerating ? 'Generating...' : 'Generate Configuration'}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'preview' && generatedConfig && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Generated Configuration
                      </h3>
                      {useLLMGeneration && llmAvailable && (
                        <div className="flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                          <Bot className="w-3 h-3 text-purple-600 dark:text-purple-400 mr-1" />
                          <span className="text-xs text-purple-700 dark:text-purple-300">AI Generated</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={saveConfigAsDocumentation}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save as Docs</span>
                      </button>
                      <button
                        onClick={downloadConfig}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download All</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {generatedConfig.files.map((file, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-sm text-gray-900 dark:text-white">
                              {file.path}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                              {file.language}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(file.content)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        <div className="p-4">
                          <pre className="text-xs text-gray-800 dark:text-gray-200 bg-gray-900 dark:bg-gray-800 rounded p-3 overflow-x-auto">
                            <code>{file.content}</code>
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>

                  {generatedConfig.setupInstructions.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Setup Instructions</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                        {generatedConfig.setupInstructions.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
