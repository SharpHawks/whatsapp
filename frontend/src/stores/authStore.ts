import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

interface User {
  id: string
  email: string
  role?: 'user' | 'admin' | 'owner'
  emailVerified: boolean
  balance?: number
  createdAt?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  refreshAccessToken: () => Promise<void>
  updateUser: (user: Partial<User>) => void
}

function decodeUserFromAccessToken(accessToken: string, fallbackEmail?: string): User {
  const payload = JSON.parse(atob(accessToken.split('.')[1]))

  return {
    id: payload.userId,
    email: payload.email || fallbackEmail || '',
    role: payload.role || 'user',
    emailVerified: payload.emailVerified || false,
    balance: payload.balance,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await api.post('/auth/login', {
            email,
            password,
          })

          const { accessToken, refreshToken } = response.data

          const user = decodeUserFromAccessToken(accessToken, email)

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          await api.post('/auth/register', {
            email,
            password,
          })

          // Auto-login after successful registration
          await get().login(email, password)
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        const currentUser = get().user
        const user = decodeUserFromAccessToken(accessToken, currentUser?.email)
        set({ accessToken, refreshToken, user })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        try {
          const response = await api.post('/auth/refresh', {
            refreshToken,
          })

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data
          
          const currentUser = get().user
          const user = decodeUserFromAccessToken(newAccessToken, currentUser?.email)

          set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user,
          })
        } catch (error) {
          // If refresh fails, logout
          get().logout()
          throw error
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...userData } })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
