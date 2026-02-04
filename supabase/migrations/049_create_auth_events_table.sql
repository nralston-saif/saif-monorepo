-- Create auth events logging table for debugging email verification flows
CREATE TABLE saif_auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  email text,
  user_id uuid,
  success boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_auth_events_email ON saif_auth_events(email);
CREATE INDEX idx_auth_events_event_type ON saif_auth_events(event_type);
CREATE INDEX idx_auth_events_created_at ON saif_auth_events(created_at DESC);
CREATE INDEX idx_auth_events_user_id ON saif_auth_events(user_id);

-- RLS: Only allow service role to insert, partners can read
ALTER TABLE saif_auth_events ENABLE ROW LEVEL SECURITY;

-- Partners can view auth events for debugging
CREATE POLICY "Partners can view auth events"
  ON saif_auth_events
  FOR SELECT
  TO authenticated
  USING (is_partner());

-- Service role can insert (used by API routes)
CREATE POLICY "Service role can insert auth events"
  ON saif_auth_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE saif_auth_events IS 'Audit log for authentication events including signup, verification, and login attempts';
