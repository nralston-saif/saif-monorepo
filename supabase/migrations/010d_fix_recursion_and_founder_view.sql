-- =====================================================
-- Migration 010d: Fix recursion AND allow founder view
-- =====================================================

-- First, ensure the helper function exists (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_user_company_ids()
RETURNS TABLE(company_id uuid) AS $$
  SELECT DISTINCT cp.company_id
  FROM saif_company_people cp
  WHERE cp.user_id = get_person_id()
    AND cp.end_date IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create function to get portfolio company IDs (also bypasses RLS)
CREATE OR REPLACE FUNCTION get_portfolio_company_ids()
RETURNS TABLE(company_id uuid) AS $$
  SELECT id FROM saif_companies WHERE stage = 'portfolio'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop any existing policies
DROP POLICY IF EXISTS "View own company relationships" ON saif_company_people;
DROP POLICY IF EXISTS "View company relationships" ON saif_company_people;

-- Create policy that:
-- 1. Uses helper functions to avoid recursion
-- 2. Allows founders to see all portfolio company relationships
CREATE POLICY "View company relationships"
ON saif_company_people FOR SELECT
TO authenticated
USING (
  user_id = get_person_id()                              -- Own relationships
  OR is_partner()                                         -- Partners see all
  OR company_id IN (SELECT * FROM get_user_company_ids()) -- Others at same company
  OR company_id IN (SELECT * FROM get_portfolio_company_ids()) -- All portfolio company people
);

SELECT 'Migration 010d complete - fixed recursion and enabled founder view' as status;
