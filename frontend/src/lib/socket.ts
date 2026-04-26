import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io'

class SocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private botStatuses: Map<string, string> = new Map()

  connect() {
    const { accessToken } = useAuthStore.getState()

    if (!accessToken) {
      console.warn('Cannot connect socket: No access token')
      return
    }

    if (this.socket?.connected) {
      return
    }

    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin

    this.socket = io(socketUrl, {
      path: SOCKET_PATH,
      auth: {
        token: accessToken,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
      toast.success('Connected to real-time updates', { duration: 2000 })
    })

    this.socket.on('connected', () => {})

    this.socket.on('disconnect', () => {})

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('Failed to connect to real-time updates')
      }
    })

    this.socket.on('bot:status', (data: { botId: string; status: string; phoneNumber?: string }) => {
      const previousStatus = this.botStatuses.get(data.botId)
      if (previousStatus !== data.status) {
        this.botStatuses.set(data.botId, data.status)
        toast(`Bot ${data.status}`, {
          icon: '🤖',
          duration: 2000,
        })
      }
      
      // Emit custom event for React components to listen
      window.dispatchEvent(new CustomEvent('bot:status', { detail: data }))
    })

    this.socket.on('bot:qr', (data: { botId: string; qrCode: string }) => {
      window.dispatchEvent(new CustomEvent('bot:qr', { detail: data }))
    })

    this.socket.on('message:new', (data: { botId: string; message: any }) => {
      window.dispatchEvent(new CustomEvent('message:new', { detail: data }))
      
      // Show toast notification
      toast.success(`New message: ${data.message?.content || 'Message received'}`, {
        duration: 3000,
      })
    })

    this.socket.on('message:status', (data: { messageId: string; status: string }) => {
      window.dispatchEvent(new CustomEvent('message:status', { detail: data }))
    })

    this.socket.on('balance:updated', (data: { userId: string; balance: number; change: number }) => {
      window.dispatchEvent(new CustomEvent('balance:updated', { detail: data }))
      
      // Show notification for balance changes
      if (data.change < 0) {
        toast(`Balance: €${data.balance.toFixed(2)}`, {
          icon: '💰',
          duration: 2000,
        })
      }
    })

    this.socket.on('webhook:delivery', (data: { botId: string; success: boolean; url: string }) => {
      window.dispatchEvent(new CustomEvent('webhook:delivery', { detail: data }))
    })

    this.socket.on('balance:low', (data: { balance: number; threshold: number }) => {
      toast.error(`Low balance warning: €${data.balance.toFixed(2)}. Please add funds.`, {
        duration: 6000,
      })
      window.dispatchEvent(new CustomEvent('balance:low', { detail: data }))
    })

    this.socket.on('quota:updated', (data: {
      messagesUsed: number
      messagesRemaining: number
      messageQuota: number | null
      cost: number
      billingMode: 'subscription' | 'pay-per-message'
      botLimit: number | null
      currentBots: number
    }) => {
      window.dispatchEvent(new CustomEvent('quota:updated', { detail: data }))
      if (data.cost > 0) {
        toast(`Message sent — €${data.cost.toFixed(2)} (pay-per-message)`, {
          icon: '💰',
          duration: 3000,
        })
      }
    })
  }

    disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.botStatuses.clear()
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Cannot emit: Socket not connected')
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }
}

// Export singleton instance
export const socketClient = new SocketClient()

// Hook for React components
export const useSocket = () => {
  return {
    connect: () => socketClient.connect(),
    disconnect: () => socketClient.disconnect(),
    isConnected: () => socketClient.isConnected(),
    emit: (event: string, data: any) => socketClient.emit(event, data),
    on: (event: string, callback: (...args: any[]) => void) => socketClient.on(event, callback),
    off: (event: string, callback?: (...args: any[]) => void) => socketClient.off(event, callback),
  }
}

export default socketClient
