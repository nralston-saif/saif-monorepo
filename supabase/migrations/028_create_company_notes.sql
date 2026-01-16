-- Migration: Create unified company notes table
-- Consolidates notes from all 3 existing notes tables into a single company-linked table
-- IMPORTANT: Old tables are preserved for backward compatibility - no data loss

-- ============================================================================
-- CREATE NEW TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS saifcrm_company_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES saif_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES saif_people(id),
  content TEXT NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Context fields to track where note was originally created
  context_type TEXT CHECK (context_type IN ('deal', 'portfolio', 'person', 'company')),
  context_id UUID, -- The original application_id, investment_id, or person_id
  -- Track migration source for debugging
  migrated_from_table TEXT,
  migrated_from_id UUID,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HELPER: Create companies for orphaned CRM investments (if needed)
-- Some saifcrm_investments may not have matching companies in saif_companies
-- ============================================================================

-- First, let's see what we're dealing with - this creates companies for any
-- investment that doesn't have a matching company
INSERT INTO saif_companies (name, stage, is_active, created_at, updated_at)
SELECT DISTINCT
  i.company_name,
  'portfolio'::text,
  true,
  NOW(),
  NOW()
FROM saifcrm_investments i
WHERE NOT EXISTS (
  SELECT 1 FROM saif_companies c
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(i.company_name))
)
AND i.company_name IS NOT NULL
AND TRIM(i.company_name) != ''
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATE DATA FROM EXISTING TABLES
-- ============================================================================

-- 1. Migrate from saifcrm_meeting_notes (deal/application notes)
-- Links: meeting_notes -> applications -> companies
INSERT INTO saifcrm_company_notes (
  id, company_id, user_id, content, meeting_date,
  context_type, context_id, migrated_from_table, migrated_from_id,
  created_at, updated_at
)
SELECT
  mn.id,
  a.company_id,
  mn.user_id,
  mn.content,
  COALESCE(mn.meeting_date, CURRENT_DATE),
  'deal',
  mn.application_id,
  'saifcrm_meeting_notes',
  mn.id,
  mn.created_at,
  mn.updated_at
FROM saifcrm_meeting_notes mn
JOIN saifcrm_applications a ON mn.application_id = a.id
WHERE a.company_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate from saifcrm_investment_notes (portfolio notes)
-- Links: investment_notes -> crm_investments (by name) -> companies
INSERT INTO saifcrm_company_notes (
  id, company_id, user_id, content, meeting_date,
  context_type, context_id, migrated_from_table, migrated_from_id,
  created_at, updated_at
)
SELECT
  inote.id,
  c.id as company_id,
  inote.user_id,
  inote.content,
  COALESCE(inote.meeting_date, CURRENT_DATE),
  'portfolio',
  inote.investment_id,
  'saifcrm_investment_notes',
  inote.id,
  inote.created_at,
  inote.updated_at
FROM saifcrm_investment_notes inote
JOIN saifcrm_investments i ON inote.investment_id = i.id
JOIN saif_companies c ON LOWER(TRIM(c.name)) = LOWER(TRIM(i.company_name))
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate from saifcrm_people_notes (person notes)
-- Links: people_notes -> company_people -> companies
-- Note: A person may be linked to multiple companies, we take the first one
INSERT INTO saifcrm_company_notes (
  id, company_id, user_id, content, meeting_date,
  context_type, context_id, migrated_from_table, migrated_from_id,
  created_at, updated_at
)
SELECT DISTINCT ON (pn.id)
  pn.id,
  cp.company_id,
  pn.user_id,
  pn.content,
  COALESCE(pn.meeting_date, CURRENT_DATE),
  'person',
  pn.person_id,
  'saifcrm_people_notes',
  pn.id,
  pn.created_at,
  pn.updated_at
FROM saifcrm_people_notes pn
JOIN saif_company_people cp ON pn.person_id = cp.user_id
WHERE cp.company_id IS NOT NULL
ORDER BY pn.id, cp.created_at DESC
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_company_notes_company_id ON saifcrm_company_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_notes_user_id ON saifcrm_company_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_company_notes_meeting_date ON saifcrm_company_notes(meeting_date);
CREATE INDEX IF NOT EXISTS idx_company_notes_context_type ON saifcrm_company_notes(context_type);
CREATE INDEX IF NOT EXISTS idx_company_notes_created_at ON saifcrm_company_notes(created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE saifcrm_company_notes ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Partners can select company notes" ON saifcrm_company_notes;
DROP POLICY IF EXISTS "Partners can insert company notes" ON saifcrm_company_notes;
DROP POLICY IF EXISTS "Partners can update company notes" ON saifcrm_company_notes;
DROP POLICY IF EXISTS "Partners can delete company notes" ON saifcrm_company_notes;

-- Create explicit policies for each operation
CREATE POLICY "Partners can select company notes"
  ON saifcrm_company_notes FOR SELECT TO authenticated
  USING (is_partner());

CREATE POLICY "Partners can insert company notes"
  ON saifcrm_company_notes FOR INSERT TO authenticated
  WITH CHECK (is_partner());

CREATE POLICY "Partners can update company notes"
  ON saifcrm_company_notes FOR UPDATE TO authenticated
  USING (is_partner())
  WITH CHECK (is_partner());

CREATE POLICY "Partners can delete company notes"
  ON saifcrm_company_notes FOR DELETE TO authenticated
  USING (is_partner());

-- ============================================================================
-- CREATE TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_company_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_notes_updated_at ON saifcrm_company_notes;
CREATE TRIGGER trigger_company_notes_updated_at
  BEFORE UPDATE ON saifcrm_company_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_company_notes_updated_at();

-- ============================================================================
-- VERIFY MIGRATION - Check for data loss
-- ============================================================================

-- Summary of migrated notes
SELECT
  'MIGRATION SUMMARY' as report,
  (SELECT COUNT(*) FROM saifcrm_company_notes) as migrated_total,
  (SELECT COUNT(*) FROM saifcrm_company_notes WHERE context_type = 'deal') as deal_notes,
  (SELECT COUNT(*) FROM saifcrm_company_notes WHERE context_type = 'portfolio') as portfolio_notes,
  (SELECT COUNT(*) FROM saifcrm_company_notes WHERE context_type = 'person') as person_notes;

-- Check for unmigrated meeting notes (applications without company_id)
SELECT
  'UNMIGRATED MEETING NOTES' as report,
  COUNT(*) as count,
  'These notes are from applications without a company_id - they remain in saifcrm_meeting_notes' as note
FROM saifcrm_meeting_notes mn
JOIN saifcrm_applications a ON mn.application_id = a.id
WHERE a.company_id IS NULL;

-- Check for unmigrated investment notes (no matching company name)
SELECT
  'UNMIGRATED INVESTMENT NOTES' as report,
  COUNT(*) as count,
  'These notes are from investments without a matching company - they remain in saifcrm_investment_notes' as note
FROM saifcrm_investment_notes inote
JOIN saifcrm_investments i ON inote.investment_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM saif_companies c
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(i.company_name))
);

-- Check for unmigrated people notes (person not linked to any company)
SELECT
  'UNMIGRATED PEOPLE NOTES' as report,
  COUNT(*) as count,
  'These notes are from people not linked to any company - they remain in saifcrm_people_notes' as note
FROM saifcrm_people_notes pn
WHERE NOT EXISTS (
  SELECT 1 FROM saif_company_people cp
  WHERE cp.user_id = pn.person_id
);

-- IMPORTANT: Old tables are NOT dropped - they serve as backup
-- The application code should use saifcrm_company_notes going forward
-- but can fall back to old tables if needed
