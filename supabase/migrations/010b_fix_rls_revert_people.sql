-- =====================================================
-- Migration 010b: Revert saif_people policy, keep company_people fix
-- =====================================================

-- Revert saif_people policy to original
DROP POLICY IF EXISTS "View profiles" ON saif_people;

CREATE POLICY "View active profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  (status = 'active' AND (is_partner() OR is_founder()))
  OR auth_user_id = auth.uid()  -- Always see own profile
);

SELECT 'Migration 010b complete - reverted saif_people policy' as status;
