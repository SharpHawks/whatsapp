import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { socketClient } from './lib/socket'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import BotsPage from './pages/BotsPage'
import MessagesPage from './pages/MessagesPage'
import SendMessagePage from './pages/SendMessagePage'
import BotDetailsPage from './pages/BotDetailsPage'
import BillingPage from './pages/BillingPage'
import SettingsPage from './pages/SettingsPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminConnections from './pages/admin/AdminConnections'

function App() {
  const { isAuthenticated, user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  // Connect/disconnect socket based on authentication
  useEffect(() => {
    if (isAuthenticated) {
      socketClient.connect()
    } else {
      socketClient.disconnect()
    }

    return () => {
      socketClient.disconnect()
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/bots" element={<BotsPage />} />
        <Route path="/bots/:botId" element={<BotDetailsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/send" element={<SendMessagePage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Admin routes */}
        {isAdmin && (
          <>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/connections" element={<AdminConnections />} />
          </>
        )}
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
