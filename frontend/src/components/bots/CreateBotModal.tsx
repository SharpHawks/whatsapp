import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import Button from '../common/Button'
import Input from '../common/Input'
import Badge from '../common/Badge'
import Spinner from '../common/Spinner'
import ApiKeyDisplay from './ApiKeyDisplay'
import { useCreateBot, useBotQR } from '../../hooks/useBots'

const createBotSchema = z.object({
  name: z.string().min(1, 'Bot name is required').max(50, 'Name too long'),
})

type CreateBotForm = z.infer<typeof createBotSchema>

interface CreateBotModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateBotModal({ isOpen, onClose }: CreateBotModalProps) {
  const [step, setStep] = useState<'form' | 'qr' | 'connecting' | 'apikey'>('form')
  const [createdBotId, setCreatedBotId] = useState<string | null>(null)
  const [botStatus, setBotStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting')
  const [hasShownQR, setHasShownQR] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState<{ key: string; expiresAt: string } | null>(null)
  
  const createBot = useCreateBot()
  const { data: qrData, isPolling, hasTimedOut, stopPolling, restartPolling, error: qrError } = useBotQR(createdBotId || '')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateBotForm>({
    resolver: zodResolver(createBotSchema),
  })

  const onSubmit = async (data: CreateBotForm) => {
    try {
      const bot = await createBot.mutateAsync(data)
      setCreatedBotId(bot.id)
      setStep('qr')
    } catch (error) {
      setBotStatus('failed')
    }
  }

  // Monitor bot status changes
  useEffect(() => {
    console.log('QR Data changed:', { qrCode: qrData?.qrCode ? 'present' : 'null', createdBotId, hasShownQR })
    if (qrData?.qrCode) {
      // QR code is available, show it
      console.log('QR code is now available, setting hasShownQR to true')
      setHasShownQR(true)
    }
    // Don't auto-close on qrCode === null, wait for bot:status event instead
  }, [qrData, createdBotId, hasShownQR])

  // Listen for real-time QR code updates via WebSocket
  useEffect(() => {
    if (!createdBotId) return

    const handleQRUpdate = (event: CustomEvent) => {
      const { botId, qrCode } = event.detail
      if (botId === createdBotId && qrCode) {
        console.log('QR code received via WebSocket:', qrCode)
        setHasShownQR(true)
        // Force refetch to update the QR code
        // The useBotQR hook will automatically update
      }
    }

    const handleBotStatus = (event: CustomEvent) => {
      const { botId, status } = event.detail
      if (botId === createdBotId) {
        console.log('Bot status update:', status)
        if (status === 'connected') {
          setBotStatus('connected')
          stopPolling()
          // Don't auto-close, wait for API key
        }
      }
    }

    const handleApiKeyGenerated = (event: CustomEvent) => {
      const { botId, key, expiresAt } = event.detail
      if (botId === createdBotId) {
        console.log('API key generated:', { botId, expiresAt })
        setGeneratedApiKey({ key, expiresAt })
        setStep('apikey')
      }
    }

    window.addEventListener('bot:qr' as any, handleQRUpdate)
    window.addEventListener('bot:status' as any, handleBotStatus)
    window.addEventListener('bot:apikey:generated' as any, handleApiKeyGenerated)

    return () => {
      window.removeEventListener('bot:qr' as any, handleQRUpdate)
      window.removeEventListener('bot:status' as any, handleBotStatus)
      window.removeEventListener('bot:apikey:generated' as any, handleApiKeyGenerated)
    }
  }, [createdBotId])

  const handleClose = () => {
    stopPolling()
    setStep('form')
    setCreatedBotId(null)
    setBotStatus('connecting')
    setHasShownQR(false)
    setGeneratedApiKey(null)
    reset()
    onClose()
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {step === 'form' && (
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                    >
                      Create New Bot
                    </Dialog.Title>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <Input
                        {...register('name')}
                        label="Bot Name"
                        placeholder="e.g., Customer Support Bot"
                        error={errors.name?.message}
                        autoFocus
                      />

                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <p className="text-sm text-blue-800">
                          After creating the bot, you'll need to scan a QR code with WhatsApp
                          to connect your phone number.
                        </p>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleClose}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          variant="primary" 
                          className="flex-1"
                          isLoading={createBot.isPending}
                          disabled={createBot.isPending}
                        >
                          Create Bot
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {step === 'qr' && (
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 mb-4 text-center"
                    >
                      Scan QR Code
                    </Dialog.Title>

                    <div className="flex flex-col items-center">
                      {/* QR Error State */}
                      {qrError ? (
                        <div className="flex flex-col items-center py-8">
                          <div className="rounded-full bg-red-100 p-3 mb-4">
                            <XMarkIcon className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-lg font-medium text-gray-900 mb-2">Connection Error</p>
                          <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
                            {(qrError as any)?.message || 'An error occurred while generating QR code. Please try again.'}
                          </p>
                          <div className="flex gap-3">
                            <Button
                              variant="secondary"
                              onClick={handleClose}
                            >
                              Close
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => {
                                restartPolling()
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : /* Success State */
                      botStatus === 'connected' ? (
                        <div className="text-center py-8">
                          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg
                              className="h-6 w-6 text-green-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Successfully Connected!
                          </h3>
                          <p className="mt-2 text-sm text-gray-500">
                            Your bot is now ready to use
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
                              onClick={handleClose}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => {
                                restartPolling()
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : /* Failed State */
                      botStatus === 'failed' ? (
                        <div className="mt-6 text-center">
                          <div className="rounded-full bg-red-100 p-3 mb-4 mx-auto w-fit">
                            <XMarkIcon className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-sm text-red-600 mb-4">
                            Connection failed. Please try again.
                          </p>
                          <Button
                            variant="primary"
                            onClick={handleClose}
                          >
                            Close
                          </Button>
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
                            onClick={handleClose}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : /* QR Code Display */
                      (
                        <>
                          <div className="mb-4">
                            <Badge variant="warning">
                              Waiting for connection
                            </Badge>
                          </div>

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
                              onClick={handleClose}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {step === 'apikey' && generatedApiKey && (
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 mb-4 text-center"
                    >
                      Bot Connected Successfully!
                    </Dialog.Title>

                    <div className="mb-6 text-center">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                        <svg
                          className="h-6 w-6 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">
                        Your bot is now connected and ready to use. Here's your API key:
                      </p>
                    </div>

                    <ApiKeyDisplay
                      apiKey={generatedApiKey.key}
                      expiresAt={generatedApiKey.expiresAt}
                      onClose={handleClose}
                      showWarning={true}
                    />

                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Next steps:</strong> You can view your API key again in the bot details
                        page after password verification.
                      </p>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
