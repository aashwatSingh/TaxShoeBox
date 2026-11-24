# 🗂️ TaxShoe

**Effortless tax organization.** A sleek, full-stack web app for capturing,
categorizing, and reviewing tax documents — receipts, income, deductions —
all secured per-user and built to scale.

![TaxShoe](./docs/banner.svg)

> Live demo: **https://taxshoe.app** — click **"Explore the demo"** on the
> login screen to try everything instantly, no account needed.

---

## ✨ Features

- 🧪 **One-click demo mode** — explore the full app with realistic sample
  data, no account or backend required (entirely client-side, per-tab)
- 🔐 **Email/password auth** with secure PKCE flow
- 📎 **Receipt uploads** — attach images/PDFs to any item, stored in a
  private Supabase Storage bucket with per-user access and signed URLs
- 📊 **Dashboard** with live, server-aggregated yearly totals
  (expenses · income · deductions · pending review)
- 🧾 **Tax items** — title, amount, category, date, type, status, tags
- 🔎 **Search & filter** by year, type, category, and full-text title/description
- 🏷️ **Auto-seeded categories** created for every new user
- 🧾 **Landing page that lets you try before anything else** (`/welcome`): log a line in a working ledger, watch the totals move, and open the demo with your own entries already in it
- ✅ **First-run checklist** in the demo (log → verify → find deductions) and **undo** instead of confirm dialogs on delete
- 🖤 **Matte-black interface**: wide Archivo display type, pointer-lit outlines, sliding page transitions, and an interactive pixel field that leans away from the cursor and ripples where you click or tap (still under `prefers-reduced-motion`)
- 🎬 **Polished UX** — gradient backgrounds, scroll-triggered fade-ins,
  spring-physics interactions
- 📱 Fully responsive

---

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, Vite, React Router |
| **Styling** | Tailwind CSS, custom gradient/animation system |
| **Animation** | Framer Motion + IntersectionObserver |
| **Backend** | Supabase (PostgreSQL, Auth, PostgREST) |
| **Security** | Row Level Security, CSP headers, input validation |
| **Icons / UX** | lucide-react, react-hot-toast, date-fns |

---

## 🔒 Security highlights

This was built security-first — see **[SECURITY.md](./SECURITY.md)** for the
full write-up. The short version:

- **Row Level Security (FORCE RLS)** on every table — a user can *only* ever
  touch rows where `auth.uid() = user_id`, enforced even for privileged roles.
- **`anon` role revoked** from all tables; a signed JWT is required for any access.
- **SQL injection is structurally impossible** — all queries go through
  PostgREST's parameterized layer; the single dynamic search filter is sanitized.
- **service_role key guard** — the app refuses to boot if the RLS-bypassing key
  is ever placed in a client-side variable.
- **Defense in depth** — app-layer validators (UUID, enum, finite-number, year,
  tag-length) backed by database `CHECK` constraints and typed enums.
- **Hardened headers** — CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
- **Rate limiting** (client + per-role `statement_timeout`) and safe,
  non-leaking error messages.

---

## 📈 Built to scale

- **Server-side aggregation** — dashboard totals computed in Postgres
  (`get_tax_summary` RPC); one small row crosses the wire regardless of item count.
- **Composite indexes** leading with `user_id` to match the RLS predicate,
  plus `pg_trgm` and GIN indexes for fast search and tag lookups.
- **Code-splitting** — vendor bundles cached independently (app chunk ~90 kB gzip 26 kB).
- **Range-based pagination** on all list queries.

---

## 🚀 Getting started

> **No Supabase yet?** Just `npm install && npm run dev` and click
> **"Explore the demo"** — the app runs fully client-side with sample data.

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) project (only for real accounts)

### 1. Install
```bash
git clone <your-repo-url>
cd taxshoe
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in your project values from **Supabase → Settings → API**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
> Only the **anon (public)** key — never the `service_role` key (the app will
> refuse to start if you do).

### 3. Set up the database
Open **Supabase → SQL Editor**, paste the contents of
[`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the
tables, RLS policies, indexes, the summary function, and the new-user trigger.

### 4. Run
```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview the production build
```

---

## 🗂️ Project structure

```
taxshoe/
├── config/
│   └── supabase.js          # Client init + service_role guard (keys isolated here)
├── supabase/
│   ├── schema.sql           # Tables, RLS, indexes, RPC, triggers (one-paste setup)
│   └── migrations/          # Same schema as ordered CLI migrations
├── src/
│   ├── components/          # Auth, Dashboard, TaxItems, Layout, UI
│   ├── context/             # Auth provider
│   ├── hooks/               # Data-fetching hooks
│   ├── services/            # taxService + storageService — all data access
│   ├── demo/                # Client-side demo sandbox
│   └── utils/               # Safe error normalization
├── public/_headers          # Production security headers
├── docs/ARCHITECTURE.md     # Code documentation — architecture & data flow
├── SECURITY.md              # Full security & scalability write-up
├── DEPLOYMENT.md            # Go-live walkthrough
└── README.md
```

📖 **New to the codebase?** Start with
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — a full walkthrough of the
architecture, data flow, database schema, and design system.

---

## 📄 License

MIT — feel free to learn from it.
