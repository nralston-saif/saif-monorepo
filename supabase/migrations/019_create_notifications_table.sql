-- Create notifications table for CRM
-- Notifications persist until dismissed or auto-expire after 30 days

CREATE TABLE IF NOT EXISTS saifcrm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who receives this notification (person_id from saif_people)
  recipient_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,

  -- Who triggered this notification (optional - null for system notifications)
  actor_id UUID REFERENCES saif_people(id) ON DELETE SET NULL,

  -- Notification type for filtering/icons
  type TEXT NOT NULL CHECK (type IN (
    'new_application',
    'ready_for_deliberation',
    'new_deliberation_notes',
    'decision_made',
    'ticket_assigned',
    'ticket_archived'
  )),

  -- Human-readable content
  title TEXT NOT NULL,
  message TEXT,

  -- Link to relevant page
  link TEXT,

  -- Related entities (for querying/filtering)
  application_id UUID REFERENCES saifcrm_applications(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES saif_tickets(id) ON DELETE CASCADE,

  -- State tracking
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Index for fast lookups by recipient
CREATE INDEX idx_notifications_recipient ON saifcrm_notifications(recipient_id);

-- Index for filtering unread/undismissed
CREATE INDEX idx_notifications_state ON saifcrm_notifications(recipient_id, dismissed_at, read_at);

-- Index for expiration cleanup
CREATE INDEX idx_notifications_expires ON saifcrm_notifications(expires_at);

-- Index for real-time subscriptions by recipient
CREATE INDEX idx_notifications_realtime ON saifcrm_notifications(recipient_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE saifcrm_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON saifcrm_notifications
  FOR SELECT
  USING (
    recipient_id IN (
      SELECT id FROM saif_people WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Users can update their own notifications (mark as read/dismissed)
CREATE POLICY "Users can update own notifications"
  ON saifcrm_notifications
  FOR UPDATE
  USING (
    recipient_id IN (
      SELECT id FROM saif_people WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_id IN (
      SELECT id FROM saif_people WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Allow service role to insert notifications (for API routes)
-- Note: Regular users cannot insert notifications directly
CREATE POLICY "Service role can insert notifications"
  ON saifcrm_notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON saifcrm_notifications
  FOR DELETE
  USING (
    recipient_id IN (
      SELECT id FROM saif_people WHERE auth_user_id = auth.uid()
    )
  );

-- Enable real-time for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE saifcrm_notifications;

-- Create a function to clean up expired notifications (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM saifcrm_notifications
  WHERE expires_at < NOW()
    OR dismissed_at IS NOT NULL;
END;
$$;

-- Comment on the table
COMMENT ON TABLE saifcrm_notifications IS 'Notifications for CRM users. Auto-expire after 30 days or when dismissed.';
