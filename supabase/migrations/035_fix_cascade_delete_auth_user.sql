-- =====================================================
-- Migration 035: Fix Cascade Delete Auth User
-- Description: Fix the trigger to clear FK reference before deleting auth user
-- =====================================================

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_person_delete_remove_auth_user ON saif_people;

-- Recreate the function with proper FK handling
CREATE OR REPLACE FUNCTION delete_auth_user_on_person_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  -- Store the auth_user_id before we clear it
  v_auth_user_id := OLD.auth_user_id;

  -- Only attempt deletion if auth_user_id was set
  IF v_auth_user_id IS NOT NULL THEN
    -- First clear the reference on this row to avoid FK constraint
    -- This works because we're in a BEFORE DELETE trigger
    UPDATE saif_people SET auth_user_id = NULL WHERE id = OLD.id;

    -- Now we can safely delete the auth user
    DELETE FROM auth.users WHERE id = v_auth_user_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_person_delete_remove_auth_user
  BEFORE DELETE ON saif_people
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_person_delete();

-- Log results
SELECT 'Fixed cascade delete trigger to clear FK before deleting auth user' as migration_status;
