import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, ArrowRight } from 'lucide-react'
import { progress, STEPS } from '../../demo/progress'
import { hasBackend } from '@config/supabase'

const EASE = [0.16, 1, 0.3, 1]

/**
 * First-run checklist (demo only). Three real actions, each with a button
 * that does it, a visible "n of 3", and a way out. It disappears once
 * dismissed and never blocks the page.
 */
export function DemoChecklist({ onAdd, onVerify, canVerify }) {
  const [state, setState] = useState(progress.get)
  useEffect(() => progress.subscribe(setState), [])
  if (state.dismissed) return null

  const done = new Set(state.done)
  const n = STEPS.filter((s) => done.has(s.id)).length
  const complete = n === STEPS.length
  const action = {
    add:    <button onClick={onAdd} className="btn btn-outline h-8 px-3 text-[12px]">Add entry</button>,
    verify: canVerify
      ? <button onClick={onVerify} className="btn btn-outline h-8 px-3 text-[12px]">Verify one</button>
      : <Link to="/items" className="btn btn-outline h-8 px-3 text-[12px]">Open ledger</Link>,
    filter: <Link to="/items?type=deduction" className="btn btn-outline h-8 px-3 text-[12px]">Show deductions</Link>,
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className="panel overflow-hidden" aria-labelledby="checklist-title"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7">
        <div>
          <h2 id="checklist-title" className="display text-lg text-ink">
            {complete ? 'That’s the whole loop' : 'Three things to try (about a minute)'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {complete
              ? 'Log it when it happens, check it once, and find it in seconds at tax time.'
              : 'Each one uses the real product on sample data. Nothing you do here leaves this tab.'}
          </p>
        </div>
        <button onClick={progress.dismiss} className="btn btn-ghost btn-icon -mr-2 -mt-1 shrink-0" aria-label="Hide checklist" title="Hide">
          <X size={15} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 px-5 sm:px-7" aria-label={`${n} of ${STEPS.length} done`}>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <motion.div className="h-full rounded-full bg-signal shadow-[0_0_8px_rgb(var(--signal))]"
            initial={false} animate={{ width: `${(n / STEPS.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
        </div>
        <span className="fact shrink-0">{n} of {STEPS.length}</span>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {complete ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3 px-5 pb-5 pt-4 sm:px-7">
            {hasBackend
              ? <Link to="/signin?mode=signup" className="btn btn-primary">Create your free account <ArrowRight size={15} /></Link>
              : <button onClick={progress.dismiss} className="btn btn-primary">Keep exploring <ArrowRight size={15} /></button>}
          </motion.div>
        ) : (
          <motion.ol key="steps" exit={{ opacity: 0 }} className="mt-3 border-t border-line">
            {STEPS.map((s) => {
              const ok = done.has(s.id)
              return (
                <li key={s.id} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0 sm:px-7">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${ok ? 'border-income bg-income text-void' : 'border-line-strong text-transparent'}`}>
                    <motion.span initial={false} animate={{ scale: ok ? 1 : 0.4, opacity: ok ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }}>
                      <Check size={12} strokeWidth={3} />
                    </motion.span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${ok ? 'text-muted line-through decoration-ink/30' : 'text-ink'}`}>{s.label}</span>
                    {!ok && <span className="block text-xs text-faint">{s.hint}</span>}
                  </span>
                  {!ok && action[s.id]}
                </li>
              )
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
