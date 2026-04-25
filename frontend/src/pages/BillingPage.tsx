import { useState } from 'react'
import {
  CreditCardIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Spinner from '../components/common/Spinner'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useTransactions } from '../hooks/useBilling'
import {
  useCurrentSubscription,
  useCancelSubscription,
  useReactivateSubscription,
  useBillingPortal,
} from '../hooks/useSubscription'
import toast from 'react-hot-toast'

export default function BillingPage() {
  const { data: subInfo, isLoading: subLoading } = useCurrentSubscription()
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const cancelSubscription = useCancelSubscription()
  const reactivateSubscription = useReactivateSubscription()
  const billingPortal = useBillingPortal()

  const isOwner = subInfo?.unlimited === true && subInfo?.role === 'owner'

  const handleCancel = async () => {
    try {
      await cancelSubscription.mutateAsync()
      toast.success('Subscription will be cancelled at the end of the current period')
      setShowCancelConfirm(false)
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to cancel subscription')
    }
  }

  const handleReactivate = async () => {
    try {
      await reactivateSubscription.mutateAsync()
      toast.success('Subscription reactivated successfully')
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to reactivate subscription')
    }
  }

  const handleManageBilling = async () => {
    try {
      const result = await billingPortal.mutateAsync()
      if (result.url) {
        window.open(result.url, '_blank')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to open billing portal')
    }
  }

  // Show loading state
  if (subLoading) {
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

  const plan = subInfo?.plan
  const usage = subInfo?.usage
  const subscription = subInfo?.subscription
  const isFreePlan = plan?.slug === 'free' || plan?.slug === 'none'
  const isCancelled = subscription?.cancelAtPeriodEnd

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="mb-3 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
          Billing
        </div>
        <h1 className="page-title">Subscription & Billing</h1>
        <p className="page-description">
          Manage your subscription plan and view billing history
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Current Plan
              </h3>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold text-gray-900">
                  {plan?.name || 'No Plan'}
                </p>
                {isCancelled && (
                  <Badge variant="warning">Cancels soon</Badge>
                )}
                {!isFreePlan && !isCancelled && subscription?.status === 'active' && (
                  <Badge variant="success">Active</Badge>
                )}
              </div>

              {!isFreePlan && plan?.priceMonthly !== undefined && (
                <p className="mt-1 text-lg text-gray-600">
                  {formatCurrency(plan.priceMonthly, 'EUR')}/month
                  {subscription?.billingInterval === 'yearly' && (
                    <span className="ml-2 text-sm text-green-600">(Billed yearly)</span>
                  )}
                </p>
              )}

              {subscription?.currentPeriodEnd && (
                <p className="mt-2 text-sm text-gray-500">
                  {isCancelled
                    ? `Access until ${formatDateTime(subscription.currentPeriodEnd)}`
                    : `Renews on ${formatDateTime(subscription.currentPeriodEnd)}`
                  }
                </p>
              )}

              {usage && plan?.messageQuota !== null && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Messages used</span>
                    <span className="font-medium text-gray-900">
                      {usage.messagesUsed} / {plan.messageQuota}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usage.usagePercentage >= 90
                          ? 'bg-red-500'
                          : usage.usagePercentage >= 75
                          ? 'bg-amber-500'
                          : 'bg-primary-600'
                      }`}
                      style={{ width: `${Math.min(usage.usagePercentage, 100)}%` }}
                    />
                  </div>
                  {usage.usagePercentage >= 90 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-600">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        You are approaching your message limit. Consider upgrading your plan.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {usage && plan?.botLimit !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <span>Bots:</span>
                  <span className="font-medium text-gray-900">
                    {usage.currentBots} / {plan.botLimit}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/plans">
              <Button variant="primary">
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Change Plan
              </Button>
            </Link>

            {!isFreePlan && (
              <Button
                variant="secondary"
                onClick={handleManageBilling}
                isLoading={billingPortal.isPending}
              >
                <CreditCardIcon className="h-5 w-5 mr-2" />
                Manage Billing
                <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
              </Button>
            )}

            {!isFreePlan && !isCancelled && (
              <Button
                variant="danger"
                onClick={() => setShowCancelConfirm(true)}
                isLoading={cancelSubscription.isPending}
              >
                <XMarkIcon className="h-5 w-5 mr-2" />
                Cancel Subscription
              </Button>
            )}

            {isCancelled && (
              <Button
                variant="primary"
                onClick={handleReactivate}
                isLoading={reactivateSubscription.isPending}
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                Reactivate Subscription
              </Button>
            )}
          </div>
        </Card>

        {/* Quick Stats */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            Plan Features
          </h3>
          <ul className="space-y-2">
            {plan?.features?.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckIcon className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                {feature}
              </li>
            )) || (
              <li className="text-sm text-gray-500">No features listed</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Legacy Transaction History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Transaction History
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Legacy wallet transactions from the previous billing system.
        </p>
        {transactionsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No transactions found.</p>
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
                        {formatCurrency(Math.abs(transaction.amount), 'EUR')}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription?</h2>
            <p className="text-gray-600 mb-6">
              Your subscription will remain active until{' '}
              <strong>{subscription?.currentPeriodEnd ? formatDateTime(subscription.currentPeriodEnd) : 'the end of the current period'}</strong>.
              After that, you will be downgraded to the Free plan.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1"
              >
                Keep Subscription
              </Button>
              <Button
                variant="danger"
                onClick={handleCancel}
                isLoading={cancelSubscription.isPending}
                className="flex-1"
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
