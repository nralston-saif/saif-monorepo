-- =====================================================
-- Migration 050: Add Founder Feedback Support
-- Description: Allow founders to submit feedback tickets
-- =====================================================

-- Add source column to distinguish founder feedback from partner tickets
ALTER TABLE saif_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'partner'
  CHECK (source IN ('partner', 'founder_feedback'));

-- Add feedback_type for categorizing founder submissions
ALTER TABLE saif_tickets ADD COLUMN IF NOT EXISTS feedback_type TEXT
  CHECK (feedback_type IS NULL OR feedback_type IN ('bug_report', 'suggestion', 'question'));

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tickets_source ON saif_tickets(source);
CREATE INDEX IF NOT EXISTS idx_tickets_feedback_type ON saif_tickets(feedback_type) WHERE feedback_type IS NOT NULL;

-- Composite index for intake queue queries (founder feedback + unassigned)
CREATE INDEX IF NOT EXISTS idx_tickets_intake ON saif_tickets(source, assigned_to)
  WHERE source = 'founder_feedback' AND assigned_to IS NULL;

-- =====================================================
-- RLS Policies for Founder Feedback
-- =====================================================

-- Drop existing founder policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Founders can submit feedback" ON saif_tickets;
DROP POLICY IF EXISTS "Founders view own feedback" ON saif_tickets;

-- Founders can submit feedback tickets
-- Must be a founder, set themselves as creator, use founder_feedback source, leave unassigned
CREATE POLICY "Founders can submit feedback"
ON saif_tickets FOR INSERT
TO authenticated
WITH CHECK (
  is_founder()
  AND created_by = get_person_id()
  AND source = 'founder_feedback'
  AND assigned_to IS NULL
);

-- Founders can view their own feedback submissions
CREATE POLICY "Founders view own feedback"
ON saif_tickets FOR SELECT
TO authenticated
USING (
  is_founder()
  AND created_by = get_person_id()
  AND source = 'founder_feedback'
);

-- =====================================================
-- Update Notification Type Constraint
-- =====================================================

-- First, check if the constraint exists and drop it
DO $$
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE saifcrm_notifications DROP CONSTRAINT IF EXISTS saifcrm_notifications_type_check;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Constraint doesn't exist, that's fine
END $$;

-- Add the new constraint with the additional type
ALTER TABLE saifcrm_notifications ADD CONSTRAINT saifcrm_notifications_type_check
  CHECK (type IN (
    'new_application',
    'ready_for_deliberation',
    'new_deliberation_notes',
    'decision_made',
    'ticket_assigned',
    'ticket_archived',
    'ticket_status_changed',
    'profile_claimed',
    'forum_mention',
    'forum_reply',
    'new_founder_feedback'
  ));

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN saif_tickets.source IS 'Source of ticket: partner (created by partner) or founder_feedback (submitted by founder)';
COMMENT ON COLUMN saif_tickets.feedback_type IS 'Type of founder feedback: bug_report, suggestion, or question (only for founder_feedback source)';

-- Log results
SELECT 'Founder feedback support added successfully' as migration_status;
