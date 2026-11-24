import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { useTaxSummary, useTaxItems } from '../../hooks/useTaxItems'
import { TaxItemForm } from '../TaxItems/TaxItemForm'
import { Counter, YearStepper, TypeChip, Ticks } from '../UI/Primitives'
import { money, typeMeta } from '../../utils/format'
import { DemoChecklist } from './DemoChecklist'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
const EASE = [0.16, 1, 0.3, 1]

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Net position, a proportional balance bar and its legend. */
function Ledger({ summary, year, loading }) {
  const income = summary?.income ?? 0
  const expenses = summary?.expenses ?? 0
  const deductions = summary?.deductions ?? 0
  const net = income - expenses
  const total = income + expenses + deductions
  const rows = [
    { key: 'income',    label: 'Income',     value: income,     bar: 'bg-income' },
    { key: 'expense',   label: 'Expenses',   value: expenses,   bar: 'bg-expense' },
    { key: 'deduction', label: 'Deductions', value: deductions, bar: 'bg-deduct' },
  ]

  return (
    <section data-lit className="ticks panel p-5 sm:p-7 lg:col-span-2" aria-labelledby="net-label">
      <Ticks />
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="net-label" className="label-wide">Net position · {year}</h2>
        <span className="fact">income − expenses</span>
      </div>

      <p className={`display figure mt-4 text-[clamp(2.4rem,7vw,4.25rem)] ${net < 0 ? 'text-expense' : 'text-ink'}`}>
        {loading ? <span className="skeleton inline-block h-[0.8em] w-[5ch] align-middle" /> : (
          <>
            <span className="mr-1 text-faint">{net < 0 ? '−' : ''}</span>
            <Counter value={Math.abs(net)} format={money} />
          </>
        )}
      </p>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
        {total === 0
          ? 'Nothing recorded for this year yet.'
          : <>Income of <span className="text-ink">{money(income)}</span> less <span className="text-ink">{money(expenses)}</span> of expenses, with <span className="text-ink">{money(deductions)}</span> set aside as deductions.</>}
      </p>

      {/* Balance bar: each segment's width is its share of everything recorded. */}
      <div className="mt-7 flex h-2 w-full gap-[3px] overflow-hidden rounded-full bg-ink/[0.05]" role="img"
        aria-label={rows.map((r) => `${r.label} ${money(r.value)}`).join(', ')}>
        {total > 0 && rows.map((r, i) => r.value > 0 && (
          <span key={r.key} className={`${r.bar} animate-grow-x h-full first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(r.value / total) * 100}%`, animationDelay: `${0.15 + i * 0.12}s` }} />
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-3 border-t border-line pt-3 sm:block">
            <dt className="flex items-center gap-2 text-[13px] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${r.bar}`} />{r.label}
              <span className="fact ml-auto sm:ml-1">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            </dt>
            <dd className="figure text-lg font-semibold text-ink sm:mt-1.5 sm:text-xl">
              {loading ? '—' : <Counter value={r.value} format={money} />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Share of the year's records that are verified, as a ring meter. */
function ReviewMeter({ summary, loading }) {
  const total = summary?.totalItems ?? 0
  const pending = summary?.pending ?? 0
  const done = Math.max(0, total - pending)
  const share = total ? done / total : 0
  const R = 46, C = 2 * Math.PI * R

  return (
    <section data-lit="pending" className="panel flex flex-col p-5 sm:p-7" aria-labelledby="review-label">
      <div className="flex items-baseline justify-between">
        <h2 id="review-label" className="label-wide">Review</h2>
        <span className="fact">{total} record{total === 1 ? '' : 's'}</span>
      </div>
      <div className="mt-5 flex items-center gap-6">
        <svg viewBox="0 0 110 110" className="h-24 w-24 shrink-0 -rotate-90" aria-hidden>
          <circle cx="55" cy="55" r={R} fill="none" stroke="rgb(var(--ink) / 0.07)" strokeWidth="5" />
          <motion.circle
            cx="55" cy="55" r={R} fill="none" stroke="rgb(var(--income))" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: loading ? C : C * (1 - share) }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
            style={{ filter: 'drop-shadow(0 0 4px rgb(var(--income) / 0.6))' }}
          />
        </svg>
        <div>
          <p className="display figure text-4xl text-ink"><Counter value={Math.round(share * 100)} />%</p>
          <p className="mt-1 text-sm text-muted">verified</p>
        </div>
      </div>
      <div className="mt-auto pt-6">
        {pending > 0 ? (
          <Link to="/items" className="btn btn-outline w-full justify-between">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pending shadow-[0_0_6px_rgb(var(--pending))]" />{pending} waiting for review</span>
            <ArrowUpRight size={15} />
          </Link>
        ) : (
          <p className="flex items-center gap-2 text-sm text-income"><ShieldCheck size={15} /> Everything is verified</p>
        )}
      </div>
    </section>
  )
}

function Recent({ items, loading, year, onAdd }) {
  return (
    <section className="panel overflow-hidden" aria-labelledby="recent-label">
      <div className="flex items-center justify-between px-5 pb-3 pt-5 sm:px-7">
        <h2 id="recent-label" className="label-wide">Recent entries</h2>
        <Link to="/items" className="group flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-signal">
          Open ledger <ArrowUpRight size={14} className="transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-px px-5 pb-5 sm:px-7">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}</div>
      ) : items.length === 0 ? (
        <div className="px-5 pb-10 pt-6 text-center sm:px-7">
          <p className="display text-lg text-ink">Nothing filed for {year}</p>
          <p className="mx-auto mt-2 max-w-[40ch] text-sm text-muted">Add a receipt, an invoice or a tax form and it lands here.</p>
          <button onClick={onAdd} className="btn btn-primary mt-6"><Plus size={15} /> Add the first entry</button>
        </div>
      ) : (
        <ul className="border-t border-line">
          {items.map((item, i) => {
            const m = typeMeta(item.item_type)
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.05 + i * 0.045 }}
                data-lit={m.lit || ''}
                className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-x-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[4rem_1fr_auto_7rem] sm:px-7"
              >
                <span className="font-mono text-[11px] uppercase leading-tight text-faint">
                  {item.item_date ? <>{format(parseISO(item.item_date), 'MMM')}<br /><span className="text-[15px] text-muted">{format(parseISO(item.item_date), 'dd')}</span></> : '—'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-faint">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: item.categories?.color ?? 'rgb(var(--faint))' }} />
                    {item.categories?.name ?? 'Uncategorized'}
                  </span>
                </span>
                <span className="hidden sm:block"><TypeChip type={item.item_type} /></span>
                <span className={`figure text-right text-sm font-semibold ${item.amount == null ? 'text-faint' : m.tone}`}>
                  {item.amount == null ? 'Doc' : `${m.sign}${money(item.amount)}`}
                </span>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Dashboard() {
  const { user, isDemo } = useAuth()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [showForm, setShowForm] = useState(false)
  const [verifying, setVerifying] = useState(null)
  const { items, loading: iLoading, createItem, updateItem } = useTaxItems({ taxYear: year, pageSize: 6 })
  const fingerprint = items.map((i) => `${i.id}:${i.amount}:${i.item_type}:${i.status}:${i.tax_year}`).join('|')
  const { summary, loading: sLoading } = useTaxSummary(year, fingerprint)
  const firstPending = items.find((i) => i.status === 'pending')
  const name = user?.isDemo ? 'Explorer' : user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()}, {name}.</p>
          <h1 className="display mt-2 text-[clamp(1.9rem,4.4vw,2.75rem)] text-ink">Your tax year at a glance</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <YearStepper year={year} years={YEARS} onChange={setYear} />
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex-1 sm:flex-none">
            <Plus size={15} /> Add entry
          </button>
        </div>
      </header>

      {isDemo && (
        <DemoChecklist
          onAdd={() => setShowForm(true)}
          canVerify={Boolean(firstPending)}
          onVerify={() => setVerifying({ ...firstPending, status: 'verified' })}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Ledger summary={summary} year={year} loading={sLoading} />
        <ReviewMeter summary={summary} loading={sLoading} />
      </div>

      <Recent items={items} loading={iLoading} year={year} onAdd={() => setShowForm(true)} />

      {showForm && (
        <TaxItemForm
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            const { error } = await createItem(data)
            if (!error) setShowForm(false)
            return { error }
          }}
          defaultYear={year}
        />
      )}
      {verifying && (
        <TaxItemForm
          item={verifying}
          onClose={() => setVerifying(null)}
          onSave={async (data) => {
            const { error } = await updateItem(verifying.id, data)
            if (!error) setVerifying(null)
            return { error }
          }}
        />
      )}
    </div>
  )
}
