import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { ArrowRight, Plus, ShieldCheck, Lock, FileCheck2, Github } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { hasBackend } from '@config/supabase'
import { demoStore } from '../../demo/demo'
import { progress } from '../../demo/progress'
import { Wordmark } from '../UI/Brand'
import { Counter, Ticks } from '../UI/Primitives'
import { money, moneyExact, typeMeta } from '../../utils/format'

/*
 * Landing page, built as one object: a ledger. The opening IS the product's
 * core action in working form (log a line, watch the totals move), and the
 * main CTA carries whatever the visitor typed into the full demo.
 */

const EASE = [0.16, 1, 0.3, 1]
const YEAR = new Date().getFullYear()
const REPO = 'https://github.com/aashwatSingh/TaxShoeBox'
const QUICK_TYPES = ['expense', 'income', 'deduction']
const SAMPLES = [
  { id: 's1', title: 'Laptop for client work',  amount: 1299,  item_type: 'expense',   sample: true },
  { id: 's2', title: 'Invoice: Acme Corp, March', amount: 4200, item_type: 'income',   sample: true },
  { id: 's3', title: 'Red Cross donation',      amount: 250,   item_type: 'deduction', sample: true },
]
const MAX_LINES = 6

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}` }

/* ── The working ledger ─────────────────────────────────────────── */
function HeroLedger({ lines, setLines }) {
  const [what, setWhat] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [error, setError] = useState(null)
  const whatRef = useRef(null)
  const amountRef = useRef(null)

  const all = [...lines, ...SAMPLES].slice(0, MAX_LINES)
  const sum = (t) => [...lines, ...SAMPLES].filter((l) => l.item_type === t).reduce((a, l) => a + l.amount, 0)
  const income = sum('income'), expenses = sum('expense'), deductions = sum('deduction')
  const net = income - expenses

  const add = (e) => {
    e.preventDefault()
    const title = what.trim()
    const n = Number(amount)
    if (!title) { setError({ field: 'what', msg: 'Name it first, for example “Printer ink”.' }); whatRef.current?.focus(); return }
    if (!(n > 0) || !Number.isFinite(n) || n > 1e7) { setError({ field: 'amount', msg: 'Enter an amount above $0.' }); amountRef.current?.focus(); return }
    setError(null)
    setLines((ls) => [{ id: `v${Date.now()}`, title: title.slice(0, 80), amount: Math.round(n * 100) / 100, item_type: type }, ...ls].slice(0, 5))
    setWhat(''); setAmount('')
    whatRef.current?.focus()
  }

  return (
    <div data-no-ripple className="ticks panel-raised relative overflow-hidden">
      <Ticks />
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <p className="label-wide flex items-center gap-2 !text-ink">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_6px_rgb(var(--signal))]" />
          Try it: log something from this year
        </p>
        <span className="fact hidden sm:inline">ledger · {YEAR}</span>
      </div>

      {/* The input row: the product's core action, working. */}
      <form onSubmit={add} noValidate className="grid grid-cols-[1fr_auto] gap-2 border-b border-line bg-void/40 p-3 sm:p-4 md:grid-cols-[1fr_9rem_auto_auto]">
        <label className="col-span-2 md:col-span-1">
          <span className="sr-only">What was it?</span>
          <input ref={whatRef} value={what} onChange={(e) => setWhat(e.target.value)} maxLength={80}
            placeholder="What was it? e.g. Printer ink" aria-invalid={error?.field === 'what'} aria-describedby={error ? 'quick-error' : undefined}
            className="field" />
        </label>
        <label className="relative order-3 md:order-none">
          <span className="sr-only">Amount in dollars</span>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
          <input ref={amountRef} value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01"
            placeholder="0.00" aria-invalid={error?.field === 'amount'} aria-describedby={error ? 'quick-error' : undefined}
            className="field figure pl-7" />
        </label>
        <div className="order-2 col-span-2 grid h-11 grid-cols-3 gap-1 rounded-lg border border-line-strong bg-void/70 p-1 md:order-none md:col-span-1" role="radiogroup" aria-label="Type">
          {QUICK_TYPES.map((t) => {
            const on = type === t
            const m = typeMeta(t)
            return (
              <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setType(t)} title={m.label}
                className={`h-full rounded-md px-2 text-[11.5px] font-medium transition-colors duration-200 [font-stretch:108%] ${on ? `bg-ink/[0.08] ${m.tone}` : 'text-muted hover:text-ink'}`}>
                {m.label}
              </button>
            )
          })}
        </div>
        <button type="submit" className="btn btn-outline order-4 h-11 md:order-none"><Plus size={15} /> Add line</button>
      </form>
      <AnimatePresence>
        {error && (
          <motion.p id="quick-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-line px-4 py-2 text-xs text-expense sm:px-6">{error.msg}</motion.p>
        )}
      </AnimatePresence>

      {/* Lines */}
      <ul aria-live="polite" aria-label="Ledger lines">
        <AnimatePresence initial={false}>
          {all.map((l) => {
            const m = typeMeta(l.item_type)
            return (
              <motion.li key={l.id} layout
                initial={{ opacity: 0, x: -16, backgroundColor: 'rgb(92 232 242 / 0.10)' }}
                animate={{ opacity: 1, x: 0, backgroundColor: 'rgb(92 232 242 / 0)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE, backgroundColor: { duration: 1.6 } }}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_7rem_8rem] sm:px-6">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${m.tone}`} />
                  <span className="truncate text-sm text-ink">{l.title}</span>
                  {l.sample
                    ? <span className="fact shrink-0">sample</span>
                    : <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-signal">yours</span>}
                </span>
                <span className={`hidden text-xs sm:block ${m.tone}`}>{m.label}</span>
                <span className={`figure text-right text-sm font-semibold ${m.tone}`}>{m.sign}{moneyExact(l.amount)}</span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {/* Totals: they move the moment a line is added. */}
      <dl className="grid grid-cols-2 border-t border-line-strong bg-void/40 sm:grid-cols-4">
        {[
          ['Income', income, 'text-income'],
          ['Expenses', expenses, 'text-expense'],
          ['Deductions', deductions, 'text-deduct'],
          ['Net position', net, 'text-ink'],
        ].map(([label, v, tone], i) => (
          <div key={label} className={`px-4 py-3.5 sm:px-6 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
            <dt className="label-wide !text-[10px]">{label}</dt>
            <dd className={`display figure mt-1 text-lg sm:text-xl ${tone}`}>
              {v < 0 ? '−' : ''}<Counter value={Math.abs(v)} format={money} duration={0.8} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ── Supporting sections ────────────────────────────────────────── */
const STEPS = [
  {
    title: 'Log it as it happens',
    body: 'Type what it was and what it cost, and attach the receipt photo or PDF. It takes about as long as reading this sentence.',
    art: (
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-void/60 px-3 py-2 text-[13px]">
        <span className="truncate text-ink">Printer ink</span>
        <span className="figure ml-auto text-expense">−$38.20</span>
        <span className="chip border-line-strong text-muted">PDF</span>
      </div>
    ),
  },
  {
    title: 'It’s sorted for you',
    body: 'Every entry lands in its tax year and category, and income, expenses and deductions stay totalled as you go.',
    art: (
      <div className="flex flex-wrap gap-1.5">
        <span className="chip border-line-strong text-ink">{YEAR}</span>
        <span className="chip border-line-strong text-muted"><span className="h-1.5 w-1.5 rounded-[2px] bg-[#d97706]" />Home Office</span>
        <span className="chip border-deduct/30 bg-deduct/[0.08] text-deduct"><span className="chip-dot" />Deduction</span>
      </div>
    ),
  },
  {
    title: 'Hand it off in April',
    body: 'Filter to deductions, one category or one year, and what your accountant asks for is already on one screen.',
    art: (
      <div className="flex items-center gap-1.5">
        <span className="chip border-line text-muted">All</span>
        <span className="chip is-on">Deductions</span>
        <span className="figure ml-auto text-sm font-semibold text-deduct">$3,410</span>
      </div>
    ),
  },
]

const PRIVACY = [
  { icon: Lock, title: 'Only you can read your entries', body: 'The database itself checks ownership on every row, so one account can never load another’s records, even through a bug in the app.' },
  { icon: FileCheck2, title: 'Receipts aren’t public files', body: 'They sit in private storage. Each time you open one, TaxShoe makes a link that stops working after two minutes.' },
  { icon: ShieldCheck, title: 'Reviewed, not just promised', body: 'A November 2026 security review found seven issues. All seven were fixed and each fix re-tested against a real Postgres database.' },
]

const FAQ = [
  ['Do I need an account to try it?', 'No. The demo runs entirely in your browser with sample data. Nothing is sent anywhere, and it clears when you close the tab.'],
  ['Does TaxShoe file my taxes?', 'No. It keeps your records and totals in order, so filing, on your own or with an accountant, starts from finished numbers.'],
  ['What can I keep in it?', 'Expenses, income and deductions, plus documents like W-2s and mileage logs. Each entry can carry a receipt (PNG, JPG, WebP or PDF up to 10 MB), tags and notes.'],
  ['Where is my data stored?', 'With an account, in a Postgres database where every row is locked to its owner, and receipts in private storage. In the demo, only in this browser tab.'],
]

function Reveal({ children, className = '', delay = 0 }) {
  // Visible by default; only animates in once it scrolls into view.
  const ref = useRef(null)
  const seen = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  return (
    <motion.div ref={ref} className={className} initial={false}
      animate={seen ? { opacity: 1, y: 0 } : { opacity: 0.001, y: 18 }}
      transition={{ duration: 0.7, ease: EASE, delay }}>
      {children}
    </motion.div>
  )
}

export function Landing() {
  const { enterDemo } = useAuth()
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const heroCta = useRef(null)
  const endCta = useRef(null)
  const endCtaVisible = useInView(endCta)
  const [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    // Shown only once the hero's own button has scrolled up out of view, so
    // it never covers the working ledger on a short phone screen.
    const check = () => setPastHero((heroCta.current?.getBoundingClientRect().bottom ?? 1) < 0)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])
  const showSticky = pastHero && !endCtaVisible

  const start = async () => {
    // Carry the visitor's lines into the full demo, so the product opens
    // with their own entries already in it.
    for (const l of [...lines].reverse()) {
      await demoStore.createTaxItem({
        title: l.title, amount: l.amount, item_type: l.item_type, tax_year: YEAR,
        item_date: new Date().toISOString().slice(0, 10), status: 'pending', tags: [],
      })
    }
    if (lines.length) progress.mark('add')
    enterDemo()
    navigate('/')
  }

  const ctaLabel = lines.length ? `Open the ledger with your ${plural(lines.length, 'entry', 'entries')}` : 'Open the full demo'
  const reassurance = 'No account or email. Runs entirely in your browser.'

  useEffect(() => { document.title = 'TaxShoe · Every receipt, sorted into a tax-ready ledger' }, [])

  return (
    <div className="relative z-content min-h-dvh [padding-top:env(safe-area-inset-top)]">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link to="/welcome" className="group rounded-md" aria-label="TaxShoe home"><Wordmark /></Link>
        <nav className="ml-auto flex items-center gap-1.5" aria-label="Account">
          {hasBackend && <Link to="/signin" className="btn btn-ghost h-9 px-3">Sign in</Link>}
          <button onClick={start} className="btn btn-outline h-9 px-3.5">Try the demo</button>
        </nav>
      </header>

      <main>
        {/* Opening: offer, then the working action, then the one CTA. */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-3 sm:px-8 sm:pt-14 lg:pb-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
            <p className="text-sm text-muted">For freelancers and anyone with side income</p>
            <h1 className="display mt-2.5 max-w-[17ch] text-[clamp(1.95rem,5.6vw+0.3rem,4.6rem)] text-ink sm:mt-3">
              Turn the shoebox of receipts into a tax‑ready ledger.
            </h1>
            <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-muted sm:mt-5 sm:text-base">
              Log what you earn and spend as it happens. TaxShoe files it by tax year and keeps the totals running, so tax season starts with the numbers done.
            </p>
          </motion.div>

          <motion.div className="mt-6 sm:mt-10" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}>
            <HeroLedger lines={lines} setLines={setLines} />
          </motion.div>

          <div ref={heroCta} className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <button onClick={start} className="btn btn-primary btn-lg w-full sm:w-auto">
              {ctaLabel} <ArrowRight size={16} />
            </button>
            <p className="text-[13px] text-muted">{reassurance}</p>
          </div>
        </section>

        {/* How it works: a real three-step sequence. */}
        <section className="border-t border-line bg-void/60" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <Reveal>
              <h2 id="how-title" className="display max-w-[20ch] text-[clamp(1.7rem,3.6vw,2.6rem)] text-ink">From a crumpled receipt to a finished total in three steps</h2>
            </Reveal>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08}>
                  <li className="relative list-none">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-signal/50 font-mono text-[11px] text-signal">{i + 1}</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-ink/20 to-transparent" aria-hidden />
                    </div>
                    <h3 className="display mt-5 text-lg text-ink">{s.title}</h3>
                    <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted">{s.body}</p>
                    <div className="mt-5">{s.art}</div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy, in plain language, with the evidence linked. */}
        <section className="border-t border-line" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:py-24">
            <Reveal>
              <h2 id="privacy-title" className="display text-[clamp(1.7rem,3.6vw,2.6rem)] text-ink">Your records stay yours.</h2>
              <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-muted">Tax records are some of the most personal data you have. Here is exactly how TaxShoe protects them.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href={`${REPO}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Read the security review <ArrowRight size={14} /></a>
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><Github size={15} /> Source code</a>
              </div>
            </Reveal>
            <div className="divide-y divide-ink/[0.07] border-y border-line">
              {PRIVACY.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 0.06}>
                  <div className="flex gap-4 py-6">
                    <Icon size={18} className="mt-0.5 shrink-0 text-signal" />
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink [font-stretch:108%]">{title}</h3>
                      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Objections, answered honestly. */}
        <section className="border-t border-line bg-void/60" aria-labelledby="faq-title">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-24">
            <Reveal><h2 id="faq-title" className="display text-[clamp(1.7rem,3.6vw,2.6rem)] text-ink">Questions, answered</h2></Reveal>
            <div className="mt-8 border-t border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-line">
                  <summary className="flex list-none items-center justify-between gap-6 py-5 text-[15px] font-medium text-ink [font-stretch:106%] [&::-webkit-details-marker]:hidden">
                    {q}
                    <Plus size={16} className="shrink-0 text-muted transition-transform duration-300 ease-out group-open:rotate-45 group-open:text-signal" />
                  </summary>
                  <p className="-mt-1 max-w-[62ch] pb-5 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action. */}
        <section className="border-t border-line" aria-labelledby="end-title">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 lg:py-28">
            <Reveal>
              <h2 id="end-title" className="display mx-auto max-w-[18ch] text-[clamp(2rem,5vw,3.6rem)] text-ink">Start with the receipts on your desk.</h2>
              <div ref={endCta} className="mt-8 flex flex-col items-center gap-3">
                <button onClick={start} className="btn btn-primary btn-lg w-full max-w-xs sm:w-auto sm:max-w-none">{ctaLabel} <ArrowRight size={16} /></button>
                <p className="text-[13px] text-muted">{reassurance}</p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-8 pb-28 sm:px-8 sm:pb-8">
        <span className="fact">TaxShoe · React · Supabase · Row Level Security</span>
        <a href={REPO} target="_blank" rel="noopener noreferrer" className="fact hover:text-ink">Open source, MIT licence</a>
      </footer>

      {/* Phones: the action stays one thumb away once the hero CTA scrolls off. */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }} transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-void/90 px-4 pt-3 backdrop-blur-md sm:hidden [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button onClick={start} className="btn btn-primary btn-lg w-full">{ctaLabel} <ArrowRight size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
