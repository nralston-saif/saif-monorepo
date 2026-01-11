-- Migration: Add SMS notification preferences to saif_people
-- This allows partners to opt-in to receive text message notifications

-- Add SMS preference columns to saif_people table
ALTER TABLE saif_people
ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_notification_types text[] DEFAULT '{}';

-- Add comments for clarity
COMMENT ON COLUMN saif_people.sms_notifications_enabled IS 'Whether user has opted into SMS notifications';
COMMENT ON COLUMN saif_people.sms_notification_types IS 'Array of notification types to receive via SMS (e.g., new_application, ready_for_deliberation)';

-- Create index for efficient lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_saif_people_sms_enabled
ON saif_people (sms_notifications_enabled)
WHERE sms_notifications_enabled = true;
