-- =====================================================
-- Migration 019: Add entity_type, tracked stage, and deal prospect tracking
-- =====================================================
-- 1. Add entity_type column to saif_companies
-- 2. Add 'tracked' to stage constraint
-- 3. Add is_deal_prospect boolean to saif_companies
-- 4. Add company_id FK to saifcrm_applications
-- 5. Backfill company_id in applications by name matching
-- 6. Backfill is_deal_prospect based on linked applications

-- =====================================================
-- Step 1: Add entity_type to saif_companies
-- =====================================================
ALTER TABLE saif_companies ADD COLUMN IF NOT EXISTS entity_type TEXT
  DEFAULT 'for_profit';

-- Add check constraint for entity_type
ALTER TABLE saif_companies DROP CONSTRAINT IF EXISTS saif_companies_entity_type_check;
ALTER TABLE saif_companies ADD CONSTRAINT saif_companies_entity_type_check
  CHECK (entity_type IN ('for_profit', 'pbc', 'nonprofit', 'government', 'other'));

-- =====================================================
-- Step 2: Update stage constraint to include 'tracked'
-- =====================================================
ALTER TABLE saif_companies DROP CONSTRAINT IF EXISTS saif_companies_stage_check;
ALTER TABLE saif_companies ADD CONSTRAINT saif_companies_stage_check
  CHECK (stage IN ('portfolio', 'prospect', 'diligence', 'passed', 'archived', 'saif', 'tracked'));

-- =====================================================
-- Step 3: Add is_deal_prospect boolean
-- =====================================================
ALTER TABLE saif_companies ADD COLUMN IF NOT EXISTS is_deal_prospect BOOLEAN DEFAULT true;

-- =====================================================
-- Step 4: Add company_id FK to saifcrm_applications
-- =====================================================
ALTER TABLE saifcrm_applications ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add foreign key constraint
ALTER TABLE saifcrm_applications DROP CONSTRAINT IF EXISTS saifcrm_applications_company_id_fkey;
ALTER TABLE saifcrm_applications ADD CONSTRAINT saifcrm_applications_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES saif_companies(id) ON DELETE SET NULL;

-- Create index for the FK
CREATE INDEX IF NOT EXISTS idx_saifcrm_applications_company_id ON saifcrm_applications(company_id);

-- =====================================================
-- Step 5: Backfill company_id in applications by name matching
-- =====================================================
-- Match applications to companies by normalized name (case-insensitive, trimmed)
UPDATE saifcrm_applications a
SET company_id = c.id
FROM saif_companies c
WHERE LOWER(TRIM(a.company_name)) = LOWER(TRIM(c.name))
  AND a.company_id IS NULL;

-- Log how many were matched
DO $$
DECLARE
  matched_count integer;
  unmatched_count integer;
BEGIN
  SELECT COUNT(*) INTO matched_count FROM saifcrm_applications WHERE company_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_count FROM saifcrm_applications WHERE company_id IS NULL;

  RAISE NOTICE 'Applications linked to companies: %', matched_count;
  RAISE NOTICE 'Applications without company match: %', unmatched_count;
END $$;

-- =====================================================
-- Step 6: Backfill is_deal_prospect
-- =====================================================
-- Companies that have linked applications OR are portfolio/invested are deal prospects
-- Companies with no applications and stage not in (portfolio, diligence, passed) are NOT deal prospects

-- First, set all to false
UPDATE saif_companies SET is_deal_prospect = false;

-- Then set to true for companies that:
-- 1. Have at least one linked application, OR
-- 2. Are portfolio companies (we invested), OR
-- 3. Are in diligence or passed (they went through the process)
UPDATE saif_companies c
SET is_deal_prospect = true
WHERE
  -- Has linked applications
  EXISTS (SELECT 1 FROM saifcrm_applications a WHERE a.company_id = c.id)
  -- OR is portfolio/diligence/passed (went through deal process)
  OR c.stage IN ('portfolio', 'diligence', 'passed');

-- SAIF company itself is not a deal prospect
UPDATE saif_companies
SET is_deal_prospect = false
WHERE stage = 'saif';

-- Log results
DO $$
DECLARE
  deal_prospect_count integer;
  non_deal_count integer;
  tracked_candidates integer;
BEGIN
  SELECT COUNT(*) INTO deal_prospect_count FROM saif_companies WHERE is_deal_prospect = true;
  SELECT COUNT(*) INTO non_deal_count FROM saif_companies WHERE is_deal_prospect = false;

  -- Companies that are prospects but have no linked applications might need review
  SELECT COUNT(*) INTO tracked_candidates
  FROM saif_companies c
  WHERE c.stage = 'prospect'
    AND c.is_deal_prospect = false;

  RAISE NOTICE '=== Deal Prospect Backfill Results ===';
  RAISE NOTICE 'Companies marked as deal prospects: %', deal_prospect_count;
  RAISE NOTICE 'Companies NOT deal prospects: %', non_deal_count;
  RAISE NOTICE 'Prospect-stage companies without applications (review candidates): %', tracked_candidates;
END $$;

-- =====================================================
-- Step 7: Show summary of unmatched applications (for review)
-- =====================================================
-- These applications couldn't be matched to a company - may need manual review
DO $$
DECLARE
  rec RECORD;
  counter integer := 0;
BEGIN
  RAISE NOTICE '=== Unmatched Applications (first 20) ===';
  FOR rec IN
    SELECT id, company_name, stage, created_at
    FROM saifcrm_applications
    WHERE company_id IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    counter := counter + 1;
    RAISE NOTICE '  %: % (stage: %)', counter, rec.company_name, rec.stage;
  END LOOP;
END $$;

-- =====================================================
-- Verification queries (for manual review)
-- =====================================================
-- Uncomment these to run manually after migration:

-- Check entity_type distribution:
-- SELECT entity_type, COUNT(*) FROM saif_companies GROUP BY entity_type;

-- Check is_deal_prospect distribution:
-- SELECT is_deal_prospect, COUNT(*) FROM saif_companies GROUP BY is_deal_prospect;

-- Check stage distribution:
-- SELECT stage, COUNT(*) FROM saif_companies GROUP BY stage ORDER BY COUNT(*) DESC;

-- Find prospect companies that might should be 'tracked':
-- SELECT name, stage, is_deal_prospect FROM saif_companies
-- WHERE stage = 'prospect' AND is_deal_prospect = false;

-- Find applications that didn't match a company:
-- SELECT company_name, stage FROM saifcrm_applications WHERE company_id IS NULL;

SELECT 'Migration 019 complete - entity_type, tracked stage, and deal prospect tracking added' as status;
