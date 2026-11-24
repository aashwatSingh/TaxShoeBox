import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { hasBackend } from '@config/supabase'
import { Wordmark } from '../UI/Brand'
import { Ticks } from '../UI/Primitives'
import { friendlyError } from '../../utils/errors'

const EASE = [0.16, 1, 0.3, 1]
const FACTS = [
  ['RLS', 'Row Level Security on every table: each account sees only its own rows.'],
  ['PKCE', 'Browser sign-in uses the PKCE flow with short-lived, rotating tokens.'],
  ['10 MB', 'Receipts sit in a private bucket and open through 2-minute signed links.'],
]

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

  const demoButton = (
    <button type="button" onClick={enterDemo} className={`btn btn-lg w-full ${hasBackend ? 'btn-outline' : 'btn-primary'}`}>
      Explore the demo <ArrowRight size={15} />
    </button>
  )

  return (
    <div className="relative z-content flex min-h-dvh flex-col [padding-top:env(safe-area-inset-top)]">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <span className="group"><Wordmark /></span>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:pb-20">
        <motion.section
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: EASE }}
        >
          <h1 className="display max-w-[14ch] text-[clamp(2.4rem,6.2vw,4.5rem)] text-ink">
            Every receipt, filed before&nbsp;April.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted sm:text-base">
            TaxShoe keeps income, expenses, deductions and the paperwork behind them in one ledger, sorted by tax year and ready for whoever files.
          </p>
          <dl className="mt-10 hidden gap-px overflow-hidden rounded-xl border border-line bg-ink/[0.06] sm:grid sm:grid-cols-3">
            {FACTS.map(([k, v], i) => (
              <motion.div key={k} data-lit
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.08 }}
                className="bg-matte p-5">
                <dt className="display figure text-lg text-ink">{k}</dt>
                <dd className="mt-2 text-[13px] leading-relaxed text-muted">{v}</dd>
              </motion.div>
            ))}
          </dl>
          <p className="fact mt-6 hidden lg:block">Tip: click anywhere on the background.</p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="ticks panel-raised w-full p-6 sm:p-8 lg:max-w-md lg:justify-self-end" aria-label="Sign in"
        >
          <Ticks />
          {!hasBackend && (
            <>
              <p className="label-wide flex items-center gap-2 !text-signal"><span className="live-dot h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_6px_rgb(var(--signal))]" />Live demo</p>
              <h2 className="display mt-3 text-2xl text-ink">Try it with sample data</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">A year of receipts, invoices and forms, ready to edit. It runs entirely in your browser and resets when you close the tab.</p>
              <div className="mt-6">{demoButton}</div>
              <div className="my-7 flex items-center gap-4"><span className="rule" /><span className="label-wide shrink-0 !text-faint">or sign in</span><span className="rule" /></div>
            </>
          )}

          <div className="relative mb-6 grid grid-cols-2 rounded-lg border border-line bg-void/60 p-1" role="tablist">
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

          {hasBackend && (
            <>
              <div className="my-7 flex items-center gap-4"><span className="rule" /><span className="label-wide shrink-0 !text-faint">or</span><span className="rule" /></div>
              {demoButton}
            </>
          )}
        </motion.section>
      </main>
    </div>
  )
}
