import React, { useEffect, useState } from 'react'
import { 
  FolderIcon, 
  TagIcon, 
  ChartBarIcon,
  CalendarIcon,
  Cog6ToothIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useAppStore } from '../lib/store'
import type { Project, ApiKey, ProjectStats } from '../lib/store'

interface ProjectDashboardProps {
  project: Project
  onEdit?: () => void
  onDelete?: () => void
  onAssignKeys?: () => void
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  project,
  onEdit,
  onDelete,
  onAssignKeys
}) => {
  const { 
    getKeysByProject, 
    projectStats, 
    calculateProjectStats,
    isLoading 
  } = useAppStore()

  const [projectKeys, setProjectKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)

  const stats = projectStats.get(project.id)

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      setLoading(true)
      try {
        const keys = await getKeysByProject(project.id)
        setProjectKeys(keys)
        
        // Calculate stats if not cached
        if (!stats) {
          await calculateProjectStats(project.id)
        }
      } catch (error) {
        console.error('Failed to load project data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProjectData()
  }, [project.id, getKeysByProject, calculateProjectStats, stats])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await calculateProjectStats(project.id)
      const keys = await getKeysByProject(project.id)
      setProjectKeys(keys)
    } catch (error) {
      console.error('Failed to refresh project data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEnvironmentStats = () => {
    const envCounts: Record<string, number> = {}
    projectKeys.forEach(key => {
      envCounts[key.environment] = (envCounts[key.environment] || 0) + 1
    })
    return envCounts
  }

  const getRecentActivity = () => {
    return projectKeys
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'staging':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'development':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const environmentStats = getEnvironmentStats()
  const recentActivity = getRecentActivity()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <FolderIcon className="h-8 w-8 text-blue-500 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {project.description}
              </p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
              <span>Created {formatDate(project.created_at)}</span>
              <span>•</span>
              <span>Last updated {formatDate(project.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {onAssignKeys && (
            <button
              onClick={onAssignKeys}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Assign Keys</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit Project"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete Project"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Keys */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center">
            <TagIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Keys</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalKeys || projectKeys.length}
              </p>
            </div>
          </div>
        </div>

        {/* Active Keys */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Keys</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.activeKeys || projectKeys.filter(k => k.is_active).length}
              </p>
            </div>
          </div>
        </div>

        {/* Environments */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Environments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.environments.length || Object.keys(environmentStats).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Breakdown */}
      {Object.keys(environmentStats).length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Environment Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(environmentStats).map(([env, count]) => (
              <div key={env} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className={`px-2 py-1 text-sm font-medium rounded-full ${getEnvironmentColor(env)}`}>
                  {env}
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3 min-w-0">
                  <TagIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {key.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {key.service}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentColor(key.environment)}`}>
                    {key.environment}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(key.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Settings */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Project Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Default Environment:</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentColor(project.settings.default_environment)}`}>
              {project.settings.default_environment}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Auto Sync:</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              project.settings.auto_sync 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {project.settings.auto_sync ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">VSCode Integration:</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              project.settings.vscode_integration 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {project.settings.vscode_integration ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Notifications:</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              project.settings.notifications 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {project.settings.notifications ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {projectKeys.length === 0 && !loading && (
        <div className="text-center py-12">
          <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No API keys assigned
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Get started by assigning some API keys to this project.
          </p>
          {onAssignKeys && (
            <button
              onClick={onAssignKeys}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Assign Keys</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectDashboard