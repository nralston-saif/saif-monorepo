-- =====================================================
-- Migration 001: Enhance saif_people Table
-- Description: Add missing columns and constraints to saif_people table
-- Note: Table was renamed from saif_users -> saif_people
-- =====================================================

-- Add new columns to saif_people
ALTER TABLE saif_people
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

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

-- Add status constraint
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

-- Set UUID default for id column
ALTER TABLE saif_people
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Parse existing "name" field into first_name/last_name (if name column exists)
-- Handle various formats: "firstname lastname", "firstname", etc.
UPDATE saif_people
SET
  first_name = CASE
    WHEN name LIKE '% %' THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE
    WHEN name LIKE '% %' THEN substring(name from position(' ' in name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saif_people_role ON saif_people(role);
CREATE INDEX IF NOT EXISTS idx_saif_people_status ON saif_people(status);
CREATE INDEX IF NOT EXISTS idx_saif_people_email ON saif_people(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saif_people_auth_user_id
  ON saif_people(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saif_people_updated_at ON saif_people;

CREATE TRIGGER update_saif_people_updated_at
  BEFORE UPDATE ON saif_people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add comment
COMMENT ON TABLE saif_people IS 'All people in SAIF ecosystem - both authenticated users and tracked contacts';
COMMENT ON COLUMN saif_people.auth_user_id IS 'Links to auth.users - NULL if person has no platform access';
COMMENT ON COLUMN saif_people.status IS 'active=has auth, pending=invited, tracked=CRM only, inactive=deactivated';
COMMENT ON COLUMN saif_people.role IS 'Role in SAIF ecosystem: partner, founder, advisor, employee, board_member, investor, contact';

-- Display results
SELECT
  'Migration 001 Complete' as status,
  COUNT(*) as total_people,
  COUNT(*) FILTER (WHERE role = 'partner') as partners,
  COUNT(*) FILTER (WHERE role = 'founder') as founders,
  COUNT(auth_user_id) as with_auth_accounts
FROM saif_people;
