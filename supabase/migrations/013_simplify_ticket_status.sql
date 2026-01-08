-- =====================================================
-- Migration 013: Simplify Ticket Status
-- Description: Combine resolved and archived into single archived status
-- =====================================================

-- Step 1: Drop all triggers and functions
DROP TRIGGER IF EXISTS set_resolved_timestamp ON saif_tickets;
DROP TRIGGER IF EXISTS set_archived_timestamp ON saif_tickets;
DROP FUNCTION IF EXISTS set_ticket_resolved_at();
DROP FUNCTION IF EXISTS set_ticket_archived_at();

-- Step 2: Update any existing 'resolved' tickets to 'archived'
UPDATE saif_tickets
SET status = 'archived'
WHERE status = 'resolved';

-- Step 3: Rename resolved_at to archived_at
ALTER TABLE saif_tickets
RENAME COLUMN resolved_at TO archived_at;

COMMENT ON COLUMN saif_tickets.archived_at IS 'Timestamp when ticket was marked as archived (auto-set by trigger)';

-- Step 4: Create new enum type
CREATE TYPE ticket_status_new AS ENUM ('open', 'in_progress', 'archived');

-- Step 5: Add a new column with the new enum type
ALTER TABLE saif_tickets ADD COLUMN status_new ticket_status_new;

-- Step 6: Copy data from old column to new column
UPDATE saif_tickets
SET status_new = status::text::ticket_status_new;

-- Step 7: Make the new column NOT NULL
ALTER TABLE saif_tickets ALTER COLUMN status_new SET NOT NULL;

-- Step 8: Set default on new column
ALTER TABLE saif_tickets ALTER COLUMN status_new SET DEFAULT 'open'::ticket_status_new;

-- Step 9: Drop the old column
ALTER TABLE saif_tickets DROP COLUMN status;

-- Step 10: Rename new column to status
ALTER TABLE saif_tickets RENAME COLUMN status_new TO status;

-- Step 11: Drop old enum and rename new one
DROP TYPE ticket_status;
ALTER TYPE ticket_status_new RENAME TO ticket_status;

-- Update the comment
COMMENT ON COLUMN saif_tickets.status IS 'Current status: open, in_progress, or archived (resolved tickets are automatically archived)';

-- Create new trigger function for archived_at
CREATE OR REPLACE FUNCTION set_ticket_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'archived' AND (OLD.status IS NULL OR OLD.status != 'archived') THEN
    NEW.archived_at = now();
  ELSIF NEW.status != 'archived' THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for archived_at
CREATE TRIGGER set_archived_timestamp
  BEFORE UPDATE ON saif_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_archived_at();

-- Log results
SELECT 'Ticket status simplified - resolved merged into archived' as migration_status;
