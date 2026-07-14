import { Navbar } from './Navbar'

export function Layout({ children }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="text-center text-xs py-8 text-zinc-400 dark:text-white/25">
        <p>© {new Date().getFullYear()} TaxShoe · Crafted with React, Supabase &amp; Row-Level Security</p>
      </footer>
    </div>
  )
}
