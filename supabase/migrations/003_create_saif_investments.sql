-- =====================================================
-- Migration 003: Create saif_investments Table
-- Description: Enhanced investment tracking with detailed fields
-- =====================================================

-- Create saif_investments table with enhanced schema
CREATE TABLE IF NOT EXISTS saif_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES saif_companies(id) NOT NULL,
  investment_date date NOT NULL,
  type text CHECK (type IN ('note', 'safe', 'equity', 'option')),
  amount numeric(20, 2),
  round text,
  post_money_valuation numeric(20, 2),
  discount numeric(5, 4),
  shares bigint,
  common_shares bigint,
  preferred_shares bigint,
  FD_shares bigint,
  share_location text,
  share_cert_numbers text[],
  lead_partner_id uuid REFERENCES saif_users(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'acquired', 'ipo', 'failed', 'written_off')),
  exit_date date,
  acquirer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saif_investments_company ON saif_investments(company_id);
CREATE INDEX IF NOT EXISTS idx_saif_investments_status ON saif_investments(status);
CREATE INDEX IF NOT EXISTS idx_saif_investments_lead_partner ON saif_investments(lead_partner_id);
CREATE INDEX IF NOT EXISTS idx_saif_investments_date ON saif_investments(investment_date);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_saif_investments_updated_at ON saif_investments;

CREATE TRIGGER update_saif_investments_updated_at
  BEFORE UPDATE ON saif_investments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Migrate data from saifcrm_investments
INSERT INTO saif_investments (
  id,
  company_id,
  investment_date,
  type,
  amount,
  round,
  status,
  created_at,
  updated_at
)
SELECT
  i.id,
  c.id as company_id,
  COALESCE(i.investment_date, CURRENT_DATE) as investment_date,
  CASE
    WHEN i.terms ILIKE '%safe%' THEN 'safe'
    WHEN i.terms ILIKE '%note%' OR i.terms ILIKE '%convertible%' THEN 'note'
    ELSE 'equity'
  END as type,
  i.amount,
  CASE
    WHEN i.terms ILIKE '%seed%' THEN 'seed'
    WHEN i.terms ILIKE '%series a%' OR i.terms ILIKE '%series_a%' THEN 'series_a'
    WHEN i.terms ILIKE '%series b%' OR i.terms ILIKE '%series_b%' THEN 'series_b'
    WHEN i.terms ILIKE '%pre-seed%' OR i.terms ILIKE '%preseed%' THEN 'pre_seed'
    ELSE NULL
  END as round,
  'active' as status,
  i.created_at,
  i.updated_at
FROM saifcrm_investments i
JOIN saif_companies c ON LOWER(TRIM(c.name)) = LOWER(TRIM(i.company_name))
ON CONFLICT (id) DO NOTHING;

-- Parse valuation caps from terms field
-- Example terms: "20mm cap safe", "10mm cap safe"
UPDATE saif_investments si
SET post_money_valuation = (
  SELECT
    CASE
      WHEN i.terms ~* '(\d+)mm cap' THEN
        (regexp_match(i.terms, '(\d+)mm cap', 'i'))[1]::numeric * 1000000
      WHEN i.terms ~* '(\d+)m cap' THEN
        (regexp_match(i.terms, '(\d+)m cap', 'i'))[1]::numeric * 1000000
      WHEN i.terms ~* '\$(\d+)m cap' THEN
        (regexp_match(i.terms, '\$(\d+)m cap', 'i'))[1]::numeric * 1000000
      ELSE NULL
    END
  FROM saifcrm_investments i
  WHERE i.id = si.id
)
WHERE type IN ('safe', 'note')
  AND post_money_valuation IS NULL;

-- Add comment
COMMENT ON TABLE saif_investments IS 'Investment details for portfolio companies (multiple investments per company possible)';
COMMENT ON COLUMN saif_investments.post_money_valuation IS 'Post-money valuation for equity investments, valuation cap for SAFEs/notes';

-- Create view with ownership percentage
CREATE OR REPLACE VIEW saif_investments_with_ownership AS
SELECT
  i.*,
  ROUND((i.shares::numeric / NULLIF(i.FD_shares, 0) * 100), 2) as ownership_percentage,
  c.name as company_name
FROM saif_investments i
JOIN saif_companies c ON c.id = i.company_id;

-- Log results
DO $$
DECLARE
  total_count integer;
  safe_count integer;
  equity_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM saif_investments;
  SELECT COUNT(*) INTO safe_count FROM saif_investments WHERE type = 'safe';
  SELECT COUNT(*) INTO equity_count FROM saif_investments WHERE type = 'equity';

  RAISE NOTICE 'Created saif_investments with % total investments', total_count;
  RAISE NOTICE '  - % SAFEs', safe_count;
  RAISE NOTICE '  - % equity', equity_count;
END $$;
