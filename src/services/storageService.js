/**
 * Receipt file storage. Uploads go to the private `receipts` bucket under
 * a path prefixed with the user's id ("<uid>/<file>"), which the Storage
 * RLS policies require. Because the bucket is private, viewing a receipt
 * mints a short-lived signed URL on demand.
 *
 * Demo mode and backend-less deploys are handled gracefully: uploads are
 * kept as in-memory object URLs for the session instead of hitting Storage.
 */
import { supabase, hasBackend } from '@config/supabase'
import { isDemoMode } from '../demo/demo'

const BUCKET    = 'receipts'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — mirrors the bucket limit
const ALLOWED   = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']

/** Throws if the file is the wrong type or too large. Returns the file. */
export function validateReceiptFile(file) {
  if (!file) return null
  if (!ALLOWED.includes(file.type))
    throw new Error('Receipt must be a PNG, JPG, WebP, or PDF')
  if (file.size > MAX_BYTES)
    throw new Error('Receipt must be 10 MB or smaller')
  return file
}

/** Build a collision-resistant, sanitized object name. */
function safeObjectName(original) {
  const dot = original.lastIndexOf('.')
  const ext = dot >= 0 ? original.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : ''
  const rand = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '')
  return `${Date.now()}-${rand}${ext}`
}

const isDemoPath = (p) => typeof p === 'string' && p.startsWith('demo/')

export const storageService = {
  /**
   * Upload a receipt and return { path, name }.
   * In demo / no-backend mode returns a synthetic demo path so the UI
   * can still show "receipt attached" without persisting a real file.
   */
  async upload(userId, file) {
    validateReceiptFile(file)

    if (isDemoMode() || !hasBackend || !supabase) {
      return { path: `demo/${file.name}`, name: file.name }
    }

    const path = `${userId}/${safeObjectName(file.name)}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    if (error) throw error
    return { path, name: file.name }
  },

  /** Mint a short-lived signed URL for viewing/downloading a receipt. */
  async signedUrl(path, expiresIn = 60) {
    if (!path || isDemoPath(path) || isDemoMode() || !supabase) return null
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
    if (error) throw error
    return data?.signedUrl ?? null
  },

  /** Best-effort delete (never blocks the surrounding operation). */
  async remove(path) {
    if (!path || isDemoPath(path) || isDemoMode() || !supabase) return
    try { await supabase.storage.from(BUCKET).remove([path]) } catch { /* ignore */ }
  },

  /** True when the path is a real Storage object (not a demo placeholder). */
  isReal(path) {
    return Boolean(path) && !isDemoPath(path)
  },
}
