import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../lib/store'
import Sidebar from './Sidebar'
import ApiKeyList from './ApiKeyList'
import ApiKeyDetail from './ApiKeyDetail'
import AddApiKeyModal from './modals/AddApiKeyModal'
import EditApiKeyModal from './modals/EditApiKeyModal'
import DeleteApiKeyModal from './modals/DeleteApiKeyModal'
import ProjectModal from './modals/ProjectModal'
import AssignKeysModal from './modals/AssignKeysModal'
import SettingsScreen from './SettingsScreen'
import DragDropZone from './DragDropZone'
import ProjectDashboard from './ProjectDashboard'
import BottomSheet from './BottomSheet'
import DocumentationLibraryModal from './modals/DocumentationLibraryModal'
import ChatSidebar from './chat/ChatSidebar'

export default function MainLayout() {
  const {
    selectedKey,
    selectedProject,
    sidebarCollapsed,
    loadApiKeys,
    showAddModal,
    showEditModal,
    showDeleteModal,
    showSettingsModal,
    showProjectModal,
    showAssignKeysModal,
    showDocumentationModal,
    setShowProjectModal,
    setShowAssignKeysModal,
    setShowDocumentationModal
  } = useAppStore()

  // Local state for chat sidebar
  const [chatMinimized, setChatMinimized] = useState(false)

  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])

  return (
    <div className="flex overflow-hidden h-screen" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`${sidebarCollapsed ? 'w-20' : 'w-80'
          } transition-all duration-300 flex-shrink-0 sidebar-native`}
      >
        <Sidebar />
      </motion.div>

      {/* Main Content */}
      <div className="flex overflow-hidden flex-1">
        {/* API Keys List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`${selectedKey ? 'w-96' : 'flex-1'
            } transition-all duration-300 glass-card rounded-none border-l-0 border-t-0 border-b-0`}
          style={{
            backgroundColor: 'var(--color-background-secondary)',
            borderRight: '1px solid rgba(0, 0, 0, 0.08)'
          }}
        >

          <div className="flex flex-col h-full bg-[rgba(44, 44, 46, 0.9)] ">

            <ApiKeyList />

            {/* Drag & Drop Zone - Only show when no keys or as help section */}
            <BottomSheet
              isOpen={!!selectedProject}
              onClose={() => {
                // Close functionality via X button - we need to add a clearSelectedProject method to store
                // For now, this will only work via the X button since we removed the backdrop
                console.log('Close project dashboard')
              }}
              title={selectedProject?.name || 'Project Dashboard'}
              subtitle={selectedProject ? `Created ${new Date(selectedProject.created_at).toLocaleDateString()}` : undefined}
              collapsible={true}
              defaultHeight="60vh"
              maxHeight="85vh"
            >
              {selectedProject && (
                <ProjectDashboard
                  project={selectedProject}
                  onEdit={() => setShowProjectModal(true)}
                  onAssignKeys={() => setShowAssignKeysModal(true)}
                />
              )}
            </BottomSheet>

          </div>

        </motion.div>

        {/* API Key Detail */}
        {selectedKey && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="flex-1"
            style={{ backgroundColor: 'var(--color-background-tertiary)' }}
          >
            <ApiKeyDetail />
          </motion.div>
        )}

        {/* Right Sidebar - Chat */}
        <ChatSidebar
          isMinimized={chatMinimized}
          onToggleMinimized={() => setChatMinimized(!chatMinimized)}
        />

      </div>

      {/* Modals */}
      {showAddModal && <AddApiKeyModal />}
      {showEditModal && <EditApiKeyModal />}
      {showDeleteModal && <DeleteApiKeyModal />}
      {showSettingsModal && <SettingsScreen />}
      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          project={selectedProject}
        />
      )}
      {showAssignKeysModal && (
        <AssignKeysModal
          isOpen={showAssignKeysModal}
          onClose={() => setShowAssignKeysModal(false)}
          project={selectedProject}
        />
      )}

      {/* Documentation Library Modal */}
      <DocumentationLibraryModal
        isOpen={showDocumentationModal}
        onClose={() => setShowDocumentationModal(false)}
      />

    </div>
  )
}