import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useQueryClient } from '@tanstack/react-query'
import Card from '../components/common/Card'
import Spinner from '../components/common/Spinner'
import Button from '../components/common/Button'
import { useDashboardStats } from '../hooks/useDashboard'
import { useCurrentSubscription } from '../hooks/useSubscription'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats()
  const { data: subInfo } = useCurrentSubscription()
  const queryClient = useQueryClient()

  // Listen for real-time updates
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    }

    const handleQuotaUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    }

    window.addEventListener('message:new' as any, handleUpdate)
    window.addEventListener('balance:updated' as any, handleUpdate)
    window.addEventListener('bot:status' as any, handleUpdate)
    window.addEventListener('quota:updated' as any, handleQuotaUpdate)

    return () => {
      window.removeEventListener('message:new' as any, handleUpdate)
      window.removeEventListener('balance:updated' as any, handleUpdate)
      window.removeEventListener('bot:status' as any, handleUpdate)
      window.removeEventListener('quota:updated' as any, handleQuotaUpdate)
    }
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load dashboard. Please try again.</p>
      </div>
    )
  }

  const plan = subInfo?.plan
  const usage = subInfo?.usage
  const isQuotaWarning = usage && plan?.messageQuota && usage.messagesRemaining < plan.messageQuota * 0.1

  return (
    <div className="page-shell">
      <div className="page-header sm:flex sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
            Live workspace
          </div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Track bots, usage, balance, and message traffic from one clean overview.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link to="/bots">
            <Button variant="primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Bot
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:-translate-y-1 hover:shadow-glow">
          <div className="flex items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
              <ChatBubbleLeftRightIcon className="h-6 w-6" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-semibold text-slate-500">Total Messages</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {stats?.totalMessages.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="group hover:-translate-y-1 hover:shadow-glow">
          <div className="flex items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <DevicePhoneMobileIcon className="h-6 w-6" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-semibold text-slate-500">Active Bots</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {stats?.activeBots || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className={isQuotaWarning ? 'border-amber-200 bg-amber-50/80' : 'group hover:-translate-y-1 hover:shadow-glow'}>
          <div className="flex items-center">
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ${isQuotaWarning ? 'bg-amber-100 text-amber-600 ring-amber-200' : 'bg-sky-50 text-sky-600 ring-sky-100'}`}>
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-semibold text-slate-500">Plan</p>
              <p className={`mt-1 text-2xl font-bold tracking-tight ${isQuotaWarning ? 'text-amber-600' : 'text-slate-950'}`}>
                {plan?.name || 'Free'}
              </p>
              {usage && plan?.messageQuota !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {usage.messagesUsed} / {plan.messageQuota} messages
                </p>
              )}
              {isQuotaWarning && (
                <p className="mt-1 text-xs text-amber-600">Low quota remaining!</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="group hover:-translate-y-1 hover:shadow-glow">
          <div className="flex items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <PaperAirplaneIcon className="h-6 w-6" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-semibold text-slate-500">Messages Today</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {stats?.messagesToday.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Message Volume Chart */}
      <Card>
        <h3 className="mb-1 text-lg font-semibold text-slate-950">
          Message Volume (Last 30 Days)
        </h3>
        <p className="mb-6 text-sm text-slate-500">Daily message activity across all connected bots.</p>
        {stats?.messagesByDay && stats.messagesByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.messagesByDay.reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [value, 'Messages']}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#059669" 
                strokeWidth={3}
                dot={{ fill: '#059669' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No message data available yet
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Quick Actions
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Get started with common tasks
          </p>
          <div className="space-y-2">
            <Link to="/bots">
              <Button variant="secondary" className="w-full justify-start">
                <PlusIcon className="h-5 w-5 mr-2" />
                Create New Bot
              </Button>
            </Link>
            <Link to="/plans">
              <Button variant="secondary" className="w-full justify-start">
                <SparklesIcon className="h-5 w-5 mr-2" />
                Upgrade Plan
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="secondary" className="w-full justify-start">
                <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                View Messages
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            This Month
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Your activity summary
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Messages Sent</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.messagesThisPeriod.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Bots</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.activeBots || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Current Plan</span>
              <span className="text-sm font-semibold text-gray-900">
                {plan?.name || 'Free'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Messages Remaining</span>
              <span className="text-sm font-semibold text-gray-900">
                {usage?.messagesRemaining ?? '∞'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
