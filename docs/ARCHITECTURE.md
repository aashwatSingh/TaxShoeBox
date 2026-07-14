# TaxShoe — Code Documentation & Architecture

A developer's guide to the codebase: how it's organized, how data flows,
and why it's built the way it is. Companion docs:
[README](../README.md) (product overview) ·
[SECURITY](../SECURITY.md) (threat model) ·
[DEPLOYMENT](../DEPLOYMENT.md) (go-live steps).

---

## 1. Stack & high-level architecture

**Frontend:** React 18 + Vite, JavaScript (JSX), Tailwind CSS, Framer Motion
**Backend:** Supabase — hosted PostgreSQL, GoTrue auth, Storage. There is no
custom application server; the browser talks to Supabase's APIs directly and
**Row Level Security in Postgres is the authorization layer**.

```
┌─────────────────────────────────────────────────────┐
│ Browser (React SPA — all JavaScript)                │
│                                                     │
│  Components ──► Hooks ──► Services ──► Supabase JS  │
│  (render)      (state)   (validate)    client       │
│                              │                      │
│                              └──► demoStore         │
│                                   (client-side      │
│                                    sandbox)         │
└───────────────┬─────────────────────────────────────┘
                │ HTTPS (parameterized PostgREST, JWT)
┌───────────────▼─────────────────────────────────────┐
│ Supabase                                            │
│  • GoTrue auth (bcrypt, JWT signing, rate limits)   │
│  • PostgREST → PostgreSQL (RLS on every query)      │
│  • Storage (private bucket, path-scoped RLS)        │
└─────────────────────────────────────────────────────┘
```

The layering rule: **components never touch `supabase` directly.** All data
access goes through `src/services/`, all component state through
`src/hooks/`. This keeps validation in one place and makes the demo-mode
swap invisible to the UI.

---

## 2. Directory tour

```
tax-shoebox/
├── config/
│   └── supabase.js         Client init + boot-time security guards
├── supabase/
│   ├── config.toml         Supabase CLI config; authoritative auth policy
│   ├── schema.sql          Full schema snapshot (one-paste setup)
│   └── migrations/         Same schema as ordered CLI migrations
├── public/                 Static deploy assets (_headers, _redirects,
│                           robots.txt, og-image.svg)
├── src/
│   ├── main.jsx            Entry: StrictMode → ErrorBoundary → App
│   ├── App.jsx             Providers, routes, route guards, toaster
│   ├── index.css           Design tokens + component classes (see §7)
│   ├── components/
│   │   ├── Auth/AuthPage.jsx        Sign-in/up + demo entry
│   │   ├── Dashboard/Dashboard.jsx  Stats, pending banner, recent items
│   │   ├── TaxItems/
│   │   │   ├── TaxItemList.jsx      Search, filters, card grid, modals
│   │   │   ├── TaxItemCard.jsx      Item card (forwardRef motion component)
│   │   │   └── TaxItemForm.jsx      Create/edit modal + receipt upload
│   │   ├── Layout/                  Navbar + page frame + footer
│   │   └── UI/                      ThemeToggle, spinners, ErrorBoundary
│   ├── context/
│   │   ├── AuthContext.jsx          Session state (real + demo + none)
│   │   └── ThemeContext.jsx         Dark/light, persisted, system default
│   ├── hooks/
│   │   └── useTaxItems.js           useTaxItems / useCategories / useTaxSummary
│   ├── services/
│   │   ├── taxService.js            All DB access + input validation
│   │   └── storageService.js        Receipt upload / signed URL / delete
│   ├── demo/
│   │   └── demo.js                  Client-side demo sandbox (see §5)
│   └── utils/
│       └── errors.js                friendlyError() — safe error mapping
├── vite.config.js          Aliases, dev CSP headers, vendor chunking
├── tailwind.config.js      gold accent scale, custom ease
└── vercel.json             Prod rewrites/headers (Netlify: public/_headers)
```

---

## 3. Data flow

### Read path (e.g. the items grid)

1. `TaxItemList` holds filter state (`search`, `year`, `type`, `catId`) and
   passes it to `useTaxItems(filters)`.
2. The hook serializes filters (`JSON.stringify`) as its effect key, calls
   `taxService.getTaxItems(...)` through its `safe()` wrapper, and exposes
   `{ items, loading, error, count }`.
