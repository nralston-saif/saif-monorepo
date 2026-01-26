-- Create audit log table for tracking partner actions on sensitive data
-- This table provides an audit trail for security and compliance purposes

CREATE TABLE IF NOT EXISTS saifcrm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX idx_audit_log_actor_id ON saifcrm_audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON saifcrm_audit_log(action);
CREATE INDEX idx_audit_log_entity_type ON saifcrm_audit_log(entity_type);
CREATE INDEX idx_audit_log_entity_id ON saifcrm_audit_log(entity_id);
CREATE INDEX idx_audit_log_created_at ON saifcrm_audit_log(created_at DESC);

-- Composite index for common query: find all actions by actor within time range
CREATE INDEX idx_audit_log_actor_time ON saifcrm_audit_log(actor_id, created_at DESC);

-- Composite index for entity history queries
CREATE INDEX idx_audit_log_entity_history ON saifcrm_audit_log(entity_type, entity_id, created_at DESC);

-- Enable RLS
ALTER TABLE saifcrm_audit_log ENABLE ROW LEVEL SECURITY;

-- Only partners can read audit logs
CREATE POLICY "Partners can read audit logs"
  ON saifcrm_audit_log
  FOR SELECT
  TO authenticated
  USING (is_partner());

-- No direct inserts from client - use the helper function
-- Service role key will bypass RLS for inserts from server

-- Create helper function for logging audit events
-- This function can be called from SQL or from the application
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id UUID,
  p_actor_email TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO saifcrm_audit_log (
    actor_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_actor_id,
    p_actor_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE saifcrm_audit_log IS 'Audit log for tracking partner actions on sensitive data. Actions include: login, vote_cast, application_stage_change, company_update, investment_create, data_export, etc.';
