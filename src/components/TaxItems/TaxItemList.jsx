import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { progress } from '../../demo/progress'
import { useTaxItems, useCategories } from '../../hooks/useTaxItems'
import { TaxItemCard } from './TaxItemCard'
import { TaxItemForm } from './TaxItemForm'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [{ value: '', label: 'All years' }, ...Array.from({ length: 6 }, (_, i) => ({ value: CURRENT_YEAR - i, label: String(CURRENT_YEAR - i) }))]
const TYPES = [
  { value: '',          label: 'All' },
  { value: 'expense',   label: 'Expenses' },
  { value: 'income',    label: 'Income' },
  { value: 'deduction', label: 'Deductions' },
  { value: 'document',  label: 'Documents' },
  { value: 'other',     label: 'Other' },
]
const EASE = [0.16, 1, 0.3, 1]

function useDebounced(value, ms) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

function Select({ value, onChange, label, children }) {
  return (
    <label className="relative block min-w-0 flex-1 sm:w-44 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-10 text-[13px]">{children}</select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </label>
  )
}

export function TaxItemList() {
  const { categories } = useCategories()
  const [search, setSearch] = useState('')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [params] = useSearchParams()
  const [type, setType] = useState(() => (TYPES.some((t) => t.value && t.value === params.get('type')) ? params.get('type') : ''))
  const [catId, setCatId] = useState('')
  const [editItem, setEditItem] = useState(null)
  useEffect(() => { if (type === 'deduction') progress.mark('filter') }, [type])
  const [showForm, setShowForm] = useState(false)
  const searchRef = useRef(null)
  const query = useDebounced(search, 180)

  const { items, loading, count, createItem, updateItem, deleteItem } = useTaxItems({
    taxYear: year || undefined, itemType: type || undefined,
    categoryId: catId || undefined, search: query || undefined,
  })

  // "/" focuses search, the way most ledgers and docs sites do.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Delete with undo instead of a blocking confirm: the entry disappears at
  // once and is only removed for real when the 5-second undo window closes.
  const [hidden, setHidden] = useState(() => new Set())
  const unhide = (id) => setHidden((h) => { const n = new Set(h); n.delete(id); return n })
  const handleDelete = (item) => {
    setHidden((h) => new Set(h).add(item.id))
    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      await deleteItem(item, { quiet: true })
      unhide(item.id)
    }, 5000)
    toast((t) => (
      <span className="flex items-center gap-3">
        <span>Deleted <span className="text-ink">“{item.title.length > 28 ? item.title.slice(0, 28) + '…' : item.title}”</span></span>
        <button
          onClick={() => { undone = true; clearTimeout(timer); unhide(item.id); toast.dismiss(t.id) }}
          className="rounded-md border border-signal/40 px-2 py-0.5 text-[12px] font-semibold text-signal hover:bg-signal/10"
        >
          Undo
        </button>
      </span>
    ), { duration: 5000 })
  }
  const visible = items.filter((i) => !hidden.has(i.id))
  const shownCount = Math.max(0, count - hidden.size)

  const handleSave = async (data) => {
    // Close only on success, so a failed save keeps the user's input and
    // TaxItemForm skips receipt cleanup for a save that didn't happen.
    if (editItem) {
      const { error } = await updateItem(editItem.id, data)
      if (!error) setEditItem(null)
      return { error }
    }
    const { error } = await createItem(data)
    if (!error) setShowForm(false)
    return { error }
  }

  const clearFilters = () => { setSearch(''); setYear(CURRENT_YEAR); setType(''); setCatId('') }
  const hasFilters = Boolean(search || type || catId || year !== CURRENT_YEAR)

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            <span className="figure text-ink">{shownCount}</span> entr{shownCount === 1 ? 'y' : 'ies'}{year ? ` in ${year}` : ' across all years'}
          </p>
          <h1 className="display mt-2 text-[clamp(1.9rem,4.4vw,2.75rem)] text-ink">Ledger</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary self-stretch sm:self-auto">
          <Plus size={15} /> Add entry
        </button>
      </header>

      {/* Toolbar */}
      <section className="panel p-3 sm:p-4" aria-label="Filter entries">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles and notes"
              aria-label="Search entries"
              className="field h-10 pl-10 pr-16 text-[13px] [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="btn btn-ghost btn-icon absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Clear search">
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line-strong px-1.5 font-mono text-[10px] text-faint sm:block">/</kbd>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={year} onChange={setYear} label="Tax year">
              {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </Select>
            <Select value={catId} onChange={setCatId} label="Category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        </div>

        {/* Type: a segmented control that scrolls sideways on narrow screens. */}
        <div className="-mx-3 mt-3 overflow-x-auto px-3 [scrollbar-width:none] [mask-image:linear-gradient(90deg,#000_88%,transparent)] sm:-mx-4 sm:px-4 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-1.5" role="radiogroup" aria-label="Entry type">
            {TYPES.map((t) => {
              const on = type === t.value
              return (
                <button
                  key={t.value || 'all'}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(t.value)}
                  className={`btn h-8 rounded-md border-line px-3 text-[12px] font-medium text-muted hover:border-line-strong hover:text-ink ${on ? 'is-on' : ''}`}
                >
                  {t.label}
                </button>
              )
            })}
            <AnimatePresence>
              {hasFilters && (
                <motion.button
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  onClick={clearFilters}
                  className="btn btn-ghost h-8 px-2.5 text-[12px]"
                >
                  <X size={12} /> Reset
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {loading && visible.length === 0 ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr))]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="panel space-y-3 p-5">
              <div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-3/4" /><div className="skeleton h-7 w-1/2" /><div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="panel px-6 py-14 text-center">
          <p className="display text-xl text-ink">{hasFilters ? 'No entries match' : 'The ledger is empty'}</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm text-muted">
            {hasFilters ? 'Try a different search, or reset the filters.' : 'Add receipts, invoices and tax forms to start building the year.'}
          </p>
          <button onClick={hasFilters ? clearFilters : () => setShowForm(true)} className={`btn mt-6 ${hasFilters ? 'btn-outline' : 'btn-primary'}`}>
            {hasFilters ? <><X size={14} /> Reset filters</> : <><Plus size={15} /> Add the first entry</>}
          </button>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr))]">
          <AnimatePresence mode="popLayout">
            {visible.map((item, i) => (
              <TaxItemCard key={item.id} item={item} index={i} onEdit={setEditItem} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {showForm && <TaxItemForm onClose={() => setShowForm(false)} onSave={handleSave} defaultYear={year || CURRENT_YEAR} />}
      {editItem && <TaxItemForm item={editItem} onClose={() => setEditItem(null)} onSave={handleSave} />}
    </div>
  )
}
