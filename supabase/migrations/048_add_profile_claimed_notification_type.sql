-- Add 'profile_claimed' to the notification type CHECK constraint
-- This allows notifications when a founder claims their profile

ALTER TABLE saifcrm_notifications
DROP CONSTRAINT IF EXISTS saifcrm_notifications_type_check;

ALTER TABLE saifcrm_notifications
ADD CONSTRAINT saifcrm_notifications_type_check
CHECK (type IN (
  'new_application', 'ready_for_deliberation', 'new_deliberation_notes',
  'decision_made', 'ticket_assigned', 'ticket_archived',
  'ticket_status_changed', 'profile_claimed'
));
