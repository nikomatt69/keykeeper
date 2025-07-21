import React from 'react'
import { ChevronDownIcon, PlusIcon, FolderIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../lib/store'
import type { Project } from '../lib/store'

interface ProjectSelectorProps {
  onCreateProject?: () => void
  showStats?: boolean
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onCreateProject,
  showStats = true
}) => {
  const {
    projects,
    currentProjectId,
    selectedProject,
    projectStats,
    setCurrentProject,
    selectProject,
    setShowProjectModal,
    getKeysByProject,
    calculateProjectStats
  } = useAppStore()

  const [isOpen, setIsOpen] = React.useState(false)
  const [projectKeys, setProjectKeys] = React.useState<{ [key: string]: number }>({})

  React.useEffect(() => {
    // Calculate key counts for each project
    const loadProjectKeys = async () => {
      const counts: { [key: string]: number } = {}
      for (const project of projects) {
        const keys = await getKeysByProject(project.id)
        counts[project.id] = keys.length

        // Calculate stats if not already cached
        if (!projectStats.has(project.id)) {
          await calculateProjectStats(project.id)
        }
      }
      setProjectKeys(counts)
    }

    if (projects.length > 0) {
      loadProjectKeys()
    }
  }, [projects, getKeysByProject, calculateProjectStats, projectStats])

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project.id)
    selectProject(project)
    setIsOpen(false)
  }

  const handleShowAllProjects = () => {
    setCurrentProject(null)
    selectProject(null)
    setIsOpen(false)
  }

  const currentProject = projects.find(p => p.id === currentProjectId)
  const stats = currentProjectId ? projectStats.get(currentProjectId) : null

  return (
    <div className="relative -mx-4">
      {/* Project Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 space-x-3 btn-secondary hover-lift focus-native"
        style={{
          width: '100%',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div className="flex items-center space-x-3">
          {currentProject ? (
            <FolderIcon className="w-4 h-4" />
          ) : (
            <GlobeAltIcon className="w-4 h-4" />
          )}
          <span className="text-body">
            {currentProject ? currentProject.name : 'All Projects'}
          </span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="overflow-y-auto absolute right-0 left-0 top-full z-50 mt-1 max-h-80 rounded-lg glass-card shadow-2xl backdrop-blur-xl">
          {/* All Projects Option */}
          <button
            onClick={handleShowAllProjects}
            className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!currentProjectId ? 'bg-blue-50 border-r-2 border-blue-500 dark:bg-blue-900/20' : ''}`}
          >
            <GlobeAltIcon className="flex-shrink-0 w-5 h-5 text-gray-500" />
            <div>
              <div className="font-medium text-contrast-high">All Projects</div>
              <div className="text-xs text-contrast-medium">
                View all API keys
              </div>
            </div>
          </button>

          {/* Divider */}
          {projects.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700" />
          )}

          {/* Project List */}
          {projects.map((project) => {
            const keyCount = projectKeys[project.id] || 0
            const projectStat = projectStats.get(project.id)
            const isSelected = currentProjectId === project.id

            return (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project)}
                className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-blue-50 border-r-2 border-blue-500 dark:bg-blue-900/20' : ''}`}
              >
                <FolderIcon className="flex-shrink-0 w-5 h-5 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-contrast-high truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-contrast-medium">
                    {keyCount} key{keyCount !== 1 ? 's' : ''}
                    {projectStat && projectStat.environments.length > 0 && (
                      <> • {projectStat.environments.join(', ')}</>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {/* Create New Project Button */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowProjectModal(true)
                setIsOpen(false)
                onCreateProject?.()
              }}
              className="flex items-center p-3 space-x-3 w-full text-left text-blue-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-blue-400"
            >
              <PlusIcon className="flex-shrink-0 w-5 h-5" />
              <div className="font-medium text-contrast-high">Create New Project</div>
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default ProjectSelector