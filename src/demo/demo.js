/**
 * Demo mode — a fully client-side sandbox so anyone (recruiters!) can
 * explore the app without an account or a Supabase backend.
 *
 * - Activated by a flag in sessionStorage (per-tab, cleared on close).
 * - All "database" operations run against an in-memory dataset that is
 *   persisted to sessionStorage so edits survive a refresh.
 * - Mirrors the exact { data, error, count } response shapes of
 *   taxService so the hooks and UI need zero special-casing.
 * - No real credentials are involved and nothing leaves the browser.
 */

const FLAG_KEY = 'taxshoe-demo'
const DATA_KEY = 'taxshoe-demo-data'

export const DEMO_USER = {
  id: 'd3a00000-0000-4000-8000-000000000001',
  email: 'demo@taxshoe.app',
  isDemo: true,
}

export function isDemoMode() {
  try { return sessionStorage.getItem(FLAG_KEY) === '1' } catch { return false }
}

export function enterDemo() {
  try { sessionStorage.setItem(FLAG_KEY, '1') } catch { /* storage blocked */ }
}

export function exitDemo() {
  items = null // drop the in-memory copy too, so a new demo starts from the seed
  try {
    sessionStorage.removeItem(FLAG_KEY)
    sessionStorage.removeItem(DATA_KEY)
    sessionStorage.removeItem('taxshoe-demo-progress')
  } catch { /* storage blocked */ }
}

/* ------------------------------------------------------------------ */
/* Seed data                                                            */
/* ------------------------------------------------------------------ */

const CATS = [
  { id: 'ca700000-0000-4000-8000-000000000001', name: 'Business Expenses',    color: '#7c3aed', icon: 'briefcase' },
  { id: 'ca700000-0000-4000-8000-000000000002', name: 'Medical',              color: '#dc2626', icon: 'heart' },
  { id: 'ca700000-0000-4000-8000-000000000003', name: 'Charitable Donations', color: '#16a34a', icon: 'gift' },
  { id: 'ca700000-0000-4000-8000-000000000004', name: 'Home Office',          color: '#d97706', icon: 'home' },
  { id: 'ca700000-0000-4000-8000-000000000005', name: 'Travel & Transport',   color: '#0891b2', icon: 'car' },
  { id: 'ca700000-0000-4000-8000-000000000006', name: 'Education',            color: '#6d28d9', icon: 'book-open' },
  { id: 'ca700000-0000-4000-8000-000000000007', name: 'Investment Income',    color: '#d4a843', icon: 'trending-up' },
  { id: 'ca700000-0000-4000-8000-000000000008', name: 'Miscellaneous',        color: '#6b7280', icon: 'folder' },
]

const YEAR = new Date().getFullYear()

