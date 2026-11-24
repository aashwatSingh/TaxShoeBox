import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthPage } from './components/Auth/AuthPage'
import { Layout } from './components/Layout/Layout'
import { Dashboard } from './components/Dashboard/Dashboard'
import { TaxItemList } from './components/TaxItems/TaxItemList'
import { FullPageLoader } from './components/UI/LoadingSpinner'
import { PixelField } from './components/FX/PixelField'
import { usePointerLight } from './hooks/usePointerLight'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user)   return <Navigate to="/auth" replace />
  return <Layout />
}

function AppShell() {
  const { user, loading } = useAuth()
  usePointerLight()

  return (
    <>
      <PixelField />
      {loading ? <FullPageLoader /> : (
        <Routes>
          <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/items" element={<TaxItemList />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: 'calc(env(safe-area-inset-top) + 12px)', zIndex: 60 }}
        toastOptions={{
          duration: 3200,
          style: {
            background: 'rgb(26 28 32)',
            color: 'rgb(238 240 243)',
            border: '1px solid rgb(238 240 243 / 0.14)',
            borderRadius: '10px',
            fontSize: '13px',
            fontStretch: '108%',
            padding: '10px 14px',
            boxShadow: '0 16px 32px -16px rgb(0 0 0 / 0.9)',
          },
          success: { iconTheme: { primary: 'rgb(95 227 166)', secondary: 'rgb(12 13 15)' } },
          error:   { iconTheme: { primary: 'rgb(255 138 146)', secondary: 'rgb(12 13 15)' } },
          loading: { iconTheme: { primary: 'rgb(92 232 242)', secondary: 'rgb(238 240 243 / 0.15)' } },
        }}
      />
    </>
  )
}

export default function App() {
  return (
    // reducedMotion="user": with the OS "reduce motion" setting on, framer
    // drops transforms and keeps only opacity fades.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  )
}
