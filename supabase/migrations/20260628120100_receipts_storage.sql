-- ================================================================
-- 20260628120100_receipts_storage — private receipt file storage
-- ================================================================
-- A private bucket for receipt images / PDFs. Security model:
--   • Bucket is NOT public — files are only reachable via short-lived
--     signed URLs the app mints on demand.
--   • Size capped at 10 MB; only image + PDF MIME types accepted.
--   • RLS on storage.objects restricts every operation to files whose
--     top-level folder is the caller's own UID ("<auth.uid()>/<file>"),
--     so one user can never read or delete another user's receipts.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', false, 10485760,
  ARRAY['image/png','image/jpeg','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path-scoped RLS. (storage.foldername(name))[1] is the first path
-- segment; we require it to equal the authenticated user's id.
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
