-- =====================================================
-- Migration 034: Cascade Delete Auth User
-- Description: When a saif_people record is deleted, also delete the corresponding auth.users record
-- =====================================================

-- Create function to delete auth user when person is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_person_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only attempt deletion if auth_user_id was set
  IF OLD.auth_user_id IS NOT NULL THEN
    -- First clear the reference to avoid FK constraint
    -- (This is redundant since the row is being deleted, but just in case)

    -- Delete the auth user
    DELETE FROM auth.users WHERE id = OLD.auth_user_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE delete (so we can access OLD.auth_user_id)
DROP TRIGGER IF EXISTS on_person_delete_remove_auth_user ON saif_people;

CREATE TRIGGER on_person_delete_remove_auth_user
  BEFORE DELETE ON saif_people
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_person_delete();

-- Grant necessary permissions
GRANT DELETE ON auth.users TO postgres;

-- Log results
SELECT 'Created trigger to cascade delete auth users when saif_people records are deleted' as migration_status;
