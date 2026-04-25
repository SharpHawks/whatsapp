export interface Transaction {
  id: string
  userId: string
  type: 'topup' | 'deduction' | 'withdrawal'
  amount: number
  description: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export interface Balance {
  current: number
  currency: string
  lowBalanceThreshold: number
}

export interface UsageStats {
  messagesThisMonth: number
  costThisMonth: number
  projectedMonthlyCost: number
  pricePerMessage: number
}
