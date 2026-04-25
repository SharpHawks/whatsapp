import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  KeyIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  SignalSlashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Spinner from '../components/common/Spinner'
import Input from '../components/common/Input'
import ApiKeyModal from '../components/bots/ApiKeyModal'
import ApiKeyDisplay from '../components/bots/ApiKeyDisplay'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getApiBaseUrl } from '../lib/api'
import toast from 'react-hot-toast'
import { useConnectBot, useDisconnectBot, useRestartBot, useBotQR } from '../hooks/useBots'
import { Dialog, Transition } from '@headlessui/react'
import { QRCodeSVG } from 'qrcode.react'
import { formatDateTime, formatRelativeTime } from '../lib/utils'
import type { Bot } from '../types/bot'

export default function BotDetailsPage() {
  const apiDocBase = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'api'>('overview')
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(true)
  const pollingIntervalRef = useRef<number | null>(null)
  
  // API Key management states
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [regeneratedKey, setRegeneratedKey] = useState<{ key: string; expiresAt: string } | null>(null)

  // Connection actions
  const connectBot = useConnectBot()
  const disconnectBot = useDisconnectBot()
  const restartBot = useRestartBot()
  const [showQRModal, setShowQRModal] = useState(false)
  const { data: qrData, hasTimedOut, stopPolling, restartPolling } = useBotQR(showQRModal && botId ? botId : '')

  // Fetch bot details
  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: async () => {
      const response = await api.get<{ bot: Bot }>(`/bots/${botId}`)
      return response.data.bot
    },
    enabled: !!botId,
  })

  // Fetch API key info
  const { data: apiKeyInfo, isLoading: isLoadingApiKey, refetch: refetchApiKey } = useQuery({
    queryKey: ['api-key-info', botId],
    queryFn: async () => {
      const response = await api.get<{
        id: string
        maskedKey: string
        botId: string
        isActive: boolean
        lastUsedAt: string | null
        createdAt: string
      }>(`/bots/${botId}/api-key`)
      return response.data
    },
    enabled: !!botId && activeTab === 'api',
  })

  // Update bot mutation
  const updateBot = useMutation({
    mutationFn: async (data: { name?: string; webhookUrl?: string; autoResponseEnabled?: boolean }) => {
      await api.put(`/bots/${botId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot updated successfully')
    },
    onError: () => {
      toast.error('Failed to update bot')
    },
  })

  const [editName, setEditName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    if (bot) {
      setEditName(bot.name)
      setWebhookUrl(bot.webhookUrl || '')
    }
  }, [bot])

  // Reveal API key function
  const handleRevealApiKey = async (password: string) => {
    const response = await api.post<{ key: string; expiresAt: string }>(
      `/bots/${botId}/api-key/reveal`,
      { password }
    )
    return response.data
  }

  const handleConnect = async () => {
    if (!botId) return
    try {
      await connectBot.mutateAsync(botId)
      setShowQRModal(true)
    } catch {
      setShowQRModal(false)
    }
  }

  const handleRestart = async () => {
    if (!botId) return
    try {
      await restartBot.mutateAsync(botId)
      setShowQRModal(true)
    } catch {
      setShowQRModal(false)
    }
  }

  // Regenerate API key mutation
  const regenerateApiKey = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        message: string
        key: string
        expiresAt: string
      }>(`/bots/${botId}/api-key/regenerate`, {})
      return response.data
    },
    onSuccess: (data) => {
      setRegeneratedKey({ key: data.key, expiresAt: data.expiresAt })
      setShowRegenerateConfirm(false)
      refetchApiKey()
      toast.success('API key regenerated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to regenerate API key')
    },
  })

  // Listen for real-time bot status updates
  useEffect(() => {
    if (!botId) return

    const handleBotStatus = (event: CustomEvent) => {
      const { botId: updatedBotId, status, phoneNumber } = event.detail
      console.log('[BotDetails] Bot status update received:', { botId: updatedBotId, status, phoneNumber })
      
      // Update bot in cache if it's the current bot
      if (updatedBotId === botId) {
        queryClient.setQueryData(['bot', botId], (oldBot: Bot | undefined) => {
          if (!oldBot) return oldBot
          console.log('[BotDetails] Updating bot status from', oldBot.status, 'to', status)
          return {
            ...oldBot,
            status,
            phoneNumber: phoneNumber || oldBot.phoneNumber,
          }
        })

        // Also update in the bots list cache
        queryClient.setQueryData(['bots'], (oldBots: Bot[] | undefined) => {
          if (!oldBots) return oldBots
          return oldBots.map(bot =>
            bot.id === updatedBotId
              ? { ...bot, status, phoneNumber: phoneNumber || bot.phoneNumber }
              : bot
          )
        })

        // Show toast notification for status changes
        if (status === 'connected') {
          toast.success('Bot connected successfully!')
          setShowQRModal(false)
          stopPolling()
        } else if (status === 'disconnected') {
          toast.error('Bot disconnected')
        }
      }
    }

    console.log('[BotDetails] Listening for bot status updates for bot:', botId)
    window.addEventListener('bot:status' as any, handleBotStatus)
    return () => {
      console.log('[BotDetails] Stopped listening for bot status updates')
      window.removeEventListener('bot:status' as any, handleBotStatus)
    }
  }, [botId, queryClient, stopPolling])

  // Status polling fallback when WebSocket is disconnected
  useEffect(() => {
    if (!botId) return

    // Start polling if WebSocket is not connected
    if (!isWebSocketConnected) {
      console.log('[BotDetails] WebSocket disconnected, starting status polling')
      
      const pollStatus = async () => {
        try {
          const response = await api.get<{
            botId: string
            status: string
            phoneNumber?: string
            health?: any
            lastActivity?: string
            uptime?: number
            reconnectAttempts?: number
          }>(`/bots/${botId}/status`)
          
          const statusData = response.data
          console.log('[BotDetails] Polled status:', statusData)

          // Update bot in cache
          queryClient.setQueryData(['bot', botId], (oldBot: Bot | undefined) => {
            if (!oldBot) return oldBot
            return {
              ...oldBot,
              status: statusData.status as Bot['status'],
              phoneNumber: statusData.phoneNumber || oldBot.phoneNumber,
            }
          })

          // Also update in the bots list cache
          queryClient.setQueryData(['bots'], (oldBots: Bot[] | undefined) => {
            if (!oldBots) return oldBots
            return oldBots.map(bot =>
              bot.id === botId
                ? { ...bot, status: statusData.status as Bot['status'], phoneNumber: statusData.phoneNumber || bot.phoneNumber }
                : bot
            )
          })
        } catch (error) {
          console.error('[BotDetails] Error polling status:', error)
          // If we get an error, assume WebSocket might be back
          setIsWebSocketConnected(true)
        }
      }

      // Poll immediately
      pollStatus()

      // Then poll every 5 seconds
      pollingIntervalRef.current = window.setInterval(pollStatus, 5000)
    } else {
      // Stop polling if WebSocket is connected
      if (pollingIntervalRef.current) {
        console.log('[BotDetails] WebSocket connected, stopping status polling')
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [botId, isWebSocketConnected, queryClient])

  const handleSaveSettings = () => {
    updateBot.mutate({
      name: editName,
      webhookUrl: webhookUrl || undefined,
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bot not found</p>
        <Button onClick={() => navigate('/bots')} className="mt-4">
          Back to Bots
        </Button>
      </div>
    )
  }

  const getStatusVariant = (status: Bot['status']) => {
    switch (status) {
      case 'connected':
        return 'success'
      case 'connecting':
      case 'qr_required':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <div className="page-shell max-w-6xl">
      {/* Header */}
      <div className="page-header">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/bots')}
          className="mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Bots
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
              Bot details
            </div>
            <h1 className="page-title">{bot.name}</h1>
            <p className="page-description">
              {bot.phoneNumber || 'No phone number'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {bot.status === 'connecting' && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Spinner size="sm" />
                <span>Connecting...</span>
              </div>
            )}
            <Badge variant={getStatusVariant(bot.status)}>
              {bot.status}
            </Badge>
            {(bot.status === 'disconnected' || bot.status === 'qr_required') && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (bot.status === 'qr_required') {
                    setShowQRModal(true)
                  } else {
                    handleConnect()
                  }
                }}
                disabled={connectBot.isPending}
                title={bot.status === 'qr_required' ? 'Show QR Code' : 'Connect'}
              >
                <SignalIcon className="h-4 w-4 mr-1" />
                {bot.status === 'qr_required' ? 'Show QR' : 'Connect'}
              </Button>
            )}
            {bot.status === 'connected' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRestart()}
                  disabled={restartBot.isPending}
                  title="Restart bot connection"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Restart
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => disconnectBot.mutate(botId!)}
                  disabled={disconnectBot.isPending}
                  title="Disconnect bot"
                >
                  <SignalSlashIcon className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <ChartBarIcon className="h-5 w-5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Cog6ToothIcon className="h-5 w-5" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`${
              activeTab === 'api'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <KeyIcon className="h-5 w-5" />
            API Keys
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Connection Status Alert */}
          {bot.status === 'connecting' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Spinner size="sm" />
                <div>
                  <h4 className="text-sm font-medium text-amber-900">Connecting to WhatsApp</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Please wait while we establish a connection. This may take a few moments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {bot.status === 'qr_required' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">QR Code Required</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    A QR code has been generated. Please scan it with WhatsApp to connect your bot.
                  </p>
                </div>
              </div>
            </div>
          )}

          {bot.status === 'disconnected' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-900">Bot Disconnected</h4>
                  <p className="text-sm text-red-700 mt-1">
                    The bot is currently disconnected. Click "Connect" to reconnect.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-sm font-medium text-gray-500">Total Messages</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {bot.messageCount || 0}
              </p>
            </Card>
            <Card>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <div className="mt-2 flex items-center gap-2">
                {bot.status === 'connecting' && <Spinner size="sm" />}
                <p className="text-3xl font-semibold text-gray-900 capitalize">
                  {bot.status}
                </p>
              </div>
            </Card>
            <Card>
              <h3 className="text-sm font-medium text-gray-500">Last Activity</h3>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {bot.lastActivity ? formatRelativeTime(bot.lastActivity) : 'Never'}
              </p>
            </Card>
          </div>

          {/* Bot Info */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bot Information</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Bot ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{bot.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{bot.phoneNumber || 'Not connected'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDateTime(bot.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDateTime(bot.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bot Settings</h3>
            <div className="space-y-4">
              <Input
                label="Bot Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                label="Webhook URL"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhook"
                helperText="Receive incoming messages at this URL"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  isLoading={updateBot.isPending}
                  disabled={updateBot.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-6">
          {/* Security Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">Security Warning</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p>
                    API keys provide full access to your bot. Keep them secure and never share them publicly.
                    Store them in environment variables or secure vaults.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Regenerated Key Display */}
          {regeneratedKey && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">New API Key Generated</h3>
              <ApiKeyDisplay
                apiKey={regeneratedKey.key}
                expiresAt={regeneratedKey.expiresAt}
                onClose={() => setRegeneratedKey(null)}
                showWarning={true}
              />
            </Card>
          )}

          {/* API Key Info */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Key</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsRevealModalOpen(true)}
                  disabled={!apiKeyInfo || isLoadingApiKey}
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View Full Key
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowRegenerateConfirm(true)}
                  disabled={!apiKeyInfo || isLoadingApiKey}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>

            {isLoadingApiKey ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : apiKeyInfo ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Masked API Key
                      </label>
                      <p className="font-mono text-sm text-gray-900 break-all">
                        {apiKeyInfo.maskedKey}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(apiKeyInfo.maskedKey)}
                      className="ml-4"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(apiKeyInfo.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Used</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {apiKeyInfo.lastUsedAt
                        ? formatRelativeTime(apiKeyInfo.lastUsedAt)
                        : 'Never'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1">
                      <Badge variant={apiKeyInfo.isActive ? 'success' : 'default'}>
                        {apiKeyInfo.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Key ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">{apiKeyInfo.id}</dd>
                  </div>
                </dl>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> For security reasons, enter your password to reveal
                    the full API key. You can reveal the same active key again later.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No API Key</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No API key found for this bot. It should have been generated automatically when the
                  bot connected.
                </p>
              </div>
            )}
          </Card>

          {/* Regenerate Confirmation Dialog */}
          {showRegenerateConfirm && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Regenerate API Key?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  This will invalidate your current API key immediately. Any applications using the old
                  key will stop working. Make sure to update all your integrations with the new key.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowRegenerateConfirm(false)}
                    className="flex-1"
                    disabled={regenerateApiKey.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => regenerateApiKey.mutate()}
                    className="flex-1"
                    isLoading={regenerateApiKey.isPending}
                    disabled={regenerateApiKey.isPending}
                  >
                    Regenerate Key
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* API Documentation */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API Documentation</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-600 mb-4">
                Use your API key to send messages programmatically:
              </p>
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X POST ${apiDocBase}/api/v1/messages/send \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+1234567890",
    "type": "text",
    "content": {
      "text": "Hello from API!"
    }
  }'`}
              </pre>
              <p className="text-sm text-gray-600 mt-4">
                For more information, check out the{' '}
                <a href="/docs/api" className="text-primary-600 hover:text-primary-700">
                  API documentation
                </a>
                .
              </p>
            </div>
          </Card>

          {/* API Key Reveal Modal */}
          <ApiKeyModal
            isOpen={isRevealModalOpen}
            onClose={() => setIsRevealModalOpen(false)}
            botId={botId!}
            botName={bot?.name || 'Bot'}
            onReveal={handleRevealApiKey}
          />
        </div>
      )}

      {/* QR Code Modal for Connect/Restart */}
      <Transition.Root show={showQRModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { setShowQRModal(false); stopPolling() }}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="relative bg-white rounded-lg px-6 py-6 shadow-xl max-w-md w-full">
                  <button type="button" className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" onClick={() => { setShowQRModal(false); stopPolling() }}>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 mb-4 text-center">
                    Connect Bot
                  </Dialog.Title>
                  <div className="flex flex-col items-center">
                    {hasTimedOut ? (
                      <div className="py-6 text-center">
                        <p className="text-gray-600 mb-4">QR code timed out. Please try again.</p>
                        <Button variant="primary" size="sm" onClick={() => { restartPolling(); handleConnect() }}>
                          Retry
                        </Button>
                      </div>
                    ) : !qrData?.qrCode ? (
                      <div className="py-8 text-center">
                        <Spinner size="lg" />
                        <p className="mt-4 text-sm text-gray-600">Generating QR code...</p>
                        <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setShowQRModal(false); stopPolling() }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                          <QRCodeSVG value={qrData.qrCode} size={256} level="H" />
                        </div>
                        <p className="mt-4 text-sm text-gray-600 text-center">Scan with WhatsApp → Linked Devices → Link a Device</p>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                          <Spinner size="sm" />
                          <span>Waiting for connection...</span>
                        </div>
                        <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setShowQRModal(false); stopPolling() }}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  )
}
