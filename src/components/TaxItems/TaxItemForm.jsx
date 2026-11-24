import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Plus, Paperclip, FileText, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useCategories } from '../../hooks/useTaxItems'
import { storageService, validateReceiptFile } from '../../services/storageService'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
const TYPES = ['expense', 'income', 'deduction', 'document', 'other']
const TYPE_LABEL = { expense: 'Expense', income: 'Income', deduction: 'Deduction', document: 'Document', other: 'Other' }
const EASE = [0.16, 1, 0.3, 1]
const STATUSES = ['pending', 'verified', 'flagged']

const EMPTY = {
  title: '', description: '', amount: '', category_id: '',
  tax_year: CURRENT_YEAR, item_date: '', item_type: 'expense',
  status: 'pending', tags: [], receipt_url: '',
}

// Friendly label for an existing stored receipt path.
const receiptLabel = (path) =>
  !path ? '' : path.startsWith('demo/') ? path.slice(5) : path.split('/').pop()

function Field({ label, required, error, children, className = '' }) {
  return (
    <div className={className}>
      <span className="label-wide mb-2 block">{label}{required && <span className="ml-1 text-signal">*</span>}</span>
      {children}
      {error && <p className="mt-1.5 text-xs text-expense">{error}</p>}
    </div>
  )
}

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

  const pick = (k, v) => setForm(p => ({ ...p, [k]: v }))

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
  const titleRef = useRef(null)
  const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches

  // Escape closes; the page behind stops scrolling; the title gets focus.
  const latest = useRef({ onClose, saving })
  latest.current = { onClose, saving }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !latest.current.saving) latest.current.onClose() }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 80)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; clearTimeout(t) }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-6" data-no-ripple>
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 bg-black/70"
        onClick={() => !saving && onClose()}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-form-title"
        initial={isPhone ? { y: '100%' } : { opacity: 0, y: 18, scale: 0.98 }}
        animate={isPhone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: isPhone ? 0.5 : 0.4, ease: EASE }}
        className="panel-raised relative flex max-h-[92dvh] w-full flex-col rounded-b-none sm:max-h-[88dvh] sm:max-w-xl sm:rounded-b-xl"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/20 sm:hidden" />
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 sm:px-7">
          <div>
            <p className="label-wide">{item ? 'Edit entry' : 'New entry'}</p>
            <h2 id="entry-form-title" className="display mt-1 text-xl text-ink">{item ? 'Update the record' : 'Add to the ledger'}</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon -mr-2" aria-label="Close"><X size={17} /></button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
            <Field label="Title" required error={errors.title}>
              <input ref={titleRef} value={form.title} onChange={set('title')} maxLength={255}
                placeholder="Office supplies from Staples" aria-invalid={!!errors.title} className="field" />
            </Field>

            <Field label="Type">
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Type">
                {TYPES.map(t => (
                  <button key={t} type="button" role="radio" aria-checked={form.item_type === t} onClick={() => pick('item_type', t)}
                    className={`btn h-9 rounded-md border-line px-2 text-[12px] font-medium text-muted hover:border-line-strong hover:text-ink ${form.item_type === t ? 'is-on' : ''}`}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount" error={errors.amount}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')}
                    placeholder="0.00" aria-invalid={!!errors.amount} className="field figure pl-7" />
                </div>
              </Field>
              <Field label="Tax year" required>
                <div className="relative">
                  <select value={form.tax_year} onChange={set('tax_year')} className="field figure">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              </Field>
              <Field label="Category">
                <div className="relative">
                  <select value={form.category_id} onChange={set('category_id')} className="field">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              </Field>
              <Field label="Date">
                <input type="date" value={form.item_date} onChange={set('item_date')} className="field font-mono text-[13px]" />
              </Field>
            </div>

            <Field label="Status">
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Status">
                {STATUSES.map(st => (
                  <button key={st} type="button" role="radio" aria-checked={form.status === st} onClick={() => pick('status', st)}
                    className={`btn h-9 rounded-md border-line px-2 text-[12px] font-medium capitalize text-muted hover:border-line-strong hover:text-ink ${form.status === st ? 'is-on' : ''}`}>
                    {st}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Notes">
              <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000}
                placeholder="Anything your accountant should know" className="field resize-none" />
            </Field>

            <Field label="Receipt">
              {currentReceipt ? (
                <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-void/60 px-3.5 py-2.5">
                  <FileText size={15} className="shrink-0 text-signal" />
                  <span className="flex-1 truncate text-sm text-ink">{currentReceipt}</span>
                  {receiptFile && <span className="chip border-signal/30 bg-signal/[0.08] text-signal">New</span>}
                  <button type="button" onClick={clearReceipt} className="btn btn-ghost btn-icon h-8 w-8" aria-label="Remove receipt"><X size={14} /></button>
                </div>
              ) : (
                <label className="group flex cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm text-muted transition-colors duration-200 hover:border-signal/50 hover:bg-signal/[0.04] hover:text-signal focus-within:border-signal/60">
                  <Paperclip size={15} />
                  <span>Attach a file <span className="text-faint group-hover:text-signal/70">· PNG, JPG, WebP or PDF, 10 MB max</span></span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/heic,application/pdf" onChange={pickReceipt} className="sr-only" />
                </label>
              )}
            </Field>

            <Field label="Tags">
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Type a tag, press Enter" maxLength={50} className="field flex-1" />
                <button type="button" onClick={addTag} className="btn btn-outline btn-icon h-11 w-11" aria-label="Add tag"><Plus size={15} /></button>
              </div>
              {form.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {form.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-ink/[0.03] py-1 pl-2 pr-1 font-mono text-[11px] text-muted">
                      #{t}
                      <button type="button" onClick={() => removeTag(t)} className="rounded p-0.5 hover:bg-ink/10 hover:text-ink" aria-label={`Remove tag ${t}`}><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </div>

          <footer className="flex shrink-0 gap-3 border-t border-line px-5 py-4 sm:px-7 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1 sm:flex-none">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-void/30 border-t-void" /> : (item ? 'Save changes' : 'Add entry')}
            </button>
          </footer>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
