-- Create ticket_reports table to store generated daily/weekly reports
CREATE TABLE IF NOT EXISTS saif_ticket_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_completed INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  report_data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying reports by type and date
CREATE INDEX idx_ticket_reports_type_date ON saif_ticket_reports(report_type, period_end DESC);

-- RLS policies - partners can read all reports
ALTER TABLE saif_ticket_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view all reports"
  ON saif_ticket_reports
  FOR SELECT
  TO authenticated
  USING (is_partner());

-- Service role can insert reports (for cron job)
CREATE POLICY "Service role can insert reports"
  ON saif_ticket_reports
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE saif_ticket_reports IS 'Stores generated daily and weekly ticket completion reports';
