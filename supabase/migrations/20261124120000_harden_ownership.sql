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
