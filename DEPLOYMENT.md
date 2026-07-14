# Deploying TaxShoe

TaxShoe is a static Vite SPA + a Supabase backend. Deploy the frontend to
any static host and point it at your Supabase project. Total time: ~10 min.

---

## 1. Set up the Supabase backend (once)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema — either way creates the tables, RLS policies, indexes,
   the `get_tax_summary` function, per-role timeouts, the new-user trigger,
   **and the private `receipts` Storage bucket with its access policies**:
   - **Quick:** open **SQL Editor**, paste all of
     [`supabase/schema.sql`](./supabase/schema.sql), and **Run**.
   - **Or via CLI:** `supabase link --project-ref <ref>` then
     `supabase db push` (applies [`supabase/migrations/`](./supabase/migrations)).
3. In **Authentication → Providers**, enable **Email**.
4. **Server-side auth policy** (Dashboard → Authentication). These are the
   authoritative rules — enforced by Supabase Auth even for direct API calls,
   so nothing depends on the frontend. They mirror `supabase/config.toml`:
   - **Confirm email**: ON (users must verify before logging in)
   - **Minimum password length**: 8, **Password requirements**: letters + digits, mixed case
   - **Leaked-password protection** (HaveIBeenPwned): ON
   - **Bot/CAPTCHA protection**: ON
   - **Rate limits**: keep defaults or lower (sign-in, token refresh, emails)
   - **Refresh-token rotation + reuse detection**: ON
   - **Site URL** and **Redirect URLs**: your production domain only
5. Grab **Settings → API → Project URL** and the **anon public** key.

> Why the dashboard *and* `config.toml`? `supabase db push` applies database
> objects (tables, RLS, functions, the Storage bucket) but **not** auth
> settings. `config.toml` governs local `supabase start`; the dashboard
> governs your cloud project. Set both so local and prod match.

---

## 2. Deploy the frontend

Set these environment variables on your host (build-time, `VITE_`-prefixed):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your **anon/public** key (never service_role) |

Build settings (auto-detected on most hosts):
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 20 (pinned via `.nvmrc`)

### Vercel
`vercel.json` is included (SPA rewrites, security headers, asset caching).
Import the repo, add the two env vars, deploy.

### Netlify / Cloudflare Pages
`public/_redirects` (SPA fallback) and `public/_headers` (security + caching)
are included and copied into `dist/` automatically. Set build command
`npm run build`, publish directory `dist`, add the two env vars, deploy.

### Any other static host
Serve the `dist/` folder and add a catch-all rewrite to `/index.html` so
client-side routes resolve on refresh.

---

## 3. Post-deploy checklist

- [ ] Sign up, confirm email, log in
- [ ] Add an item — confirm it appears and the dashboard totals update
- [ ] Attach a receipt (image/PDF), then click it to open the signed URL
- [ ] Refresh on `/items` — should load (SPA fallback working)
- [ ] Open a second account — confirm you **cannot** see the first user's data (RLS)
- [ ] Check response headers include the CSP / HSTS / X-Frame-Options
- [ ] Run **Supabase → Database → Advisors** — confirm no RLS warnings

---

## Notes
- The **anon key is public by design** and safe to ship — RLS protects the data.
  The app refuses to boot if a `service_role` key is supplied instead.
- See [`SECURITY.md`](./SECURITY.md) for the full security & scalability model.
