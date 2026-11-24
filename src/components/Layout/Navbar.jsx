import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Rows3, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Wordmark } from '../UI/Brand'

const NAV = [
  { to: '/',      label: 'Overview', icon: LayoutDashboard },
  { to: '/items', label: 'Ledger',   icon: Rows3 },
]
const EASE = [0.16, 1, 0.3, 1]

function AccountMenu() {
  const { user, signOut, isDemo } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const name = isDemo ? 'Demo' : user?.email?.split('@')[0] ?? 'Account'
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-outline h-9 gap-2 pl-1.5 pr-2.5"
      >
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-ink/[0.08] font-mono text-[10px] font-semibold text-ink">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">{name}</span>
        <ChevronDown size={13} className={`text-muted transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ transformOrigin: 'top right' }}
            className="panel-raised absolute right-0 top-full z-menu mt-2 w-60 p-1.5"
          >
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="label-wide">{isDemo ? 'Demo session' : 'Signed in'}</p>
              <p className="mt-1 truncate text-sm text-ink">{user?.email}</p>
            </div>
            <div className="rule mb-1" />
            <button
              role="menuitem"
              onClick={() => { setOpen(false); signOut() }}
              className="btn btn-ghost btn-danger h-9 w-full justify-start px-2.5"
            >
              <LogOut size={14} />
              {isDemo ? 'Exit demo' : 'Sign out'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Navbar() {
  const { isDemo } = useAuth()
  return (
    <header className="sticky top-0 z-sticky border-b border-line bg-void/80 backdrop-blur-md [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-3 rounded-md" aria-label="TaxShoe overview">
          <Wordmark />
          {isDemo && (
            <span className="chip border-signal/30 bg-signal/[0.07] text-signal">
              <span className="chip-dot live-dot" /> Demo
            </span>
          )}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end className="group relative flex h-16 items-center px-3">
              {({ isActive }) => (
                <>
                  <span className={`label-wide !text-[11.5px] transition-colors duration-200 ${isActive ? '!text-ink' : 'group-hover:!text-ink'}`}>
                    {label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      transition={{ duration: 0.45, ease: EASE }}
                      className="absolute inset-x-3 -bottom-px h-px bg-signal shadow-[0_0_10px_rgb(var(--signal)),0_0_2px_rgb(var(--signal))]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

/** Phones: a thumb-reach tab bar, clear of the home indicator. */
export function MobileTabs() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-void/90 backdrop-blur-md sm:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-2">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <Link key={to} to={to} aria-current={active ? 'page' : undefined} className="relative flex h-16 flex-col items-center justify-center gap-1.5">
              {active && (
                <motion.span
                  layoutId="tab-underline"
                  transition={{ duration: 0.45, ease: EASE }}
                  className="absolute inset-x-10 top-0 h-px bg-signal shadow-[0_0_10px_rgb(var(--signal))]"
                />
              )}
              <Icon size={18} className={active ? 'text-signal' : 'text-muted'} />
              <span className={`label-wide !text-[10px] ${active ? '!text-ink' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
