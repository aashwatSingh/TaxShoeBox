import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Tag, Paperclip, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useCategories } from '../../hooks/useTaxItems'
import { storageService, validateReceiptFile } from '../../services/storageService'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
const TYPES = ['expense', 'income', 'deduction', 'document', 'other']
const STATUSES = ['pending', 'verified', 'flagged']

const EMPTY = {
  title: '', description: '', amount: '', category_id: '',
  tax_year: CURRENT_YEAR, item_date: '', item_type: 'expense',
  status: 'pending', tags: [], receipt_url: '',
}

// Friendly label for an existing stored receipt path.
const receiptLabel = (path) =>
  !path ? '' : path.startsWith('demo/') ? path.slice(5) : path.split('/').pop()

export function TaxItemForm({ item = null, onClose, onSave, defaultYear }) {
  const { user }          = useAuth()
  const { categories }    = useCategories()
  const [form, setForm]   = useState(item ? {
    ...EMPTY, ...item,
    description: item.description ?? '', // DB stores blank descriptions as null
    amount: item.amount ?? '',
    category_id: item.category_id ?? '',
    item_date: item.item_date ?? '',
    receipt_url: item.receipt_url ?? '',
    tags: item.tags ?? [],
  } : { ...EMPTY, tax_year: defaultYear ?? CURRENT_YEAR })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState({})
  const [receiptFile, setReceiptFile] = useState(null) // newly-picked File, not yet uploaded

  const set = (k) => (e) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || form.tags.includes(t) || form.tags.length >= 10) return
    setForm(p => ({ ...p, tags: [...p.tags, t] }))
    setTagInput('')
  }

  const removeTag = (t) => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))

  const pickReceipt = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      validateReceiptFile(file)
      setReceiptFile(file)
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Drop the current attachment (a freshly picked file or the stored one).
  const clearReceipt = () => {
    setReceiptFile(null)
    setForm(p => ({ ...p, receipt_url: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim())           e.title    = 'Title is required'
    if (!form.tax_year)               e.tax_year = 'Year is required'
    if (form.amount !== '' && form.amount !== null && !isFinite(Number(form.amount)))
                                      e.amount   = 'Must be a finite number'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)

    let payload = form
    const oldPath = item?.receipt_url || null
    let newPath = null

    // Upload a newly-picked receipt before saving the item.
    if (receiptFile) {
      try {
        const { path } = await storageService.upload(user?.id, receiptFile)
        newPath = path
        payload = { ...form, receipt_url: path }
      } catch (err) {
        toast.error(err.message || 'Receipt upload failed')
        setSaving(false)
        return
      }
    }

    const result = await onSave(payload)

    if (result?.error) {
      // The DB save failed, so the item still points at the OLD receipt —
      // deleting it now would leave a broken reference. If we uploaded a
      // NEW file this attempt, it's unreferenced (orphaned); remove that
      // instead, and keep the modal open so the user can retry.
      if (newPath && storageService.isReal(newPath)) storageService.remove(newPath)
      setSaving(false)
      return
    }

    // Save succeeded — now safe to remove a replaced/removed OLD receipt.
    if (oldPath && oldPath !== payload.receipt_url && storageService.isReal(oldPath)) {
      storageService.remove(oldPath)
    }
    setSaving(false)
  }

  const currentReceipt = receiptFile?.name || receiptLabel(form.receipt_url)
  const labelCls = 'block text-sm font-medium mb-1.5 text-zinc-500 dark:text-white/55'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="surface-raised relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Modal header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4
            bg-white/95 dark:bg-[#15151d]/95 backdrop-blur border-b border-black/[0.06] dark:border-white/[0.07]"
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {item ? 'Edit Item' : 'Add Tax Item'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors hover:bg-black/[0.05] text-zinc-400 dark:hover:bg-white/10 dark:text-white/50"
            >
              <X size={17} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Title */}
            <div>
              <label className={labelCls}>Title <span className="text-red-500">*</span></label>
              <input
                value={form.title} onChange={set('title')}
                placeholder="e.g. Office supplies from Staples"
                className={`input ${errors.title ? 'border-red-500/60' : ''}`}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            {/* Amount + Year row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.amount} onChange={set('amount')}
                  placeholder="0.00"
                  className={`input ${errors.amount ? 'border-red-500/60' : ''}`}
                />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
              </div>
              <div>
                <label className={labelCls}>Tax Year <span className="text-red-500">*</span></label>
                <select value={form.tax_year} onChange={set('tax_year')} className="select">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Type + Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select value={form.item_type} onChange={set('item_type')} className="select">
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={set('status')} className="select">
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Category + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Category</label>
                <select value={form.category_id} onChange={set('category_id')} className="select">
                  <option value="">None</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={form.item_date} onChange={set('item_date')} className="input" />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description} onChange={set('description')}
                rows={3} maxLength={2000}
                placeholder="Optional notes about this item…"
                className="input resize-none"
              />
            </div>

            {/* Receipt upload */}
            <div>
              <label className={labelCls}>Receipt</label>
              {currentReceipt ? (
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border
                  bg-black/[0.02] border-black/[0.1] dark:bg-white/[0.04] dark:border-white/[0.1]"
                >
                  <FileText size={15} className="text-accent shrink-0" />
                  <span className="text-sm truncate flex-1 text-zinc-700 dark:text-white/80">
                    {currentReceipt}
                  </span>
                  {receiptFile && (
                    <span className="badge bg-gold-500/10 text-gold-700 dark:bg-gold-400/15 dark:text-gold-400">
                      New
                    </span>
                  )}
                  <button type="button" onClick={clearReceipt}
                    className="p-1 rounded-md transition-colors hover:bg-black/[0.05] text-zinc-400 dark:hover:bg-white/10 dark:text-white/50"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-dashed cursor-pointer
                  transition-colors text-sm
                  border-black/[0.14] text-zinc-500 hover:bg-black/[0.02]
                  dark:border-white/[0.16] dark:text-white/50 dark:hover:bg-white/[0.04]"
                >
                  <Paperclip size={14} />
                  <span>Attach receipt — PNG, JPG, WebP, or PDF (max 10 MB)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                    onChange={pickReceipt}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className={labelCls}>Tags</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Add tag…"
                  className="input flex-1"
                />
                <button
                  type="button" onClick={addTag}
                  className="btn-ghost px-3 shrink-0"
                >
                  <Plus size={15} />
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                      bg-black/[0.05] text-zinc-600 dark:bg-white/[0.08] dark:text-white/60"
                    >
                      <Tag size={9} />
                      {t}
                      <button type="button" onClick={() => removeTag(t)} className="ml-0.5 hover:opacity-70">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (item ? 'Save Changes' : 'Add Item')}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
