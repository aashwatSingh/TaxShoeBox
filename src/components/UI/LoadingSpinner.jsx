export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-9 h-9 border-[2.5px]' }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizes[size]} rounded-full border-black/10 dark:border-white/10 animate-spin`}
        style={{ borderTopColor: 'rgb(var(--accent))' }}
      />
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-app">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-zinc-400 dark:text-white/40">Loading…</p>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="surface p-5">
      <div className="skeleton h-4 w-2/3 mb-3 opacity-70" />
      <div className="skeleton h-3.5 w-1/2 mb-2 opacity-50" />
      <div className="skeleton h-3.5 w-3/4 opacity-40" />
    </div>
  )
}