3. `taxService.getTaxItems` validates inputs (enum whitelist, UUID regex),
   sanitizes the search string, then either:
   - **demo mode** → delegates to `demoStore.getTaxItems` (same response shape), or
   - builds a parameterized PostgREST query with `.eq()/.or()/.range()`.
4. RLS in Postgres appends `user_id = auth.uid()` to everything — the client
   *cannot* query another user's rows even with a modified bundle.

### Write path (create/edit with receipt)

1. `TaxItemForm.handleSubmit` validates locally, then if a file was picked,
   uploads it first via `storageService.upload(userId, file)` →
   `receipts/<uid>/<timestamp>-<rand>.<ext>`.
2. It calls `onSave(payload)` (provided by `TaxItemList`/`Dashboard`), which
   calls the hook's `createItem`/`updateItem` and **returns `{ error }`**.
3. On failure: the modal stays open, and the just-uploaded (now orphaned)
   file is removed. On success: the modal closes, and a *replaced* old
   receipt is deleted. Order matters — the old file is only deleted after
   the DB row no longer references it.
4. `deleteItem(item)` takes the whole item (not just the id) so it can also
   best-effort delete the attached receipt file.

### Dashboard summary

`useTaxSummary(year)` → `taxService.getSummary` → the `get_tax_summary`
Postgres function. Aggregation happens **in the database** (one small row
over the wire regardless of item count); the demo store computes the same
shape client-side.

---

## 4. Auth & session model

`AuthContext` supports three mutually exclusive session kinds:

| Kind | Trigger | `user` value |
|---|---|---|
| **Real** | Supabase session exists | GoTrue user object |
| **Demo** | `sessionStorage['taxshoe-demo'] === '1'` | `DEMO_USER` constant |
| **None** | neither | `null` → `ProtectedRoute` redirects to `/auth` |

Key points:

- **Auth is enforced server-side.** `signIn/signUp` are HTTPS calls to
  GoTrue, which does the hashing/verification/JWT-signing. The frontend's
  8-char password check is UX-only; the authoritative policy lives in
  `supabase/config.toml` (local) and the Supabase Dashboard (cloud).
- **Backend-less deploys** (`hasBackend === false` in `config/supabase.js`):
  the client is `null`, real sign-in returns a friendly error, demo mode
  still works. This lets the site deploy with zero configuration.
- **Boot guards** in `config/supabase.js`: refuses to start if a
  `service_role` key is detected in the anon slot (decodes the JWT's `role`
  claim), and validates the Supabase URL shape.

---

## 5. Demo mode (`src/demo/demo.js`)

A fully client-side sandbox so the app is explorable with no account:

- Flag + data live in `sessionStorage` (per-tab, gone on close).
- `demoStore` mirrors `taxService`'s exact `{ data, error, count }` response
  shapes, so hooks and components need **zero** special-casing.
- The swap happens at the top of each `taxService` method:
  `if (isDemoMode()) return demoStore.method(...)` — *before* any network
  code, so demo and real data can never mix.
- Receipt uploads in demo return a synthetic `demo/<name>` path; the UI
  renders a non-clickable "Receipt (demo)" chip
  (`storageService.isReal()` distinguishes real Storage paths).

---

## 6. Database schema reference (`supabase/schema.sql`)

### Tables

