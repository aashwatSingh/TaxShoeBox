-- ================================================================
-- TAXSHOE — Database Schema (full snapshot)
-- Paste this whole file into the Supabase SQL Editor and run it.
-- It is the concatenation of supabase/migrations/*.sql — CLI users can
-- instead run `supabase db push`. Includes the receipts Storage bucket.
-- ================================================================
-- Security model:
--   • All queries from the JS client use Supabase's query builder,
--     which always uses parameterized statements (no raw SQL).
--   • Row Level Security (RLS) is enabled on every table so that
--     users can only ever read or write their own rows.
--   • CHECK constraints validate data types and value ranges at
--     the database level as a second line of defence.
--   • Functions use SECURITY DEFINER + fixed search_path to prevent
--     privilege escalation via search_path hijacking.
-- ================================================================

-- ----------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE item_type   AS ENUM ('expense','income','deduction','document','other');
  CREATE TYPE item_status AS ENUM ('pending','verified','flagged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      CHAR(7)     NOT NULL DEFAULT '#7c3aed'
               CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon       VARCHAR(50) NOT NULL DEFAULT 'folder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categories_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- ----------------------------------------------------------------
-- Validates every element of a tags array is 1–50 chars. CHECK
-- constraints can't contain a bare subquery, but CAN call an IMMUTABLE
-- function that does — this mirrors the app-layer assertTag() so the
-- rule holds even for a client that calls the API directly.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tags_within_length(t TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(bool_and(char_length(tag) BETWEEN 1 AND 50), true)
  FROM unnest(t) AS tag;
$$;

-- ----------------------------------------------------------------
-- tax_items
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_items (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  amount       NUMERIC(12,2)  CHECK (amount IS NULL OR amount >= 0),
  category_id  UUID         REFERENCES public.categories(id) ON DELETE SET NULL,
  tax_year     SMALLINT     NOT NULL
                 CHECK (tax_year BETWEEN 2000 AND 2100),
  item_date    DATE,
  -- Holds a private Storage object path (e.g. "<uid>/<file>"). Dangerous
  -- URI schemes are rejected as defence-in-depth.
  receipt_url  TEXT CHECK (
                 receipt_url IS NULL OR (
                   char_length(receipt_url) <= 1024
                   AND receipt_url !~* '^\s*(javascript|data|vbscript):'
                 )),
  item_type    item_type    NOT NULL DEFAULT 'expense',
  status       item_status  NOT NULL DEFAULT 'pending',
  tags         TEXT[]       NOT NULL DEFAULT '{}'
                 CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 20)
                 CHECK (public.tags_within_length(tags)),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tax_items_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 255),
  CONSTRAINT tax_items_desc_length  CHECK (description IS NULL OR char_length(description) <= 2000)
);

-- Composite indexes that match the app's actual access patterns.
-- Because RLS adds "user_id = auth.uid()" to EVERY query, the leading
-- column of each index is user_id so the planner can use the index for
-- both the RLS predicate and the filter/sort in one pass.
CREATE INDEX IF NOT EXISTS idx_tax_items_user_year
  ON public.tax_items(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_created
  ON public.tax_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_category
  ON public.tax_items(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_type
  ON public.tax_items(user_id, item_type);

-- GIN index for fast tag containment queries as the dataset grows.
CREATE INDEX IF NOT EXISTS idx_tax_items_tags
  ON public.tax_items USING GIN (tags);

-- Trigram index to keep title/description ILIKE searches fast at scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tax_items_title_trgm
  ON public.tax_items USING GIN (title gin_trgm_ops);

-- ----------------------------------------------------------------
-- Auto-update updated_at
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tax_items_updated_at ON public.tax_items;
CREATE TRIGGER tax_items_updated_at
  BEFORE UPDATE ON public.tax_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_items  ENABLE ROW LEVEL SECURITY;

-- FORCE RLS applies the policies even to table owners / superusers,
-- closing the privilege-escalation loophole.
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tax_items  FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Explicit privilege grants
-- Revoke blanket public access, then grant only to authenticated.
-- The anon role gets nothing — unauthenticated requests are blocked
-- at the policy layer AND the privilege layer.
-- ----------------------------------------------------------------
REVOKE ALL ON public.categories FROM anon, public;
REVOKE ALL ON public.tax_items  FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_items  TO authenticated;

-- ----------------------------------------------------------------
-- RLS Policies — categories
-- Each policy uses BOTH USING (read guard) and WITH CHECK (write
-- guard) so a user can never touch another user's rows.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;

CREATE POLICY "categories_select_own" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- RLS Policies — tax_items
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "tax_items_select_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_insert_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_update_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_delete_own" ON public.tax_items;

CREATE POLICY "tax_items_select_own" ON public.tax_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tax_items_insert_own" ON public.tax_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tax_items_update_own" ON public.tax_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tax_items_delete_own" ON public.tax_items
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Seed default categories for new users
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, color, icon) VALUES
    (NEW.id, 'Business Expenses',    '#7c3aed', 'briefcase'),
    (NEW.id, 'Medical',              '#dc2626', 'heart'),
    (NEW.id, 'Charitable Donations', '#16a34a', 'gift'),
    (NEW.id, 'Home Office',          '#d97706', 'home'),
    (NEW.id, 'Travel & Transport',   '#0891b2', 'car'),
    (NEW.id, 'Education',            '#6d28d9', 'book-open'),
    (NEW.id, 'Investment Income',    '#d4a843', 'trending-up'),
    (NEW.id, 'Miscellaneous',        '#6b7280', 'folder');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- ----------------------------------------------------------------
-- Server-side summary aggregation (scalability)
-- Instead of shipping every row to the browser to be summed in JS,
-- aggregate inside Postgres and return a single row.
--   • SECURITY INVOKER  → runs as the calling user, so RLS still
--                          restricts it to that user's own rows.
--   • Explicit user_id = auth.uid() lets the planner use the
--     idx_tax_items_user_year composite index.
--   • STABLE            → tells the planner there are no side effects.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tax_summary(p_year INTEGER)
RETURNS TABLE (
  total_items BIGINT,
  expenses    NUMERIC,
  income      NUMERIC,
  deductions  NUMERIC,
  pending     BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT
    COUNT(*)                                                        AS total_items,
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'expense'),   0) AS expenses,
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'income'),    0) AS income,
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'deduction'), 0) AS deductions,
    COUNT(*) FILTER (WHERE status = 'pending')                      AS pending
  FROM public.tax_items
  WHERE user_id = auth.uid()
    AND tax_year = p_year;
$$;

-- Only logged-in users may call it; anon is denied.
REVOKE ALL ON FUNCTION public.get_tax_summary(INTEGER) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_tax_summary(INTEGER) TO authenticated;

-- ----------------------------------------------------------------
-- Per-role statement timeouts (DoS / runaway-query protection)
-- Bounds how long any single query from these roles can run, so a
-- crafted or accidental expensive query cannot tie up the database.
-- ----------------------------------------------------------------
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE anon          SET statement_timeout = '5s';

-- ----------------------------------------------------------------
-- Receipts storage bucket (private; 10 MB; images + PDF only)
-- Files live under "<auth.uid()>/<file>"; RLS on storage.objects
-- restricts every operation to the owner's own folder. Reads happen
-- through short-lived signed URLs minted by the app.
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', false, 10485760,
  ARRAY['image/png','image/jpeg','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "receipts_select_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_update_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete_own" ON storage.objects;

CREATE POLICY "receipts_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "receipts_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "receipts_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "receipts_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));


-- ================================================================
-- 20261124120000_harden_ownership — security audit fixes
-- ================================================================
-- 1. user_id now defaults to auth.uid(). The client never sends
--    user_id (it shouldn't be trusted to), so before this every insert
--    from the app failed the RLS check with user_id = NULL.
-- 2. A tax item may only reference one of the caller's OWN categories.
--    Previously the FK accepted any category id, so a user could attach
--    their items to another user's category (and probe which category
--    ids exist via FK errors).
-- 3. receipt_url must point inside the caller's own Storage folder
--    ("<auth.uid()>/..."), so a row can never reference someone else's
--    file. Storage RLS already blocks the read; this keeps the data clean.
-- 4. Trigger functions are not callable by API roles, and the
--    updated_at trigger no longer runs with elevated privileges.
-- ================================================================

-- 1. Server-side ownership default ----------------------------------
ALTER TABLE public.categories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.tax_items  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Clean up any cross-tenant references created before this migration.
UPDATE public.tax_items t
   SET category_id = NULL
 WHERE category_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.categories c
      WHERE c.id = t.category_id AND c.user_id = t.user_id
   );

-- 2 + 3. Tighter INSERT / UPDATE policies on tax_items --------------
DROP POLICY IF EXISTS "tax_items_insert_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_update_own" ON public.tax_items;

CREATE POLICY "tax_items_insert_own" ON public.tax_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (category_id IS NULL OR EXISTS (
          SELECT 1 FROM public.categories c
           WHERE c.id = category_id AND c.user_id = auth.uid()))
    AND (receipt_url IS NULL OR starts_with(receipt_url, auth.uid()::text || '/'))
  );

CREATE POLICY "tax_items_update_own" ON public.tax_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (category_id IS NULL OR EXISTS (
          SELECT 1 FROM public.categories c
           WHERE c.id = category_id AND c.user_id = auth.uid()))
    AND (receipt_url IS NULL OR starts_with(receipt_url, auth.uid()::text || '/'))
  );

-- 4. Least privilege for trigger functions --------------------------
ALTER FUNCTION public.handle_updated_at() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.handle_updated_at()         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_categories() FROM public, anon, authenticated;
