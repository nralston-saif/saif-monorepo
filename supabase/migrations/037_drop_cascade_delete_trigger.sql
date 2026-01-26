-- =====================================================
-- Migration 037: Drop Cascade Delete Trigger
-- Description: Remove the problematic cascade delete trigger
-- The FK constraint checking happens before the trigger can complete
-- Orphaned auth users are harmless and can be cleaned up separately
-- =====================================================

-- Drop the trigger
DROP TRIGGER IF EXISTS on_person_delete_remove_auth_user ON saif_people;

-- Drop the function
DROP FUNCTION IF EXISTS delete_auth_user_on_person_delete();

-- Log results
SELECT 'Dropped cascade delete trigger - orphaned auth users can be cleaned up separately' as migration_status;
