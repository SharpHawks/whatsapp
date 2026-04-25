import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

/**
 * If VITE_API_URL is set, use it. In dev, default to backend on :3000.
 * In production with empty VITE_API_URL, use same origin (e.g. nginx + /api proxy).
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL
  if (v !== undefined && v !== '') return v
  if (import.meta.env.DEV) return 'http://localhost:3000'
  return ''
}

const API_ROOT = (() => {
  const b = getApiBaseUrl()
  return b ? `${b}/api/v1` : '/api/v1'
})()

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const { refreshToken, setTokens, logout } = useAuthStore.getState()

      if (refreshToken) {
        try {
          // Attempt to refresh the access token
          const response = await axios.post(`${API_ROOT}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data

          // Update tokens in store
          setTokens(newAccessToken, newRefreshToken)

          // Retry the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          }
          return api.request(originalRequest)
        } catch (refreshError) {
          // Refresh failed, logout user
          logout()
          toast.error('Session expired. Please login again.')
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, logout
        logout()
        toast.error('Please login to continue.')
      }
    }

    // Handle other errors
    if (error.response) {
      const responseData = error.response.data as any
      const message = responseData?.error?.message || responseData?.message || 'An error occurred'
      
      // Don't show toast for:
      // - 401 (already handled above)
      // - 404 on QR code endpoint (QR not ready yet)
      const isQREndpoint = originalRequest?.url?.includes('/qr')
      const shouldShowToast = error.response.status !== 401 && !(error.response.status === 404 && isQREndpoint)
      
      if (shouldShowToast) {
        toast.error(message)
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.')
    } else {
      toast.error('An unexpected error occurred.')
    }

    return Promise.reject(error)
  }
)

export default api
