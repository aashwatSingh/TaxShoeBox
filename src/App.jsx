import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { AuthPage } from './components/Auth/AuthPage'
import { Layout } from './components/Layout/Layout'
import { Dashboard } from './components/Dashboard/Dashboard'
import { TaxItemList } from './components/TaxItems/TaxItemList'
import { FullPageLoader } from './components/UI/LoadingSpinner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user)   return <Navigate to="/auth" replace />
  return children
}

function AppShell() {
  const { user, loading } = useAuth()
  const { isDark }        = useTheme()

  if (loading) return <FullPageLoader />

  return (
    <div className="relative min-h-screen bg-app">
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/items" element={
          <ProtectedRoute>
            <Layout><TaxItemList /></Layout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: isDark ? {
            background: '#18181f',
            color: '#f4f4f5',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          } : {
            background: '#ffffff',
            color: '#18181b',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '10px',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          },
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    // reducedMotion="user" → respects the OS "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  )
}
