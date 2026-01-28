-- Add is_flagged column to saif_tickets table
-- This replaces the testing workflow with a simple flag feature

ALTER TABLE saif_tickets
ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN saif_tickets.is_flagged IS 'Flag for highlighting important tickets that need attention';
