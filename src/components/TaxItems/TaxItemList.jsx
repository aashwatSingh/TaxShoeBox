import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import { useTaxItems, useCategories } from '../../hooks/useTaxItems'
import { TaxItemCard } from './TaxItemCard'
import { TaxItemForm } from './TaxItemForm'
import { SkeletonCard } from '../UI/LoadingSpinner'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [{ value: '', label: 'All Years' }, ...Array.from({ length: 6 }, (_, i) => ({
  value: CURRENT_YEAR - i, label: String(CURRENT_YEAR - i),
}))]
const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'expense',   label: 'Expenses'   },
  { value: 'income',    label: 'Income'     },
  { value: 'deduction', label: 'Deductions' },
  { value: 'document',  label: 'Documents'  },
  { value: 'other',     label: 'Other'      },
]

export function TaxItemList() {
  const { categories }       = useCategories()
  const [search, setSearch]  = useState('')
  const [year, setYear]      = useState(CURRENT_YEAR)
  const [type, setType]      = useState('')
  const [catId, setCatId]    = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [showForm, setShowForm]       = useState(false)

  const { items, loading, count, createItem, updateItem, deleteItem } = useTaxItems({
    taxYear: year || undefined, itemType: type || undefined,
    categoryId: catId || undefined, search: search || undefined,
  })

  const handleDelete = async (item) => {
    if (window.confirm('Delete this item? This cannot be undone.')) {
      await deleteItem(item)
    }
  }

  const handleSave = async (data) => {
    // Only close the modal on success — on failure, keep it open (with the
    // user's input intact) so TaxItemForm can also skip its post-save
    // receipt cleanup, which must not run against a save that didn't happen.
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
  const hasFilters = search || type || catId || year !== CURRENT_YEAR

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-0.5">
            Tax Items
          </h1>
          <p className="text-sm text-zinc-400 dark:text-white/40">
            {count} item{count !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="surface p-3.5">
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-3.5 rounded-lg border text-sm font-medium transition-colors duration-150
              ${showFilters
                ? 'bg-gold-500/10 border-gold-500/30 text-gold-700 dark:bg-gold-400/15 dark:border-gold-400/30 dark:text-gold-400'
                : 'bg-white border-black/[0.08] text-zinc-600 hover:bg-black/[0.02] dark:bg-white/[0.05] dark:border-white/[0.1] dark:text-white/60 dark:hover:bg-white/[0.08]'
              }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgb(var(--accent))' }} />}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <select value={year} onChange={e => setYear(e.target.value)} className="select">
                      {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-white/40" />
                  </div>
                  <div className="relative">
                    <select value={type} onChange={e => setType(e.target.value)} className="select">
                      {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-white/40" />
                  </div>
                  <div className="relative">
                    <select value={catId} onChange={e => setCatId(e.target.value)} className="select">
                      <option value="">All Categories</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-white/40" />
                  </div>
                </div>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity
                      text-zinc-400 dark:text-white/40"
                  >
                    <X size={11} /> Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-medium text-base mb-1 text-zinc-600 dark:text-white/60">
            {hasFilters ? 'No items match your filters' : 'No tax items yet'}
          </p>
          <p className="text-sm mb-5 text-zinc-400 dark:text-white/30">
            {hasFilters
              ? 'Try adjusting or clearing your filters'
              : 'Add receipts, invoices, and tax documents to get started'}
          </p>
          {!hasFilters && (
            <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-1.5">
              <Plus size={15} /> Add First Item
            </button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* TaxItemCard is itself a motion component, so AnimatePresence can
              drive its enter/exit directly — no wrapper (which would break the
              ref AnimatePresence needs to attach). */}
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <TaxItemCard
                key={item.id}
                item={item}
                onEdit={setEditItem}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals */}
      {showForm && (
        <TaxItemForm
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          defaultYear={year || CURRENT_YEAR}
        />
      )}
      {editItem && (
        <TaxItemForm
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
