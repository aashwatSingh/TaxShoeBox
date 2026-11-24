/**
 * Normalize raw Supabase / PostgREST / network errors into safe,
 * user-friendly messages.  Never expose internal constraint names,
 * table names, or stack traces to the UI.
 */

// Patterns that indicate a specific known condition
const PATTERNS = [
  { re: /duplicate key|unique constraint/i,          msg: 'That item already exists.' },
  { re: /violates foreign key/i,                     msg: 'Referenced record not found.' },
  { re: /violates check constraint/i,                msg: 'One or more values are invalid.' },
  { re: /invalid input syntax for type uuid/i,       msg: 'Invalid identifier format.' },
  { re: /jwt expired|token is expired/i,             msg: 'Your session has expired. Please sign in again.' },
  { re: /invalid login credentials/i,                msg: 'Incorrect email or password.' },
  { re: /email not confirmed/i,                      msg: 'Please confirm your email address first.' },
  { re: /user already registered/i,                  msg: 'Check your email to confirm your account.' }, // never reveal whether an address is registered
  { re: /password should be at least/i,              msg: 'Password must be at least 8 characters, with upper/lowercase letters and a number.' },
  { re: /network|fetch|failed to fetch/i,            msg: 'Network error — please check your connection.' },
  { re: /permission denied|rls|policy/i,             msg: 'You do not have permission to do that.' },
  { re: /demo deployment/i,                          msg: 'This deployment has no backend — click "Explore the demo" below instead.' },
]

/**
 * Returns a safe, user-facing message for any error object.
 * Falls back to a generic message so internals are never exposed.
 *
 * @param {unknown} err  — raw Error, Supabase error object, or string
 * @returns {string}
 */
export function friendlyError(err) {
  const raw = (
    typeof err === 'string' ? err :
    err?.message            ? err.message :
    ''
  ).toLowerCase()

  if (!raw) return 'Something went wrong. Please try again.'

  for (const { re, msg } of PATTERNS) {
    if (re.test(raw)) return msg
  }

  return 'Something went wrong. Please try again.'
}
