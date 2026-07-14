/**
 * Supabase client — initialized once and exported for reuse.
 *
 * ── On API keys & "stealing" them ───────────────────────────────────
 * The anon (public) key is INTENTIONALLY public. It is embedded in the
 * compiled JS bundle that ships to every browser, so it can never be
 * hidden in a frontend-only app. This is by design and is safe BECAUSE:
 *   1. Row Level Security (FORCE RLS) means the anon key alone grants
 *      access to NOTHING — every row is gated by auth.uid() = user_id.
 *   2. The anon role has been REVOKEd from both tables in schema.sql.
 *   3. A valid, signed JWT (obtained only by logging in) is required to
 *      read or write any data.
 *
 * The service_role key is the dangerous one — it bypasses RLS entirely.
 * It must live ONLY on a trusted server, NEVER in this file or any
 * VITE_-prefixed variable (those are bundled into client code).
 * The guard below refuses to boot if a service_role key is detected.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * hasBackend — false when credentials are absent. The app still runs in
 * this state: real sign-in is disabled, but the fully client-side demo
 * mode (src/demo/demo.js) remains available. This allows zero-config
 * portfolio deploys with no Supabase project at all.
 *
 * Credentials that are PRESENT but invalid still fail loudly below —
 * absence is a choice, a malformed value is a mistake.
 */
export const hasBackend = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasBackend && import.meta.env.DEV) {
  console.warn(
    '[TaxShoe] No Supabase credentials found — running in demo-only mode.\n' +
      'Copy .env.example → .env to connect a real backend.'
  )
}

/**
 * Decode the `role` claim from a Supabase JWT (base64url-safe).
 * Returns null if the token can't be parsed.
 */
function decodeJwtRole(jwt) {
  try {
    const part = String(jwt).split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json).role ?? null
  } catch {
    return null
  }
}

// ── Hard guard: never let the all-powerful service_role key ship to the
//    browser. This catches the single most catastrophic key mistake. ──
if (hasBackend && decodeJwtRole(supabaseAnonKey) === 'service_role') {
  throw new Error(
    '🚨 SECURITY ERROR: a service_role key was placed in VITE_SUPABASE_ANON_KEY.\n' +
      'The service_role key BYPASSES Row Level Security and must NEVER be exposed to the browser.\n' +
      'Replace it with your project\'s anon (public) key.'
  )
}

// Validate the URL is a real https Supabase endpoint (defends against a
// typo'd or attacker-supplied URL pointing the client elsewhere).
if (hasBackend && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(supabaseUrl)) {
  throw new Error(`Invalid VITE_SUPABASE_URL: "${supabaseUrl}" is not a valid Supabase https endpoint.`)
}

export const supabase = hasBackend
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE is the most secure browser auth flow — the authorization code
        // is exchanged with a one-time verifier, preventing code interception.
        flowType: 'pkce',
      },
      global: {
        headers: { 'X-Client-Info': 'taxshoe/1.0.0' },
      },
      // Cap realtime event rate so a flood of changes can't overwhelm clients.
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null
