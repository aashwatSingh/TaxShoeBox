import { forwardRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Trash2, Paperclip } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'
import { moneyExact, typeMeta } from '../../utils/format'
import { TypeChip, StatusChip } from '../UI/Primitives'

const EASE = [0.16, 1, 0.3, 1]

export const TaxItemCard = forwardRef(function TaxItemCard({ item, index = 0, onEdit, onDelete }, ref) {
  const [opening, setOpening] = useState(false)
  const m = typeMeta(item.item_type)
  const hasReceipt = Boolean(item.receipt_url)
  const realReceipt = storageService.isReal(item.receipt_url)

  const viewReceipt = async () => {
    if (!realReceipt) return // demo placeholder: nothing to open
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
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: Math.min(index, 10) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ layout: { duration: 0.45, ease: EASE } }}
      data-lit={m.lit || ''}
      className="group panel flex flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 pt-1 text-xs text-faint">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: item.categories?.color ?? 'rgb(var(--faint))' }} />
          <span className="truncate">{item.categories?.name ?? 'Uncategorized'}</span>
        </span>
        <div className="reveal-on-hover -mr-2 -mt-1.5 flex shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <button onClick={() => onEdit(item)} className="btn btn-ghost btn-icon" aria-label={`Edit ${item.title}`} title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(item)} className="btn btn-ghost btn-danger btn-icon" aria-label={`Delete ${item.title}`} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-ink [font-stretch:108%]">{item.title}</h3>

      {item.amount != null && (
        <p className={`display figure mt-3 text-[1.65rem] ${m.tone}`}>
          <span className="mr-0.5 text-[0.7em] opacity-70">{m.sign}</span>{moneyExact(item.amount)}
        </p>
      )}

      {item.description && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{item.description}</p>
      )}

      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeChip type={item.item_type} />
          <StatusChip status={item.status} />
          {hasReceipt && (
            <button
              type="button"
              onClick={viewReceipt}
              disabled={!realReceipt || opening}
              title={realReceipt ? 'View receipt' : 'Receipt attached (demo)'}
              className={`chip border-line-strong bg-ink/[0.03] text-muted disabled:cursor-default ${realReceipt ? 'hover:border-signal/50 hover:text-signal' : ''}`}
            >
              <Paperclip size={10} />
              {opening ? 'Opening…' : 'Receipt'}
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="fact">{item.item_date ? format(parseISO(item.item_date), 'dd MMM yyyy').toUpperCase() : 'No date'}</span>
          {item.tags?.length > 0 && (
            <span className="fact truncate">
              {item.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}
              {item.tags.length > 2 && ` +${item.tags.length - 2}`}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  )
})
