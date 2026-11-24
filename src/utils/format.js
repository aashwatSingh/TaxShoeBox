const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** $8,712 */
export const money = (n) => usd0.format(Number(n) || 0)
/** $8,712.40 */
export const moneyExact = (n) => usd2.format(Number(n) || 0)

/**
 * Item-type metadata shared by every view. `sign` is how the amount reads
 * in a ledger: income adds, expenses subtract, deductions reduce tax.
 */
export const TYPE_META = {
  expense:   { label: 'Expense',   plural: 'Expenses',   tone: 'text-expense', border: 'border-expense/30 bg-expense/[0.08]', lit: 'expense', sign: '−' },
  income:    { label: 'Income',    plural: 'Income',     tone: 'text-income',  border: 'border-income/30 bg-income/[0.08]',   lit: 'income',  sign: '+' },
  deduction: { label: 'Deduction', plural: 'Deductions', tone: 'text-deduct',  border: 'border-deduct/30 bg-deduct/[0.08]',   lit: 'deduct',  sign: '−' },
  document:  { label: 'Document',  plural: 'Documents',  tone: 'text-doc',     border: 'border-doc/30 bg-doc/[0.08]',         lit: '',        sign: '' },
  other:     { label: 'Other',     plural: 'Other',      tone: 'text-muted',   border: 'border-line-strong bg-ink/[0.04]',    lit: '',        sign: '' },
}
export const typeMeta = (t) => TYPE_META[t] ?? TYPE_META.other

export const STATUS_META = {
  pending:  { label: 'Pending',  tone: 'text-pending', border: 'border-pending/30 bg-pending/[0.08]' },
  verified: { label: 'Verified', tone: 'text-income',  border: 'border-income/25 bg-income/[0.06]' },
  flagged:  { label: 'Flagged',  tone: 'text-expense', border: 'border-expense/30 bg-expense/[0.08]' },
}
export const statusMeta = (s) => STATUS_META[s] ?? STATUS_META.pending
