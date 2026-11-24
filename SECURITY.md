# Security & Scalability Model — TaxShoe

This document explains *why* the app is resistant to the common attacks
(SQL injection, key theft, data leakage, DoS) and how it scales.

---

## 1. "Can someone steal the API key?"

**The anon key is public on purpose — and that is safe.**

In any frontend-only app the key is compiled into the JavaScript bundle
that every visitor downloads. It cannot be hidden. Stealing it gains an
attacker *nothing*, because:

| Protection | Where | Effect |
|---|---|---|
| **FORCE Row Level Security** | `schema.sql` | Every row is gated by `auth.uid() = user_id` — even table owners obey it |
| **`REVOKE ALL … FROM anon`** | `schema.sql` | The anon role has zero table privileges |
| **Signed JWT required** | Supabase Auth | Reading/writing data needs a login-issued token, not just the key |
| **service_role guard** | `config/supabase.js` | App refuses to boot if the *dangerous* key is ever placed in a `VITE_` var |
| **URL validation** | `config/supabase.js` | Rejects a tampered/typo'd Supabase URL |

➡️ With the anon key, an attacker can reach the login screen and nothing
else. The **service_role key** (which *does* bypass RLS) lives only on a
trusted server and is never referenced in client code.

---

## 2. "Can someone SQL-inject?"

**No raw SQL is ever constructed from user input.**

- All reads/writes go through the Supabase JS client → **PostgREST**,
  which sends fully **parameterized** requests. String values can never
  break out into SQL syntax.
- The single dynamic filter string (`.or()` search) is run through
  `sanitizeSearch()`, which strips PostgREST filter metacharacters
  (`, ( ) \ .`) and null bytes, and caps length.
- Inputs are validated *before* they reach the DB: UUID regex for IDs,
  `Set`-whitelist for enums, finite-number check for amounts, range
  check for years, per-tag length limits.
- The database is the final backstop: `CHECK` constraints, typed enums,
  and length limits reject anything malformed.

| Layer | Mechanism |
|---|---|
| App | UUID / enum / number / year / tag validators (`taxService.js`) |
| App | `sanitizeSearch()` for the `.or()` clause |
| Transport | PostgREST parameterized queries (no string SQL) |
| DB | `CHECK` constraints, ENUM types, length limits |
| DB | `SECURITY DEFINER` functions pin `search_path` (no hijacking) |

---

## 2a. Authentication — enforced server-side

Authentication is handled by **Supabase Auth (GoTrue)**, a server-side
service. The browser never runs auth logic — `supabase.auth.signIn(...)` is
just an HTTPS call to that backend, which hashes/verifies passwords and signs
JWTs on the server. The frontend's checks are **UX only**; the real rules
live in `supabase/config.toml` (local) and the Supabase Dashboard (cloud):

| Control | Where enforced |
|---|---|
| Password hashing (bcrypt) & credential verification | Supabase Auth server |
| JWT signing & validation | Supabase Auth server (secret never leaves it) |
| Min length 8 + mixed case + digits | `[auth]` `minimum_password_length` / `password_requirements` |
| Email confirmation before login | `[auth.email] enable_confirmations = true` |
| Refresh-token rotation + reuse detection | `[auth]` rotation + `refresh_token_reuse_interval` |
| Brute-force rate limiting | `[auth.rate_limit]` (server) + UI pre-check |
| Leaked-password (HaveIBeenPwned) & CAPTCHA | Dashboard → Authentication |
| Per-row access for the logged-in user | RLS via `auth.uid()` on every query |

Because these are server-side, a client that bypasses the UI and calls the
API directly still faces the full password policy, email verification, rate
limits, and RLS. The short-lived JWT (1 h) is validated on every request; the
frontend only *holds* it, it can't *forge* it.

---

## 3. Other hardening

- **Client + DB rate limiting** — 5 auth attempts / 60 s in the UI;
  per-role `statement_timeout` (8 s authenticated, 5 s anon) bounds query
  cost server-side.
- **Safe error messages** — `friendlyError()` maps raw DB/network errors
  to generic text so schema/constraint names are never leaked.
- **Security headers / CSP** — set in `vite.config.js` (dev) and
  `public/_headers` (prod): `Content-Security-Policy`, `X-Frame-Options:
  DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`.
- **PKCE auth flow** — most secure browser OAuth/code exchange.
- **Secrets never committed** — `.env` is git-ignored; only `.env.example`
  (with placeholders) is tracked.

---

## 3a. Receipt file storage

Receipts live in a **private** Supabase Storage bucket (`receipts`):
- **Not public** — files are reachable only via short-lived signed URLs the
  app mints on demand; there are no guessable public links.
- **RLS on `storage.objects`** restricts every read/write/delete to files
  whose top-level folder is the caller's own UID (`<auth.uid()>/<file>`), so
  one user can never touch another's receipts.
- **Bucket-level limits** — 10 MB max, and only `image/png`, `image/jpeg`,
  `image/webp`, `image/heic`, `application/pdf` MIME types are accepted.
