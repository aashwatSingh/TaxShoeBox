import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, FolderOpen, LogOut, ChevronDown, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggle } from '../UI/ThemeToggle'

const NAV = [
  { to: '/',      label: 'Dashboard', icon: LayoutDashboard },
  { to: '/items', label: 'Tax Items', icon: FolderOpen },
]

export function Navbar() {
  const { user, signOut, isDemo } = useAuth()
  const { pathname }              = useLocation()
  const [userOpen, setUserOpen]   = useState(false)

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-black/30 border-b border-black/[0.06] dark:border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-4">
          <span className="text-xl leading-none">🗂️</span>
          <span className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-white hidden sm:block">
            TaxShoe
          </span>
          {isDemo && (
            <span className="badge uppercase tracking-wide bg-gold-600/10 text-gold-700 dark:bg-gold-400/15 dark:text-gold-400">
              Demo
            </span>
          )}
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150
                ${pathname === to
                  ? 'bg-black/[0.06] dark:bg-white/[0.08] text-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.03] dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.05]'
                }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle compact />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserOpen(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
                bg-black/[0.04] hover:bg-black/[0.07] text-zinc-700 border border-black/[0.06]
                dark:bg-white/[0.05] dark:hover:bg-white/[0.09] dark:text-white/75 dark:border-white/[0.08]
                transition-colors duration-150"
            >
              <User size={13} />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {user?.email?.split('@')[0] ?? 'Account'}
              </span>
              <ChevronDown size={12} className={`transition-transform duration-150 ${userOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="surface-raised absolute right-0 top-full mt-2 w-48 p-1.5 z-20"
                  >
                    <div className="px-2.5 py-1.5 mb-1 text-zinc-400 dark:text-white/40 text-xs truncate">
                      {user?.email}
                    </div>
                    <div className="h-px mb-1 bg-black/[0.06] dark:bg-white/[0.06]" />
                    <button
                      onClick={() => { setUserOpen(false); signOut() }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium transition-colors
                        text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LogOut size={14} />
                      {isDemo ? 'Exit Demo' : 'Sign Out'}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
