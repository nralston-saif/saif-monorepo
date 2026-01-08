-- Add relationship tracking fields to saif_people
-- This allows tracking when/how SAIF met each person

-- Add new columns for relationship tracking
ALTER TABLE saif_people
ADD COLUMN IF NOT EXISTS first_met_date DATE,
ADD COLUMN IF NOT EXISTS introduced_by UUID REFERENCES saif_people(id),
ADD COLUMN IF NOT EXISTS introduction_context TEXT,
ADD COLUMN IF NOT EXISTS relationship_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN saif_people.first_met_date IS 'Date when SAIF first met this person';
COMMENT ON COLUMN saif_people.introduced_by IS 'Reference to the person who introduced them to SAIF';
COMMENT ON COLUMN saif_people.introduction_context IS 'How SAIF met this person - the story/context';
COMMENT ON COLUMN saif_people.relationship_notes IS 'General notes about the relationship with this person';

-- Create index for introduced_by lookups
CREATE INDEX IF NOT EXISTS idx_saif_people_introduced_by ON saif_people(introduced_by) WHERE introduced_by IS NOT NULL;
