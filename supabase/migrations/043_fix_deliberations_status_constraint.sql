-- Migration 043: Fix deliberations status check constraint
-- Description: Update the status check constraint to include all valid status values
-- The constraint was missing 'portfolio', 'scheduled', 'met', 'emailed', and 'rejected'

-- Drop the existing constraint
ALTER TABLE saifcrm_deliberations DROP CONSTRAINT IF EXISTS deliberations_status_check;

-- Add the updated constraint with all valid status values
ALTER TABLE saifcrm_deliberations ADD CONSTRAINT deliberations_status_check
  CHECK (status IS NULL OR status IN ('scheduled', 'met', 'emailed', 'portfolio', 'rejected'));
