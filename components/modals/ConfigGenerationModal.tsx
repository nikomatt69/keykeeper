import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, LayoutGroup, Variants } from 'framer-motion'
import {
  X, Code, Download, Sparkles, FileText, Copy, CheckCircle, Loader2, Wand2, Bot,
  Save, BookOpen, ArrowRight, ArrowLeft, Search, Zap, Eye, Settings,
  ChevronDown, ChevronRight, AlertCircle, Info, Play, Palette, Check,
  MonitorSpeaker, Layers, Cpu, Server, Database, Shield
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { ApiProviderService, GeneratedConfig } from '../../lib/services/apiProviderService'
import { useMLEngine, useLLMDocumentation } from '../../lib/hooks/useMLEngine'
import { enhancedTemplateService } from '../../lib/services/enhancedTemplateService'
import { frameworkDetectionService } from '../../lib/services/frameworkDetectionService'
import { invoke } from '@tauri-apps/api/core'
import type { ContextInfo, GeneratedConfigTemplate } from '../../lib/tauri-api'
import type {
  EnhancedGenerationRequest,
  EnhancedGenerationResult,
  FrameworkDetectionResult,
  TemplateSuggestion,
  GenerationProgress,
  GeneratedTemplateFile,
  TemplateValidationResult
} from '../../lib/types/enhanced-templates'

interface ConfigGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  apiKey: any
}

// Wizard step definitions
type WizardStepId = 'detection' | 'templates' | 'configuration' | 'preview' | 'generation'

interface WizardStep {
  id: WizardStepId
  title: string
  description: string
  icon: any
  isComplete: boolean
  isActive: boolean
  canSkip?: boolean
}

