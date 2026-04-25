export interface Message {
  id: string
  botId: string
  botName?: string
  from: string
  to: string
  content: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document'
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  mediaUrl: string | null
  timestamp: string
  direction: 'incoming' | 'outgoing'
}

export interface MessageFilters {
  botId?: string
  startDate?: string
  endDate?: string
  type?: Message['type']
  status?: Message['status']
  search?: string
}
