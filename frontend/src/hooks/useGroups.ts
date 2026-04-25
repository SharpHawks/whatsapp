import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Group {
  id: string
  name: string
  participantCount: number
  isAdmin: boolean
}

interface GroupsResponse {
  groups: Group[]
}

export function useGroups(botId: string | undefined) {
  return useQuery({
    queryKey: ['groups', botId],
    queryFn: async (): Promise<Group[]> => {
      if (!botId) {
        return []
      }
      
      const response = await api.get<GroupsResponse>(`/bots/${botId}/groups`)
      return response.data.groups || []
    },
    enabled: !!botId,
    staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache TTL)
  })
}
