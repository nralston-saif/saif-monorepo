-- =====================================================
-- Migration 017: Optimize RLS Helper Functions
-- Description: Add caching and optimize RLS functions for better performance
-- =====================================================

-- Drop and recreate RLS helper functions with better optimization
DROP FUNCTION IF EXISTS is_partner() CASCADE;
DROP FUNCTION IF EXISTS is_founder() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_person_id() CASCADE;

-- Optimized is_partner function with better indexing hint
CREATE OR REPLACE FUNCTION is_partner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM saif_people
    WHERE auth_user_id = auth.uid()
      AND role = 'partner'
    LIMIT 1
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Optimized is_founder function
CREATE OR REPLACE FUNCTION is_founder()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM saif_people
    WHERE auth_user_id = auth.uid()
      AND role = 'founder'
    LIMIT 1
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Optimized get_user_role function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM saif_people
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Optimized get_person_id function
CREATE OR REPLACE FUNCTION get_person_id()
RETURNS UUID AS $$
  SELECT id FROM saif_people
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Add comments
COMMENT ON FUNCTION is_partner() IS 'Optimized: Check if current user is a partner (cached per transaction)';
COMMENT ON FUNCTION is_founder() IS 'Optimized: Check if current user is a founder (cached per transaction)';
COMMENT ON FUNCTION get_user_role() IS 'Optimized: Get current user role (cached per transaction)';
COMMENT ON FUNCTION get_person_id() IS 'Optimized: Get current user person ID (cached per transaction)';

SELECT 'RLS helper functions optimized successfully' as status;
