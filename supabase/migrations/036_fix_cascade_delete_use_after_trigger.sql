-- =====================================================
-- Migration 036: Fix Cascade Delete - Use AFTER Trigger
-- Description: Use AFTER DELETE trigger so FK constraint is already gone
-- =====================================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_person_delete_remove_auth_user ON saif_people;

-- Recreate the function for AFTER DELETE
-- At this point the saif_people row is already deleted, so no FK issues
CREATE OR REPLACE FUNCTION delete_auth_user_on_person_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only attempt deletion if auth_user_id was set
  IF OLD.auth_user_id IS NOT NULL THEN
    -- The saif_people row is already deleted (AFTER trigger)
    -- so we can safely delete the auth user without FK issues
    DELETE FROM auth.users WHERE id = OLD.auth_user_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create AFTER DELETE trigger (fires after row is deleted)
CREATE TRIGGER on_person_delete_remove_auth_user
  AFTER DELETE ON saif_people
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_person_delete();

-- Log results
SELECT 'Changed to AFTER DELETE trigger for cascade delete' as migration_status;
