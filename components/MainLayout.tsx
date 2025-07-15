import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../lib/store'
import Sidebar from './Sidebar'
import ApiKeyList from './ApiKeyList'
import ApiKeyDetail from './ApiKeyDetail'
import AddApiKeyModal from './modals/AddApiKeyModal'
import EditApiKeyModal from './modals/EditApiKeyModal'
import DeleteApiKeyModal from './modals/DeleteApiKeyModal'
import SettingsScreen from './SettingsScreen'
import DragDropZone from './DragDropZone'

export default function MainLayout() {
  const {
    selectedKey,
    sidebarCollapsed,
    loadApiKeys,
    showAddModal,
    showEditModal,
    showDeleteModal,
    showSettingsModal
  } = useAppStore()

  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
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
      <div className="flex-1 flex overflow-hidden">
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
          <div className="h-full flex flex-col">
            <ApiKeyList />
            
            {/* Drag & Drop Zone - Only show when no keys or as help section */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <DragDropZone 
                onFileImport={(filePath, projectPath) => {
                  console.log('File imported:', filePath, 'Project:', projectPath);
                  // Refresh the keys list after import
                  loadApiKeys();
                }}
              />
            </div>
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
      </div>

      {/* Modals */}
      {showAddModal && <AddApiKeyModal />}
      {showEditModal && <EditApiKeyModal />}
      {showDeleteModal && <DeleteApiKeyModal />}
      {showSettingsModal && <SettingsScreen />}
    </div>
  )
}