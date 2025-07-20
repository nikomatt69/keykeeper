import React, { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { XMarkIcon, MagnifyingGlassIcon, TagIcon, FolderIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import { useAppStore } from '../../lib/store'
import type { ApiKey, Project } from '../../lib/store'

interface AssignKeysModalProps {
  isOpen: boolean
  onClose: () => void
  project?: Project | null
}

export const AssignKeysModal: React.FC<AssignKeysModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { 
    assignKeysToProject, 
    getUnassignedKeys,
    getKeysByProject,
    projects,
    isLoading 
  } = useAppStore()

  const [availableKeys, setAvailableKeys] = useState<ApiKey[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterByProject, setFilterByProject] = useState<string>('unassigned')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Load available keys when modal opens
  useEffect(() => {
    const loadKeys = async () => {
      if (!isOpen) return

      setLoading(true)
      try {
        let keys: ApiKey[] = []
        
        if (filterByProject === 'unassigned') {
          keys = await getUnassignedKeys()
        } else if (filterByProject === 'all') {
          keys = await getKeysByProject()
        } else {
          keys = await getKeysByProject(filterByProject)
        }

        setAvailableKeys(keys)
      } catch (err) {
        setError('Failed to load API keys')
        console.error('Error loading keys:', err)
      } finally {
        setLoading(false)
      }
    }

    loadKeys()
  }, [isOpen, filterByProject, getUnassignedKeys, getKeysByProject])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(new Set())
      setSearchQuery('')
      setFilterByProject('unassigned')
      setError(null)
    }
  }, [isOpen])

  // Filter keys based on search query
  const filteredKeys = availableKeys.filter(key => {
    const query = searchQuery.toLowerCase()
    return (
      key.name.toLowerCase().includes(query) ||
      key.service.toLowerCase().includes(query) ||
      key.description?.toLowerCase().includes(query) ||
      key.tags.some(tag => tag.toLowerCase().includes(query))
    )
  })

  const handleKeyToggle = (keyId: string) => {
    const newSelected = new Set(selectedKeys)
    if (newSelected.has(keyId)) {
      newSelected.delete(keyId)
    } else {
      newSelected.add(keyId)
    }
    setSelectedKeys(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedKeys.size === filteredKeys.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filteredKeys.map(key => key.id)))
    }
  }

  const handleAssign = async () => {
    if (!project || selectedKeys.size === 0) return

    setError(null)
    try {
      await assignKeysToProject(project.id, Array.from(selectedKeys))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign keys')
    }
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

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <FolderIcon className="h-6 w-6 text-blue-500" />
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  Assign Keys to Project
                </Dialog.Title>
                {project && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {project.name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 space-y-4 overflow-hidden flex flex-col">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Project Filter */}
              <div className="flex-1">
                <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Show keys from
                </label>
                <select
                  id="project-filter"
                  value={filterByProject}
                  onChange={(e) => setFilterByProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="unassigned">Unassigned keys only</option>
                  <option value="all">All keys</option>
                  {projects.filter(p => p.id !== project?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search keys
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, service, or tags..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Select All */}
            {filteredKeys.length > 0 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {selectedKeys.size === filteredKeys.length ? 'Deselect All' : 'Select All'}
                  {filteredKeys.length > 0 && ` (${filteredKeys.length})`}
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedKeys.size} selected
                </div>
              </div>
            )}

            {/* Keys List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-gray-500 dark:text-gray-400">Loading keys...</div>
                </div>
              ) : filteredKeys.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <div className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No keys match your search' : 'No keys available'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredKeys.map((key) => {
                    const isSelected = selectedKeys.has(key.id)
                    
                    return (
                      <label
                        key={key.id}
                        className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleKeyToggle(key.id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && (
                              <CheckIcon className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {key.name}
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentColor(key.environment)}`}>
                              {key.environment}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {key.service}
                            {key.description && ` • ${key.description}`}
                          </div>
                          {key.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {key.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {key.tags.length > 3 && (
                                <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                                  +{key.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={isLoading || selectedKeys.size === 0 || !project}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Assigning...' : `Assign ${selectedKeys.size} Key${selectedKeys.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

export default AssignKeysModal