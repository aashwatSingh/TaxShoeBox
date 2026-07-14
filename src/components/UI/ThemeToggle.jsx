import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`
        relative flex items-center rounded-full p-1 transition-colors duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/25
        ${compact ? 'w-10 h-6' : 'w-11 h-6'}
        ${isDark ? 'bg-white/10' : 'bg-black/10'}
      `}
    >
      <span
        className={`
          flex items-center justify-center rounded-full bg-white shadow-sm
          transition-transform duration-150 ease-out
          ${compact ? 'w-4 h-4' : 'w-4 h-4'}
          ${isDark ? 'translate-x-4' : 'translate-x-0'}
        `}
      >
        {isDark
          ? <Moon size={10} className="text-zinc-700" />
          : <Sun size={10} className="text-amber-500" />}
      </span>
    </button>
  )
}
