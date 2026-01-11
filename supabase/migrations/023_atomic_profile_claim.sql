-- Migration: Atomic Profile Claiming
-- Purpose: Prevent race conditions when multiple users try to claim the same profile
-- This function uses row-level locking to ensure only one user can claim a profile

CREATE OR REPLACE FUNCTION claim_profile(
  p_profile_id UUID,
  p_auth_user_id UUID,
  p_user_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_result JSONB;
BEGIN
  -- Attempt to select and lock the profile row
  -- NOWAIT means we fail immediately if the row is already locked
  SELECT id, auth_user_id, first_name, last_name, email
  INTO v_profile
  FROM saif_people
  WHERE id = p_profile_id
  FOR UPDATE NOWAIT;

  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'profile_not_found',
      'message', 'Profile does not exist'
    );
  END IF;

  -- Check if profile is already claimed
  IF v_profile.auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_claimed',
      'message', 'This profile has already been claimed by another user'
    );
  END IF;

  -- Claim the profile
  UPDATE saif_people
  SET
    auth_user_id = p_auth_user_id,
    status = 'active',
    email = COALESCE(p_user_email, email),
    updated_at = NOW()
  WHERE id = p_profile_id
    AND auth_user_id IS NULL;  -- Double-check in case of race

  -- Verify the update succeeded
  IF NOT FOUND THEN
    -- This shouldn't happen due to FOR UPDATE, but just in case
    RETURN jsonb_build_object(
      'success', false,
      'error', 'claim_failed',
      'message', 'Failed to claim profile - it may have been claimed by another user'
    );
  END IF;

  -- Return success with profile info
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'name', TRIM(COALESCE(v_profile.first_name, '') || ' ' || COALESCE(v_profile.last_name, '')),
    'message', 'Profile claimed successfully'
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Another transaction is already claiming this profile
    RETURN jsonb_build_object(
      'success', false,
      'error', 'profile_locked',
      'message', 'This profile is currently being claimed by another user. Please try again.'
    );
  WHEN OTHERS THEN
    -- Log unexpected errors
    RAISE WARNING 'Error in claim_profile: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unexpected_error',
      'message', 'An unexpected error occurred. Please try again.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_profile(UUID, UUID, TEXT) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION claim_profile IS 'Atomically claim an unclaimed profile for a user. Uses row-level locking to prevent race conditions.';
