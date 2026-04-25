import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface DashboardStats {
  totalMessages: number
  messagesThisPeriod: number
  currentBalance: number
  activeBots: number
  messagesToday: number
  messagesByDay: Array<{ date: string; count: number }>
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const response = await api.get<DashboardStats>('/dashboard/stats')
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
