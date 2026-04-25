import Card from '../components/common/Card'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import { useAuthStore } from '../stores/authStore'

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
          Account
        </div>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage account details, API access, and webhook preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
          <div className="space-y-4 max-w-md">
            <Input
              label="Email"
              type="email"
              value={user?.email || ''}
              disabled
            />
            <div>
              <Button variant="secondary">Change Password</Button>
            </div>
          </div>
        </Card>

        {/* API Keys */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h3>
          <div className="space-y-4 max-w-xl">
            <p className="text-sm text-gray-600">
              API keys are created per bot. Open a bot, go to the API tab, then use
              "Show API Key" to view it after password verification.
            </p>
            <p className="text-sm text-gray-500">
              For security, keys are not shown on the global settings page and should
              only be copied when you are ready to configure your integration.
            </p>
          </div>
        </Card>

        {/* Webhooks */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhooks</h3>
          <div className="space-y-4 max-w-md">
            <Input
              label="Webhook URL"
              type="url"
              placeholder="https://your-domain.com/webhook"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Events
              </label>
              <div className="space-y-2">
                {['message.received', 'message.sent', 'bot.connected', 'bot.disconnected'].map((event) => (
                  <label key={event} className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-primary-600 mr-2" />
                    <span className="text-sm text-gray-700">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button variant="primary">Save Webhook Settings</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
