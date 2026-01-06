-- =====================================================
-- Migration 007: Storage Buckets Setup
-- Description: Create storage buckets for avatars and logos
-- NOTE: Buckets must be created via Supabase Dashboard first
-- =====================================================

/*
===========================================
STEP 1: Create Buckets via Dashboard
===========================================

Go to Supabase Dashboard → Storage → New Bucket

Bucket 1: saif-avatars
- Name: saif-avatars
- Public: NO (private, requires authentication)
- File size limit: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp

Bucket 2: saif-company-logos
- Name: saif-company-logos
- Public: NO (private, requires authentication)
- File size limit: 2MB
- Allowed MIME types: image/jpeg, image/png, image/svg+xml

===========================================
STEP 2: Run this SQL after buckets created
===========================================
*/

-- Storage policies for saif-avatars bucket

-- SELECT: Authenticated users can view avatars
CREATE POLICY "Authenticated users view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'saif-avatars');

-- INSERT: Users can upload to their own folder
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'saif-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can update their own avatars
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'saif-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'saif-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can delete their own avatars
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'saif-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policies for saif-company-logos bucket

-- SELECT: Authenticated users can view logos
CREATE POLICY "Authenticated users view logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'saif-company-logos');

-- INSERT: Authorized users can upload company logos
CREATE POLICY "Authorized users upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'saif-company-logos'
  AND (
    -- Partners can upload any logo
    (SELECT EXISTS (SELECT 1 FROM saif_people WHERE auth_user_id = auth.uid() AND role = 'partner'))
    OR
    -- Founders can upload their company's logo
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM saif_company_people
      WHERE user_id = (SELECT id FROM saif_people WHERE auth_user_id = auth.uid())
        AND relationship_type = 'founder'
        AND end_date IS NULL
    )
  )
);

-- UPDATE: Authorized users can update company logos
CREATE POLICY "Authorized users update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'saif-company-logos'
  AND (
    (SELECT EXISTS (SELECT 1 FROM saif_people WHERE auth_user_id = auth.uid() AND role = 'partner'))
    OR
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM saif_company_people
      WHERE user_id = (SELECT id FROM saif_people WHERE auth_user_id = auth.uid())
        AND relationship_type = 'founder'
        AND end_date IS NULL
    )
  )
);

-- DELETE: Authorized users can delete company logos
CREATE POLICY "Authorized users delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'saif-company-logos'
  AND (
    (SELECT EXISTS (SELECT 1 FROM saif_people WHERE auth_user_id = auth.uid() AND role = 'partner'))
    OR
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM saif_company_people
      WHERE user_id = (SELECT id FROM saif_people WHERE auth_user_id = auth.uid())
        AND relationship_type = 'founder'
        AND end_date IS NULL
    )
  )
);

-- Display results
SELECT
  'Storage Policies Created' as status,
  'Buckets: saif-avatars, saif-company-logos' as buckets,
  'File structure: {bucket}/{id}/{filename}' as structure;
