-- =====================================================
-- Migration 006b: Fix RLS Infinite Recursion
-- Description: Fix the recursive policy on saif_company_people
-- =====================================================

-- Create a security definer function to get user's company IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_company_ids()
RETURNS TABLE(company_id uuid) AS $$
  SELECT DISTINCT cp.company_id
  FROM saif_company_people cp
  WHERE cp.user_id = get_person_id()
    AND cp.end_date IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the problematic policy
DROP POLICY IF EXISTS "View own company relationships" ON saif_company_people;

-- Recreate without recursion
CREATE POLICY "View own company relationships"
ON saif_company_people FOR SELECT
TO authenticated
USING (
  user_id = get_person_id()
  OR is_partner()
  OR company_id IN (SELECT * FROM get_user_company_ids())
);

-- Display results
SELECT 'RLS Recursion Fixed' as status;
