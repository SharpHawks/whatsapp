import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { useQueryClient } from '@tanstack/react-query'
import Badge from '../components/common/Badge'
import EmptyState from '../components/common/EmptyState'
import Spinner from '../components/common/Spinner'
import { formatDateTime, truncate, getStatusColor } from '../lib/utils'
import { useMessages } from '../hooks/useMessages'
import { useBots } from '../hooks/useBots'
import type { Message } from '../types/message'

export default function MessagesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [selectedBot, setSelectedBot] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  
  const { data: botsData = [] } = useBots()
  const { data: messagesData, isLoading, error } = useMessages({
    botId: selectedBot !== 'all' ? selectedBot : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    search: searchQuery || undefined,
    page,
    limit: 20,
  })
  
  const messages = messagesData?.messages || []
  const queryClient = useQueryClient()

  // Listen for real-time message updates
  useEffect(() => {
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    }

    const handleMessageStatus = (event: CustomEvent) => {
      const { messageId, status } = event.detail
      queryClient.setQueryData(['messages', { selectedBot, selectedStatus, searchQuery, page }], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          messages: oldData.messages.map((msg: Message) =>
            msg.id === messageId ? { ...msg, status } : msg
          )
        }
      })
    }

    const handleQuotaUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    }

    window.addEventListener('message:new' as any, handleNewMessage)
    window.addEventListener('message:status' as any, handleMessageStatus)
    window.addEventListener('quota:updated' as any, handleQuotaUpdate)

    return () => {
      window.removeEventListener('message:new' as any, handleNewMessage)
      window.removeEventListener('message:status' as any, handleMessageStatus)
      window.removeEventListener('quota:updated' as any, handleQuotaUpdate)
    }
  }, [queryClient, selectedBot, selectedStatus, searchQuery, page])

  const getStatusVariant = (status: Message['status']) => {
    switch (status) {
      case 'delivered':
      case 'read':
        return 'success'
      case 'sent':
        return 'info'
      case 'pending':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getTypeIcon = (type: Message['type']) => {
    switch (type) {
      case 'image':
        return '🖼️'
      case 'video':
        return '🎥'
      case 'audio':
        return '🎵'
      case 'document':
        return '📄'
      default:
        return '💬'
    }
  }

  const filteredMessages = messages.filter((message) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (message.content && message.content.toLowerCase().includes(query)) ||
      (message.from && message.from.includes(query)) ||
      (message.to && message.to.includes(query))
    )
  })

  return (
    <div className="page-shell">
      <div className="page-header sm:flex sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
            Message center
          </div>
          <h1 className="page-title">Messages</h1>
          <p className="page-description">
            View and search message history across all bots
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search messages, phone numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <button className="btn-secondary">
          <FunnelIcon className="h-5 w-5 mr-2" />
          Filters
        </button>
      </div>

      {/* Messages Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load messages. Please try again.</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlassIcon className="h-12 w-12" />}
          title={searchQuery ? 'No messages found' : 'No messages yet'}
          description={
            searchQuery
              ? 'Try adjusting your search query'
              : 'Messages will appear here once your bots start receiving them'
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From / To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <tr
                    key={message.id}
                    onClick={() => setSelectedMessage(message)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(message.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {message.botName || 'Unknown Bot'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="text-gray-900">
                          {message.direction === 'incoming' ? 'From:' : 'To:'}{' '}
                          {message.direction === 'incoming' ? message.from : message.to}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      <div className="flex items-center gap-2">
                        <span>{getTypeIcon(message.type)}</span>
                        <span className="truncate">{truncate(message.content || '', 50)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {message.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {message.cost === 0 ? (
                        <span className="text-green-600 font-medium">Subscription</span>
                      ) : (
                        <span className="text-amber-700">€{message.cost.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(message.status)}>
                        {message.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button className="btn-secondary">Previous</button>
              <button className="btn-secondary">Next</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to{' '}
                  <span className="font-medium">{filteredMessages.length}</span> of{' '}
                  <span className="font-medium">{messages.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button className="btn-secondary rounded-l-md">Previous</button>
                  <button className="btn-secondary rounded-r-md">Next</button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Details Modal */}
      {selectedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Message Details</h2>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Bot</label>
                <p className="mt-1 text-sm text-gray-900">{selectedMessage.botName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">From</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedMessage.from}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">To</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedMessage.to}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Time</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDateTime(selectedMessage.timestamp)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {getTypeIcon(selectedMessage.type)} {selectedMessage.type}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <Badge variant={getStatusVariant(selectedMessage.status)}>
                    {selectedMessage.status}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Message</label>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedMessage.content || 'No content'}
                </p>
              </div>

              {selectedMessage.mediaUrl && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Media</label>
                  <a
                    href={selectedMessage.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-sm text-primary-600 hover:text-primary-700"
                  >
                    View Media
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setSelectedMessage(null)}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
