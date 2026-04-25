import { useState, useEffect } from 'react'
import { ClipboardDocumentIcon, CheckIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import Button from '../common/Button'

interface ApiKeyDisplayProps {
  apiKey: string
  expiresAt?: string
  onClose?: () => void
  showWarning?: boolean
}

export default function ApiKeyDisplay({ 
  apiKey, 
  expiresAt, 
  onClose,
  showWarning = true 
}: ApiKeyDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  // Calculate time remaining until expiration
  useEffect(() => {
    if (!expiresAt) return

    const updateTimeRemaining = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeRemaining('Expired')
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const toggleVisibility = () => {
    setVisible(!visible)
  }

  const displayKey = visible ? apiKey : '•'.repeat(apiKey.length)

  // Clear key from memory on unmount
  useEffect(() => {
    return () => {
      // Clear the key variable
      apiKey = ''
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Warning Message */}
      {showWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Important: Keep this API key secret
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Anyone with this key can send messages through this bot. Copy it only into
                  trusted systems and rotate it if you suspect it was exposed.
                  {expiresAt && timeRemaining && (
                    <span className="font-semibold"> Time remaining: {timeRemaining}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Display */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 font-mono text-sm break-all">
            {displayKey}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleVisibility}
            title={visible ? 'Hide key' : 'Show key'}
          >
            {visible ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="h-5 w-5 text-green-600" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </Button>
        </div>
        {copied && (
          <p className="mt-2 text-sm text-green-600">Copied to clipboard!</p>
        )}
      </div>

      {/* Expiration Info */}
      {expiresAt && (
        <div className="text-sm text-gray-600">
          <p>
            This screen will hide the key after{' '}
            <span className="font-medium">{new Date(expiresAt).toLocaleString()}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            You can reveal the same active key again later after password verification.
          </p>
        </div>
      )}

      {/* Close Button */}
      {onClose && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            I've Saved the Key
          </Button>
        </div>
      )}
    </div>
  )
}
