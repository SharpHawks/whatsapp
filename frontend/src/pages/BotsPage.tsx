import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, QrCodeIcon, TrashIcon, XMarkIcon, ArrowPathIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, Transition } from '@headlessui/react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import EmptyState from '../components/common/EmptyState'
import Spinner from '../components/common/Spinner'
import CreateBotModal from '../components/bots/CreateBotModal'
import { formatRelativeTime } from '../lib/utils'
import { useBots, useDeleteBot, useConnectBot, useRestartBot, useBotQR } from '../hooks/useBots'
import type { Bot } from '../types/bot'

export default function BotsPage() {
  const navigate = useNavigate()
  const { data: bots = [], isLoading, error } = useBots()
  const deleteBot = useDeleteBot()
  const connectBot = useConnectBot()
  const restartBot = useRestartBot()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [reconnectBotId, setReconnectBotId] = useState<string | null>(null)
  const { data: qrData, isPolling, hasTimedOut, stopPolling, restartPolling, error: qrError } = useBotQR(reconnectBotId || '')
  const queryClient = useQueryClient()

  const handleReconnect = async (botId: string) => {
    try {
      setReconnectBotId(botId)
      await connectBot.mutateAsync(botId)
    } catch (error: any) {
      console.error('[BotsPage] Failed to reconnect bot:', error)
      
      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to connect bot'
      toast.error(errorMessage, { duration: 5000 })
      
      // Close modal on error
      setReconnectBotId(null)
    }
  }

  // Track connection success
  const [isConnected, setIsConnected] = useState(false)

  // Listen for real-time bot status updates
  useEffect(() => {
    const handleBotStatus = (event: CustomEvent) => {
      const { botId, status, phoneNumber } = event.detail
      console.log('[BotsPage] Bot status update received:', { botId, status, phoneNumber })
      
      // Update bot in cache with visual feedback
      queryClient.setQueryData(['bots'], (oldBots: Bot[] | undefined) => {
        if (!oldBots) return oldBots
        
        const updatedBots = oldBots.map(bot => {
          if (bot.id === botId) {
            const oldStatus = bot.status
            console.log(`[BotsPage] Updating bot ${botId} status: ${oldStatus} → ${status}`)
            return { ...bot, status, phoneNumber: phoneNumber || bot.phoneNumber }
          }
          return bot
        })
        
        return updatedBots
      })

      // Show success state and close reconnect modal if this bot connected
      if (botId === reconnectBotId && status === 'connected') {
        console.log('[BotsPage] Reconnect successful, showing success state')
        setIsConnected(true)
        stopPolling()
        setTimeout(() => {
          console.log('[BotsPage] Closing reconnect modal')
          setReconnectBotId(null)
          setIsConnected(false)
        }, 2000)
      }

      // Show toast notifications for status changes
      if (status === 'connected') {
        toast.success(`Bot connected successfully!`, { duration: 3000 })
      } else if (status === 'disconnected') {
        toast.error(`Bot disconnected`, { duration: 3000 })
      }
    }

    console.log('[BotsPage] Listening for bot status updates')
    window.addEventListener('bot:status' as any, handleBotStatus)
    return () => {
      console.log('[BotsPage] Stopped listening for bot status updates')
      window.removeEventListener('bot:status' as any, handleBotStatus)
    }
  }, [queryClient, reconnectBotId, stopPolling])

  const getStatusVariant = (status: Bot['status']) => {
    switch (status) {
      case 'connected':
        return 'success'
      case 'connecting':
      case 'qr_required':
        return 'warning'
      case 'disconnected':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: Bot['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting'
      case 'qr_required':
        return 'Scan QR Code'
      case 'disconnected':
        return 'Disconnected'
      default:
        return status
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header sm:flex sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
            Bot fleet
          </div>
          <h1 className="page-title">Bots</h1>
          <p className="page-description">
            Manage WhatsApp connections, QR sessions, and API access for every bot.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Bot
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load bots. Please try again.</p>
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          icon={<QrCodeIcon className="h-12 w-12" />}
          title="No bots yet"
          description="Get started by creating your first WhatsApp bot instance"
          action={
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Your First Bot
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="group hover:-translate-y-1 hover:shadow-glow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                    <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  </div>
                  <h3 className="truncate text-lg font-bold text-slate-950">
                    {bot.name}
                  </h3>
                  {bot.phoneNumber && (
                    <p className="mt-1 text-sm text-slate-500">{bot.phoneNumber}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {bot.status === 'connecting' && (
                    <Spinner size="sm" />
                  )}
                  <Badge 
                    variant={getStatusVariant(bot.status)}
                    className="transition-all duration-300 ease-in-out"
                  >
                    {getStatusLabel(bot.status)}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                {bot.status === 'connecting' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <p className="text-xs font-medium text-sky-800">
                      Restoring connection... This usually takes 2-5 seconds.
                    </p>
                  </div>
                )}
                {bot.status === 'qr_required' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-800">
                      Click the QR button below to scan and connect.
                    </p>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Messages</span>
                  <span className="font-semibold text-slate-950">
                    {(bot.messageCount || 0).toLocaleString()}
                  </span>
                </div>
                {bot.lastActivity && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Last activity</span>
                    <span className="font-semibold text-slate-950">
                      {formatRelativeTime(bot.lastActivity)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`/bots/${bot.id}`)}
                >
                  View Details
                </Button>
                {(bot.status === 'disconnected' || bot.status === 'qr_required') && (
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => {
                      if (bot.status === 'qr_required') {
                        setReconnectBotId(bot.id)
                      } else {
                        handleReconnect(bot.id)
                      }
                    }}
                    disabled={connectBot.isPending}
                    title={bot.status === 'qr_required' ? 'Show QR Code' : 'Reconnect'}
                  >
                    <QrCodeIcon className="h-4 w-4" />
                  </Button>
                )}
                {bot.status === 'connected' && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={async () => {
                      setReconnectBotId(bot.id)
                      try {
                        await restartBot.mutateAsync(bot.id)
                      } catch {
                        setReconnectBotId(null)
                      }
                    }}
                    disabled={restartBot.isPending}
                    title="Restart bot"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this bot?')) {
                      deleteBot.mutate(bot.id)
                    }
                  }}
                  disabled={deleteBot.isPending}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Bot Modal */}
      <CreateBotModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Reconnect QR Modal */}
      <Transition.Root show={!!reconnectBotId} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setReconnectBotId(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={() => setReconnectBotId(null)}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 mb-4 text-center"
                    >
                      Reconnect Bot
                    </Dialog.Title>

                    <div className="flex flex-col items-center">
                      {/* Error State */}
                      {qrError ? (
                        <div className="flex flex-col items-center py-8">
                          <div className="rounded-full bg-red-100 p-3 mb-4">
                            <XMarkIcon className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-lg font-medium text-gray-900 mb-2">Connection Error</p>
                          <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                            {(qrError as any)?.message || 'An error occurred while connecting. Please try again.'}
                          </p>
                          <div className="flex gap-3">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                stopPolling()
                                setReconnectBotId(null)
                              }}
                            >
                              Close
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => {
                                restartPolling()
                                handleReconnect(reconnectBotId!)
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : /* Success State */
                      isConnected ? (
                        <div className="flex flex-col items-center py-8">
                          <div className="rounded-full bg-green-100 p-3 mb-4">
                            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-lg font-medium text-gray-900 mb-2">Bot Connected Successfully!</p>
                          <p className="text-sm text-gray-600 text-center max-w-sm">
                            Your bot is now connected and ready to send messages.
                          </p>
                        </div>
                      ) : /* Timeout State */
                      hasTimedOut ? (
                        <div className="flex flex-col items-center py-8">
                          <div className="rounded-full bg-red-100 p-3 mb-4">
                            <XMarkIcon className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-lg font-medium text-gray-900 mb-2">QR Code Generation Timed Out</p>
                          <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                            The QR code could not be generated within 30 seconds. Please try again.
                          </p>
                          <div className="flex gap-3">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                stopPolling()
                                setReconnectBotId(null)
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => {
                                restartPolling()
                                handleReconnect(reconnectBotId!)
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : /* Loading State */
                      !qrData?.qrCode ? (
                        <div className="flex flex-col items-center py-8">
                          <Spinner size="lg" />
                          <p className="mt-4 text-sm text-gray-600">Generating QR code...</p>
                          <p className="mt-2 text-xs text-gray-500">This usually takes a few seconds</p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              stopPolling()
                              setReconnectBotId(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : /* QR Code Display */
                      (
                        <>
                          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                            <QRCodeSVG value={qrData.qrCode} size={256} level="H" />
                          </div>

                          <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600 mb-4">
                              Open WhatsApp on your phone and scan this QR code
                            </p>
                            <ol className="text-xs text-gray-500 text-left space-y-2 max-w-xs mx-auto">
                              <li>1. Open WhatsApp on your phone</li>
                              <li>2. Tap Menu or Settings and select Linked Devices</li>
                              <li>3. Tap on Link a Device</li>
                              <li>4. Point your phone at this screen to scan the code</li>
                            </ol>
                            
                            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                              <Spinner size="sm" />
                              <span>Waiting for connection...</span>
                            </div>

                            <Button
                              variant="secondary"
                              size="sm"
                              className="mt-4"
                              onClick={() => {
                                stopPolling()
                                setReconnectBotId(null)
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
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
