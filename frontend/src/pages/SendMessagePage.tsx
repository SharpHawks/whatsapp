import { useState, useRef } from 'react'
import { PaperAirplaneIcon, PhotoIcon, DocumentIcon, VideoCameraIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Input from '../components/common/Input'
import GroupSelector from '../components/bots/GroupSelector'
import ApiDocumentation from '../components/bots/ApiDocumentation'
import { useBots } from '../hooks/useBots'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

type TabType = 'contact' | 'group'
type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio'

const messageTypeConfig: Record<MessageType, { label: string; icon: any; accept: string }> = {
  text: { label: 'Text', icon: null, accept: '' },
  image: { label: 'Image', icon: PhotoIcon, accept: 'image/*' },
  video: { label: 'Video', icon: VideoCameraIcon, accept: 'video/*' },
  document: { label: 'Document', icon: DocumentIcon, accept: '.pdf,.doc,.docx,.xls,.xlsx' },
  audio: { label: 'Audio', icon: MusicalNoteIcon, accept: 'audio/*' },
}

export default function SendMessagePage() {
  const { data: bots = [] } = useBots()
  const [activeTab, setActiveTab] = useState<TabType>('contact')
  const [selectedBot, setSelectedBot] = useState<string>('')
  const [recipient, setRecipient] = useState<string>('')
  const [messageType, setMessageType] = useState<MessageType>('text')
  const [message, setMessage] = useState<string>('')
  const [caption, setCaption] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const connectedBots = bots.filter(bot => bot.status === 'connected')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBot) {
      toast.error('Please select a bot')
      return
    }

    if (!recipient) {
      const recipientType = activeTab === 'contact' ? 'phone number' : 'group'
      toast.error(`Please enter recipient ${recipientType}`)
      return
    }

    if (messageType === 'text' && !message) {
      toast.error('Please enter a message')
      return
    }

    if (messageType !== 'text' && !selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsSending(true)

    try {
      let payload: any = {
        to: recipient,
        type: messageType,
        content: {},
      }

      if (messageType === 'text') {
        payload.content.text = message
      } else if (selectedFile) {
        // Convert file to base64
        const base64 = await fileToBase64(selectedFile)
        payload.content = {
          base64,
          filename: selectedFile.name,
          caption: caption || undefined,
        }
      }

      await api.post(`/bots/${selectedBot}/messages`, payload)

      toast.success('Message sent successfully!')
      setRecipient('')
      setMessage('')
      setCaption('')
      setSelectedFile(null)
      setFilePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
    })
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setRecipient('')
  }

  const handleTypeChange = (type: MessageType) => {
    setMessageType(type)
    setSelectedFile(null)
    setFilePreview(null)
    setMessage('')
    setCaption('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page-shell max-w-4xl">
      <div className="page-header">
        <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
          Composer
        </div>
        <h1 className="page-title">Send Message</h1>
        <p className="page-description">
          Send WhatsApp messages, photos, videos, documents, and audio
        </p>
      </div>

      {connectedBots.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">
              No connected bots available. Please connect a bot first.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleTabChange('contact')}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'contact'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Send to Contact
              </button>
              <button
                onClick={() => handleTabChange('group')}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'group'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Send to Group
              </button>
            </nav>
          </div>

          <form onSubmit={handleSend} className="space-y-6">
            {/* Bot Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bot
              </label>
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="input"
                required
              >
                <option value="">Choose a bot...</option>
                {connectedBots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} ({bot.phoneNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient */}
            {activeTab === 'contact' ? (
              <div>
                <Input
                  label="Recipient Phone Number"
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="+1234567890"
                  required
                  helperText="Include country code (e.g., +1 for US, +371 for Latvia)"
                />
              </div>
            ) : (
              <GroupSelector
                botId={selectedBot}
                value={recipient}
                onChange={setRecipient}
              />
            )}

            {/* Message Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Type
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(messageTypeConfig) as MessageType[]).map((type) => {
                  const config = messageTypeConfig[type]
                  const Icon = config.icon
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeChange(type)}
                      className={`
                        flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors
                        ${messageType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }
                      `}
                    >
                      {Icon && <Icon className="h-6 w-6 mb-1" />}
                      <span className="text-xs font-medium">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Text Message */}
            {messageType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="input"
                  placeholder="Type your message here..."
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {message.length} characters
                </p>
              </div>
            )}

            {/* Media Upload */}
            {messageType !== 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {messageTypeConfig[messageType].label}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={messageTypeConfig[messageType].accept}
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

                {/* Preview */}
                {filePreview && (
                  <div className="mt-3">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="max-h-48 rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {selectedFile && !filePreview && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <DocumentIcon className="h-5 w-5 inline mr-2" />
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                )}

                {/* Caption */}
                <div className="mt-3">
                  <Input
                    label="Caption (optional)"
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                  />
                </div>
              </div>
            )}

            {/* Send Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSending}
                disabled={isSending}
              >
                <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                Send {messageTypeConfig[messageType].label}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Info Card */}
      <Card className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Tips for sending messages
        </h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• Text messages: simple and fast</li>
          <li>• Images: JPG, PNG, GIF, WebP supported</li>
          <li>• Videos: MP4, 3GP, MOV supported</li>
          <li>• Documents: PDF, Word, Excel supported</li>
          <li>• Audio: MP3, OGG, M4A supported</li>
          <li>• Max file size: 16 MB</li>
          <li>• Each message costs from your balance</li>
        </ul>
      </Card>

      {/* API Documentation */}
      <Card className="mt-6">
        <ApiDocumentation botId={selectedBot} />
      </Card>
    </div>
  )
}