**`categories`** — per-user labels. `id` (uuid PK), `user_id` (FK →
`auth.users`, cascade), `name` (1–100 chars), `color` (`#rrggbb`, CHECK'd),
`icon` (lucide icon name), `created_at`. Eight defaults are seeded for every
new user by the `on_auth_user_created` trigger.

**`tax_items`** — the core record.

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | FK → auth.users, cascade delete |
| `title` | varchar(255) | 1–255 chars (trimmed) |
| `description` | text | ≤ 2000 chars, nullable |
| `amount` | numeric(12,2) | ≥ 0 or null |
| `category_id` | uuid | FK → categories, `SET NULL` on delete |
| `tax_year` | smallint | 2000–2100 |
| `item_date` | date | nullable |
| `receipt_url` | text | Storage *path* (not URL); ≤1024 chars; `javascript:`/`data:`/`vbscript:` rejected |
| `item_type` | enum | expense · income · deduction · document · other |
| `status` | enum | pending · verified · flagged |
| `tags` | text[] | ≤ 20 tags, each 1–50 chars (`tags_within_length()`) |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

### Functions & triggers

- `handle_updated_at()` — BEFORE UPDATE trigger, bumps `updated_at`.
- `create_default_categories()` — AFTER INSERT on `auth.users`, seeds categories.
- `get_tax_summary(p_year)` — `SECURITY INVOKER`, `STABLE`; returns one row
  of totals for the calling user's year. Anon role denied.
- `tags_within_length(text[])` — IMMUTABLE helper so a CHECK constraint can
  validate every tag's length.

### Security & performance

- `ENABLE` + `FORCE ROW LEVEL SECURITY` on both tables; four per-operation
  policies each (`USING` + `WITH CHECK` on `auth.uid() = user_id`).
- `REVOKE ALL FROM anon, public`; explicit grants to `authenticated` only.
- Composite indexes lead with `user_id` (matches the RLS predicate):
  `(user_id, tax_year)`, `(user_id, created_at DESC)`,
  `(user_id, category_id)`, `(user_id, item_type)`; GIN on `tags`;
  `pg_trgm` GIN on `title` for fast `ILIKE` search.
- Per-role `statement_timeout` (8s authenticated / 5s anon).

### Storage

Private `receipts` bucket: 10 MB cap, image/PDF MIME whitelist, and RLS on
`storage.objects` restricting every operation to paths whose first folder
equals the caller's uid. Reads happen via short-lived signed URLs minted by
`storageService.signedUrl()` (default 60 s).

---

## 7. Design system (`src/index.css` + `tailwind.config.js`)

All theming flows from CSS custom properties defined on `:root` (light) and
`.dark` (dark): `--bg-base`, `--bg-subtle`, `--surface(+alphas)`,
`--text-primary/secondary/tertiary`, `--accent`, `--accent-contrast`.
Components use a small set of shared classes rather than ad-hoc values:

| Class | Purpose |
|---|---|
| `.bg-app` | Static two-tone page background |
| `.surface` / `.surface-hover` | The one card treatment used everywhere |
| `.surface-raised` | Elevated surface — modals & dropdowns only |
| `.text-accent` | Accent color — key figures / wordmark only |
| `.btn-primary` / `.btn-ghost` | Buttons |
| `.input` / `.select` | Form fields |
| `.badge` | Status/type chips |
| `.skeleton` | Loading shimmer |

Motion rules: micro-interactions ~150 ms, entrances ≤ 220 ms with the
`cubic-bezier(0.16,1,0.3,1)` ease; `MotionConfig reducedMotion="user"` plus
a CSS `prefers-reduced-motion` kill-switch. The single accent (gold scale in
`tailwind.config.js`) appears only on primary actions, key numbers, and
active states.

**Gotcha for contributors:** `TaxItemCard` must remain a `forwardRef`
component — `AnimatePresence` (with `mode="popLayout"`) attaches a ref
directly to it to drive enter/exit animations.

---

## 8. Error handling

- **`safe()`** (in `useTaxItems.js`) wraps every service call so both thrown
  validation errors and Supabase `{ error }` returns surface identically.
- **`friendlyError()`** (`utils/errors.js`) maps raw DB/auth/network errors
  to safe user-facing text — internal constraint/table names never reach the
  UI.
- **Save flows return `{ error }` upward** — modals only close on success,
  and receipt-file cleanup only runs against saves that actually happened.
- **`ErrorBoundary`** (class component at the root) catches render-time
  crashes and offers a reload, instead of a white page.

## 9. Validation — defense in depth

| Layer | Mechanism |
|---|---|
| Form (UX) | required title/year, `isFinite` amount, file type/size |
| Service | UUID regex, enum `Set` whitelists, `parseAmount` (rejects Infinity/NaN), `assertYear`, per-tag length, `sanitizeSearch` (strips PostgREST filter metacharacters) |
| Transport | PostgREST parameterized queries — no string SQL exists |
| Database | CHECK constraints, typed enums, RLS, bucket MIME/size limits |

The same rule is often enforced twice on purpose: the app layer gives good
error messages; the database is the backstop against clients that bypass
the app entirely.
