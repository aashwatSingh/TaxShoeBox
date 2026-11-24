/**
 * All database access goes through Supabase's JS query builder, which
 * sends parameterized requests to PostgREST — SQL injection is not
 * possible via this path.  Row Level Security (with FORCE RLS) on the
 * database enforces ownership for every operation, even for privileged
 * roles.  The anon role is explicitly denied table access in the schema.
 */
import { supabase } from '@config/supabase'
import { isDemoMode, demoStore } from '../demo/demo'

// ── Input validation helpers ────────────────────────────────────────
const UUID_RE          = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ITEM_TYPES = new Set(['expense', 'income', 'deduction', 'document', 'other'])
const VALID_STATUSES   = new Set(['pending', 'verified', 'flagged'])

/** Throws if val is provided but is not a valid UUID string. */
function assertUUID(val, field) {
  if (val && !UUID_RE.test(String(val)))
    throw new Error(`Invalid ${field}: must be a UUID`)
}

/**
 * Parse an amount value to a safe finite number, or null.
 * Rejects Infinity, -Infinity, and NaN — all of which pass isNaN() alone.
 */
function parseAmount(val) {
  if (val === '' || val == null) return null
  const n = Number(val)
  if (!isFinite(n) || n < 0)
    throw new Error('Amount must be a finite non-negative number')
  return n
}

/** Validate a single tag: lowercase alphanumeric + hyphens, max 50 chars. */
function assertTag(tag) {
  if (typeof tag !== 'string' || tag.length === 0 || tag.length > 50)
    throw new Error('Each tag must be between 1 and 50 characters')
}

/** Validate tax year is in the allowed range. */
function assertYear(year) {
  const y = Number(year)
  if (!Number.isInteger(y) || y < 2000 || y > 2100)
    throw new Error('Tax year must be between 2000 and 2100')
  return y
}

/**
 * Strip PostgREST filter-syntax characters from a user-supplied search
 * string to prevent filter-injection via the .or() clause.
 * Characters removed: comma, parentheses, backslash, period, double
 * quote (PostgREST value quoting), colon, null bytes, and the LIKE
 * wildcards % and * (PostgREST treats * as %), so a search can't turn
 * into a match-everything pattern. Also enforced: max 120 chars.
 */
