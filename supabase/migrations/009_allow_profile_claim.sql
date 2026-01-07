-- =====================================================
-- Migration 009: Allow Profile Claiming
-- Description: Add policy to let users claim unclaimed profiles matching their email
-- =====================================================

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Claim unclaimed profile by email" ON saif_people;

-- Allow authenticated users to claim unclaimed profiles where the email matches (case-insensitive)
CREATE POLICY "Claim unclaimed profile by email"
ON saif_people FOR UPDATE
TO authenticated
USING (
  -- Can update if profile is unclaimed and email matches (case-insensitive)
  auth_user_id IS NULL
  AND LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
)
WITH CHECK (
  -- After update, auth_user_id must be set to own id
  auth_user_id = auth.uid()
);

-- Display result
SELECT 'Profile claim policy created' as status;
