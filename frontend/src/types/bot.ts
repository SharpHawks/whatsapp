export interface Bot {
  id: string
  userId: string
  name: string
  phoneNumber: string | null
  webhookUrl: string | null
  autoResponseEnabled: boolean
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_required'
  qrCode: string | null
  lastActivity: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateBotRequest {
  name: string
}

export interface BotStats {
  totalMessages: number
  messagesThisMonth: number
  lastMessageAt: string | null
}
