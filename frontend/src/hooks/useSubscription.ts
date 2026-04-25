import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string
  priceMonthly: number
  priceYearly: number
  messageQuota: number
  botLimit: number
  features: string[]
  stripePriceId?: string
  stripePriceIdYearly?: string
  isActive: boolean
  sortOrder: number
}

export interface SubscriptionInfo {
  role: string
  unlimited: boolean
  plan: {
    id?: string
    name: string
    slug: string
    messageQuota: number | null
    botLimit: number | null
    priceMonthly?: number
    priceYearly?: number
    features?: string[]
  }
  usage?: {
    messagesUsed: number
    messagesRemaining: number
    usagePercentage: number
    currentBots: number
    botsRemaining: number
  }
  subscription: {
    status: string
    currentPeriodStart?: string
    currentPeriodEnd?: string | null
    billingInterval?: string | null
    cancelAtPeriodEnd: boolean
    renewalCount?: number
    cancelledAt?: string | null
  }
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const response = await api.get<{ plans: SubscriptionPlan[] }>('/subscriptions/plans')
      return response.data.plans
    },
  })
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['current-subscription'],
    queryFn: async (): Promise<SubscriptionInfo> => {
      const response = await api.get<SubscriptionInfo>('/subscriptions/me')
      return response.data
    },
  })
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async ({
      planSlug,
      billingInterval,
    }: {
      planSlug: string
      billingInterval: 'monthly' | 'yearly'
    }): Promise<{ sessionId: string; url: string }> => {
      const response = await api.post('/subscriptions/checkout', {
        planSlug,
        billingInterval,
      })
      return response.data
    },
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      const response = await api.post('/subscriptions/cancel')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['quota'] })
    },
  })
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      const response = await api.post('/subscriptions/reactivate')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['quota'] })
    },
  })
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async (): Promise<{ url: string }> => {
      const response = await api.post('/subscriptions/portal')
      return response.data
    },
  })
}
