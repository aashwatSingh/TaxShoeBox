import { useEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { typeMeta, statusMeta } from '../../utils/format'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A number that counts to its new value (ease-out-expo), or jumps with reduced motion. */
export function Counter({ value, format = (n) => String(Math.round(n)), duration = 1.1 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(0)
  useEffect(() => {
    if (reduceMotion()) { setShown(value); from.current = value; return }
    const ctrl = animate(from.current, value, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    })
    from.current = value
    return () => ctrl.stop()
  }, [value, duration])
  return <>{format(shown)}</>
}

/** ‹ 2026 › — steps through tax years; the year ticks vertically as it changes. */
export function YearStepper({ year, years, onChange }) {
  const i = years.indexOf(Number(year))
  const older = years[i + 1]
  const newer = years[i - 1]
  const [dir, setDir] = useState(1)
  const go = (y, d) => { setDir(d); onChange(y) }
  return (
    <div className="flex h-10 items-center rounded-lg border border-line-strong bg-ink/[0.02]" role="group" aria-label="Tax year">
      <button className="btn btn-ghost btn-icon h-full rounded-r-none" disabled={!older} onClick={() => go(older, -1)} aria-label={`Tax year ${older ?? ''}`}>
        <ChevronLeft size={15} />
      </button>
      <span className="relative flex h-full w-16 items-center justify-center overflow-hidden border-x border-line" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={year}
            custom={dir}
            variants={{ enter: (d) => ({ y: 14 * d, opacity: 0 }), center: { y: 0, opacity: 1 }, exit: (d) => ({ y: -14 * d, opacity: 0 }) }}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="figure text-sm font-semibold text-ink"
          >
            {year}
          </motion.span>
        </AnimatePresence>
      </span>
      <button className="btn btn-ghost btn-icon h-full rounded-l-none" disabled={!newer} onClick={() => go(newer, 1)} aria-label={`Tax year ${newer ?? ''}`}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

export function TypeChip({ type }) {
  const m = typeMeta(type)
  return <span className={`chip ${m.border} ${m.tone}`}><span className="chip-dot" />{m.label}</span>
}

export function StatusChip({ status }) {
  const m = statusMeta(status)
  return <span className={`chip ${m.border} ${m.tone}`}>{m.label}</span>
}

/** Four corner brackets; place inside a `.ticks` container. */
export function Ticks() {
  return (
    <>
      <span aria-hidden className="tick tick-tl" />
      <span aria-hidden className="tick tick-tr" />
      <span aria-hidden className="tick tick-bl" />
      <span aria-hidden className="tick tick-br" />
    </>
  )
}
