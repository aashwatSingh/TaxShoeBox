/** The shoebox mark: a box with its lid lifted, drawn on a 20px grid. */
export function Mark({ size = 22, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M3.5 8.5h13v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 5.2 17.5 3.2v2.6L2.5 7.8V5.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
        className="origin-[2.5px_6.5px] transition-transform duration-500 ease-out group-hover:-rotate-6" />
      <path d="M8 12h4" stroke="rgb(var(--signal))" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`flex items-center gap-2.5 text-ink ${className}`}>
      <Mark />
      <span className="display text-[15px] font-semibold uppercase !tracking-[0.18em]">TaxShoe</span>
    </span>
  )
}
