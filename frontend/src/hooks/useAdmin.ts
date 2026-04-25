import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export type AdminRole = 'user' | 'admin' | 'owner'

export interface AdminUser {
  id: string
  email: string
  role: AdminRole
  emailVerified: boolean
  balance: number
  totalBots: number
  activeBots: number
  createdAt: string
}

interface AdminUsersResponse {
  success: boolean
  data: {
    users: AdminUser[]
    total: number
    page: number
    limit: number
  }
}

export function useAdminUsers(params: {
  page: number
  limit: number
  search?: string
  role?: AdminRole | 'all'
}) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: async () => {
      const response = await api.get<AdminUsersResponse>('/admin/users', {
        params: {
          page: params.page,
          limit: params.limit,
          search: params.search || undefined,
          role: params.role && params.role !== 'all' ? params.role : undefined,
        },
      })
      return response.data.data
    },
  })
}

export function useUpdateAdminUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'user' | 'admin' }) => {
      const response = await api.patch<{ success: boolean; data: AdminUser }>(
        `/admin/users/${userId}/role`,
        { role }
      )
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User role updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update user role')
    },
  })
}
