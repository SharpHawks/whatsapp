import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Message } from '../types/message'

interface MessagesResponse {
  messages: Message[]
  total: number
  page: number
  limit: number
}

interface MessagesFilters {
  botId?: string
  status?: string
  type?: string
  search?: string
  page?: number
  limit?: number
}

export function useMessages(filters: MessagesFilters = {}) {
  return useQuery({
    queryKey: ['messages', filters],
    queryFn: async (): Promise<MessagesResponse> => {
      const params = new URLSearchParams()
      
      if (filters.botId) params.append('botId', filters.botId)
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)
      if (filters.search) params.append('search', filters.search)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())
      
      const response = await api.get<MessagesResponse>(`/messages?${params.toString()}`)
      return response.data
    },
  })
}
