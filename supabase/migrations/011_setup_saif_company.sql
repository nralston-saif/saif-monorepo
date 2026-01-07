-- =====================================================
-- Migration 011: Set up SAIF as a special company
-- =====================================================
-- 1. Update SAIF company stage to 'saif' (special designation)
-- 2. Link Nick, Michael, Geoff to SAIF as 'partner' relationship
-- 3. Remove Shannon's link to SAIF

-- First, update SAIF company stage
UPDATE saif_companies
SET stage = 'saif'
WHERE LOWER(name) LIKE '%saif%'
  AND (stage = 'portfolio' OR stage IS NULL);

-- Get SAIF company ID for use in subsequent operations
DO $$
DECLARE
  saif_company_id uuid;
  nick_person_id uuid;
  michael_person_id uuid;
  geoff_person_id uuid;
  shannon_person_id uuid;
BEGIN
  -- Find SAIF company
  SELECT id INTO saif_company_id
  FROM saif_companies
  WHERE stage = 'saif'
  LIMIT 1;

  IF saif_company_id IS NULL THEN
    RAISE NOTICE 'SAIF company not found, skipping partner links';
    RETURN;
  END IF;

  RAISE NOTICE 'Found SAIF company: %', saif_company_id;

  -- Find partners by first name (assuming these are unique enough for SAIF partners)
  SELECT id INTO nick_person_id FROM saif_people WHERE LOWER(first_name) = 'nick' AND role = 'partner' LIMIT 1;
  SELECT id INTO michael_person_id FROM saif_people WHERE LOWER(first_name) = 'michael' AND role = 'partner' LIMIT 1;
  SELECT id INTO geoff_person_id FROM saif_people WHERE LOWER(first_name) = 'geoff' AND role = 'partner' LIMIT 1;

  -- Find Shannon (to remove from SAIF)
  SELECT id INTO shannon_person_id FROM saif_people WHERE LOWER(first_name) = 'shannon' LIMIT 1;

  -- Remove Shannon's link to SAIF if exists
  IF shannon_person_id IS NOT NULL THEN
    DELETE FROM saif_company_people
    WHERE company_id = saif_company_id
      AND user_id = shannon_person_id;
    RAISE NOTICE 'Removed Shannon (%) from SAIF', shannon_person_id;
  END IF;

  -- Add Nick as partner at SAIF (if not already linked)
  IF nick_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, nick_person_id, 'partner', true, CURRENT_DATE)
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET relationship_type = 'partner', end_date = NULL;
    RAISE NOTICE 'Linked Nick (%) to SAIF as partner', nick_person_id;
  END IF;

  -- Add Michael as partner at SAIF (if not already linked)
  IF michael_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, michael_person_id, 'partner', false, CURRENT_DATE)
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET relationship_type = 'partner', end_date = NULL;
    RAISE NOTICE 'Linked Michael (%) to SAIF as partner', michael_person_id;
  END IF;

  -- Add Geoff as partner at SAIF (if not already linked)
  IF geoff_person_id IS NOT NULL THEN
    INSERT INTO saif_company_people (company_id, user_id, relationship_type, is_primary_contact, start_date)
    VALUES (saif_company_id, geoff_person_id, 'partner', false, CURRENT_DATE)
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET relationship_type = 'partner', end_date = NULL;
    RAISE NOTICE 'Linked Geoff (%) to SAIF as partner', geoff_person_id;
  END IF;

END $$;

-- Verify the changes
SELECT 'SAIF company stage:' as info, id, name, stage
FROM saif_companies WHERE stage = 'saif';

SELECT 'SAIF partners:' as info, p.first_name, p.last_name, cp.relationship_type
FROM saif_company_people cp
JOIN saif_people p ON cp.user_id = p.id
JOIN saif_companies c ON cp.company_id = c.id
WHERE c.stage = 'saif';

SELECT 'Migration 011 complete - SAIF company configured' as status;
