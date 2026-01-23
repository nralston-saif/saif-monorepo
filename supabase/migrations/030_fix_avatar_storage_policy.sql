-- =====================================================
-- Migration 030: Fix Avatar Storage Policy
-- Description: Allow users to upload avatars using their person ID as folder
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;

-- INSERT: Users can upload to their own person folder OR partners can upload anywhere
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'saif-avatars'
  AND (
    -- Partners can upload to any folder
    is_partner()
    OR
    -- Users can upload to their own person folder
    (storage.foldername(name))[1] = (
      SELECT id::text FROM saif_people WHERE auth_user_id = auth.uid()
    )
  )
);

-- UPDATE: Users can update their own avatars OR partners can update any
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'saif-avatars'
  AND (
    is_partner()
    OR
    (storage.foldername(name))[1] = (
      SELECT id::text FROM saif_people WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'saif-avatars'
  AND (
    is_partner()
    OR
    (storage.foldername(name))[1] = (
      SELECT id::text FROM saif_people WHERE auth_user_id = auth.uid()
    )
  )
);

-- DELETE: Users can delete their own avatars OR partners can delete any
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'saif-avatars'
  AND (
    is_partner()
    OR
    (storage.foldername(name))[1] = (
      SELECT id::text FROM saif_people WHERE auth_user_id = auth.uid()
    )
  )
);

-- Display result
SELECT 'Avatar storage policies updated' as status;
