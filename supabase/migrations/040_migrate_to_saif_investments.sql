-- Migration: Migrate from saifcrm_investments to saif_investments
-- Purpose: Update RPC function to use saif_investments table for consistent totals

-- Update the portfolio stats function to use saif_investments instead of saifcrm_investments
CREATE OR REPLACE FUNCTION get_portfolio_stats()
RETURNS TABLE (
  total_investments BIGINT,
  total_invested NUMERIC,
  average_check NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_investments,
    COALESCE(SUM(amount), 0)::NUMERIC as total_invested,
    CASE
      WHEN COUNT(*) FILTER (WHERE amount > 0) > 0
      THEN (SUM(amount) / COUNT(*) FILTER (WHERE amount > 0))::NUMERIC
      ELSE 0::NUMERIC
    END as average_check
  FROM saif_investments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure grants are in place
GRANT EXECUTE ON FUNCTION get_portfolio_stats() TO authenticated;
