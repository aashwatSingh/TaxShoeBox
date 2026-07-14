import { forwardRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Calendar, Tag, MoreHorizontal, Paperclip } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'

const TYPE_STYLES = {
  expense:   { cls: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300',           label: 'Expense'   },
  income:    { cls: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', label: 'Income' },
  deduction: { cls: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',     label: 'Deduction' },
  document:  { cls: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',             label: 'Document'  },
  other:     { cls: 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',             label: 'Other'     },
}

const STATUS_STYLES = {
  pending:  'bg-gold-500/10 text-gold-700 dark:bg-gold-400/15 dark:text-gold-400',
  verified: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  flagged:  'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300',
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export const TaxItemCard = forwardRef(function TaxItemCard({ item, onEdit, onDelete }, ref) {
  const [menu, setMenu] = useState(false)
  const [opening, setOpening] = useState(false)
  const type   = TYPE_STYLES[item.item_type] ?? TYPE_STYLES.other
  const status = STATUS_STYLES[item.status]  ?? STATUS_STYLES.pending
  const hasReceipt = Boolean(item.receipt_url)
  const realReceipt = storageService.isReal(item.receipt_url)

  const viewReceipt = async () => {
    if (!realReceipt) return // demo placeholder — nothing to open
    setOpening(true)
    try {
      const url = await storageService.signedUrl(item.receipt_url, 120)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else toast.error('Could not open receipt')
    } catch {
      toast.error('Could not open receipt')
    } finally {
      setOpening(false)
    }
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="surface surface-hover relative p-4 group"
    >
      <div
        className="absolute top-0 left-0 w-[3px] h-full rounded-l-xl"
        style={{ background: item.categories?.color ?? '#6b7280' }}
      />

      <div className="pl-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm leading-snug truncate mb-0.5 text-zinc-900 dark:text-white">
              {item.title}
            </h3>
            {item.categories && (
              <span className="text-xs text-zinc-400 dark:text-white/35">{item.categories.name}</span>
            )}
          </div>

          {/* Overflow menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenu(p => !p)}
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150
                hover:bg-black/[0.05] text-zinc-400 dark:hover:bg-white/10 dark:text-white/50"
            >
              <MoreHorizontal size={15} />
            </button>

            <AnimatePresence>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="surface-raised absolute right-0 top-7 z-20 w-32 p-1"
                  >
                    <button
                      onClick={() => { setMenu(false); onEdit(item) }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors
                        text-zinc-700 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/10"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => { setMenu(false); onDelete(item) }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors
                        text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {item.description && (
          <p className="text-xs mb-2 line-clamp-2 text-zinc-500 dark:text-white/40">
            {item.description}
          </p>
        )}

        {item.amount != null && (
          <p className="text-lg font-semibold mb-2.5 tabular-nums text-zinc-900 dark:text-white">
            {formatCurrency(item.amount)}
          </p>
        )}

        {/* Chips row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`badge ${type.cls}`}>{type.label}</span>
          <span className={`badge capitalize ${status}`}>{item.status}</span>

          {item.item_date && (
            <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/35">
              <Calendar size={10} />
              {format(parseISO(item.item_date), 'MMM d, yyyy')}
            </span>
          )}

          {item.tags?.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/35">
              <Tag size={10} />
              {item.tags.slice(0, 2).join(', ')}
              {item.tags.length > 2 && ` +${item.tags.length - 2}`}
            </span>
          )}

          {hasReceipt && (
            <button
              type="button"
              onClick={viewReceipt}
              disabled={!realReceipt || opening}
              title={realReceipt ? 'View receipt' : 'Receipt attached (demo)'}
              className={`badge gap-1 transition-opacity bg-gold-500/10 text-gold-700 dark:bg-gold-400/15 dark:text-gold-400
                ${realReceipt ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'}`}
            >
              <Paperclip size={10} />
              {opening ? 'Opening…' : realReceipt ? 'Receipt' : 'Receipt (demo)'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
})
