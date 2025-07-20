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
  const [projectKeys, setProjectKeys] = React.useState<{[key: string]: number}>({})

  React.useEffect(() => {
    // Calculate key counts for each project
    const loadProjectKeys = async () => {
      const counts: {[key: string]: number} = {}
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
    <div className="relative">
      {/* Project Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-3 min-w-0">
          {currentProject ? (
            <FolderIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
          ) : (
            <GlobeAltIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
          )}
          <div className="text-left min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate">
              {currentProject ? currentProject.name : 'All Projects'}
            </div>
            {showStats && currentProject && stats && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {stats.totalKeys} keys • {stats.environments.length} env{stats.environments.length !== 1 ? 's' : ''}
              </div>
            )}
            {showStats && !currentProject && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {projects.length} project{projects.length !== 1 ? 's' : ''} • All keys
              </div>
            )}
          </div>
        </div>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* All Projects Option */}
          <button
            onClick={handleShowAllProjects}
            className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
              !currentProjectId ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' : ''
            }`}
          >
            <GlobeAltIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">All Projects</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' : ''
                }`}
              >
                <FolderIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {project.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
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
              className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-blue-600 dark:text-blue-400"
            >
              <PlusIcon className="h-5 w-5 flex-shrink-0" />
              <div className="font-medium">Create New Project</div>
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