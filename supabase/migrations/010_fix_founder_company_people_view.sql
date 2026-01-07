-- =====================================================
-- Migration 010: Fix founder view of company_people
-- Description: Allow founders to see people at all portfolio companies
-- =====================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "View own company relationships" ON saif_company_people;

-- Create new policy that allows founders to see portfolio company relationships
CREATE POLICY "View company relationships"
ON saif_company_people FOR SELECT
TO authenticated
USING (
  user_id = get_person_id()           -- Own relationships
  OR is_partner()                      -- Partners see all
  OR company_id IN (                   -- Others at same company
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id() AND end_date IS NULL
  )
  OR company_id IN (                   -- Founders can see all portfolio company relationships
    SELECT id FROM saif_companies
    WHERE stage = 'portfolio'
  )
);

-- Also need to allow founders to see people at portfolio companies
-- Update saif_people policy to allow viewing people associated with portfolio companies
DROP POLICY IF EXISTS "View active profiles" ON saif_people;

CREATE POLICY "View profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()           -- Always see own profile
  OR is_partner()                      -- Partners see all
  OR (                                 -- Founders see active/pending profiles
    status IN ('active', 'pending')
    AND is_founder()
  )
);

SELECT 'Migration 010 complete - founders can now view portfolio company relationships' as status;
