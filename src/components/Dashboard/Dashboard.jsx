import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingDown, TrendingUp, Receipt, Clock, Plus, ArrowRight, ChevronDown
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { useTaxSummary, useTaxItems } from '../../hooks/useTaxItems'
import { TaxItemForm } from '../TaxItems/TaxItemForm'
import { SkeletonCard } from '../UI/LoadingSpinner'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
}

function StatCard({ label, value, sub, icon: Icon, tint }) {
  return (
    <div className="surface surface-hover p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tint}`}>
        <Icon size={15} />
      </div>
      <p className="text-xl font-semibold text-zinc-900 dark:text-white mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm text-zinc-500 dark:text-white/50">{label}</p>
      {sub && <p className="text-xs mt-0.5 text-zinc-400 dark:text-white/30">{sub}</p>}
    </div>
  )
}

function ItemTypeChip({ type }) {
  const map = {
    expense:   { label: 'Expense',   cls: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
    income:    { label: 'Income',    cls: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
    deduction: { label: 'Deduction', cls: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
    document:  { label: 'Document',  cls: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' },
    other:     { label: 'Other',     cls: 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300' },
  }
  const m = map[type] ?? map.other
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export function Dashboard() {
  const { user }               = useAuth()
  const [year, setYear]        = useState(CURRENT_YEAR)
  const [showForm, setShowForm] = useState(false)
  const { summary, loading: sLoading } = useTaxSummary(year)
  const { items, loading: iLoading, createItem } = useTaxItems({ taxYear: year, pageSize: 6 })

  const name = user?.isDemo ? 'Explorer' : user?.email?.split('@')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { label: 'Total Items',    value: summary?.totalItems ?? 0,            icon: Receipt,     tint: 'bg-zinc-900/5 text-zinc-700 dark:bg-white/10 dark:text-white', sub: `Tax year ${year}` },
    { label: 'Total Expenses', value: formatCurrency(summary?.expenses),   icon: TrendingDown, tint: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300', sub: 'Logged expenses' },
    { label: 'Total Income',   value: formatCurrency(summary?.income),     icon: TrendingUp,   tint: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', sub: 'Reported income' },
    { label: 'Deductions',     value: formatCurrency(summary?.deductions), icon: TrendingDown, tint: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', sub: 'Potential savings' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-0.5">
            {greeting}, {name}
          </h1>
          <p className="text-sm text-zinc-400 dark:text-white/40">Here's your tax overview</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="select bg-white dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.1] py-2"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-white/40" />
          </div>

          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      {/* Stats grid */}
      {sLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Pending review banner */}
      {summary?.pending > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border
          bg-gold-500/[0.06] border-gold-500/20 text-gold-700
          dark:bg-gold-400/[0.08] dark:border-gold-400/20 dark:text-gold-400"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={15} />
            <span className="text-sm font-medium">
              {summary.pending} item{summary.pending !== 1 ? 's' : ''} pending review
            </span>
          </div>
          <Link to="/items" className="text-xs font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity">
            Review <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Recent items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Recent Items</h2>
          <Link to="/items" className="text-accent text-sm flex items-center gap-1 font-medium hover:opacity-70 transition-opacity">
            View all <ArrowRight size={13} />
          </Link>
        </div>

        {iLoading ? (
          <div className="space-y-2.5">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="surface p-10 text-center">
            <p className="text-3xl mb-3">📂</p>
            <p className="font-medium mb-1 text-zinc-600 dark:text-white/60">No items for {year}</p>
            <p className="text-sm mb-5 text-zinc-400 dark:text-white/30">
              Start adding receipts, invoices, and documents
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-1.5">
              <Plus size={15} /> Add First Item
            </button>
          </div>
        ) : (
          <div className="surface overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-4 py-3 transition-colors duration-150
                  hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: item.categories?.color ?? '#6b7280' }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-zinc-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-white/35">
                    {item.categories?.name ?? 'Uncategorized'}
                    {item.item_date && ` · ${format(parseISO(item.item_date), 'MMM d, yyyy')}`}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <ItemTypeChip type={item.item_type} />
                  {item.amount != null && (
                    <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  )
}
