import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Button from '../common/Button'
import Input from '../common/Input'
import ApiKeyDisplay from './ApiKeyDisplay'

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

type PasswordForm = z.infer<typeof passwordSchema>

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  botId: string
  botName: string
  onReveal: (password: string) => Promise<{ key: string; expiresAt: string }>
}

export default function ApiKeyModal({
  isOpen,
  onClose,
  botId,
  botName,
  onReveal,
}: ApiKeyModalProps) {
  const [step, setStep] = useState<'password' | 'display'>('password')
  const [apiKey, setApiKey] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState<number>(5)
  const [isLocked, setIsLocked] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordForm) => {
    if (isLocked) {
      setError('Too many failed attempts. Please try again later.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await onReveal(data.password)
      setApiKey(result.key)
      setExpiresAt(result.expiresAt)
      setStep('display')
      // Reset attempts on success
      setAttemptsLeft(5)
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error?.message || err?.message || 'Failed to reveal API key'
      
      // Check if it's an authentication error
      if (err?.response?.status === 401 || errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('invalid')) {
        const newAttemptsLeft = attemptsLeft - 1
        setAttemptsLeft(newAttemptsLeft)
        
        if (newAttemptsLeft <= 0) {
          setIsLocked(true)
          setError('Too many failed attempts. Please close this window and try again later.')
        } else {
          // Show custom message instead of backend message
          setError(`Invalid password. ${newAttemptsLeft} attempt${newAttemptsLeft !== 1 ? 's' : ''} remaining.`)
        }
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStep('password')
    setApiKey('')
    setExpiresAt('')
    setError('')
    setShowPassword(false)
    setAttemptsLeft(5)
    setIsLocked(false)
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
                <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {step === 'password' && (
                  <div>
                    <div className="flex items-center justify-between mb-2 pr-8">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold leading-6 text-gray-900"
                      >
                        Reveal API Key
                      </Dialog.Title>
                      <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                        attemptsLeft <= 2 
                          ? 'bg-red-100 text-red-700' 
                          : attemptsLeft <= 3 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {attemptsLeft} / 5
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-6">
                      Enter your password to view the API key for <span className="font-medium">{botName}</span>
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div className="relative">
                        <Input
                          {...register('password')}
                          type={showPassword ? 'text' : 'password'}
                          label="Password"
                          placeholder="Enter your password"
                          error={errors.password?.message}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <p className="text-sm text-blue-800">
                          <strong>Security Note:</strong> Your password is required to view sensitive
                          information. We never store your password in plain text.
                        </p>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleClose}
                          className="flex-1"
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          className="flex-1"
                          isLoading={isLoading}
                          disabled={isLoading || isLocked}
                        >
                          {isLocked ? 'Locked' : 'Show API Key'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {step === 'display' && (
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                    >
                      API Key for {botName}
                    </Dialog.Title>

                    <ApiKeyDisplay
                      apiKey={apiKey}
                      expiresAt={expiresAt}
                      onClose={handleClose}
                      showWarning={true}
                    />
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
