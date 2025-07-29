import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderIcon,
  TagIcon,
  ChartBarIcon,
  CalendarIcon,
  Cog6ToothIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  BellIcon,
  BookOpenIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import { useAppStore } from '../lib/store'
import type { Project, ApiKey, ProjectStats } from '../lib/store'

interface ProjectDashboardProps {
  project: Project
  onEdit?: () => void
  onDelete?: () => void
  onAssignKeys?: () => void
  onRemoveKey?: (keyId: string) => void
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  project,
  onEdit,
  onDelete,
  onAssignKeys,
  onRemoveKey
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
    <div className="p-2 space-y-3 sm:p-4 sm:space-y-4">
      {/* Header */}
      <div className="p-3 glass-card sm:p-4">
        <div className="flex items-center mb-3 space-x-2 sm:space-x-3">
          <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 bg-blue-500 rounded-lg sm:w-10 sm:h-10">
            <FolderIcon className="w-4 h-4 text-white sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate sm:text-lg text-contrast-high">{project.name}</h1>
            <p className="text-xs truncate text-contrast-medium sm:text-sm">Created {formatDate(project.created_at)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors glass-card hover:bg-gray-100/50 dark:hover:bg-gray-800/50 sm:p-2"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 text-contrast-medium sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onAssignKeys && (
            <button
              onClick={onAssignKeys}
              className="flex items-center px-2 py-1.5 space-x-1 text-xs font-medium text-white bg-blue-500 rounded-lg transition-colors hover:bg-blue-600 sm:px-3 sm:py-2 sm:space-x-2"
            >
              <PlusIcon className="w-3 h-3" />
              <span className="sm:inline">Add Keys</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg transition-colors glass-card hover:bg-gray-100/50 dark:hover:bg-gray-800/50 sm:p-2"
              title="Edit Project"
            >
              <Cog6ToothIcon className="w-3.5 h-3.5 text-contrast-medium sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Total Keys */}
        <div className="p-3 glass-card sm:p-4">
          <div className="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs font-medium text-contrast-medium">Total</p>
              <p className="text-lg font-bold text-contrast-high sm:text-2xl">
                {stats?.totalKeys || projectKeys.length}
              </p>
            </div>
            <div className="flex justify-center items-center w-6 h-6 rounded-lg bg-blue-500/10 sm:w-8 sm:h-8">
              <TagIcon className="w-3 h-3 text-blue-500 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>

        {/* Active Keys */}
        <div className="p-3 glass-card sm:p-4">
          <div className="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs font-medium text-contrast-medium">Active</p>
              <p className="text-lg font-bold text-green-600 sm:text-2xl">
                {stats?.activeKeys || projectKeys.filter(k => k.is_active).length}
              </p>
            </div>
            <div className="flex justify-center items-center w-6 h-6 rounded-lg bg-green-500/10 sm:w-8 sm:h-8">
              <ChartBarIcon className="w-3 h-3 text-green-500 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>

        {/* Environments */}
        <div className="p-3 glass-card sm:p-4">
          <div className="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs font-medium text-contrast-medium">Envs</p>
              <p className="text-lg font-bold text-purple-600 sm:text-2xl">
                {stats?.environments.length || Object.keys(environmentStats).length}
              </p>
            </div>
            <div className="flex justify-center items-center w-6 h-6 rounded-lg bg-purple-500/10 sm:w-8 sm:h-8">
              <CalendarIcon className="w-3 h-3 text-purple-500 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Environment Breakdown */}
      {Object.keys(environmentStats).length > 0 && (
        <div className="p-3 glass-card sm:p-4">
          <h3 className="flex items-center mb-3 space-x-2 text-sm font-semibold text-contrast-high sm:text-base">
            <ChartBarIcon className="w-4 h-4 text-blue-500" />
            <span>Environments</span>
            <span className="px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full dark:bg-blue-900/20 dark:text-blue-400">
              {Object.keys(environmentStats).length}
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(environmentStats).map(([env, count]) => {
              const isProduction = env.toLowerCase() === 'production'
              const isStaging = env.toLowerCase() === 'staging'
              const isDevelopment = env.toLowerCase() === 'development'
              
              return (
                <div
                  key={env}
                  className={`relative overflow-hidden rounded-lg p-3 glass-card border-2 transition-all hover:shadow-md ${
                    isProduction ? 'border-red-200 bg-gradient-to-r from-red-50/30 to-transparent dark:border-red-800/30 dark:from-red-900/5' :
                    isStaging ? 'border-yellow-200 bg-gradient-to-r from-yellow-50/30 to-transparent dark:border-yellow-800/30 dark:from-yellow-900/5' :
                    isDevelopment ? 'border-green-200 bg-gradient-to-r from-green-50/30 to-transparent dark:border-green-800/30 dark:from-green-900/5' :
                    'border-blue-200 bg-gradient-to-r from-blue-50/30 to-transparent dark:border-blue-800/30 dark:from-blue-900/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isProduction ? 'bg-red-100 dark:bg-red-900/20' :
                        isStaging ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                        isDevelopment ? 'bg-green-100 dark:bg-green-900/20' :
                        'bg-blue-100 dark:bg-blue-900/20'
                      }`}>
                        {isProduction ? (
                          <ShieldCheckIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : isStaging ? (
                          <Cog6ToothIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        ) : isDevelopment ? (
                          <CodeBracketIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <TagIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold capitalize text-contrast-high">
                          {env}
                        </h4>
                        <p className="text-xs text-contrast-medium">
                          {isProduction ? 'Live environment' :
                           isStaging ? 'Testing environment' :
                           isDevelopment ? 'Development environment' :
                           'Custom environment'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-contrast-high">
                        {count}
                      </div>
                      <div className={`text-xs font-medium ${
                        isProduction ? 'text-red-600 dark:text-red-400' :
                        isStaging ? 'text-yellow-600 dark:text-yellow-400' :
                        isDevelopment ? 'text-green-600 dark:text-green-400' :
                        'text-blue-600 dark:text-blue-400'
                      }`}>
                        {count === 1 ? 'API Key' : 'API Keys'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar showing relative usage */}
                  <div className="mt-3">
                    <div className="w-full h-1.5 bg-gray-200 rounded-full dark:bg-gray-700">
                      <div 
                        className={`h-1.5 rounded-full transition-all ${
                          isProduction ? 'bg-red-500' :
                          isStaging ? 'bg-yellow-500' :
                          isDevelopment ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min((count / Math.max(...Object.values(environmentStats))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Project Keys */}
      {projectKeys.length > 0 && (
        <div className="p-3 glass-card sm:p-4">
          <h3 className="flex items-center mb-2 space-x-1.5 text-sm font-semibold text-contrast-high sm:mb-3 sm:space-x-2 sm:text-base">
            <TagIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>API Keys ({projectKeys.length})</span>
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            {projectKeys.map((key) => (
              <div
                key={key.id}
                className="flex justify-between items-center p-2 rounded-lg glass-card sm:p-3"
              >
                <div className="flex flex-1 items-center space-x-2 min-w-0">
                  <div className="flex flex-shrink-0 justify-center items-center w-5 h-5 rounded-lg bg-blue-500/10 sm:w-6 sm:h-6">
                    <TagIcon className="w-2.5 h-2.5 text-blue-500 sm:w-3 sm:h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate text-contrast-high sm:text-sm">
                      {key.name}
                    </div>
                    <div className="text-xs truncate text-contrast-medium">
                      {key.service} • {key.environment}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded text-center ${key.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                    {key.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {onRemoveKey && (
                    <button
                      onClick={() => onRemoveKey(key.id)}
                      className="p-1 rounded transition-colors glass-card hover:bg-red-50 dark:hover:bg-red-900/20 group"
                      title="Remove"
                    >
                      <TrashIcon className="w-3 h-3 text-gray-400 transition-colors group-hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="p-3 glass-card sm:p-4">
          <h3 className="flex items-center mb-2 space-x-1.5 text-sm font-semibold text-contrast-high sm:mb-3 sm:space-x-2 sm:text-base">
            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            {recentActivity.map((key) => (
              <div
                key={key.id}
                className="flex justify-between items-center p-2 rounded-lg glass-card sm:p-3"
              >
                <div className="flex flex-1 items-center space-x-2 min-w-0">
                  <div className="flex flex-shrink-0 justify-center items-center w-5 h-5 rounded-lg bg-blue-500/10 sm:w-6 sm:h-6">
                    <TagIcon className="w-2.5 h-2.5 text-blue-500 sm:w-3 sm:h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate text-contrast-high sm:text-sm">
                      {key.name}
                    </div>
                    <div className="text-xs truncate text-contrast-medium">
                      {key.service}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col flex-shrink-0 items-end space-y-1">
                  <span className="px-1.5 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded dark:bg-gray-700 dark:text-gray-300">
                    {key.environment}
                  </span>
                  <span className="text-xs whitespace-nowrap text-contrast-medium">
                    {formatDate(key.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentation Section */}
      <div className="p-3 glass-card sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className="flex items-center space-x-1.5 text-sm font-semibold text-contrast-high sm:space-x-2 sm:text-base">
            <BookOpenIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Documentation</span>
          </h3>
          <button
            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            onClick={() => {/* TODO: Open documentation modal */}}
          >
            <PlusIcon className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
        
        {/* Documentation Links */}
        <div className="space-y-2">
          {projectKeys
            .filter(key => key.documentation_url)
            .map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-2 rounded-lg glass-card sm:p-3"
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-500/10 rounded-lg flex items-center justify-center sm:w-6 sm:h-6">
                    <BookOpenIcon className="w-2.5 h-2.5 text-blue-500 sm:w-3 sm:h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-contrast-high truncate sm:text-sm">
                      {key.documentation_title || `${key.name} Documentation`}
                    </div>
                    <div className="text-xs text-contrast-medium truncate">
                      {key.service} • {key.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {key.last_doc_sync && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Synced
                    </span>
                  )}
                  <a
                    href={key.documentation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Open documentation"
                  >
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))
          }
          
          {/* Empty State */}
          {projectKeys.filter(key => key.documentation_url).length === 0 && (
            <div className="text-center py-4">
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                <BookOpenIcon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-contrast-medium mb-2">No documentation linked yet</p>
              <p className="text-xs text-contrast-low">Add documentation URLs to your API keys for quick reference</p>
            </div>
          )}
        </div>
      </div>

      {/* Project Settings */}
      <div className="p-3 glass-card sm:p-4">
        <h3 className="flex items-center mb-2 space-x-1.5 text-xs font-semibold text-contrast-high sm:text-sm">
          <Cog6ToothIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Settings</span>
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex justify-between items-center p-2 rounded-lg glass-card">
            <div className="flex items-center space-x-1.5">
              <div className="flex justify-center items-center w-3 h-3 rounded-md bg-blue-500/20 sm:w-4 sm:h-4">
                <ShieldCheckIcon className="w-2 h-2 text-blue-600 sm:w-2.5 sm:h-2.5" />
              </div>
              <span className="text-xs font-medium text-contrast-medium">Default Env</span>
            </div>
            <span className="px-1 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded dark:bg-gray-700 dark:text-gray-300 truncate max-w-16 sm:max-w-20">
              {project.settings.default_environment}
            </span>
          </div>

          <div className="flex justify-between items-center p-2 rounded-lg glass-card">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-md flex items-center justify-center sm:w-4 sm:h-4 ${project.settings.auto_sync ? 'bg-green-500/20' : 'bg-gray-500/20'
                }`}>
                <ArrowPathIcon className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${project.settings.auto_sync ? 'text-green-600' : 'text-gray-600'
                  }`} />
              </div>
              <span className="text-xs font-medium text-contrast-medium">Auto Sync</span>
            </div>
            <span className={`px-1 py-0.5 text-xs font-medium rounded ${project.settings.auto_sync
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
              {project.settings.auto_sync ? 'On' : 'Off'}
            </span>
          </div>

          <div className="flex justify-between items-center p-2 rounded-lg glass-card">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-md flex items-center justify-center sm:w-4 sm:h-4 ${project.settings.vscode_integration ? 'bg-blue-500/20' : 'bg-gray-500/20'
                }`}>
                <CodeBracketIcon className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${project.settings.vscode_integration ? 'text-blue-600' : 'text-gray-600'
                  }`} />
              </div>
              <span className="text-xs font-medium text-contrast-medium">VSCode</span>
            </div>
            <span className={`px-1 py-0.5 text-xs font-medium rounded ${project.settings.vscode_integration
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
              {project.settings.vscode_integration ? 'On' : 'Off'}
            </span>
          </div>

          <div className="flex justify-between items-center p-2 rounded-lg glass-card">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-md flex items-center justify-center sm:w-4 sm:h-4 ${project.settings.notifications ? 'bg-purple-500/20' : 'bg-gray-500/20'
                }`}>
                <BellIcon className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${project.settings.notifications ? 'text-purple-600' : 'text-gray-600'
                  }`} />
              </div>
              <span className="text-xs font-medium text-contrast-medium">Notifications</span>
            </div>
            <span className={`px-1 py-0.5 text-xs font-medium rounded ${project.settings.notifications
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
              {project.settings.notifications ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {projectKeys.length === 0 && !loading && (
        <div className="p-6 text-center glass-card sm:p-8">
          <div className="flex justify-center items-center mx-auto mb-3 w-10 h-10 rounded-lg bg-blue-500/10 sm:w-12 sm:h-12 sm:mb-4">
            <TagIcon className="w-5 h-5 text-blue-500 sm:w-6 sm:h-6" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-contrast-high sm:text-lg">
            No API keys assigned
          </h3>
          <p className="mx-auto mb-4 max-w-sm text-sm text-contrast-medium">
            Get started by assigning some API keys to this project.
          </p>
          {onAssignKeys && (
            <button
              onClick={onAssignKeys}
              className="inline-flex items-center px-4 py-2 space-x-2 text-sm font-medium text-white bg-blue-500 rounded-lg transition-colors hover:bg-blue-600 active:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Assign Keys</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectDashboard