-- =====================================================
-- Migration 010c: Complete rollback to original policies
-- =====================================================

-- Revert saif_people policy
DROP POLICY IF EXISTS "View profiles" ON saif_people;
DROP POLICY IF EXISTS "View active profiles" ON saif_people;

CREATE POLICY "View active profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  (status = 'active' AND (is_partner() OR is_founder()))
  OR auth_user_id = auth.uid()
);

-- Revert saif_company_people policy
DROP POLICY IF EXISTS "View company relationships" ON saif_company_people;
DROP POLICY IF EXISTS "View own company relationships" ON saif_company_people;

CREATE POLICY "View own company relationships"
ON saif_company_people FOR SELECT
TO authenticated
USING (
  user_id = get_person_id()
  OR is_partner()
  OR company_id IN (
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id() AND end_date IS NULL
  )
);

SELECT 'Rollback complete - original policies restored' as status;
