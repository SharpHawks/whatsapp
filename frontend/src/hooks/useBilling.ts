import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Balance {
  userId: string
  amount: string
  currency: string
  updatedAt: string
}

interface Transaction {
  id: string
  userId: string
  type: 'topup' | 'deduction' | 'withdrawal'
  amount: number
  description: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export function useBalance() {
  return useQuery({
    queryKey: ['balance'],
    queryFn: async (): Promise<Balance> => {
      const response = await api.get<{ balance: Balance }>('/billing/balance')
      return response.data.balance
    },
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async (): Promise<Transaction[]> => {
      const response = await api.get<{ transactions: Transaction[], total: number }>('/billing/transactions')
      return response.data.transactions || []
    },
  })
}

export function useCreateTopup() {
  return useMutation({
    mutationFn: async (amount: number): Promise<{ clientSecret: string; paymentIntentId: string }> => {
      const response = await api.post('/billing/topup', { amount })
      return response.data
    },
  })
}
