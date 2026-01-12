-- Migration: Add Stats Functions
-- Purpose: Provide efficient aggregated stats without fetching all rows

-- Portfolio stats function
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
  FROM saifcrm_investments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Application stats by stage function
CREATE OR REPLACE FUNCTION get_application_stats()
RETURNS TABLE (
  pipeline BIGINT,
  deliberation BIGINT,
  invested BIGINT,
  rejected BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE stage IN ('new', 'voting'))::BIGINT as pipeline,
    COUNT(*) FILTER (WHERE stage = 'deliberation')::BIGINT as deliberation,
    COUNT(*) FILTER (WHERE stage = 'invested')::BIGINT as invested,
    COUNT(*) FILTER (WHERE stage = 'rejected')::BIGINT as rejected
  FROM saifcrm_applications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_portfolio_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_application_stats() TO authenticated;
