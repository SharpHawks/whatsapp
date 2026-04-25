import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Bot } from '../types/bot'
import toast from 'react-hot-toast'

interface CreateBotRequest {
  name: string
}

interface BotsResponse {
  bots: Bot[]
}

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: async (): Promise<Bot[]> => {
      const response = await api.get<BotsResponse>('/bots')
      return response.data.bots || []
    },
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateBotRequest): Promise<Bot> => {
      const response = await api.post<{ bot: Bot }>('/bots', data)
      return response.data.bot
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create bot')
    },
  })
}

export function useBotQR(botId: string) {
  const queryClient = useQueryClient()
  const [isPolling, setIsPolling] = useState(true)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const POLLING_INTERVAL = 2000 // 2 seconds
  const TIMEOUT_DURATION = 30000 // 30 seconds

  // Reset state when botId changes
  useEffect(() => {
    if (botId) {
      setIsPolling(true)
      setHasTimedOut(false)
      startTimeRef.current = Date.now()
    }
  }, [botId])

  // Listen for WebSocket QR updates
  useEffect(() => {
    if (!botId) return

    const handleQRUpdate = (event: CustomEvent) => {
      const { botId: updatedBotId, qrCode } = event.detail
      if (updatedBotId === botId) {
        console.log(`[WebSocket] QR code received for bot ${botId}`)
        console.log(`[WebSocket] Stopping HTTP polling for bot ${botId}`)
        // Update cache directly instead of invalidating
        queryClient.setQueryData(['bot-qr', botId], { qrCode })
        // Stop polling when QR received via WebSocket
        setIsPolling(false)
      }
    }

    console.log(`[WebSocket] Listening for QR updates for bot ${botId}`)
    window.addEventListener('bot:qr' as any, handleQRUpdate)
    return () => {
      console.log(`[WebSocket] Stopped listening for QR updates for bot ${botId}`)
      window.removeEventListener('bot:qr' as any, handleQRUpdate)
    }
  }, [botId, queryClient])

  // Timeout logic
  useEffect(() => {
    if (!botId || !isPolling) return

    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed >= TIMEOUT_DURATION) {
        console.log(`QR code polling timed out after ${TIMEOUT_DURATION}ms for bot ${botId}`)
        setIsPolling(false)
        setHasTimedOut(true)
      }
    }, TIMEOUT_DURATION)

    return () => clearTimeout(timeoutId)
  }, [botId, isPolling, TIMEOUT_DURATION])

  const query = useQuery({
    queryKey: ['bot-qr', botId],
    queryFn: async (): Promise<{ qrCode: string | null }> => {
      try {
        console.log(`[HTTP Polling] Fetching QR code for bot ${botId}`)
        const response = await api.get(`/bots/${botId}/qr`)
        const data = response.data
        
        // Stop polling when QR code is received
        if (data.qrCode) {
          console.log(`[HTTP Polling] QR code received for bot ${botId}, stopping polling`)
          setIsPolling(false)
        } else {
          console.log(`[HTTP Polling] QR code not yet available for bot ${botId}`)
        }
        
        return data
      } catch (error: any) {
        // Handle different error scenarios
        if (error.response?.status === 404) {
          // 404 means QR code not available yet (not an error)
          console.log(`[HTTP Polling] QR code not found (404) for bot ${botId}`)
          return { qrCode: null }
        } else if (error.response?.status === 401) {
          console.error(`[HTTP Polling] Unauthorized (401) - authentication required`)
          setIsPolling(false)
          throw new Error('Authentication required. Please log in again.')
        } else if (error.response?.status === 403) {
          console.error(`[HTTP Polling] Forbidden (403) - access denied for bot ${botId}`)
          setIsPolling(false)
          throw new Error('Access denied. You do not have permission to access this bot.')
        } else if (error.response?.status === 500) {
          console.error(`[HTTP Polling] Server error (500) for bot ${botId}`)
          throw new Error('Server error. Please try again later.')
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          console.error(`[HTTP Polling] Request timeout for bot ${botId}`)
          throw new Error('Request timeout. Please check your connection.')
        } else if (!error.response) {
          console.error(`[HTTP Polling] Network error for bot ${botId}:`, error.message)
          throw new Error('Network error. Please check your internet connection.')
        }
        
        console.error(`[HTTP Polling] Unexpected error fetching QR code for bot ${botId}:`, error)
        throw error
      }
    },
    enabled: !!botId && isPolling,
    refetchInterval: isPolling ? POLLING_INTERVAL : false,
    retry: false, // Don't retry on 404
    staleTime: 0, // Always consider data stale to enable polling
  })

  return {
    ...query,
    isPolling,
    hasTimedOut,
    stopPolling: () => {
      console.log(`[Polling] Manually stopping polling for bot ${botId}`)
      setIsPolling(false)
    },
    restartPolling: () => {
      console.log(`[Polling] Restarting polling for bot ${botId}`)
      setIsPolling(true)
      setHasTimedOut(false)
      startTimeRef.current = Date.now()
      queryClient.invalidateQueries({ queryKey: ['bot-qr', botId] })
    },
  }
}

export function useConnectBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (botId: string): Promise<void> => {
      await api.post(`/bots/${botId}/connect`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot connection initiated. Please wait for QR code.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to connect bot')
    },
  })
}

export function useDisconnectBot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (botId: string): Promise<void> => {
      await api.post(`/bots/${botId}/disconnect`)
    },
    onSuccess: (_, botId) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast.success('Bot disconnected')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to disconnect bot')
    },
  })
}

export function useRestartBot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (botId: string): Promise<void> => {
      await api.post(`/bots/${botId}/disconnect`)
      await api.post(`/bots/${botId}/connect`)
    },
    onSuccess: (_, botId) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bot', botId] })
      toast.success('Bot restart initiated. Please wait for QR code.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to restart bot')
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (botId: string): Promise<void> => {
      await api.delete(`/bots/${botId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot deleted successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete bot')
    },
  })
}
