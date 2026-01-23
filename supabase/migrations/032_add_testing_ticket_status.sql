-- =====================================================
-- Migration 032: Add Testing Ticket Status
-- Description: Add 'testing' status between active and archived
-- =====================================================

-- Add 'testing' value to ticket_status enum
-- Position it before 'archived' so the order is: open, in_progress, testing, archived
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'testing' BEFORE 'archived';

-- Update comment to reflect new status
COMMENT ON COLUMN saif_tickets.status IS 'Current status: open, in_progress, testing, or archived';

-- Log results
SELECT 'Added testing status to ticket_status enum' as migration_status;
