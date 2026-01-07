-- =====================================================
-- Migration 012: Fix SAIF company setup + add Michael
-- =====================================================

-- First, update the check constraint to allow 'saif' as a valid stage
ALTER TABLE saif_companies DROP CONSTRAINT IF EXISTS saif_companies_stage_check;
ALTER TABLE saif_companies ADD CONSTRAINT saif_companies_stage_check
  CHECK (stage IN ('portfolio', 'prospect', 'diligence', 'passed', 'archived', 'saif'));

-- Also update relationship_type constraint to allow 'partner'
ALTER TABLE saif_company_people DROP CONSTRAINT IF EXISTS saif_company_people_relationship_type_check;
ALTER TABLE saif_company_people ADD CONSTRAINT saif_company_people_relationship_type_check
  CHECK (relationship_type IN ('founder', 'employee', 'advisor', 'board_member', 'partner'));

-- Update the RLS helper function to include 'saif' stage companies
CREATE OR REPLACE FUNCTION get_portfolio_company_ids()
RETURNS TABLE(company_id uuid) AS $$
  SELECT id FROM saif_companies WHERE stage IN ('portfolio', 'saif')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- CRITICAL: Update the RLS policy on saif_companies to allow founders to see 'saif' stage
DROP POLICY IF EXISTS "View portfolio companies" ON saif_companies;
CREATE POLICY "View portfolio companies"
ON saif_companies FOR SELECT
TO authenticated
USING (
  stage IN ('portfolio', 'saif')  -- Founders can see portfolio + SAIF company
  OR is_partner()                  -- Partners see all companies
);

-- SAIF is the actual company - set to stage='saif' (using exact ID)
UPDATE saif_companies
SET stage = 'saif'
WHERE id = 'd5d16d3a-4f56-405d-b262-37c1f79f28d4';

-- All other companies with 'saif' in name should be portfolio
UPDATE saif_companies
SET stage = 'portfolio'
WHERE id != 'd5d16d3a-4f56-405d-b262-37c1f79f28d4'
  AND LOWER(name) LIKE '%saif%';

-- Remove any partner links accidentally added to wrong companies
DELETE FROM saif_company_people
WHERE company_id != 'd5d16d3a-4f56-405d-b262-37c1f79f28d4'
  AND relationship_type = 'partner'
  AND company_id IN (SELECT id FROM saif_companies WHERE LOWER(name) LIKE '%saif%');

-- Ensure Michael's record exists and is correct
-- First try to update existing record linked to his auth account
UPDATE saif_people
SET first_name = 'Michael',
    last_name = 'Ralston',
    role = 'partner',
    status = 'active'
WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'mike@saif.vc');

-- If no record exists for this auth_user_id, insert one
INSERT INTO saif_people (first_name, last_name, role, status, auth_user_id, email)
SELECT
  'Michael',
  'Ralston',
  'partner',
  'active',
  au.id,
  au.email
FROM auth.users au
WHERE au.email = 'mike@saif.vc'
  AND NOT EXISTS (
    SELECT 1 FROM saif_people WHERE auth_user_id = au.id
  );

-- Now link the partners to SAIF
DO $$
DECLARE
  saif_company_id uuid;
  nick_person_id uuid;
  michael_person_id uuid;
  geoff_person_id uuid;
BEGIN
  -- Use exact SAIF company ID
  saif_company_id := 'd5d16d3a-4f56-405d-b262-37c1f79f28d4'::uuid;

  RAISE NOTICE 'Found SAIF company: %', saif_company_id;

  -- Find partners by email to avoid duplicates
  SELECT id INTO nick_person_id FROM saif_people WHERE email = 'nick@saif.vc' LIMIT 1;
  SELECT id INTO michael_person_id FROM saif_people WHERE email = 'mike@saif.vc' LIMIT 1;
  SELECT id INTO geoff_person_id FROM saif_people WHERE email = 'geoff@saif.vc' LIMIT 1;

  RAISE NOTICE 'Nick: %, Michael: %, Geoff: %', nick_person_id, michael_person_id, geoff_person_id;

  -- FIRST: Remove ALL existing links to SAIF company
  DELETE FROM saif_company_people WHERE company_id = saif_company_id;
  RAISE NOTICE 'Removed all existing SAIF company links';

  -- Now add ONLY the three partners
  IF nick_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, nick_person_id, 'partner', true, CURRENT_DATE);
    RAISE NOTICE 'Linked Nick to SAIF';
  END IF;

  IF michael_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, michael_person_id, 'partner', false, CURRENT_DATE);
    RAISE NOTICE 'Linked Michael to SAIF';
  END IF;

  IF geoff_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, geoff_person_id, 'partner', false, CURRENT_DATE);
    RAISE NOTICE 'Linked Geoff to SAIF';
  END IF;

END $$;

-- Verify
SELECT 'SAIF company:' as info, id, name, stage FROM saif_companies WHERE stage = 'saif';
SELECT 'SAIF team:' as info, p.first_name, p.last_name, cp.relationship_type
FROM saif_company_people cp
JOIN saif_people p ON cp.user_id = p.id
JOIN saif_companies c ON cp.company_id = c.id
WHERE c.stage = 'saif';
