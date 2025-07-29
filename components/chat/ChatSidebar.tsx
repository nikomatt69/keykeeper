import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Plus,
  Settings,
  Download,
  Code,
  FileText,
  MessageSquare,
  Clock,
  User,
  Bot,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
  Archive,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Wifi
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { ChatMessage, ChatSession, ChatUserPreferences, GeneratedCode } from '../../lib/types'
import ChatSessionList from './ChatSessionList'
import ChatPreferencesModal from './ChatPreferencesModal'
import CodePreviewModal from './CodePreviewModal'
import ChatConnectionModal from './ChatConnectionModal'

interface ChatSidebarProps {
  isMinimized: boolean
  onToggleMinimized: () => void
  className?: string
}

export default function ChatSidebar({
  isMinimized,
  onToggleMinimized,
  className = ''
}: ChatSidebarProps) {
  const {
    chat,
    createChatSession,
    sendChatMessage,
    loadChatMessages,
    loadUserChatSessions,
    setCurrentChatSession,
    updateChatPreferences,
    generateIntegration,
    exportChatSession,
    archiveChatSession,
    deleteChatSession,
    clearChatError
  } = useAppStore()

  const [message, setMessage] = useState('')
  const [showSessionList, setShowSessionList] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showCodePreview, setShowCodePreview] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [selectedCode, setSelectedCode] = useState<GeneratedCode | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load user sessions on mount
  useEffect(() => {
    loadUserChatSessions('default-user') // TODO: Get from auth state
  }, [loadUserChatSessions])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chat.messages, isMinimized])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && !isMinimized) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message, isMinimized])

  const handleCreateSession = async () => {
    try {
      const title = `Chat Session ${new Date().toLocaleTimeString()}`
      await createChatSession(title)
      setShowSessionList(false)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim() || !chat.currentSessionId || chat.isSendingMessage) return

    const messageContent = message.trim()
    setMessage('')

    try {
      await sendChatMessage(chat.currentSessionId, messageContent, false)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  const handleGenerateCode = async (messageContent: string) => {
    if (!chat.currentSessionId) return

    try {
      const requirements = [messageContent]

      await generateIntegration({
        sessionId: chat.currentSessionId,
        providerName: 'OpenAI',
        framework: chat.userPreferences.preferredFramework,
        language: chat.userPreferences.preferredLanguage,
        requirements,
        constraints: []
      })
    } catch (error) {
      console.error('Failed to generate integration:', error)
    }
  }

  const handleViewCode = (generatedCode: GeneratedCode) => {
    setSelectedCode(generatedCode)
    setShowCodePreview(true)
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const unreadCount = chat.messages.filter(msg => msg.role === 'assistant').length

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'
    const isSystem = msg.role === 'system'

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isUser ? 'justify-end pr-4' : 'justify-start pl-4'} mb-4`}
      >
        <div className={`flex max-w-[90%] ${isUser ? 'flex-row-reverse space-x-reverse space-x-2' : 'flex-row space-x-2'} items-start`}>
          {/* Avatar */}
          <div
            className="flex flex-shrink-0 justify-center items-center w-7 h-7 rounded-full"
            style={{
              background: isUser
                ? 'var(--color-accent)'
                : isSystem
                  ? 'var(--color-text-tertiary)'
                  : 'linear-gradient(135deg, var(--color-accent) 0%, #8b5cf6 100%)'
            }}
          >
            {isUser ? (
              <User className="w-3.5 h-3.5 text-white" />
            ) : isSystem ? (
              <Settings className="w-3.5 h-3.5 text-white" />
            ) : (
              <Bot className="w-3.5 h-3.5 text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div
              className={`p-3 glass-card ${isUser
                ? 'text-white'
                : 'text-contrast-high'
                }`}
              style={{
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isUser
                  ? 'var(--color-accent)'
                  : 'var(--color-surface)',
                border: !isUser ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {msg.content}
              </div>

              {/* Context indicators */}
              {msg.context_chunks && msg.context_chunks.length > 0 && (
                <div className="pt-2 mt-2 border-subtle">
                  <div className="flex items-center space-x-1 text-xs text-contrast-medium">
                    <BookOpen className="w-3 h-3" />
                    <span>{msg.context_chunks.length} context sources used</span>
                  </div>
                </div>
              )}

              {/* Generated code */}
              {msg.generated_code && (
                <div className="pt-2 mt-2 border-subtle">
                  <button
                    onClick={() => handleViewCode(msg.generated_code!)}
                    className="flex items-center space-x-2 text-xs btn-secondary hover-lift focus-native"
                    style={{
                      color: 'var(--color-accent)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px'
                    }}
                  >
                    <Code className="w-3 h-3" />
                    <span>View Generated Code ({msg.generated_code.code_blocks.length} files)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Message actions */}
            <div className="flex items-center mt-1 space-x-2">
              <span className="text-xs text-contrast-low">
                {formatTimestamp(msg.created_at)}
              </span>

              <button
                onClick={() => handleCopyMessage(msg.content, msg.id)}
                className="p-1 btn-secondary hover-lift focus-native"
                title="Copy message"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                {copiedMessageId === msg.id ? (
                  <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              {!isUser && (
                <button
                  onClick={() => handleGenerateCode(msg.content)}
                  className="p-1 btn-secondary hover-lift focus-native"
                  title="Generate code from this response"
                  disabled={chat.isGeneratingIntegration}
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-tertiary)'
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Metadata */}
            {msg.metadata && (
              <div className="mt-1 text-xs text-contrast-low space-y-1">
                {msg.metadata.confidence_score && (
                  <div>
                    Confidence: {Math.round(msg.metadata.confidence_score * 100)}%
                  </div>
                )}
                {msg.metadata.provider_used && (
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span>
                      Provider: {(() => {
                        switch (msg.metadata.provider_used) {
                          case 'local': return 'Local Qwen';
                          case 'ollama': return 'Ollama';
                          case 'openai': return 'OpenAI';
                          case 'anthropic': return 'Anthropic';
                          default: return msg.metadata.provider_used;
                        }
                      })()}
                    </span>
                    {msg.metadata.response_time_ms && (
                      <span className="text-contrast-low">
                        ({msg.metadata.response_time_ms}ms)
                      </span>
                    )}
                  </div>
                )}
                {msg.metadata.tokens && (
                  <div>
                    Tokens: {msg.metadata.tokens}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ width: isMinimized ? '60px' : '500px' }}
        animate={{
          width: isMinimized ? '60px' : '500px'
        }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 200,
          duration: 0.4
        }}
        className={`relative flex-shrink-0 h-full border-l-0 sidebar-native smooth-transition ${className}`}
        style={{
          backgroundColor: 'var(--color-background-secondary)',
          backdropFilter: 'var(--blur-lg)',
          WebkitBackdropFilter: 'var(--blur-lg)',
          boxShadow: isMinimized
            ? 'var(--shadow-lg)'
            : 'var(--shadow-xl)'
        }}
      >
        {/* Minimized State - Thin Toolbar */}
        <AnimatePresence mode="wait">
          {isMinimized ? (
            <motion.div
              key="minimized"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center py-4 space-y-4 h-full"
            >
              {/* Toggle Button */}
              <motion.button
                onClick={onToggleMinimized}
                className="p-3 btn-secondary hover-lift focus-native"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Expand chat"
                style={{
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>

              {/* Chat Icon with Badge */}
              <motion.div
                className="relative"
                whileHover={{ scale: 1.1 }}
                animate={{
                  y: [0, -2, 0],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
              >
                <motion.div
                  className="p-3 cursor-pointer glass-card smooth-transition"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-secondary)'
                  }}
                  whileHover={{
                    backgroundColor: 'var(--color-surface-elevated)'
                  }}
                >
                  <MessageSquare className="w-5 h-5" />
                </motion.div>
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{
                      scale: 1
                    }}
                    className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs text-white rounded-full native-shadow"
                    style={{
                      background: 'var(--color-accent)',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
              </motion.div>

              {/* Session Indicator */}
              <motion.button
                onClick={() => setShowSessionList(true)}
                className="p-2 btn-secondary hover-lift focus-native"
                whileHover={{ scale: 1.05 }}
                title="Chat sessions"
                style={{
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <Clock className="w-4 h-4" />
              </motion.button>

              {/* Settings */}
              <motion.button
                onClick={() => setShowPreferences(true)}
                className="p-2 btn-secondary hover-lift focus-native"
                whileHover={{ scale: 1.05 }}
                title="Chat preferences"
                style={{
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <Settings className="w-4 h-4" />
              </motion.button>
            </motion.div>
          ) : (
            /* Expanded State - Full Chat Interface */
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full rounded-l-2xl"
            >
              {/* Header */}
              <div
                className="flex justify-between items-center p-4 rounded-l-2xl rounded-tl-none border-subtle"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                  borderBottom: '1px solid border',

                  borderLeft: '1px solid var(--color-text-border)'
                }}
              >
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowSessionList(true)}
                    className="p-2 btn-secondary hover-lift focus-native"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold truncate text-contrast-high">
                      {chat.currentSession?.title || 'No Session Selected'}
                    </h2>
                    {chat.currentSession && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-contrast-low">
                          {chat.messages.length} messages
                        </p>
                        {/* Provider indicator */}
                        <div className="flex items-center space-x-1 text-xs">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-contrast-medium">
                            {(() => {
                              // Get provider from last message metadata if available
                              const lastMessage = chat.messages[chat.messages.length - 1];
                              if (lastMessage?.metadata?.provider_used) {
                                switch (lastMessage.metadata.provider_used) {
                                  case 'local': return 'Local Qwen';
                                  case 'ollama': return 'Ollama';
                                  case 'openai': return 'OpenAI';
                                  case 'anthropic': return 'Anthropic';
                                  default: return 'AI';
                                }
                              }
                              return 'AI';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {chat.currentSession && (
                    <>
                      <button
                        onClick={() => exportChatSession(chat.currentSession!.id)}
                        className="p-2 btn-secondary hover-lift focus-native"
                        title="Export session"
                        style={{
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-text-tertiary)'
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => archiveChatSession(chat.currentSession!.id)}
                        className="p-2 btn-secondary hover-lift focus-native"
                        title="Archive session"
                        style={{
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-text-tertiary)'
                        }}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowConnectionModal(true)}
                    className="p-2 btn-secondary hover-lift focus-native"
                    title="Connect AI Provider"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-tertiary)'
                    }}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setShowPreferences(true)}
                    className="p-2 btn-secondary hover-lift focus-native"
                    title="Chat preferences"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-tertiary)'
                    }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={onToggleMinimized}
                    className="p-2 btn-secondary hover-lift focus-native"
                    title="Minimize chat"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Error display */}
              {chat.lastError && (
                <div className="p-3 mx-4 mt-4 rounded-lg border border-red-800 bg-red-900/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-300">{chat.lastError}</span>
                    </div>
                    <button
                      onClick={clearChatError}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="overflow-y-auto flex-1 p-4 space-y-4 scrollbar-native">
                {!chat.currentSession ? (
                  <div className="flex flex-col justify-center items-center h-full text-center">
                    <MessageSquare className="mb-3 w-10 h-10 text-gray-500" />
                    <h3 className="mb-2 text-sm font-medium text-contrast-high">
                      No Chat Session Selected
                    </h3>
                    <p className="mb-4 text-xs text-contrast-medium">
                      Create a new session or select an existing one to start chatting
                    </p>
                    <button
                      onClick={handleCreateSession}
                      className="px-3 py-2 text-sm btn-primary btn-native hover-lift focus-native"
                      disabled={chat.isCreatingSession}
                      style={{
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      {chat.isCreatingSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Create New Session'
                      )}
                    </button>
                  </div>
                ) : chat.isLoadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-contrast-medium" />
                  </div>
                ) : chat.messages.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full text-center">
                    <Bot className="mb-3 w-10 h-10 text-contrast-low" />
                    <h3 className="mb-2 text-sm font-medium text-contrast-high">
                      Start a Conversation
                    </h3>
                    <p className="text-xs text-contrast-medium">
                      Ask me anything about API integration, documentation, or code generation!
                    </p>
                  </div>
                ) : (
                  <>
                    {chat.messages.map(renderMessage)}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              {chat.currentSession && (
                <div
                  className="p-3 pt-5 rounded-l-2xl rounded-bl-none border border-subtle"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    backdropFilter: 'var(--blur-md)',
                    WebkitBackdropFilter: 'var(--blur-md)',
                    borderTop: '1px solid var(--color-text-border)',
                    borderLeft: '1px solid var(--color-text-border)'
                  }}
                >
                  <div className="flex items-end mx-2 space-x-2">
                    <div className="relative flex-1">
                      <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="text-sm resize-none input-native"
                        rows={1}
                        style={{
                          maxHeight: '120px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '14px'
                        }}
                        disabled={chat.isSendingMessage}
                      />
                    </div>

                    <button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || chat.isSendingMessage}
                      className="p-3 btn-primary btn-native hover-lift focus-native disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderRadius: 'var(--radius-md)',
                        alignSelf: 'flex-end',
                        marginBottom: '7px',

                      }}
                    >
                      {chat.isSendingMessage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Generation status */}
                  {chat.isGeneratingIntegration && (
                    <div className="flex items-center mt-2 space-x-2 text-sm" style={{ color: 'var(--color-accent)' }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating integration code...</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Modals */}
      <ChatSessionList
        isOpen={showSessionList}
        onClose={() => setShowSessionList(false)}
        onCreateSession={handleCreateSession}
      />

      <ChatPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />

      <ChatConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
      />

      {selectedCode && (
        <CodePreviewModal
          isOpen={showCodePreview}
          onClose={() => setShowCodePreview(false)}
          generatedCode={selectedCode}
        />
      )}
    </>
  )
}