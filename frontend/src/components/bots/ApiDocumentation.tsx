import { useState } from 'react'
import { getApiBaseUrl } from '../../lib/api'
import { ChevronDownIcon, ChevronUpIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ApiDocumentationProps {
  botId?: string
  apiKey?: string
}

export default function ApiDocumentation({ botId, apiKey }: ApiDocumentationProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const apiUrl = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com')
  const exampleBotId = botId || 'your-bot-id'
  const exampleApiKey = apiKey || 'your-api-key'

  const contactExample = `curl -X POST ${apiUrl}/api/v1/messages/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${exampleApiKey}" \\
  -d '{
    "botId": "${exampleBotId}",
    "to": "+1234567890",
    "type": "text",
    "content": {
      "text": "Hello from WhatsApp API!"
    }
  }'`

  const groupExample = `curl -X POST ${apiUrl}/api/v1/messages/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${exampleApiKey}" \\
  -d '{
    "botId": "${exampleBotId}",
    "to": "123456789@g.us",
    "type": "text",
    "content": {
      "text": "Hello group members!"
    }
  }'`

  const responseExample = `{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "timestamp": "2024-01-15T10:30:00Z",
  "cost": 0.05
}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          📚 API Documentation
        </h3>
      </div>

      {/* Send to Contact */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('contact')}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-medium text-gray-900">Send Message to Contact</span>
          {expandedSection === 'contact' ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          )}
        </button>
        
        {expandedSection === 'contact' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">cURL Example:</p>
                <button
                  onClick={() => copyToClipboard(contactExample, 'Contact example')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                {contactExample}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Parameters:</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">botId</code> - Your bot ID (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">to</code> - Recipient phone number in E.164 format (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">type</code> - Message type: text, image, video, document, audio (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">content.text</code> - Message text content (required for text type)</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Send to Group */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('group')}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-medium text-gray-900">Send Message to Group</span>
          {expandedSection === 'group' ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          )}
        </button>
        
        {expandedSection === 'group' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">cURL Example:</p>
                <button
                  onClick={() => copyToClipboard(groupExample, 'Group example')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                {groupExample}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Parameters:</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">botId</code> - Your bot ID (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">to</code> - Group ID ending with @g.us (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">type</code> - Message type: text, image, video, document, audio (required)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">content.text</code> - Message text content (required for text type)</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> The bot must be a member of the group to send messages.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Response Format */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('response')}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
        >
          <span className="font-medium text-gray-900">Response Format</span>
          {expandedSection === 'response' ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          )}
        </button>
        
        {expandedSection === 'response' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Success Response (200 OK):</p>
                <button
                  onClick={() => copyToClipboard(responseExample, 'Response example')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                {responseExample}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Response Fields:</p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">messageId</code> - Unique message identifier</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">status</code> - Message status (queued, sent, delivered, read, failed)</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">timestamp</code> - Message timestamp in ISO 8601 format</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">cost</code> - Message cost in EUR</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Authentication */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">🔐 Authentication</h4>
        <p className="text-sm text-blue-800">
          All API requests require an API key in the <code className="bg-blue-100 px-2 py-1 rounded">X-API-Key</code> header.
          You can find your API key in the bot details page.
        </p>
      </div>
    </div>
  )
}
