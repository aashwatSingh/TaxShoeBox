import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('taxshoe-theme')
      if (saved) return saved === 'dark'
    } catch { /* localStorage blocked (private browsing, iframe sandboxing) */ }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch { return true }
  })

  useEffect(() => {
    try {
      const root = document.documentElement
      isDark ? root.classList.add('dark') : root.classList.remove('dark')
      localStorage.setItem('taxshoe-theme', isDark ? 'dark' : 'light')
    } catch { /* silently ignore if storage is unavailable */ }
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
