import { useState, useMemo } from 'react'
import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useGroups } from '../../hooks/useGroups'

interface GroupSelectorProps {
  botId: string
  value: string
  onChange: (groupId: string) => void
}

export default function GroupSelector({ botId, value, onChange }: GroupSelectorProps) {
  const { data: groups = [], isLoading, error } = useGroups(botId)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groups
    }
    
    const query = searchQuery.toLowerCase()
    return groups.filter(group => 
      group.name.toLowerCase().includes(query) ||
      group.id.toLowerCase().includes(query)
    )
  }, [groups, searchQuery])

  // Find selected group
  const selectedGroup = groups.find(g => g.id === value)

  if (isLoading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Group
        </label>
        <div className="input flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Loading groups...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Group
        </label>
        <div className="input bg-red-50 border-red-200 text-red-600 py-4">
          <p className="text-sm">
            Failed to load groups. {(error as any)?.response?.data?.error?.message || 'Please try again.'}
          </p>
        </div>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Group
        </label>
        <div className="border border-gray-200 rounded-lg bg-gray-50 p-8">
          <div className="text-center">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              No groups found for this bot
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Add the bot to a WhatsApp group to send messages
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Group
      </label>
      
      {/* Search Input */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups..."
          className="input pl-10"
        />
      </div>

      {/* Groups List */}
      <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No groups match your search
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => onChange(group.id)}
                className={`
                  w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                  ${value === group.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      value === group.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {group.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {group.id}
                    </p>
                    <div className="flex items-center mt-1 space-x-3">
                      <span className="text-xs text-gray-500">
                        {group.participantCount} {group.participantCount === 1 ? 'member' : 'members'}
                      </span>
                      {group.isAdmin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  {value === group.id && (
                    <div className="ml-3 flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Group Display */}
      {selectedGroup && (
        <div className="mt-2 text-sm text-gray-600">
          Selected: <span className="font-medium">{selectedGroup.name}</span>
        </div>
      )}

      {/* Helper Text */}
      <p className="mt-2 text-xs text-gray-500">
        {groups.length} {groups.length === 1 ? 'group' : 'groups'} available
      </p>
    </div>
  )
}
