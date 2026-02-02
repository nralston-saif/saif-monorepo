-- Migration 046: Fix infinite recursion in saif_people policies
--
-- Migration 045 added inline EXISTS subqueries to the "View active profiles"
-- SELECT policy on saif_people. Those subqueries access saif_company_people
-- and saif_companies, whose own RLS policies chain back to saif_people via
-- helper functions — causing PostgreSQL to detect infinite recursion.
--
-- Fix: Move the stealth-visibility check into a SECURITY DEFINER function
-- that bypasses RLS entirely, and keep the SELECT policy simple.
-- Also fix the "Update own profile" WITH CHECK to use get_user_role().

-- 1. Create a SECURITY DEFINER function for stealth visibility checks.
--    This runs as the function owner (superuser), bypassing all RLS.
CREATE OR REPLACE FUNCTION is_person_visible(person_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT
    -- Person has NO active company relationships (just a contact) → visible
    NOT EXISTS (
      SELECT 1 FROM saif_company_people scp
      WHERE scp.user_id = person_uuid
        AND scp.end_date IS NULL
    )
    OR
    -- Person has at least one relationship with a non-stealth portfolio company → visible
    EXISTS (
      SELECT 1 FROM saif_company_people scp
      JOIN saif_companies sc ON scp.company_id = sc.id
      WHERE scp.user_id = person_uuid
        AND scp.end_date IS NULL
        AND sc.stage = 'portfolio'
        AND (
          sc.is_stealth = FALSE
          OR is_founder_of_company(sc.id)
        )
    )
    OR
    -- Person has relationships with non-portfolio companies → visible
    EXISTS (
      SELECT 1 FROM saif_company_people scp
      JOIN saif_companies sc ON scp.company_id = sc.id
      WHERE scp.user_id = person_uuid
        AND scp.end_date IS NULL
        AND sc.stage != 'portfolio'
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Replace the "View active profiles" SELECT policy.
--    Now uses is_person_visible() instead of inline EXISTS subqueries.
DROP POLICY IF EXISTS "View active profiles" ON saif_people;

CREATE POLICY "View active profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  is_partner()
  OR auth_user_id = auth.uid()
  OR (
    status = 'active'
    AND (is_partner() OR is_founder())
    AND is_person_visible(id)
  )
);

-- 3. Fix the "Update own profile" WITH CHECK clause.
--    Replace raw subquery with SECURITY DEFINER function.
DROP POLICY IF EXISTS "Update own profile" ON saif_people;

CREATE POLICY "Update own profile"
ON saif_people FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid()
  AND role = get_user_role()
);
