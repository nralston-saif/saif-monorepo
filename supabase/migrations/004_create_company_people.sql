-- =====================================================
-- Migration 004: Create saif_company_people Table
-- Description: Junction table linking users to companies with roles
-- =====================================================

-- Create saif_company_people table
CREATE TABLE IF NOT EXISTS saif_company_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES saif_companies(id) NOT NULL,
  user_id uuid REFERENCES saif_users(id) NOT NULL,
  relationship_type text CHECK (relationship_type IN ('founder', 'employee', 'advisor', 'board_member')),
  title text,
  is_primary_contact boolean DEFAULT false,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saif_company_people_company ON saif_company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_saif_company_people_user ON saif_company_people(user_id);
CREATE INDEX IF NOT EXISTS idx_saif_company_people_type ON saif_company_people(relationship_type);
CREATE INDEX IF NOT EXISTS idx_saif_company_people_primary ON saif_company_people(is_primary_contact) WHERE is_primary_contact = true;

-- Unique constraint: prevent duplicate active relationships
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_company_user
ON saif_company_people(company_id, user_id, relationship_type)
WHERE end_date IS NULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_saif_company_people_updated_at ON saif_company_people;

CREATE TRIGGER update_saif_company_people_updated_at
  BEFORE UPDATE ON saif_company_people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add comment
COMMENT ON TABLE saif_company_people IS 'Links users to companies with their roles (founders, employees, advisors, board members)';

RAISE NOTICE 'Created saif_company_people table - ready for founder parsing';