interface WizardState {
  currentStep: WizardStepId
  steps: WizardStep[]
  formData: {
    detectedFrameworks: FrameworkDetectionResult[]
    selectedFramework?: string
    selectedTemplate?: TemplateSuggestion
    selectedFeatures: string[]
    customSettings: Record<string, any>
  }
  isGenerating: boolean
  progress?: GenerationProgress
  result?: EnhancedGenerationResult
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
  // Wizard state management
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'detection',
    steps: [
      { id: 'detection', title: 'Framework Detection', description: 'Analyzing your project', icon: Search, isComplete: false, isActive: true },
      { id: 'templates', title: 'Template Selection', description: 'Choose your template', icon: Palette, isComplete: false, isActive: false },
      { id: 'configuration', title: 'Configuration', description: 'Customize settings', icon: Settings, isComplete: false, isActive: false },
      { id: 'preview', title: 'Preview', description: 'Review your config', icon: Eye, isComplete: false, isActive: false },
      { id: 'generation', title: 'Generation', description: 'Generate files', icon: Zap, isComplete: false, isActive: false }
    ],
    formData: {
      detectedFrameworks: [],
      selectedFeatures: [],
      customSettings: {}
    },
    isGenerating: false
  })

  // Legacy states for compatibility
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [mlAnalysis, setMlAnalysis] = useState<EnhancedMLAnalysis | null>(null)
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null)
  const [llmConfigTemplate, setLlmConfigTemplate] = useState<GeneratedConfigTemplate | null>(null)
  const [selectedFramework, setSelectedFramework] = useState('nextjs')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'analysis' | 'generation' | 'preview'>('analysis')
  const [useLLMGeneration, setUseLLMGeneration] = useState(true)

  // New enhanced states
  const [templateSuggestions, setTemplateSuggestions] = useState<TemplateSuggestion[]>([])
  const [validationResults, setValidationResults] = useState<TemplateValidationResult | null>(null)
  const [previewFiles, setPreviewFiles] = useState<GeneratedTemplateFile[]>([])
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const frameworkToLanguageMap = {
    'react': 'typescript',
    'vue': 'typescript',
    'angular': 'typescript',
    'node': 'javascript',
    'express': 'javascript',
    'next': 'typescript',
    'nuxt': 'typescript',
    'nextjs': 'typescript',
    'svelte': 'typescript'
  };

  // Enhanced glassmorphism animation variants
  const glassVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: 60,
      filter: 'blur(10px)'
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 400,
        duration: 0.8,
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -30,
      filter: 'blur(10px)',
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  }

  const stepVariants = {
    hidden: {
      opacity: 0,
      x: 100,
      filter: 'blur(8px)',
      scale: 0.95
    },
    visible: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      scale: 1,
      transition: {
        type: "spring",
        damping: 35,
        stiffness: 500,
        duration: 0.6
      }
    },
    exit: {
      opacity: 0,
      x: -100,
      filter: 'blur(8px)',
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  }

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.95,
      filter: 'blur(5px)'
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 400
      }
    },
    hover: {
      y: -8,
      scale: 1.02,
      boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    },
    tap: {
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  }

  const progressVariants = {
    hidden: { width: 0 },
    visible: {
      width: '100%',
      transition: {
        duration: 1,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  }

  // Wizard navigation functions
  const goToNextStep = useCallback(() => {
    const currentIndex = wizardState.steps.findIndex(step => step.id === wizardState.currentStep)
    if (currentIndex < wizardState.steps.length - 1) {
      const nextStep = wizardState.steps[currentIndex + 1]
      setWizardState(prev => ({
        ...prev,
        currentStep: nextStep.id,
        steps: prev.steps.map((step, index) => ({
          ...step,
          isActive: index === currentIndex + 1,
          isComplete: index <= currentIndex ? true : step.isComplete
        }))
      }))
    }
  }, [wizardState])

  const goToPreviousStep = useCallback(() => {
    const currentIndex = wizardState.steps.findIndex(step => step.id === wizardState.currentStep)
    if (currentIndex > 0) {
      const previousStep = wizardState.steps[currentIndex - 1]
      setWizardState(prev => ({
        ...prev,
        currentStep: previousStep.id,
        steps: prev.steps.map((step, index) => ({
          ...step,
          isActive: index === currentIndex - 1,
          isComplete: index < currentIndex - 1 ? true : false
        }))
      }))
    }
  }, [wizardState])

  const goToStep = useCallback((stepId: WizardStepId) => {
    setWizardState(prev => ({
      ...prev,
      currentStep: stepId,
      steps: prev.steps.map(step => ({
        ...step,
        isActive: step.id === stepId
      }))
    }))
  }, [])

  // Progress tracking callback
  const onProgressUpdate = useCallback((progress: GenerationProgress) => {
    setWizardState(prev => ({ ...prev, progress }))
  }, [])

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
    if (isOpen && apiKey) {
      // Reset wizard state when modal opens
      setWizardState(prev => ({
        ...prev,
        currentStep: 'detection',
        steps: prev.steps.map((step, index) => ({
          ...step,
          isActive: index === 0,
          isComplete: false
        })),
        formData: {
          detectedFrameworks: [],
          selectedFeatures: [],
          customSettings: {}
        },
        isGenerating: false,
        progress: undefined,
        result: undefined
      }))

      // Start framework detection automatically
      if (!isAnalyzing && !mlAnalysis) {
        performFrameworkDetection()
      }
    }
  }, [isOpen, apiKey])

  // Enhanced framework detection using new service
  const performFrameworkDetection = async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)

    try {
      // Detect frameworks using enhanced service
      const detectedFrameworks = await frameworkDetectionService.detectFrameworks('./')

      // Get template suggestions based on API key
      const suggestions = await enhancedTemplateService.getTemplateSuggestions({
        [apiKey.name]: apiKey.key
      })

      // Update wizard state
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          detectedFrameworks
        }
      }))

      setTemplateSuggestions(suggestions)

      // Legacy compatibility
      const analysis: EnhancedMLAnalysis = {
        provider: apiKey.service,
        confidence: detectedFrameworks[0]?.confidence || 0.6,
        suggestedFramework: detectedFrameworks[0]?.framework || 'nextjs',
        recommendedFeatures: getRecommendedFeatures(apiKey.service),
        configType: getConfigType(apiKey.service),
        llmInsights: ['AI-enhanced detection completed'],
        securityRecommendations: ['Store API keys in environment variables', 'Enable rate limiting'],
        bestPractices: ['Use TypeScript for better type safety', 'Implement proper error handling']
      }

      setMlAnalysis(analysis)
      setSelectedFramework(analysis.suggestedFramework)
      setSelectedFeatures(analysis.recommendedFeatures)

      // Complete detection step and move to templates
      setTimeout(() => {
        goToNextStep()
      }, 1500)

    } catch (error) {
      console.error('Framework detection failed:', error)
      // Fallback analysis
      const fallbackAnalysis: EnhancedMLAnalysis = {
        provider: apiKey.service,
        confidence: 0.6,
        suggestedFramework: 'nextjs',
        recommendedFeatures: ['basic-setup'],
        configType: 'client',
        llmInsights: ['Using fallback detection'],
        securityRecommendations: ['Implement proper error handling'],
        bestPractices: ['Use TypeScript for better type safety']
      }
      setMlAnalysis(fallbackAnalysis)
      setSelectedFramework('nextjs')
      setSelectedFeatures(['basic-setup'])
      goToNextStep()
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
    setWizardState(prev => ({ ...prev, isGenerating: true }))

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
            files: llmTemplate.files.map(file => {
              const fileType: 'config' | 'code' | 'documentation' =
                file.file_type === 'config' || file.file_type === 'code' || file.file_type === 'documentation'
                  ? file.file_type
                  : 'documentation';

              return {
                path: file.path,
                file_type: fileType,
                content: file.content,
                language: fileType === 'code'
                  ? (frameworkToLanguageMap[selectedFramework as keyof typeof frameworkToLanguageMap] || 'typescript')
                  : 'text'
              };
            }),
            setupInstructions: llmTemplate.setup_instructions,
            dependencies: llmTemplate.dependencies,
            nextSteps: []
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

    } catch (error) {
      console.error('Configuration generation failed:', error)
    } finally {
      setIsGenerating(false)
      setWizardState(prev => ({ ...prev, isGenerating: false }))
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
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex fixed inset-0 z-50 justify-center items-center p-4"
        onClick={onClose}
      >
        {/* Enhanced glassmorphism backdrop */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br backdrop-blur-xl from-purple-900/20 via-blue-900/30 to-indigo-900/40"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.5 }}
        />

        {/* Floating particles effect */}
        <div className="overflow-hidden absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-white/10"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [-20, -100, -20],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <motion.div
          variants={glassVariants as unknown as Variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-6xl max-h-[95vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Liquid glass container */}
          <div className="overflow-hidden relative rounded-3xl border shadow-2xl backdrop-blur-2xl bg-white/5 border-white/10">
            {/* Holographic gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br via-transparent pointer-events-none from-white/5 to-purple-500/5" />

            {/* Inner glass effect */}
            <div className="absolute inset-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-3xl" />

            {/* Enhanced glassmorphism header */}
            <motion.div
              className="relative p-8 border-b border-white/10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              {/* Header background blur */}
              <div className="absolute inset-0 backdrop-blur-sm bg-white/5" />

              <div className="flex relative justify-between items-center">
                <div className="flex items-center space-x-4">
                  {/* Holographic icon */}
                  <motion.div
                    className="flex relative justify-center items-center w-14 h-14 rounded-2xl"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br rounded-2xl blur-xl from-purple-400/30 to-blue-500/30" />
                    <div className="flex relative justify-center items-center w-full h-full rounded-2xl border backdrop-blur-sm bg-white/10 border-white/20">
                      <Wand2 className="w-7 h-7 text-white drop-shadow-lg" />
                    </div>
                  </motion.div>

                  <div>
                    <motion.h2
                      className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 drop-shadow-sm"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      AI Config Generator
                    </motion.h2>
                    <motion.p
                      className="mt-1 text-sm text-white/60"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      Generate configuration files for <span className="font-medium text-white/80">{apiKey?.name}</span>
                    </motion.p>
                  </div>
                </div>

                {/* Enhanced close button */}
                <motion.button
                  onClick={onClose}
                  className="relative p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 bg-white/5 border-white/10 hover:bg-white/10"
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5 text-white/70" />
                </motion.button>
              </div>

              {/* Progress indicator */}
              <motion.div
                className="overflow-hidden mt-6 h-1 rounded-full bg-white/10"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"
                  style={{
                    width: `${((wizardState.steps.findIndex(s => s.id === wizardState.currentStep) + 1) / wizardState.steps.length) * 100}%`
                  }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((wizardState.steps.findIndex(s => s.id === wizardState.currentStep) + 1) / wizardState.steps.length) * 100}%`
                  }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                />
              </motion.div>
            </motion.div>

            {/* Enhanced wizard layout */}
            <div className="flex min-h-[700px]">
              {/* Left Panel - Wizard Steps */}
              <motion.div
                className="p-6 w-80 border-r border-white/10"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                {/* Step navigation */}
                <div className="space-y-3">
                  <h3 className="mb-6 text-lg font-semibold text-white/90">Generation Steps</h3>

                  <LayoutGroup>
                    {wizardState.steps.map((step, index) => {
                      const Icon = step.icon
                      const isCompleted = step.isComplete
                      const isActive = step.id === wizardState.currentStep
                      const canAccess = index === 0 || wizardState.steps[index - 1].isComplete

                      return (
                        <motion.div
                          key={step.id}
                          layoutId={`step-${step.id}`}
                          className="relative"
                        >
                          <motion.button
                            onClick={() => canAccess && goToStep(step.id)}
                            disabled={!canAccess}
                            className={`w-full p-4 rounded-2xl text-left transition-all duration-300 ${isActive
                              ? 'border shadow-lg backdrop-blur-sm bg-white/15 border-white/20'
                              : isCompleted
                                ? 'border bg-green-500/10 border-green-400/20 hover:bg-green-500/15'
                                : canAccess
                                  ? 'border bg-white/5 border-white/10 hover:bg-white/10'
                                  : 'border opacity-50 cursor-not-allowed bg-white/5 border-white/5'
                              }`}
                            whileHover={canAccess ? { scale: 1.02, y: -2 } : {}}
                            whileTap={canAccess ? { scale: 0.98 } : {}}
                          >
                            {/* Step connector line */}
                            {index > 0 && (
                              <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 w-0.5 h-3 ${isCompleted || isActive ? 'bg-gradient-to-b from-green-400 to-blue-400' : 'bg-white/20'
                                }`} />
                            )}

                            <div className="flex items-center space-x-3">
                              {/* Step icon */}
                              <motion.div
                                className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${isCompleted
                                  ? 'border bg-green-500/20 border-green-400/30'
                                  : isActive
                                    ? 'border bg-purple-500/20 border-purple-400/30'
                                    : 'border bg-white/10 border-white/20'
                                  }`}
                                whileHover={{ rotate: 10 }}
                              >
                                {isCompleted ? (
                                  <Check className="w-5 h-5 text-green-400" />
                                ) : (
                                  <Icon className={`w-5 h-5 ${isActive ? 'text-purple-300' : 'text-white/60'
                                    }`} />
                                )}

                                {/* Active pulse */}
                                {isActive && (
                                  <motion.div
                                    className="absolute inset-0 rounded-xl bg-purple-400/20"
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                              </motion.div>

                              <div className="flex-1">
                                <div className={`text-sm font-medium ${isActive ? 'text-white' : isCompleted ? 'text-green-300' : 'text-white/70'
                                  }`}>
                                  {step.title}
                                </div>
                                <div className={`text-xs mt-1 ${isActive ? 'text-white/80' : 'text-white/50'
                                  }`}>
                                  {step.description}
                                </div>
                              </div>

                              {/* Step number */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${isCompleted ? 'text-green-300 bg-green-500/20' :
                                isActive ? 'text-purple-300 bg-purple-500/20' :
                                  'bg-white/10 text-white/50'
                                }`}>
                                {index + 1}
                              </div>
                            </div>
                          </motion.button>
                        </motion.div>
                      )
                    })}
                  </LayoutGroup>
                </div>

                {/* Enhanced API Key Info */}
                <motion.div
                  className="p-4 mt-8 rounded-2xl border backdrop-blur-sm bg-white/5 border-white/10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.6 }}
                >
                  <h4 className="flex items-center mb-3 text-sm font-semibold text-white/90">
                    <Shield className="mr-2 w-4 h-4 text-blue-400" />
                    API Key Details
                  </h4>
                  <div className="space-y-2 text-xs text-white/60">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-medium text-white/80">{apiKey?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service:</span>
                      <span className="font-medium text-white/80">{apiKey?.service}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Environment:</span>
                      <span className="font-medium text-white/80">{apiKey?.environment}</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Panel - Step Content */}
              <motion.div
                className="overflow-y-auto flex-1 p-8"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <AnimatePresence mode="wait">
                  {wizardState.currentStep === 'detection' && (
                    <motion.div
                      key="detection"
                      variants={stepVariants as unknown as Variants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="h-full"
                    >
                      {renderDetectionStep()}
                    </motion.div>
                  )}

                  {wizardState.currentStep === 'templates' && (
                    <motion.div
                      key="templates"
                      variants={stepVariants as unknown as Variants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="h-full"
                    >
                      {renderTemplateSelectionStep()}
                    </motion.div>
                  )}

                  {wizardState.currentStep === 'configuration' && (
                    <motion.div
                      key="configuration"
                      variants={stepVariants as unknown as Variants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="h-full"
                    >
                      {renderConfigurationStep()}
                    </motion.div>
                  )}

                  {wizardState.currentStep === 'preview' && (
                    <motion.div
                      key="preview"
                      variants={stepVariants as unknown as Variants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="h-full"
                    >
                      {renderPreviewStep()}
                    </motion.div>
                  )}

                  {wizardState.currentStep === 'generation' && (
                    <motion.div
                      key="generation"
                      variants={stepVariants as unknown as Variants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="h-full"
                    >
                      {renderGenerationStep()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  // Step rendering functions
  function renderDetectionStep() {
    return (
      <div className="space-y-6">
        <div className="mb-8 text-center">
          <motion.h3
            className="mb-2 text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Framework Detection
          </motion.h3>
          <motion.p
            className="text-white/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Analyzing your project structure and detecting frameworks...
          </motion.p>
        </div>

        {isAnalyzing ? (
          <div className="flex flex-col justify-center items-center py-16 space-y-6">
            <motion.div
              className="relative w-20 h-20"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 border-r-blue-400 border-l-transparent" />
            </motion.div>

            <motion.div className="text-center">
              <motion.p
                className="text-lg font-medium text-white/90"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Analyzing project structure...
              </motion.p>
              <p className="mt-2 text-sm text-white/60">This may take a few moments</p>
            </motion.div>
          </div>
        ) : wizardState.formData.detectedFrameworks.length > 0 ? (
          <div className="space-y-6">
            <motion.div
              className="grid gap-4"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
              initial="hidden"
              animate="visible"
            >
              {wizardState.formData.detectedFrameworks.map((framework, index) => (
                <motion.div
                  key={framework.framework}
                  variants={cardVariants as unknown as Variants}
                  className="p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 bg-white/5 border-white/10 hover:border-white/20"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="flex justify-center items-center w-12 h-12 bg-gradient-to-br rounded-xl border from-purple-400/20 to-blue-500/20 border-white/20">
                        <Cpu className="w-6 h-6 text-white/80" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white capitalize">
                          {framework.framework.replace(/js$/, '.js')}
                        </h4>
                        <p className="text-sm text-white/60">
                          Detected with {Math.round(framework.confidence * 100)}% confidence
                        </p>
                      </div>
                    </div>

                    {/* Confidence indicator */}
                    <div className="flex items-center space-x-3">
                      <div className="overflow-hidden w-24 h-2 rounded-full bg-white/10">
                        <motion.div
                          className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${framework.confidence * 100}%` }}
                          transition={{ delay: index * 0.1, duration: 0.8 }}
                        />
                      </div>
                      <span className="text-sm font-medium text-white/80">
                        {Math.round(framework.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Evidence */}
                  {framework.evidence && framework.evidence.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-white/10">
                      <h5 className="mb-2 text-sm font-medium text-white/80">Evidence:</h5>
                      <div className="flex flex-wrap gap-2">
                        {framework.evidence.slice(0, 3).map((evidence, evidenceIndex) => (
                          <span
                            key={evidenceIndex}
                            className="px-2 py-1 text-xs rounded-lg border bg-white/10 border-white/20 text-white/70"
                          >
                            {evidence.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Continue button */}
            <motion.div
              className="flex justify-center pt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.button
                onClick={goToNextStep}
                className="px-8 py-3 font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-2">
                  <span>Continue to Templates</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </motion.button>
            </motion.div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center items-center mx-auto mb-6 w-24 h-24 rounded-full border bg-amber-500/10 border-amber-400/20"
            >
              <AlertCircle className="w-12 h-12 text-amber-400" />
            </motion.div>
            <h3 className="mb-2 text-xl font-semibold text-white">No Frameworks Detected</h3>
            <p className="mb-6 text-white/60">We couldn&apos;t automatically detect any frameworks in your project.</p>
            <motion.button
              onClick={goToNextStep}
              className="px-6 py-3 text-white rounded-xl border backdrop-blur-sm transition-all duration-300 bg-white/10 border-white/20 hover:bg-white/15"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue Manually
            </motion.button>
          </div>
        )}
      </div>
    )
  }

  function renderTemplateSelectionStep() {
    return (
      <div className="space-y-6">
        <div className="mb-8 text-center">
          <motion.h3
            className="mb-2 text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Template Selection
          </motion.h3>
          <motion.p
            className="text-white/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Choose a configuration template that best fits your project
          </motion.p>
        </div>

        {templateSuggestions.length > 0 ? (
          <motion.div
            className="grid gap-4"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            {templateSuggestions.map((template, index) => (
              <motion.button
                key={template.templateId}
                variants={cardVariants as any}
                whileHover="hover"
                whileTap="tap"
                onClick={() => {
                  setWizardState(prev => ({
                    ...prev,
                    formData: {
                      ...prev.formData,
                      selectedTemplate: template
                    }
                  }))
                  goToNextStep()
                }}
                className={`p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 text-left transition-all duration-300 ${wizardState.formData.selectedTemplate?.templateId === template.templateId
                  ? 'border-purple-400/50 bg-purple-500/10'
                  : ''
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-1 items-start space-x-4">
                    <div className="flex flex-shrink-0 justify-center items-center w-14 h-14 bg-gradient-to-br rounded-2xl border from-purple-400/20 to-blue-500/20 border-white/20">
                      <Palette className="w-7 h-7 text-white/80" />
                    </div>
                    <div className="flex-1">
                      <h4 className="mb-1 text-lg font-semibold text-white">
                        {template.templateName}
                      </h4>
                      <p className="mb-3 text-sm text-white/60">
                        {template.reason}
                      </p>

                      <div className="flex items-center space-x-4 text-xs text-white/50">
                        <div className="flex items-center space-x-1">
                          <MonitorSpeaker className="w-3 h-3" />
                          <span>{template.framework}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Settings className="w-3 h-3" />
                          <span>{template.difficultyLevel}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Zap className="w-3 h-3" />
                          <span>{template.estimatedSetupTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    {/* Confidence badge */}
                    <div className="px-3 py-1 rounded-full border bg-green-500/20 border-green-400/30">
                      <span className="text-xs font-medium text-green-300">
                        {Math.round(template.confidence * 100)}% match
                      </span>
                    </div>

                    {/* Tags */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-w-32">
                        {template.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs rounded-md border bg-white/10 border-white/20 text-white/70"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <div className="py-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center items-center mx-auto mb-6 w-24 h-24 rounded-full border bg-blue-500/10 border-blue-400/20"
            >
              <Palette className="w-12 h-12 text-blue-400" />
            </motion.div>
            <h3 className="mb-2 text-xl font-semibold text-white">Loading Templates...</h3>
            <p className="text-white/60">Finding the best templates for your project</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-8">
          <motion.button
            onClick={goToPreviousStep}
            className="px-6 py-3 text-white rounded-xl border backdrop-blur-sm transition-all duration-300 bg-white/10 border-white/20 hover:bg-white/15"
            whileHover={{ scale: 1.02, x: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </div>
          </motion.button>

          {wizardState.formData.selectedTemplate && (
            <motion.button
              onClick={goToNextStep}
              className="px-8 py-3 font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center space-x-2">
                <span>Configure Template</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          )}
        </div>
      </div>
    )
  }

  function renderConfigurationStep() {
    return (
      <div className="space-y-6">
        <div className="mb-8 text-center">
          <motion.h3
            className="mb-2 text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Configuration Options
          </motion.h3>
          <motion.p
            className="text-white/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Customize your template settings and features
          </motion.p>
        </div>

        <div className="space-y-6">
          {/* LLM Generation Toggle */}
          {llmAvailable && (
            <motion.div
              className="p-6 bg-gradient-to-br rounded-2xl border from-purple-500/10 to-blue-500/10 border-purple-400/20"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <label className="flex items-center space-x-4 cursor-pointer">
                <motion.div
                  className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${useLLMGeneration ? 'bg-purple-500' : 'bg-white/20'
                    }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-4 h-4 bg-white rounded-full shadow-lg"
                    animate={{ x: useLLMGeneration ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </motion.div>
                <div className="flex items-center space-x-3">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <div>
                    <span className="font-medium text-white">AI-Enhanced Generation</span>
                    <p className="text-sm text-white/60">Generate more comprehensive configurations with LLM insights</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useLLMGeneration}
                  onChange={(e) => setUseLLMGeneration(e.target.checked)}
                  className="sr-only"
                />
              </label>
            </motion.div>
          )}

          {/* Framework Selection */}
          <motion.div
            className="p-6 rounded-2xl border backdrop-blur-sm bg-white/5 border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="block mb-4 font-medium text-white/90">Framework</label>
            <div className="grid grid-cols-3 gap-3">
              {['nextjs', 'react', 'vue', 'svelte', 'angular', 'nodejs'].map((framework) => (
                <motion.button
                  key={framework}
                  onClick={() => setSelectedFramework(framework)}
                  className={`p-4 rounded-xl border transition-all duration-300 ${selectedFramework === framework
                    ? 'bg-purple-500/20 border-purple-400/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                    }`}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-center">
                    <div className="flex justify-center items-center mx-auto mb-2 w-8 h-8 rounded-lg bg-white/10">
                      <Code className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium capitalize">
                      {framework.replace('js', '.js')}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Feature Selection */}
          <motion.div
            className="p-6 rounded-2xl border backdrop-blur-sm bg-white/5 border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="block mb-4 font-medium text-white/90">Features to Include</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'basic-setup', label: 'Basic Setup', icon: Settings },
                { id: 'authentication', label: 'Authentication', icon: Shield },
                { id: 'error-handling', label: 'Error Handling', icon: AlertCircle },
                { id: 'rate-limiting', label: 'Rate Limiting', icon: Zap },
                { id: 'webhooks', label: 'Webhooks', icon: Server },
                { id: 'streaming', label: 'Streaming', icon: Play },
                { id: 'database-types', label: 'Database Types', icon: Database },
                { id: 'real-time', label: 'Real-time', icon: Layers }
              ].map((feature) => {
                const Icon = feature.icon
                const isSelected = selectedFeatures.includes(feature.id)

                return (
                  <motion.button
                    key={feature.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFeatures(selectedFeatures.filter(f => f !== feature.id))
                      } else {
                        setSelectedFeatures([...selectedFeatures, feature.id])
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all duration-300 text-left ${isSelected
                      ? 'text-white bg-blue-500/20 border-blue-400/50'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                      }`}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-400/20' : 'bg-white/10'
                        }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">{feature.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto"
                        >
                          <Check className="w-4 h-4 text-blue-400" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-8">
          <motion.button
            onClick={goToPreviousStep}
            className="px-6 py-3 text-white rounded-xl border backdrop-blur-sm transition-all duration-300 bg-white/10 border-white/20 hover:bg-white/15"
            whileHover={{ scale: 1.02, x: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </div>
          </motion.button>

          <motion.button
            onClick={goToNextStep}
            className="px-8 py-3 font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <span>Preview Configuration</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>
        </div>
      </div>
    )
  }

  function renderPreviewStep() {
    return (
      <div className="space-y-6">
        <div className="mb-8 text-center">
          <motion.h3
            className="mb-2 text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Configuration Preview
          </motion.h3>
          <motion.p
            className="text-white/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Review your configuration before generation
          </motion.p>
        </div>

        {/* Configuration Summary */}
        <motion.div
          className="p-6 rounded-2xl border backdrop-blur-sm bg-white/5 border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h4 className="flex items-center mb-4 font-semibold text-white">
            <Eye className="mr-2 w-5 h-5 text-blue-400" />
            Configuration Summary
          </h4>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h5 className="mb-2 font-medium text-white/80">Framework</h5>
              <div className="p-3 rounded-xl border bg-white/5 border-white/10">
                <span className="text-white capitalize">{selectedFramework.replace('js', '.js')}</span>
              </div>
            </div>

            <div>
              <h5 className="mb-2 font-medium text-white/80">Template</h5>
              <div className="p-3 rounded-xl border bg-white/5 border-white/10">
                <span className="text-white">{wizardState.formData.selectedTemplate?.templateName || 'Default'}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h5 className="mb-2 font-medium text-white/80">Selected Features</h5>
            <div className="flex flex-wrap gap-2">
              {selectedFeatures.map(feature => (
                <span
                  key={feature}
                  className="px-3 py-1 text-sm text-blue-300 rounded-lg border bg-blue-500/20 border-blue-400/30"
                >
                  {feature.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between pt-8">
          <motion.button
            onClick={goToPreviousStep}
            className="px-6 py-3 text-white rounded-xl border backdrop-blur-sm transition-all duration-300 bg-white/10 border-white/20 hover:bg-white/15"
            whileHover={{ scale: 1.02, x: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </div>
          </motion.button>

          <motion.button
            onClick={goToNextStep}
            className="px-8 py-3 font-semibold text-white bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <span>Generate Configuration</span>
              <Wand2 className="w-4 h-4" />
            </div>
          </motion.button>
        </div>
      </div>
    )
  }

  function renderGenerationStep() {
    return (
      <div className="space-y-6">
        <div className="mb-8 text-center">
          <motion.h3
            className="mb-2 text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Generating Configuration
          </motion.h3>
          <motion.p
            className="text-white/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Creating your customized configuration files...
          </motion.p>
        </div>

        {wizardState.isGenerating ? (
          <div className="py-16 text-center">
            <motion.div
              className="relative mx-auto mb-8 w-32 h-32"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-t-purple-400 border-r-blue-400 border-b-green-400 border-l-transparent" />
            </motion.div>

            {wizardState.progress && (
              <div className="space-y-4">
                <motion.p
                  className="text-lg font-medium text-white"
                  key={wizardState.progress.currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {wizardState.progress.statusMessage}
                </motion.p>

                <div className="mx-auto w-64">
                  <div className="flex justify-between mb-2 text-sm text-white/60">
                    <span>Step {wizardState.progress.currentStepNumber} of {wizardState.progress.totalSteps}</span>
                    <span>{wizardState.progress.progress}%</span>
                  </div>
                  <div className="overflow-hidden h-3 rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${wizardState.progress.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : generatedConfig ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Success message */}
            <motion.div
              className="p-6 text-center rounded-2xl border bg-green-500/10 border-green-400/20"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="flex justify-center items-center mx-auto mb-4 w-16 h-16 rounded-full border bg-green-500/20 border-green-400/30"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              >
                <CheckCircle className="w-8 h-8 text-green-400" />
              </motion.div>
              <h4 className="mb-2 text-xl font-semibold text-white">Configuration Generated!</h4>
              <p className="text-white/70">Your customized configuration files are ready</p>
            </motion.div>

            {/* Generated files preview */}
            <div className="space-y-4">
              <h4 className="flex items-center font-semibold text-white">
                <FileText className="mr-2 w-5 h-5 text-blue-400" />
                Generated Files ({generatedConfig.files.length})
              </h4>

              <div className="overflow-y-auto space-y-3 max-h-96">
                {generatedConfig.files.map((file, index) => (
                  <motion.div
                    key={index}
                    className="p-4 rounded-xl border backdrop-blur-sm bg-white/5 border-white/10"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-white/60" />
                        <span className="font-medium text-white">{file.path}</span>
                        <span className="px-2 py-1 text-xs text-blue-300 rounded border bg-blue-500/20 border-blue-400/30">
                          {file.language}
                        </span>
                      </div>
                      <motion.button
                        onClick={() => copyToClipboard(file.content)}
                        className="p-2 rounded-lg transition-all duration-200 bg-white/5 hover:bg-white/10"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Copy className="w-4 h-4 text-white/60" />
                      </motion.button>
                    </div>
                    <div className="overflow-x-auto p-3 rounded-lg bg-gray-900/50">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        <code>{file.content.slice(0, 200)}...</code>
                      </pre>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center pt-6 space-x-4">
              <motion.button
                onClick={saveConfigAsDocumentation}
                className="px-6 py-3 text-blue-300 rounded-xl border transition-all duration-300 bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save as Docs</span>
                </div>
              </motion.button>

              <motion.button
                onClick={downloadConfig}
                className="px-6 py-3 text-green-300 rounded-xl border transition-all duration-300 bg-green-500/20 border-green-400/30 hover:bg-green-500/30"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-2">
                  <Download className="w-4 h-4" />
                  <span>Download All</span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="py-16 text-center">
            <motion.button
              onClick={generateConfiguration}
              className="px-8 py-4 font-semibold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5" />
                <span>Start Generation</span>
              </div>
            </motion.button>
          </div>
        )}
      </div>
    )
  }
}