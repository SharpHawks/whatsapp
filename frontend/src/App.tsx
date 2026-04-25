import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { socketClient } from './lib/socket'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import LandingPage from './pages/LandingPage'
import PlansPage from './pages/plans/PlansPage'
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
import TermsPage from './pages/legal/TermsPage'
import PrivacyPage from './pages/legal/PrivacyPage'
import CookiesPage from './pages/legal/CookiesPage'

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

  // Public routes (available to everyone)
  const publicRoutes = (
    <>
      <Route path="/" element={<LandingPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
    </>
  )

  if (!isAuthenticated) {
    return (
      <Routes>
        {publicRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        {publicRoutes}
        <Route path="/dashboard" element={<DashboardPage />} />
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
