import { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Spinner from '../components/common/Spinner'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useBalance, useCreateTopup, useTransactions } from '../hooks/useBilling'
import { useQuota } from '../hooks/useQuota'
import type { UsageStats } from '../types/billing'
import toast from 'react-hot-toast'

// Mock usage stats for now
const mockUsageStats: UsageStats = {
  messagesThisMonth: 0,
  costThisMonth: 0,
  projectedMonthlyCost: 0,
  pricePerMessage: 0.01,
}

export default function BillingPage() {
  const { data: quotaInfo, isLoading: quotaLoading } = useQuota()
  const { data: balanceData, isLoading: balanceLoading } = useBalance()
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions()
  const [usageStats] = useState<UsageStats>(mockUsageStats)
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number>(50)

  const balance = balanceData ? parseFloat(balanceData.amount) : 0
  const currency = balanceData?.currency || 'EUR'
  const isLowBalance = balance < 10 // Low balance threshold
  const queryClient = useQueryClient()
  const createTopup = useCreateTopup()
  
  // Check if user is owner with unlimited access
  const isOwner = quotaInfo?.unlimited === true && quotaInfo?.role === 'owner'

  // Listen for real-time balance updates
  useEffect(() => {
    const handleBalanceUpdate = () => {
      // Invalidate balance and transactions queries
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    }

    window.addEventListener('balance:updated' as any, handleBalanceUpdate)
    window.addEventListener('balance:low' as any, handleBalanceUpdate)
    
    return () => {
      window.removeEventListener('balance:updated' as any, handleBalanceUpdate)
      window.removeEventListener('balance:low' as any, handleBalanceUpdate)
    }
  }, [queryClient])

  const presetAmounts = [50, 100, 250, 500]

  // Show loading state
  if (quotaLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Show owner account message
  if (isOwner) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
            Owner
          </div>
          <h1 className="page-title">Billing</h1>
          <p className="page-description">
            Owner Account - Unlimited Access
          </p>
        </div>

        <Card className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-3">
              <SparklesIcon className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Owner Account
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You have unlimited access to all platform features. Billing and payment management 
            is not applicable for owner accounts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600 mb-1">∞</div>
              <div className="text-sm text-gray-600">Unlimited Messages</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600 mb-1">∞</div>
              <div className="text-sm text-gray-600">Unlimited Bots</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600 mb-1">$0</div>
              <div className="text-sm text-gray-600">No Charges</div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
          Payments
        </div>
        <h1 className="page-title">Billing</h1>
        <p className="page-description">
          Manage your account balance and view transaction history
        </p>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Current Balance
              </h3>
              {balanceLoading ? (
                <Spinner size="lg" />
              ) : (
                <p className="text-4xl font-bold text-gray-900">
                  {formatCurrency(balance, currency)}
                </p>
              )}
              
              {isLowBalance && (
                <div className="mt-4 flex items-center gap-2 text-amber-600">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Low balance warning! Please add funds to continue service.
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              onClick={() => setIsAddFundsModalOpen(true)}
            >
              <CreditCardIcon className="h-5 w-5 mr-2" />
              Add Funds
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            Quick Stats
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Messages this month</p>
              <p className="text-lg font-semibold text-gray-900">
                {usageStats.messagesThisMonth.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cost this month</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(usageStats.costThisMonth, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Price per message</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(usageStats.pricePerMessage, currency)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Usage Statistics */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Usage Statistics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Messages This Month</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {usageStats.messagesThisMonth.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cost This Month</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(usageStats.costThisMonth, currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Projected Monthly Cost</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCurrency(usageStats.projectedMonthlyCost, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* Transaction History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Transaction History
        </h3>
        {transactionsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(transaction.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span
                      className={
                        transaction.type === 'topup'
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }
                    >
                      {transaction.type === 'topup' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount), currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={
                        transaction.status === 'completed'
                          ? 'success'
                          : transaction.status === 'pending'
                          ? 'warning'
                          : 'error'
                      }
                    >
                      {transaction.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {transaction.type === 'topup' && transaction.status === 'completed' && (
                      <button className="text-primary-600 hover:text-primary-700">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {/* Add Funds Modal */}
      {isAddFundsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsAddFundsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add Funds</h2>
              <button
                onClick={() => setIsAddFundsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Amount
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        selectedAmount === amount
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(amount, currency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Enter Custom Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    €
                  </span>
                  <input
                    type="number"
                    value={selectedAmount}
                    onChange={(e) => setSelectedAmount(Number(e.target.value))}
                    className="input pl-8"
                    min="50"
                    step="1"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Stripe:</strong> A payment intent will be created on the server.
                  Use the returned client secret with your Stripe payment form to complete the top-up.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setIsAddFundsModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await createTopup.mutateAsync(selectedAmount)
                      toast.success('Payment intent created. Complete the payment in your Stripe form.')
                      setIsAddFundsModalOpen(false)
                    } catch (error: any) {
                      toast.error(error?.response?.data?.error?.message || 'Failed to create payment intent')
                    }
                  }}
                  className="flex-1"
                  isLoading={createTopup.isPending}
                  disabled={createTopup.isPending || selectedAmount < 50}
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
