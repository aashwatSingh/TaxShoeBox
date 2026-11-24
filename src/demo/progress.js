/**
 * First-run checklist for the demo: three actions that together show the
 * product's core loop (log → verify → find). Stored per tab, like the demo.
 */
const KEY = 'taxshoe-demo-progress'
export const STEPS = [
  { id: 'add',    label: 'Log an entry',           hint: 'Add something you paid for or earned.' },
  { id: 'verify', label: 'Verify a pending entry', hint: 'Open one marked Pending and set it to Verified.' },
  { id: 'filter', label: 'Find your deductions',   hint: 'In the ledger, filter by Deductions.' },
]

const listeners = new Set()
function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) ?? { done: [], dismissed: false } } catch { return { done: [], dismissed: false } }
}
function write(s) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn(s))
}

export const progress = {
  get: read,
  mark(id) {
    const s = read()
    if (!s.done.includes(id)) write({ ...s, done: [...s.done, id] })
  },
  dismiss() { write({ ...read(), dismissed: true }) },
  reset() { write({ done: [], dismissed: false }) },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
}
