-- =====================================================
-- Migration 033: Add Testing and Reactivated Comment Flags
-- Description: Add is_testing_comment and is_reactivated_comment columns to saif_ticket_comments
-- =====================================================

-- Add is_testing_comment column with default false
ALTER TABLE saif_ticket_comments
ADD COLUMN IF NOT EXISTS is_testing_comment BOOLEAN NOT NULL DEFAULT FALSE;

-- Add is_reactivated_comment column with default false
ALTER TABLE saif_ticket_comments
ADD COLUMN IF NOT EXISTS is_reactivated_comment BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN saif_ticket_comments.is_testing_comment IS 'Flag indicating this comment was added when moving ticket to testing status';
COMMENT ON COLUMN saif_ticket_comments.is_reactivated_comment IS 'Flag indicating this comment was added when reactivating a ticket from testing';

-- Log results
SELECT 'Added is_testing_comment and is_reactivated_comment columns to saif_ticket_comments' as migration_status;
