-- Migration 029: Rename application stages and add previous_stage column
--
-- Stage Renaming:
--   voting -> application
--   deliberation -> interview
--   invested -> portfolio
--   rejected -> rejected (no change)
--
-- Also adds previous_stage column to track where companies came from before archiving,
-- so they can be restored to their correct stage.

-- Step 1: Add previous_stage column
ALTER TABLE saifcrm_applications ADD COLUMN IF NOT EXISTS previous_stage TEXT;

-- Step 2: Drop existing CHECK constraint if it exists
ALTER TABLE saifcrm_applications DROP CONSTRAINT IF EXISTS saifcrm_applications_stage_check;

-- Step 3: Update existing stage values
UPDATE saifcrm_applications SET stage = 'application' WHERE stage = 'voting';
UPDATE saifcrm_applications SET stage = 'interview' WHERE stage = 'deliberation';
UPDATE saifcrm_applications SET stage = 'portfolio' WHERE stage = 'invested';
-- 'rejected' stays as 'rejected'
-- 'new' stays as 'new'

-- Step 4: Add new CHECK constraint with updated values
ALTER TABLE saifcrm_applications ADD CONSTRAINT saifcrm_applications_stage_check
  CHECK (stage IN ('new', 'application', 'interview', 'portfolio', 'rejected'));

-- Step 5: Add CHECK constraint for previous_stage (same valid values, but nullable)
ALTER TABLE saifcrm_applications ADD CONSTRAINT saifcrm_applications_previous_stage_check
  CHECK (previous_stage IS NULL OR previous_stage IN ('new', 'application', 'interview', 'portfolio', 'rejected'));

-- Step 6: Create index on previous_stage for faster lookups
CREATE INDEX IF NOT EXISTS idx_saifcrm_applications_previous_stage ON saifcrm_applications(previous_stage);

-- Verification
DO $$
DECLARE
  app_count INT;
  interview_count INT;
  portfolio_count INT;
  rejected_count INT;
BEGIN
  SELECT COUNT(*) INTO app_count FROM saifcrm_applications WHERE stage = 'application';
  SELECT COUNT(*) INTO interview_count FROM saifcrm_applications WHERE stage = 'interview';
  SELECT COUNT(*) INTO portfolio_count FROM saifcrm_applications WHERE stage = 'portfolio';
  SELECT COUNT(*) INTO rejected_count FROM saifcrm_applications WHERE stage = 'rejected';

  RAISE NOTICE 'Stage counts after migration:';
  RAISE NOTICE '  application: %', app_count;
  RAISE NOTICE '  interview: %', interview_count;
  RAISE NOTICE '  portfolio: %', portfolio_count;
  RAISE NOTICE '  rejected: %', rejected_count;
END $$;

SELECT 'Migration 029 complete - application stages renamed and previous_stage column added' as status;
