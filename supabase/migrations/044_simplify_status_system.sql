-- Migration 044: Simplify status system
-- Replace 4-status + flag model (pending, active, tracked, inactive + invited_to_community)
-- with 3 clean statuses (tracked, eligible, active) and no flag.
--
-- State machine:
--   tracked --[partner invites to community]--> eligible
--   eligible --[user signs up + claims profile]--> active

BEGIN;

-- Step 1: Drop old constraint first (it rejects 'eligible' as a value)
ALTER TABLE saif_people DROP CONSTRAINT IF EXISTS saif_people_status_check;

-- Step 2: Migrate existing data to new status values
-- pending -> eligible (these were people invited/ready to sign up)
UPDATE saif_people SET status = 'eligible' WHERE status = 'pending';

-- inactive -> tracked (these are just people we're tracking)
UPDATE saif_people SET status = 'tracked' WHERE status = 'inactive';

-- Step 3: Add new constraint
ALTER TABLE saif_people ADD CONSTRAINT saif_people_status_check
  CHECK (status IN ('active', 'eligible', 'tracked'));

-- Step 3: Drop the invited_to_community column (no longer needed)
ALTER TABLE saif_people DROP COLUMN IF EXISTS invited_to_community;

-- Step 4: Create function for partners to check unverified signups
-- This lets the CRM show "Awaiting Verification" for eligible people
-- who have started but not completed the signup process.
CREATE OR REPLACE FUNCTION get_unverified_signups(check_emails text[])
RETURNS TABLE(email text) AS $$
BEGIN
  -- Only partners can call this
  IF NOT is_partner() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.email::text
  FROM auth.users u
  WHERE u.email = ANY(check_emails)
    AND u.email_confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