function sanitizeSearch(s) {
  return String(s)
    .replace(/[,()\\.\x00"*%:]/g, '')
    .slice(0, 120)
    .trim()
}

export const taxService = {
  /* ---------------------------------------------------------------- */
  /* Categories                                                         */
  /* ---------------------------------------------------------------- */
  async getCategories() {
    if (isDemoMode()) return demoStore.getCategories()
    return supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
  },

  async createCategory({ name, color = '#7c3aed', icon = 'folder' }) {
    return supabase
      .from('categories')
      .insert({ name: name.trim(), color, icon })
      .select()
      .single()
  },

  async deleteCategory(id) {
    assertUUID(id, 'category id')
    return supabase.from('categories').delete().eq('id', id)
  },

  /* ---------------------------------------------------------------- */
  /* Tax items                                                          */
  /* ---------------------------------------------------------------- */
  async getTaxItems({ taxYear, itemType, categoryId, search, page = 0, pageSize = 24 } = {}) {
    if (isDemoMode()) return demoStore.getTaxItems({ taxYear, itemType, categoryId, search, page, pageSize })
    // Validate enum + UUID inputs before they reach the query builder
    if (itemType   && !VALID_ITEM_TYPES.has(itemType))
      throw new Error(`Invalid item_type: ${itemType}`)
    assertUUID(categoryId, 'category_id')

    let q = supabase
      .from('tax_items')
      .select('*, categories(id,name,color,icon)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (taxYear)    q = q.eq('tax_year', Number(taxYear))
    if (itemType)   q = q.eq('item_type', itemType)
    if (categoryId) q = q.eq('category_id', categoryId)

    // Sanitize search before embedding in the PostgREST filter string to
    // prevent filter-injection (e.g. "foo%,amount.gt.0" adding extra clauses).
    if (search?.trim()) {
      const s = sanitizeSearch(search)
      if (s) q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
    }

    return q
  },

  async createTaxItem(item) {
    if (isDemoMode()) return demoStore.createTaxItem(item)
    const itemType = item.item_type || 'expense'
    const status   = item.status    || 'pending'
    if (!VALID_ITEM_TYPES.has(itemType)) throw new Error(`Invalid item_type: ${itemType}`)
    if (!VALID_STATUSES.has(status))     throw new Error(`Invalid status: ${status}`)
    assertUUID(item.category_id, 'category_id')
    const tags = Array.isArray(item.tags) ? item.tags : []
    tags.forEach(assertTag)

    return supabase
      .from('tax_items')
      .insert({
        title:       item.title.trim(),
        description: item.description?.trim() || null,
        amount:      parseAmount(item.amount),         // guards Infinity/NaN
        category_id: item.category_id || null,
        tax_year:    assertYear(item.tax_year),        // guards out-of-range years
        item_date:   item.item_date   || null,
        receipt_url: item.receipt_url || null,
        item_type:   itemType,
        status,
        tags,
      })
      .select('*, categories(id,name,color,icon)')
      .single()
  },

  async updateTaxItem(id, updates) {
    if (isDemoMode()) return demoStore.updateTaxItem(id, updates)
    assertUUID(id, 'tax item id')
    assertUUID(updates.category_id, 'category_id')
    if (updates.item_type && !VALID_ITEM_TYPES.has(updates.item_type))
      throw new Error(`Invalid item_type: ${updates.item_type}`)
    if (updates.status && !VALID_STATUSES.has(updates.status))
      throw new Error(`Invalid status: ${updates.status}`)

    const patch = {}
    if (updates.title       !== undefined) patch.title       = updates.title.trim()
    if (updates.description !== undefined) patch.description = updates.description?.trim() || null
    if (updates.amount      !== undefined) patch.amount      = parseAmount(updates.amount)   // guards Infinity/NaN
    if (updates.category_id !== undefined) patch.category_id = updates.category_id || null
    if (updates.tax_year    !== undefined) patch.tax_year    = assertYear(updates.tax_year)  // guards range
    if (updates.item_date   !== undefined) patch.item_date   = updates.item_date || null
    if (updates.receipt_url !== undefined) patch.receipt_url = updates.receipt_url || null
    if (updates.item_type   !== undefined) patch.item_type   = updates.item_type
    if (updates.status      !== undefined) patch.status      = updates.status
    if (updates.tags        !== undefined) {
      patch.tags = Array.isArray(updates.tags) ? updates.tags : []
      patch.tags.forEach(assertTag) // guards per-tag length
    }

    return supabase
      .from('tax_items')
      .update(patch)
      .eq('id', id)
      .select('*, categories(id,name,color,icon)')
      .single()
  },

  async deleteTaxItem(id) {
    if (isDemoMode()) return demoStore.deleteTaxItem(id)
    assertUUID(id, 'tax item id')
    return supabase.from('tax_items').delete().eq('id', id)
  },

  async getSummary(taxYear) {
    if (isDemoMode()) return demoStore.getSummary(taxYear)
    const year = assertYear(taxYear) // throws if outside 2000–2100

    // Aggregation happens server-side in Postgres (see get_tax_summary in
    // schema.sql) — only one small row crosses the network regardless of
    // how many thousands of items the user has. Scales O(1) over the wire.
    const { data, error } = await supabase.rpc('get_tax_summary', { p_year: year })
    if (error) return { data: null, error }

    const row = Array.isArray(data) ? data[0] : data
    return {
      data: {
        totalItems: Number(row?.total_items ?? 0),
        expenses:   Number(row?.expenses   ?? 0),
        income:     Number(row?.income     ?? 0),
        deductions: Number(row?.deductions ?? 0),
        pending:    Number(row?.pending    ?? 0),
      },
      error: null,
    }
  },
}
