import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface QuotaInfo {
  role: string
  unlimited: boolean
  plan: {
    name: string
    slug?: string
    price?: number
    messageQuota: number | null
    botLimit: number | null
  }
  usage?: {
    messagesUsed: number
    messagesRemaining: number
    usagePercentage: number
    currentBots: number
    botsRemaining: number
  }
  subscription?: {
    status: string
    currentPeriodEnd: string | null
  }
}

export function useQuota() {
  return useQuery({
    queryKey: ['quota'],
    queryFn: async (): Promise<QuotaInfo> => {
      const response = await api.get<QuotaInfo>('/quota/me')
      return response.data
    },
  })
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await api.get<{ plans: any[] }>('/quota/plans')
      return response.data.plans
    },
  })
}