- The `receipt_url` column rejects `javascript:` / `data:` / `vbscript:`
  URIs as defence-in-depth.

---

## 3b. Demo mode

The "Explore the demo" feature is **entirely client-side**: a sessionStorage
flag plus an in-browser sample dataset (`src/demo/demo.js`). It never touches
Supabase, involves no credentials, and its data evaporates when the tab
closes. When the demo flag is set, `taxService` routes to the local store
*before* any network code runs; real accounts and demo state cannot mix.
A deployment with no `VITE_SUPABASE_*` variables at all runs in demo-only
mode — real sign-in is disabled with a friendly message.

---

## 4. How it scales

| Concern | Approach |
|---|---|
| **Dashboard totals** | Aggregated server-side via the `get_tax_summary` SQL function — one small row over the wire no matter how many items exist (was: fetch-all-and-sum in JS) |
| **List queries** | Range-based pagination (`.range()`), default 24/page |
| **Index coverage** | Composite indexes lead with `user_id` (matching the RLS predicate): `(user_id, tax_year)`, `(user_id, created_at)`, `(user_id, category_id)`, `(user_id, item_type)` |
| **Search** | `pg_trgm` GIN index keeps `ILIKE` searches fast as rows grow |
| **Tags** | GIN index on the `tags` array for fast containment |
| **Connections** | Supabase's PgBouncer pooling handles concurrency |
| **Realtime** | Capped at 10 events/sec per client |

---

## 4b. Dependency audit status

Last audited: November 2026 (`npm audit`): **0 vulnerabilities.**

- react-router-dom 6 → 7.18 (open redirect via backslash, GHSA-wrjc-x8rr-h8h6).
  The app already ran with the v7 future flags, so no code changed.
- vite 5 → 7.3 and @vitejs/plugin-react 4 → 5, which clears the dev-server
  advisories (esbuild CORS, vite fs.deny bypass) that were accepted in July.
  Vite 7 needs Node 20.19+, so `.nvmrc` and `engines` were raised.
- postcss / postcss-selector-parser / source-map-js patched via `npm audit fix`.

## 4c. November 2026 audit — findings and fixes

Each database finding was reproduced against Postgres 16 with two users
(A attacking B) before and after `supabase/migrations/20261124120000_harden_ownership.sql`.

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High (broken feature) | `user_id` had no default and the client never sends it, so **every insert from the app failed** the RLS check. | `user_id DEFAULT auth.uid()` on both tables. The server sets the owner; the client is never trusted to. |
| 2 | Medium | A user could attach their items to **another user's category id**. The FK only checked that the id exists, and FK errors let you probe which ids exist. | INSERT/UPDATE policies require the category to belong to `auth.uid()`; existing cross-tenant links are nulled. |
| 3 | Low | `receipt_url` accepted any path, including another user's Storage folder. (Storage RLS still blocked the actual read.) | Policies require `receipt_url` to start with `<auth.uid()>/`. |
| 4 | Low | `handle_updated_at()` ran as SECURITY DEFINER for no reason; trigger functions were executable by API roles. | Switched to SECURITY INVOKER; EXECUTE revoked from `public`, `anon`, `authenticated`. |
| 5 | Low | Search sanitizer let `"`, `:`, `%` and `*` through into the PostgREST `or=` filter (wildcard / quoting tricks, own rows only). | Those characters are now stripped too. |
| 6 | Low | Sign-up said "An account with that email already exists" (account enumeration). | Generic "check your email" message. |
| 7 | Hardening | CSP had no `object-src`; `vite preview` used the dev CSP with `'unsafe-inline'` scripts. | Added `object-src 'none'` and `upgrade-insecure-requests`; preview now uses the production CSP. |

**Checked and found sound:** no secrets in git history; the service_role
guard; anon is denied every table and the RPC; users can't read, update,
delete or re-assign each other's rows (verified); `get_tax_summary` is
SECURITY INVOKER and scoped to `auth.uid()`; the receipts bucket is private
with path-scoped RLS and no SVG uploads; no `dangerouslySetInnerHTML` or
`eval`; there is no admin role, admin route or debug endpoint to abuse; an
HTML payload in a title renders as text under the production CSP (verified
in Chromium).

**Applying to an existing Supabase project:** `supabase db push`, or paste
the new migration file into the SQL Editor. A fresh project can still use
`supabase/schema.sql`, which now includes it.

---

## 5. Production checklist

- [ ] Enable **email confirmation** in Supabase Auth settings
- [ ] Turn on Supabase's built-in **auth rate limiting** & **CAPTCHA**
- [ ] Set **leaked-password protection** (HaveIBeenPwned) in Auth → Policies
- [ ] Restrict **allowed redirect URLs** to your production domain
- [ ] Keep `service_role` key only in server-side env (never `VITE_`)
- [ ] Run the **Supabase linter** (Database → Advisors) to confirm RLS
      is enabled on all tables
