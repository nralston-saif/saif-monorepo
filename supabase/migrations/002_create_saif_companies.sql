-- =====================================================
-- Migration 002: Create saif_companies Table
-- Description: Central table for all companies (prospects + portfolio)
-- =====================================================

-- Create saif_companies table
CREATE TABLE IF NOT EXISTS saif_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  previous_names text[],
  short_description text,
  website text,
  logo_url text,
  industry text,
  founded_year integer,
  is_AIsafety_company boolean DEFAULT false,
  YC_batch text,
  city text,
  country text,
  stage text CHECK (stage IN ('prospect', 'diligence', 'portfolio', 'exited', 'passed')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saif_companies_stage ON saif_companies(stage);
CREATE INDEX IF NOT EXISTS idx_saif_companies_industry ON saif_companies(industry);
CREATE INDEX IF NOT EXISTS idx_saif_companies_country ON saif_companies(country);
CREATE INDEX IF NOT EXISTS idx_saif_companies_is_AIsafety ON saif_companies(is_AIsafety_company);
CREATE INDEX IF NOT EXISTS idx_saif_companies_YC_batch ON saif_companies(YC_batch);
CREATE INDEX IF NOT EXISTS idx_saif_companies_name ON saif_companies(name);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_saif_companies_updated_at ON saif_companies;

CREATE TRIGGER update_saif_companies_updated_at
  BEFORE UPDATE ON saif_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Migrate data from saifcrm_investments (portfolio companies)
INSERT INTO saif_companies (id, name, short_description, website, stage, created_at, updated_at)
SELECT
  id,
  company_name,
  description,
  website,
  'portfolio' as stage,
  created_at,
  updated_at
FROM saifcrm_investments
ON CONFLICT (id) DO NOTHING;

-- Migrate data from saifcrm_applications
-- Create new IDs for applications that aren't already in investments
INSERT INTO saif_companies (name, short_description, website, stage, created_at, updated_at)
SELECT DISTINCT ON (a.company_name)
  a.company_name,
  a.company_description,
  a.website,
  CASE
    WHEN a.stage = 'invested' THEN 'portfolio'
    WHEN a.stage = 'rejected' THEN 'passed'
    WHEN a.stage = 'deliberation' THEN 'diligence'
    ELSE 'prospect'
  END as stage,
  a.created_at,
  a.updated_at
FROM saifcrm_applications a
WHERE NOT EXISTS (
  SELECT 1 FROM saif_companies c
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(a.company_name))
)
AND a.company_name IS NOT NULL
AND a.company_name != ''
ORDER BY a.company_name, a.created_at DESC;

-- Update portfolio companies that came from applications
-- (Prefer 'portfolio' stage over other stages)
UPDATE saif_companies c
SET stage = 'portfolio'
WHERE stage != 'portfolio'
  AND EXISTS (
    SELECT 1 FROM saifcrm_investments i
    WHERE LOWER(TRIM(i.company_name)) = LOWER(TRIM(c.name))
  );

-- Add comment
COMMENT ON TABLE saif_companies IS 'All companies SAIF interacts with (prospects, portfolio, exited)';

-- Log results
DO $$
DECLARE
  total_count integer;
  portfolio_count integer;
  prospect_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM saif_companies;
  SELECT COUNT(*) INTO portfolio_count FROM saif_companies WHERE stage = 'portfolio';
  SELECT COUNT(*) INTO prospect_count FROM saif_companies WHERE stage = 'prospect';

  RAISE NOTICE 'Created saif_companies with % total companies', total_count;
  RAISE NOTICE '  - % portfolio companies', portfolio_count;
  RAISE NOTICE '  - % prospect companies', prospect_count;
END $$;
