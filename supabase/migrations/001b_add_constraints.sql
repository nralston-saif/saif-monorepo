-- =====================================================
-- Migration 001b: Add Role and Status Constraints
-- Description: Update constraints on saif_people table
-- Run this after renaming saif_users -> saif_people
-- =====================================================

-- Add role constraint
ALTER TABLE saif_people
DROP CONSTRAINT IF EXISTS saif_people_role_check;

ALTER TABLE saif_people
ADD CONSTRAINT saif_people_role_check
CHECK (role IN (
  'partner',      -- SAIF partners (full platform access)
  'founder',      -- Company founders (may have access or be tracked)
  'advisor',      -- Advisors (may have platform access)
  'employee',     -- Company employees (tracked)
  'board_member', -- Board members (tracked)
  'investor',     -- Other investors, LPs (tracked)
  'contact'       -- Generic contact/tracked person
));

-- Add status constraint (includes 'tracked' now)
ALTER TABLE saif_people
DROP CONSTRAINT IF EXISTS saif_people_status_check;

ALTER TABLE saif_people
ADD CONSTRAINT saif_people_status_check
CHECK (status IN (
  'active',    -- Has authenticated account, can access platform
  'pending',   -- Invited to platform, hasn't signed up yet
  'tracked',   -- Just tracking in CRM, no platform access planned
  'inactive'   -- Had account but deactivated
));

-- Verify constraints
SELECT
  'Constraints Added' as status,
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE 'saif_people_%_check';
