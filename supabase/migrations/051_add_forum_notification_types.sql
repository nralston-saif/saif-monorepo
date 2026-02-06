-- ============================================
-- 051: Add forum notification types
-- Extends notifications for forum_mention and forum_reply
-- ============================================

-- Update the CHECK constraint to include forum types
ALTER TABLE saifcrm_notifications
DROP CONSTRAINT IF EXISTS saifcrm_notifications_type_check;

ALTER TABLE saifcrm_notifications
ADD CONSTRAINT saifcrm_notifications_type_check
CHECK (type IN (
  'new_application', 'ready_for_deliberation', 'new_deliberation_notes',
  'decision_made', 'ticket_assigned', 'ticket_archived',
  'ticket_status_changed', 'profile_claimed',
  'forum_mention', 'forum_reply'
));

-- Add forum_post_id column for linking notifications to forum posts
ALTER TABLE saifcrm_notifications
ADD COLUMN IF NOT EXISTS forum_post_id UUID REFERENCES saif_forum_posts(id) ON DELETE CASCADE;
