import { useEffect, useRef } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar, MobileTabs } from './Navbar'
import { useAuth } from '../../context/AuthContext'

// Page order decides which way a page slides: forward slides in from the
// right, back slides in from the left.
const ORDER = { '/': 0, '/items': 1 }
const EASE = [0.16, 1, 0.3, 1]

const page = {
  enter:  (dir) => ({ opacity: 0, x: 44 * dir, filter: 'blur(5px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } },
  exit:   (dir) => ({ opacity: 0, x: -28 * dir, filter: 'blur(4px)', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }),
}

export function Layout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const { isDemo } = useAuth()
  const idx = ORDER[pathname] ?? 0
  const prev = useRef(idx)
  const dir = idx >= prev.current ? 1 : -1
  useEffect(() => { prev.current = idx }, [idx])

  return (
    <div className="relative z-content flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-md focus:bg-signal focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-void">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10 [overflow-x:clip]">
        <AnimatePresence mode="wait" custom={dir} initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
          <motion.div key={pathname} custom={dir} variants={page} initial="enter" animate="center" exit="exit">
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-4 px-6 pb-8 sm:flex">
        <span className="fact">TaxShoe · React · Supabase · Row Level Security</span>
        <span className="fact">{isDemo ? 'Demo data lives only in this browser tab' : `© ${new Date().getFullYear()} TaxShoe`}</span>
      </footer>
      <MobileTabs />
    </div>
  )
}
