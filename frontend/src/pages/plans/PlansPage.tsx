import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckIcon,
  XMarkIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../../stores/authStore'
import { useSubscriptionPlans, useCreateCheckout, useCurrentSubscription } from '../../hooks/useSubscription'
import Spinner from '../../components/common/Spinner'
import toast from 'react-hot-toast'

export default function PlansPage() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')

  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans()
  const { data: currentSub } = useCurrentSubscription()
  const createCheckout = useCreateCheckout()

  const handleSubscribe = async (planSlug: string) => {
    if (!isAuthenticated) {
      navigate(`/register?plan=${planSlug}&billingInterval=${billingInterval}`)
      return
    }

    try {
      const result = await createCheckout.mutateAsync({
        planSlug,
        billingInterval,
      })

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to start checkout')
    }
  }

  const isCurrentPlan = (planSlug: string) => {
    return currentSub?.plan?.slug === planSlug && currentSub?.subscription?.status === 'active'
  }

  const isDowngrade = (planPrice: number) => {
    if (!currentSub?.plan?.priceMonthly) return false
    return planPrice < currentSub.plan.priceMonthly
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">WhatsApp API</span>
            </Link>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Pricing</h2>
            <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Simple, transparent pricing
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Choose the plan that fits your needs. All plans include core features.
              Upgrade or downgrade at any time.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="mt-10 flex justify-center">
            <div className="relative flex rounded-full bg-gray-100 p-1">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={`relative rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  billingInterval === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('yearly')}
                className={`relative rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  billingInterval === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Yearly
                <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          {plansLoading ? (
            <div className="mt-16 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-4">
              {plans?.map((plan) => {
                const isCurrent = isCurrentPlan(plan.slug)
                const price = billingInterval === 'yearly' ? plan.priceYearly : plan.priceMonthly
                const isPopular = plan.slug === 'pro'

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                      isPopular
                        ? 'border-primary-600 ring-1 ring-primary-600'
                        : 'border-gray-200'
                    } ${isCurrent ? 'bg-primary-50/50' : 'bg-white'}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-gray-900">
                          {price === 0 ? 'Free' : `€${price}`}
                        </span>
                        {price > 0 && (
                          <span className="ml-2 text-sm text-gray-500">
                            /{billingInterval === 'yearly' ? 'year' : 'month'}
                          </span>
                        )}
                      </div>
                      {billingInterval === 'yearly' && price > 0 && (
                        <p className="mt-1 text-xs text-green-600">
                          Save €{((plan.priceMonthly * 12) - plan.priceYearly).toFixed(2)} per year
                        </p>
                      )}
                    </div>

                    <ul className="mb-8 flex-1 space-y-3">
                      {plan.features?.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckIcon className="h-5 w-5 shrink-0 text-green-500" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-700"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.slug)}
                        disabled={createCheckout.isPending || (plan.priceMonthly > 0 && isDowngrade(plan.priceMonthly))}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                          plan.priceMonthly === 0
                            ? 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                            : isPopular
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {createCheckout.isPending ? 'Loading...' : plan.priceMonthly === 0 ? 'Get Started' : 'Subscribe'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* FAQ */}
          <div className="mx-auto mt-24 max-w-3xl">
            <h3 className="text-center text-2xl font-bold text-gray-900">Frequently Asked Questions</h3>
            <dl className="mt-10 space-y-8">
              {[
                {
                  q: 'Can I change my plan later?',
                  a: 'Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately, while downgrades apply at the end of your current billing period.',
                },
                {
                  q: 'What happens if I exceed my message quota?',
                  a: 'Once you reach your monthly message limit, you will not be able to send additional messages until your quota resets or you upgrade to a higher plan.',
                },
                {
                  q: 'Is there a free trial?',
                  a: 'Yes, new users get a 7-day free trial of the Pro plan. No credit card required to start.',
                },
                {
                  q: 'How do I cancel my subscription?',
                  a: 'You can cancel anytime from your billing page. Your access continues until the end of the current billing period.',
                },
              ].map((faq, idx) => (
                <div key={idx}>
                  <dt className="text-base font-semibold text-gray-900">{faq.q}</dt>
                  <dd className="mt-2 text-base text-gray-600">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} WhatsApp API Platform
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link to="/terms" className="hover:text-gray-900">Terms</Link>
              <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
