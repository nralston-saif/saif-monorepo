-- Migration: Fix RLS policies for all notes tables
-- The notes tables may exist but lack proper DELETE policies

-- ============================================================================
-- SAIFCRM_MEETING_NOTES
-- ============================================================================

-- Ensure table exists
CREATE TABLE IF NOT EXISTS saifcrm_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES saifcrm_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES saif_people(id),
  content TEXT NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE saifcrm_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Partners only" ON saifcrm_meeting_notes;
DROP POLICY IF EXISTS "Partners can select meeting notes" ON saifcrm_meeting_notes;
DROP POLICY IF EXISTS "Partners can insert meeting notes" ON saifcrm_meeting_notes;
DROP POLICY IF EXISTS "Partners can update meeting notes" ON saifcrm_meeting_notes;
DROP POLICY IF EXISTS "Partners can delete meeting notes" ON saifcrm_meeting_notes;

-- Create explicit policies for each operation
CREATE POLICY "Partners can select meeting notes"
  ON saifcrm_meeting_notes FOR SELECT TO authenticated
  USING (is_partner());

CREATE POLICY "Partners can insert meeting notes"
  ON saifcrm_meeting_notes FOR INSERT TO authenticated
  WITH CHECK (is_partner());

CREATE POLICY "Partners can update meeting notes"
  ON saifcrm_meeting_notes FOR UPDATE TO authenticated
  USING (is_partner())
  WITH CHECK (is_partner());

CREATE POLICY "Partners can delete meeting notes"
  ON saifcrm_meeting_notes FOR DELETE TO authenticated
  USING (is_partner());

-- ============================================================================
-- SAIFCRM_INVESTMENT_NOTES
-- ============================================================================

-- Ensure table exists
CREATE TABLE IF NOT EXISTS saifcrm_investment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES saifcrm_investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES saif_people(id),
  content TEXT NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE saifcrm_investment_notes ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Partners only" ON saifcrm_investment_notes;
DROP POLICY IF EXISTS "Partners can select investment notes" ON saifcrm_investment_notes;
DROP POLICY IF EXISTS "Partners can insert investment notes" ON saifcrm_investment_notes;
DROP POLICY IF EXISTS "Partners can update investment notes" ON saifcrm_investment_notes;
DROP POLICY IF EXISTS "Partners can delete investment notes" ON saifcrm_investment_notes;

-- Create explicit policies for each operation
CREATE POLICY "Partners can select investment notes"
  ON saifcrm_investment_notes FOR SELECT TO authenticated
  USING (is_partner());

CREATE POLICY "Partners can insert investment notes"
  ON saifcrm_investment_notes FOR INSERT TO authenticated
  WITH CHECK (is_partner());

CREATE POLICY "Partners can update investment notes"
  ON saifcrm_investment_notes FOR UPDATE TO authenticated
  USING (is_partner())
  WITH CHECK (is_partner());

CREATE POLICY "Partners can delete investment notes"
  ON saifcrm_investment_notes FOR DELETE TO authenticated
  USING (is_partner());

-- ============================================================================
-- SAIFCRM_PEOPLE_NOTES
-- ============================================================================

-- Ensure table exists
CREATE TABLE IF NOT EXISTS saifcrm_people_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES saif_people(id),
  content TEXT NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE saifcrm_people_notes ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Partners only" ON saifcrm_people_notes;
DROP POLICY IF EXISTS "Partners can select people notes" ON saifcrm_people_notes;
DROP POLICY IF EXISTS "Partners can insert people notes" ON saifcrm_people_notes;
DROP POLICY IF EXISTS "Partners can update people notes" ON saifcrm_people_notes;
DROP POLICY IF EXISTS "Partners can delete people notes" ON saifcrm_people_notes;

-- Create explicit policies for each operation
CREATE POLICY "Partners can select people notes"
  ON saifcrm_people_notes FOR SELECT TO authenticated
  USING (is_partner());

CREATE POLICY "Partners can insert people notes"
  ON saifcrm_people_notes FOR INSERT TO authenticated
  WITH CHECK (is_partner());

CREATE POLICY "Partners can update people notes"
  ON saifcrm_people_notes FOR UPDATE TO authenticated
  USING (is_partner())
  WITH CHECK (is_partner());

CREATE POLICY "Partners can delete people notes"
  ON saifcrm_people_notes FOR DELETE TO authenticated
  USING (is_partner());

-- ============================================================================
-- Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meeting_notes_application_id ON saifcrm_meeting_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_id ON saifcrm_meeting_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting_date ON saifcrm_meeting_notes(meeting_date);

CREATE INDEX IF NOT EXISTS idx_investment_notes_investment_id ON saifcrm_investment_notes(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_notes_user_id ON saifcrm_investment_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_notes_meeting_date ON saifcrm_investment_notes(meeting_date);

CREATE INDEX IF NOT EXISTS idx_people_notes_person_id ON saifcrm_people_notes(person_id);
CREATE INDEX IF NOT EXISTS idx_people_notes_user_id ON saifcrm_people_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_people_notes_meeting_date ON saifcrm_people_notes(meeting_date);

-- ============================================================================
-- Verify
-- ============================================================================

SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename IN ('saifcrm_meeting_notes', 'saifcrm_investment_notes', 'saifcrm_people_notes')
ORDER BY tablename, policyname;
