import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggle } from '../UI/ThemeToggle'
import { friendlyError } from '../../utils/errors'

// Client-side rate limiting: max 5 attempts per 60-second window
const RATE_LIMIT  = 5
const WINDOW_MS   = 60_000

export function AuthPage() {
  const { signIn, signUp, enterDemo } = useAuth()
  const [mode, setMode]         = useState('signin')
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

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-8"
      >
        <div className="text-3xl mb-3">🗂️</div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-1.5">
          Tax<span className="text-accent">Shoe</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-white/45">
          Organize your finances with elegance
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="surface-raised w-full max-w-sm p-7"
      >
        {/* Mode tabs */}
        <div className="flex rounded-lg p-1 mb-6 bg-black/[0.04] dark:bg-white/[0.05]">
          {['signin', 'signup'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors duration-150
                ${mode === m
                  ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-600 dark:text-white/40 dark:hover:text-white/70'
                }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-0.5">
              {mode === 'signin' ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="text-sm text-zinc-400 dark:text-white/40 mb-6">
              {mode === 'signin'
                ? 'Sign in to access your tax documents'
                : 'Create a free account to get organized'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-zinc-600 dark:text-white/60">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-zinc-600 dark:text-white/60">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    className="input pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-white/30 dark:hover:text-white/60"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
          <span className="text-xs text-zinc-400 dark:text-white/30">or</span>
          <div className="flex-1 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
        </div>

        <button
          type="button"
          onClick={enterDemo}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
            border transition-colors duration-150
            border-black/[0.1] text-zinc-600 hover:bg-black/[0.03]
            dark:border-white/[0.12] dark:text-white/70 dark:hover:bg-white/[0.05]"
        >
          <Sparkles size={14} className="text-accent" />
          Explore the demo — no account needed
        </button>

        <p className="text-center text-xs mt-5 text-zinc-400 dark:text-white/25">
          Your data is encrypted and protected by Supabase RLS.
        </p>
      </motion.div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-sm">
        {['Receipt Tracking', 'Tax Year Organizer', 'Category Labels', 'Secure Storage'].map((f) => (
          <span
            key={f}
            className="text-xs px-2.5 py-1 rounded-full border border-black/[0.06] text-zinc-400
              dark:border-white/[0.07] dark:text-white/35"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}
