-- =====================================================
-- Migration 006: Row Level Security Policies
-- Description: Enable RLS and create access control policies
-- =====================================================

-- Create helper functions for RLS
CREATE OR REPLACE FUNCTION is_partner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM saif_people
    WHERE auth_user_id = auth.uid() AND role = 'partner'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_founder()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM saif_people
    WHERE auth_user_id = auth.uid() AND role = 'founder'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM saif_people
  WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_person_id()
RETURNS UUID AS $$
  SELECT id FROM saif_people
  WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE saif_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_company_people ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policies for: saif_people
-- ============================================

-- SELECT: Users can view active profiles (status='active' means has platform access)
CREATE POLICY "View active profiles"
ON saif_people FOR SELECT
TO authenticated
USING (
  (status = 'active' AND (is_partner() OR is_founder()))
  OR auth_user_id = auth.uid()  -- Always see own profile
);

-- INSERT: Users can create their own profile (triggered on signup)
CREATE POLICY "Insert own profile"
ON saif_people FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

-- UPDATE: Users can update their own profile
CREATE POLICY "Update own profile"
ON saif_people FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid()
  AND role = (SELECT role FROM saif_people WHERE auth_user_id = auth.uid())  -- Prevent role escalation
);

-- UPDATE: Partners can update any profile
CREATE POLICY "Partners update any profile"
ON saif_people FOR UPDATE
TO authenticated
USING (is_partner())
WITH CHECK (is_partner());

-- DELETE: Only partners can delete people (soft delete via status preferred)
CREATE POLICY "Partners delete people"
ON saif_people FOR DELETE
TO authenticated
USING (is_partner());

-- ============================================
-- Policies for: saif_companies
-- ============================================

-- SELECT: Authenticated users can view portfolio companies
CREATE POLICY "View portfolio companies"
ON saif_companies FOR SELECT
TO authenticated
USING (
  stage = 'portfolio'  -- Founders can see portfolio companies
  OR is_partner()      -- Partners see all companies
);

-- INSERT: Only partners can add companies
CREATE POLICY "Partners insert companies"
ON saif_companies FOR INSERT
TO authenticated
WITH CHECK (is_partner());

-- UPDATE: Founders can update their own company info
CREATE POLICY "Founders update own company"
ON saif_companies FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id()
      AND relationship_type = 'founder'
      AND end_date IS NULL
  )
)
WITH CHECK (
  id IN (
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id()
      AND relationship_type = 'founder'
      AND end_date IS NULL
  )
);

-- UPDATE: Partners can update any company
CREATE POLICY "Partners update companies"
ON saif_companies FOR UPDATE
TO authenticated
USING (is_partner())
WITH CHECK (is_partner());

-- DELETE: Only partners can delete companies
CREATE POLICY "Partners delete companies"
ON saif_companies FOR DELETE
TO authenticated
USING (is_partner());

-- ============================================
-- Policies for: saif_investments
-- ============================================

-- SELECT: Partners can view all investments
CREATE POLICY "Partners view investments"
ON saif_investments FOR SELECT
TO authenticated
USING (is_partner());

-- SELECT: Founders can view their company's investments (basic info only)
CREATE POLICY "Founders view own company investments"
ON saif_investments FOR SELECT
TO authenticated
USING (
  is_founder()
  AND company_id IN (
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id()
      AND relationship_type = 'founder'
      AND end_date IS NULL
  )
);

-- INSERT/UPDATE/DELETE: Only partners can modify investments
CREATE POLICY "Partners insert investments"
ON saif_investments FOR INSERT
TO authenticated
WITH CHECK (is_partner());

CREATE POLICY "Partners update investments"
ON saif_investments FOR UPDATE
TO authenticated
USING (is_partner())
WITH CHECK (is_partner());

CREATE POLICY "Partners delete investments"
ON saif_investments FOR DELETE
TO authenticated
USING (is_partner());

-- ============================================
-- Policies for: saif_company_people
-- ============================================

-- SELECT: Users can view their own company relationships
CREATE POLICY "View own company relationships"
ON saif_company_people FOR SELECT
TO authenticated
USING (
  user_id = get_person_id()
  OR is_partner()
  OR company_id IN (
    -- Can see others at same company
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id() AND end_date IS NULL
  )
);

-- INSERT: Partners can create relationships
CREATE POLICY "Partners create relationships"
ON saif_company_people FOR INSERT
TO authenticated
WITH CHECK (is_partner());

-- INSERT: Founders can claim their own relationships (when signing up)
CREATE POLICY "Founders claim own relationships"
ON saif_company_people FOR INSERT
TO authenticated
WITH CHECK (
  user_id = get_person_id()
  AND relationship_type = 'founder'
);

-- UPDATE: Partners can update any relationship
CREATE POLICY "Partners update relationships"
ON saif_company_people FOR UPDATE
TO authenticated
USING (is_partner())
WITH CHECK (is_partner());

-- UPDATE: Users can update their own relationships
CREATE POLICY "Update own relationships"
ON saif_company_people FOR UPDATE
TO authenticated
USING (user_id = get_person_id())
WITH CHECK (user_id = get_person_id());

-- DELETE: Partners can delete relationships
CREATE POLICY "Partners delete relationships"
ON saif_company_people FOR DELETE
TO authenticated
USING (is_partner());

-- ============================================
-- Policies for CRM tables (saifcrm_*)
-- ============================================

-- These tables remain partner-only
-- Add RLS if not already enabled

-- Enable RLS on CRM tables
ALTER TABLE saifcrm_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saifcrm_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saifcrm_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saifcrm_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saifcrm_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing CRM policies if they exist
DROP POLICY IF EXISTS "Partners only" ON saifcrm_applications;
DROP POLICY IF EXISTS "Partners only" ON saifcrm_votes;
DROP POLICY IF EXISTS "Partners only" ON saifcrm_deliberations;
DROP POLICY IF EXISTS "Partners only" ON saifcrm_investments;
DROP POLICY IF EXISTS "Partners only" ON saifcrm_meeting_notes;

-- Create partners-only policies for CRM tables
CREATE POLICY "Partners only" ON saifcrm_applications FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner());
CREATE POLICY "Partners only" ON saifcrm_votes FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner());
CREATE POLICY "Partners only" ON saifcrm_deliberations FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner());
CREATE POLICY "Partners only" ON saifcrm_investments FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner());
CREATE POLICY "Partners only" ON saifcrm_meeting_notes FOR ALL TO authenticated USING (is_partner()) WITH CHECK (is_partner());

-- Display results
SELECT
  'RLS Policies Created' as status,
  COUNT(*) FILTER (WHERE schemaname = 'public' AND tablename LIKE 'saif_%') as saif_tables_with_rls,
  COUNT(*) FILTER (WHERE schemaname = 'public' AND tablename LIKE 'saifcrm_%') as crm_tables_with_rls
FROM pg_policies
WHERE schemaname = 'public';

-- Show all policies created
SELECT
  tablename,
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE 'saif_%' OR tablename LIKE 'saifcrm_%')
ORDER BY tablename, cmd;
