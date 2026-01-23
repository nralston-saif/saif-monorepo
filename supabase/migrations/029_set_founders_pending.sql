-- Migration: Set portfolio founders to pending status and add invited_to_community column
-- This enables the simplified registration flow where only invited users can sign up

-- 1. Add invited_to_community column for explicitly invited non-portfolio users
ALTER TABLE saif_people ADD COLUMN IF NOT EXISTS invited_to_community boolean DEFAULT false;

COMMENT ON COLUMN saif_people.invited_to_community IS 'When true, allows non-portfolio users to sign up for the community';

-- 2. Set unclaimed portfolio founders to pending status
-- This marks them as eligible for signup
UPDATE saif_people p
SET status = 'pending'
WHERE p.auth_user_id IS NULL
  AND (p.status IS NULL OR p.status NOT IN ('pending', 'active'))
  AND EXISTS (
    SELECT 1 FROM saif_company_people cp
    JOIN saif_companies c ON cp.company_id = c.id
    WHERE cp.user_id = p.id
      AND cp.relationship_type = 'founder'
      AND c.stage = 'portfolio'
      AND cp.end_date IS NULL
  );

-- 3. Ensure SAIF partners are set to active (they should already have auth_user_id set)
-- Skip this if they're already active
UPDATE saif_people p
SET status = 'active'
WHERE p.auth_user_id IS NOT NULL
  AND p.role = 'partner'
  AND (p.status IS NULL OR p.status != 'active');
