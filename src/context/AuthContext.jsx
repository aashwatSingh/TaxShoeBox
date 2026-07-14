import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, hasBackend } from '@config/supabase'
import { DEMO_USER, isDemoMode, enterDemo as setDemoFlag, exitDemo as clearDemoFlag } from '../demo/demo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isDemo, setIsDemo]   = useState(isDemoMode)
  const [user, setUser]       = useState(() => (isDemoMode() ? DEMO_USER : null))
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => !isDemoMode())

  useEffect(() => {
    // Demo sessions and backend-less deploys never talk to Supabase Auth.
    if (isDemo || !hasBackend) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [isDemo])

  const signUp = (email, password) => {
    if (!hasBackend) return Promise.resolve({ error: { message: 'demo deployment' } })
    return supabase.auth.signUp({ email, password })
  }

  const signIn = (email, password) => {
    if (!hasBackend) return Promise.resolve({ error: { message: 'demo deployment' } })
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    if (isDemo) {
      clearDemoFlag()
      setIsDemo(false)
      setUser(null)
      setSession(null)
      return { error: null }
    }
    return supabase ? supabase.auth.signOut() : { error: null }
  }

  const enterDemo = () => {
    setDemoFlag()
    setIsDemo(true)
    setUser(DEMO_USER)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isDemo, signUp, signIn, signOut, enterDemo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
