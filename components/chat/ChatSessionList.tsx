import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  MessageSquare,
  Clock,
  Archive,
  Trash2,
  MoreVertical,
  Search,
  Filter
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import type { ChatSession } from '../../lib/types'

interface ChatSessionListProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: () => void
}

export default function ChatSessionList({ isOpen, onClose, onCreateSession }: ChatSessionListProps) {
  const {
    chat,
    setCurrentChatSession,
    deleteChatSession,
    archiveChatSession,
    loadUserChatSessions
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const filteredSessions = chat.sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          session.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArchived = showArchived ? session.status === 'archived' : session.status === 'active'
    return matchesSearch && matchesArchived
  })

  const handleSelectSession = (session: ChatSession) => {
    setCurrentChatSession(session.id)
    onClose()
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      await deleteChatSession(sessionId)
      setSelectedSessionId(null)
    }
  }

  const handleArchiveSession = async (sessionId: string) => {
    await archiveChatSession(sessionId)
    setSelectedSessionId(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
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
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Chat Sessions
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Filters and Create button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                showArchived
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Show Archived</span>
            </button>

            <button
              onClick={onCreateSession}
              disabled={chat.isCreatingSession}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Session</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No sessions match your search' : 
                 showArchived ? 'No archived sessions' : 'No active sessions'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                    chat.currentSessionId === session.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                      : ''
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {session.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{session.message_count} messages</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(session.updated_at)}</span>
                        </div>
                        {session.status === 'archived' && (
                          <div className="flex items-center space-x-1 text-orange-500">
                            <Archive className="w-3 h-3" />
                            <span>Archived</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Session actions */}
                    <div className="flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSessionId(
                            selectedSessionId === session.id ? null : session.id
                          )
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Action menu */}
                      <AnimatePresence>
                        {selectedSessionId === session.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-4 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
                          >
                            {session.status === 'active' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchiveSession(session.id)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                              >
                                <Archive className="w-4 h-4" />
                                <span>Archive</span>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSession(session.id)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-xs text-gray-500 text-center">
            {filteredSessions.length} of {chat.sessions.length} sessions
          </p>
        </div>
      </motion.div>
    </div>
  )
}