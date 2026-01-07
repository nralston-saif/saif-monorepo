-- =====================================================
-- Migration 013: Add tags to companies and people
-- =====================================================

-- Add tags column to saif_companies
ALTER TABLE saif_companies
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add tags column to saif_people
ALTER TABLE saif_people
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create GIN indexes for efficient tag searches
CREATE INDEX IF NOT EXISTS idx_saif_companies_tags ON saif_companies USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_saif_people_tags ON saif_people USING GIN (tags);

-- Add comments for documentation
COMMENT ON COLUMN saif_companies.tags IS 'Array of tags for categorizing companies (e.g., AI, fintech, B2B)';
COMMENT ON COLUMN saif_people.tags IS 'Array of tags for categorizing people (e.g., technical, operator, domain-expert)';
