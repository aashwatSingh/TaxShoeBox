-- ================================================================
-- 20260628120000_init — core schema
-- Tables, RLS, indexes, summary RPC, triggers.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE item_type   AS ENUM ('expense','income','deduction','document','other');
  CREATE TYPE item_status AS ENUM ('pending','verified','flagged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- categories ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      CHAR(7)      NOT NULL DEFAULT '#7c3aed'
               CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon       VARCHAR(50)  NOT NULL DEFAULT 'folder',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- Validates every element of a tags array is 1–50 chars. CHECK constraints
-- can't contain a bare subquery, but CAN call an IMMUTABLE function that
-- does — this mirrors the app-layer assertTag() so the same rule holds
-- even for a client that calls the API directly, bypassing the JS layer.
CREATE OR REPLACE FUNCTION public.tags_within_length(t TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(bool_and(char_length(tag) BETWEEN 1 AND 50), true)
  FROM unnest(t) AS tag;
$$;

-- tax_items ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_items (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  amount       NUMERIC(12,2)  CHECK (amount IS NULL OR amount >= 0),
  category_id  UUID         REFERENCES public.categories(id) ON DELETE SET NULL,
  tax_year     SMALLINT     NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  item_date    DATE,
  -- Holds a private Storage object path (e.g. "<uid>/<file>") rather than a
  -- public URL. Dangerous URI schemes are rejected as defence-in-depth.
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

CREATE INDEX IF NOT EXISTS idx_tax_items_user_year     ON public.tax_items(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_created  ON public.tax_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_category ON public.tax_items(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_tax_items_user_type     ON public.tax_items(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_tax_items_tags          ON public.tax_items USING GIN (tags);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tax_items_title_trgm
  ON public.tax_items USING GIN (title gin_trgm_ops);

-- updated_at trigger -------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tax_items_updated_at ON public.tax_items;
CREATE TRIGGER tax_items_updated_at
  BEFORE UPDATE ON public.tax_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security -------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tax_items  FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.categories FROM anon, public;
REVOKE ALL ON public.tax_items  FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_items  TO authenticated;

DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
CREATE POLICY "categories_select_own" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tax_items_select_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_insert_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_update_own" ON public.tax_items;
DROP POLICY IF EXISTS "tax_items_delete_own" ON public.tax_items;
CREATE POLICY "tax_items_select_own" ON public.tax_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_items_insert_own" ON public.tax_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_items_update_own" ON public.tax_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_items_delete_own" ON public.tax_items FOR DELETE USING (auth.uid() = user_id);

-- Seed default categories on signup ---------------------------------
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- Server-side summary aggregation -----------------------------------
CREATE OR REPLACE FUNCTION public.get_tax_summary(p_year INTEGER)
RETURNS TABLE (total_items BIGINT, expenses NUMERIC, income NUMERIC, deductions NUMERIC, pending BIGINT)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT
    COUNT(*),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'expense'),   0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'income'),    0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'deduction'), 0),
    COUNT(*) FILTER (WHERE status = 'pending')
  FROM public.tax_items
  WHERE user_id = auth.uid() AND tax_year = p_year;
$$;
REVOKE ALL ON FUNCTION public.get_tax_summary(INTEGER) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_tax_summary(INTEGER) TO authenticated;

-- Per-role query timeouts -------------------------------------------
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE anon          SET statement_timeout = '5s';
