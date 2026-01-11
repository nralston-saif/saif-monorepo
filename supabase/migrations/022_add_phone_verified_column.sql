-- Migration: Add phone_verified column to saif_people
-- This tracks whether a partner's phone number has been verified via Twilio

ALTER TABLE saif_people
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

COMMENT ON COLUMN saif_people.phone_verified IS 'Whether the mobile_phone has been verified via Twilio Verify';