const seedItems = () => [
  { title: 'MacBook Pro 16″ — client development', description: 'Primary work machine, used 100% for freelance contracts.', amount: 2499.00, category: 0, tax_year: YEAR, item_date: `${YEAR}-01-18`, item_type: 'expense',   status: 'verified', tags: ['equipment', 'client-work'], receipt_url: 'demo/macbook-invoice.pdf' },
  { title: 'Q1 freelance invoice — Acme Corp',     description: 'Web platform build, milestone 1 of 3.',                    amount: 8400.00, category: null, tax_year: YEAR, item_date: `${YEAR}-03-31`, item_type: 'income',    status: 'verified', tags: ['freelance', 'invoice'] },
  { title: 'Standing desk & ergonomic chair',      description: 'Home office furniture for dedicated workspace.',           amount: 649.99,  category: 3, tax_year: YEAR, item_date: `${YEAR}-02-07`, item_type: 'expense',   status: 'pending',  tags: ['furniture'] },
  { title: 'Dividend payout — index fund',         description: null,                                                       amount: 312.40,  category: 6, tax_year: YEAR, item_date: `${YEAR}-04-02`, item_type: 'income',    status: 'verified', tags: ['dividends'] },
  { title: 'Red Cross annual donation',            description: 'Receipt #RC-99812 on file.',                               amount: 500.00,  category: 2, tax_year: YEAR, item_date: `${YEAR}-04-15`, item_type: 'deduction', status: 'verified', tags: ['charity'] },
  { title: 'Conference flight — Austin, TX',       description: 'React Summit speaker travel.',                             amount: 418.60,  category: 4, tax_year: YEAR, item_date: `${YEAR}-05-09`, item_type: 'expense',   status: 'pending',  tags: ['travel', 'conference'] },
  { title: 'Dental cleaning + x-rays',             description: null,                                                       amount: 285.00,  category: 1, tax_year: YEAR, item_date: `${YEAR}-03-12`, item_type: 'expense',   status: 'verified', tags: ['dental'] },
  { title: 'Online course — Advanced React',       description: 'Continuing education for client work.',                    amount: 199.00,  category: 5, tax_year: YEAR, item_date: `${YEAR}-02-22`, item_type: 'expense',   status: 'verified', tags: ['learning'] },
  { title: 'W-2 — day job',                        description: 'Employer wage statement, filed with return.',              amount: null,    category: 7, tax_year: YEAR, item_date: `${YEAR}-01-31`, item_type: 'document',  status: 'verified', tags: ['w2'] },
  { title: 'Mileage log — client site visits',     description: '1,240 miles logged Jan–May.',                              amount: null,    category: 4, tax_year: YEAR, item_date: `${YEAR}-05-30`, item_type: 'document',  status: 'pending',  tags: ['mileage'] },
  { title: 'Adobe Creative Cloud (annual)',        description: null,                                                       amount: 599.88,  category: 0, tax_year: YEAR - 1, item_date: `${YEAR - 1}-11-04`, item_type: 'expense', status: 'verified', tags: ['software', 'subscription'] },
  { title: 'Goodwill donation — office cleanout',  description: 'Itemized list attached.',                                  amount: 230.00,  category: 2, tax_year: YEAR - 1, item_date: `${YEAR - 1}-12-19`, item_type: 'deduction', status: 'verified', tags: ['charity'] },
].map((it, i) => ({
  id: `17e00000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  user_id: DEMO_USER.id,
  title: it.title,
  description: it.description,
  amount: it.amount,
  category_id: it.category == null ? null : CATS[it.category].id,
  tax_year: it.tax_year,
  item_date: it.item_date,
  receipt_url: it.receipt_url ?? null,
  item_type: it.item_type,
  status: it.status,
  tags: it.tags,
  created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
  updated_at: new Date(Date.now() - i * 86_400_000).toISOString(),
}))

/* ------------------------------------------------------------------ */
/* In-memory store with sessionStorage persistence                      */
/* ------------------------------------------------------------------ */

let items = null

function load() {
  if (items) return items
  try {
    const saved = sessionStorage.getItem(DATA_KEY)
    items = saved ? JSON.parse(saved) : seedItems()
  } catch {
    items = seedItems()
  }
  return items
}

function save() {
  try { sessionStorage.setItem(DATA_KEY, JSON.stringify(items)) } catch { /* ignore */ }
}

const catById = (id) => CATS.find(c => c.id === id) ?? null
const withJoin = (row) => ({ ...row, categories: catById(row.category_id) })
const newId = () =>
  (crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)))

/* ------------------------------------------------------------------ */
/* taxService-compatible API                                            */
/* ------------------------------------------------------------------ */

export const demoStore = {
  async getCategories() {
    return { data: [...CATS].sort((a, b) => a.name.localeCompare(b.name)), error: null }
  },

  async getTaxItems({ taxYear, itemType, categoryId, search, page = 0, pageSize = 24 } = {}) {
    let rows = load().filter(r =>
      (!taxYear    || r.tax_year === Number(taxYear)) &&
      (!itemType   || r.item_type === itemType) &&
      (!categoryId || r.category_id === categoryId)
    )
    if (search?.trim()) {
      const s = search.trim().toLowerCase()
      rows = rows.filter(r =>
        r.title.toLowerCase().includes(s) ||
        (r.description ?? '').toLowerCase().includes(s)
      )
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
    const count = rows.length
    const data = rows.slice(page * pageSize, (page + 1) * pageSize).map(withJoin)
    return { data, count, error: null }
  },

  async createTaxItem(item) {
    const now = new Date().toISOString()
    const row = {
      id: newId(),
      user_id: DEMO_USER.id,
      title: item.title.trim(),
      description: item.description?.trim() || null,
      amount: item.amount !== '' && item.amount != null ? Number(item.amount) : null,
      category_id: item.category_id || null,
      tax_year: Number(item.tax_year),
      item_date: item.item_date || null,
      receipt_url: item.receipt_url || null,
      item_type: item.item_type || 'expense',
      status: item.status || 'pending',
      tags: Array.isArray(item.tags) ? item.tags : [],
      created_at: now,
      updated_at: now,
    }
    load().unshift(row)
    save()
    return { data: withJoin(row), error: null }
  },

  async updateTaxItem(id, updates) {
    const row = load().find(r => r.id === id)
    if (!row) return { data: null, error: { message: 'Item not found' } }
    const fields = ['title', 'description', 'amount', 'category_id', 'tax_year', 'item_date', 'receipt_url', 'item_type', 'status', 'tags']
    for (const f of fields) {
      if (updates[f] !== undefined) {
        row[f] =
          f === 'amount'   ? (updates.amount !== '' && updates.amount != null ? Number(updates.amount) : null) :
          f === 'tax_year' ? Number(updates.tax_year) :
          f === 'tags'     ? (Array.isArray(updates.tags) ? updates.tags : []) :
          typeof updates[f] === 'string' && (f === 'title' || f === 'description')
            ? (updates[f]?.trim() || (f === 'description' ? null : updates[f])) :
          (updates[f] || null)
      }
    }
    row.updated_at = new Date().toISOString()
    save()
    return { data: withJoin(row), error: null }
  },

  async deleteTaxItem(id) {
    const idx = load().findIndex(r => r.id === id)
    if (idx !== -1) { items.splice(idx, 1); save() }
    return { error: null }
  },

  async getSummary(taxYear) {
    const year = Number(taxYear)
    const rows = load().filter(r => r.tax_year === year)
    const out = { totalItems: rows.length, expenses: 0, income: 0, deductions: 0, pending: 0 }
    for (const r of rows) {
      const amt = Number(r.amount) || 0
      if (r.item_type === 'expense')   out.expenses   += amt
      if (r.item_type === 'income')    out.income     += amt
      if (r.item_type === 'deduction') out.deductions += amt
      if (r.status    === 'pending')   out.pending++
    }
    return { data: out, error: null }
  },
}
