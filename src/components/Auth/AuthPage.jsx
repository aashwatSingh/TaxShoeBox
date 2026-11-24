import { useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { hasBackend } from '@config/supabase'
import { Wordmark } from '../UI/Brand'
import { Ticks } from '../UI/Primitives'
import { friendlyError } from '../../utils/errors'

const EASE = [0.16, 1, 0.3, 1]


// Client-side rate limiting: max 5 attempts per 60-second window
const RATE_LIMIT  = 5
const WINDOW_MS   = 60_000

export function AuthPage() {
  const { signIn, signUp, enterDemo } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode]         = useState(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm]         = useState({ email: '', password: '' })
  const attempts    = useRef(0)
  const windowStart = useRef(Date.now())

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Client-side pre-checks are UX only — the real password policy is
    // enforced server-side by Supabase Auth (see supabase/config.toml).
    if (!form.email || !form.password) { toast.error('Please fill in all fields'); return }
    if (mode === 'signup' && form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (Date.now() - windowStart.current > WINDOW_MS) {
      attempts.current    = 0
      windowStart.current = Date.now()
    }
    if (attempts.current >= RATE_LIMIT) {
      const waitSec = Math.ceil((WINDOW_MS - (Date.now() - windowStart.current)) / 1000)
      toast.error(`Too many attempts. Please wait ${waitSec}s before trying again.`)
      return
    }
    attempts.current++

    setLoading(true)
    const fn = mode === 'signin' ? signIn : signUp
    const { error } = await fn(form.email, form.password)
    setLoading(false)

    if (error) {
      toast.error(friendlyError(error))
    } else if (mode === 'signup') {
      attempts.current = 0
      toast.success('Account created! Check your email to confirm.')
    } else {
      attempts.current = 0
    }
  }

  const form_ = (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="auth-email" className="label-wide mb-2 block">Email</label>
        <input id="auth-email" type="email" value={form.email} onChange={set('email')}
          placeholder="you@example.com" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="auth-password" className="label-wide mb-2 block">Password</label>
        <div className="relative">
          <input id="auth-password" type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
            placeholder={mode === 'signup' ? '8+ characters, mixed case and a number' : '••••••••'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required className="field pr-11" />
          <button type="button" onClick={() => setShowPass(p => !p)} className="btn btn-ghost btn-icon absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
            aria-label={showPass ? 'Hide password' : 'Show password'}>
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={loading} className={`btn btn-lg w-full ${hasBackend ? 'btn-primary' : 'btn-outline'}`}>
        {loading
          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          : <>{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={15} /></>}
      </button>
    </form>
  )

  return (
    <div className="relative z-content flex min-h-dvh flex-col [padding-top:env(safe-area-inset-top)]">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/welcome" className="group rounded-md" aria-label="TaxShoe home"><Wordmark /></Link>
        <Link to="/welcome" className="btn btn-ghost h-9 px-3">Back to home</Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:pt-0">
        <motion.section
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          className="ticks panel-raised w-full max-w-md p-6 sm:p-8" aria-labelledby="auth-title"
        >
          <Ticks />
          <h1 id="auth-title" className="display text-2xl text-ink">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-muted">
            {!hasBackend
              ? 'Accounts need a connected database, which this preview doesn’t have. The demo has every feature.'
              : mode === 'signin' ? 'Sign in to open your ledger.' : 'Just an email and a password.'}
          </p>

          <div className="relative my-6 grid grid-cols-2 rounded-lg border border-line bg-void/60 p-1" role="tablist">
            {['signin', 'signup'].map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`relative z-[1] h-9 rounded-md text-[13px] font-medium transition-colors duration-200 [font-stretch:110%] ${mode === m ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {mode === m && <motion.span layoutId="auth-tab" transition={{ duration: 0.4, ease: EASE }} className="absolute inset-0 -z-[1] rounded-md border border-line-strong bg-raised" />}
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22, ease: EASE }}>
              {form_}
            </motion.div>
          </AnimatePresence>

          <div className="my-7 flex items-center gap-4"><span className="rule" /><span className="label-wide shrink-0 !text-faint">or</span><span className="rule" /></div>
          <button type="button" onClick={() => { enterDemo(); navigate('/') }} className={`btn btn-lg w-full ${hasBackend ? 'btn-outline' : 'btn-primary'}`}>
            Explore the demo instead <ArrowRight size={15} />
          </button>
        </motion.section>
      </main>
    </div>
  )
}
