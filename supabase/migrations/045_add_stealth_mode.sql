-- =====================================================
-- Migration 045: Add Stealth Mode for Companies
-- Description: Allow portfolio companies to hide themselves and their team
--              from non-partners (while founders can still see their own company)
-- =====================================================

-- 1. Add is_stealth column to saif_companies
ALTER TABLE saif_companies
ADD COLUMN IF NOT EXISTS is_stealth BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_saif_companies_is_stealth ON saif_companies(is_stealth) WHERE is_stealth = TRUE;

-- 2. Create helper function to check if user is founder of a specific company
CREATE OR REPLACE FUNCTION is_founder_of_company(company_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM saif_company_people
    WHERE company_id = company_uuid
      AND user_id = get_person_id()
      AND relationship_type = 'founder'
      AND end_date IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Update RLS policy for saif_companies to handle stealth mode
-- Drop existing policy first
DROP POLICY IF EXISTS "View portfolio companies" ON saif_companies;

-- Create new policy that respects stealth mode
-- Partners: see ALL companies
-- Non-partners: see portfolio companies WHERE is_stealth=false OR is_founder_of_company(id)
CREATE POLICY "View portfolio companies"
ON saif_companies FOR SELECT
TO authenticated
USING (
  is_partner()                                         -- Partners see everything
  OR (
    stage = 'portfolio'                                -- Non-partners only see portfolio companies
    AND (
      is_stealth = FALSE                               -- that are not in stealth mode
      OR is_founder_of_company(id)                     -- OR they are a founder of that company
    )
  )
);

-- 4. Update RLS policy for saif_people to hide team members of stealth companies
-- We need to modify the "View active profiles" policy to exclude people whose
-- ONLY active company relationships are with stealth companies

-- Drop existing policy
DROP POLICY IF EXISTS "View active profiles" ON saif_people;

-- Create new policy that respects stealth mode
-- Partners: see ALL people
-- Self: always see own profile
-- Non-partners: see people UNLESS all their active company relationships are to stealth companies
CREATE POLICY "View active profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  is_partner()                                         -- Partners see everyone
  OR auth_user_id = auth.uid()                         -- Always see own profile
  OR (
    status = 'active'                                  -- Must be active
    AND (is_partner() OR is_founder())                 -- Must be authenticated as partner/founder to see others
    AND (
      -- Show person if they have NO company relationships (just a contact)
      NOT EXISTS (
        SELECT 1 FROM saif_company_people scp
        WHERE scp.user_id = saif_people.id
          AND scp.end_date IS NULL
      )
      OR
      -- OR they have at least one active relationship with a non-stealth portfolio company
      EXISTS (
        SELECT 1 FROM saif_company_people scp
        JOIN saif_companies sc ON scp.company_id = sc.id
        WHERE scp.user_id = saif_people.id
          AND scp.end_date IS NULL
          AND sc.stage = 'portfolio'
          AND (
            sc.is_stealth = FALSE                       -- Company is not in stealth
            OR is_founder_of_company(sc.id)             -- OR viewer is founder of that company
          )
      )
      OR
      -- OR they have relationships with non-portfolio companies (advisors, contacts, etc.)
      EXISTS (
        SELECT 1 FROM saif_company_people scp
        JOIN saif_companies sc ON scp.company_id = sc.id
        WHERE scp.user_id = saif_people.id
          AND scp.end_date IS NULL
          AND sc.stage != 'portfolio'
      )
    )
  )
);

-- Display results
SELECT 'Stealth mode migration complete' as status;

-- Show updated policies
SELECT
  tablename,
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('saif_companies', 'saif_people')
  AND policyname IN ('View portfolio companies', 'View active profiles')
ORDER BY tablename;
