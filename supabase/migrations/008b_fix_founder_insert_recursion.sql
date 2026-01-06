-- =====================================================
-- Migration 008b: Fix Infinite Recursion in Founder Insert Policy
-- Description: Create security definer function to avoid recursion
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Founders create company relationships" ON saif_company_people;

-- Create a security definer function to get companies where user is a founder (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_founder_company_ids()
RETURNS TABLE(company_id uuid) AS $$
  SELECT DISTINCT cp.company_id
  FROM saif_company_people cp
  WHERE cp.user_id = get_person_id()
    AND cp.relationship_type = 'founder'
    AND cp.end_date IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the policy without recursion
CREATE POLICY "Founders create company relationships"
ON saif_company_people FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT * FROM get_user_founder_company_ids())
);

-- Display results
SELECT 'Founder Insert Policy Fixed' as status;
