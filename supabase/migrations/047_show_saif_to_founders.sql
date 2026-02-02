-- Migration 047: Make SAIF company visible to founders
--
-- The SAIF company has stage='saif' (not 'portfolio'), so it was excluded
-- from founder views by both the RLS policy and application-level filters.
-- Add stage='saif' to the saif_companies SELECT policy so founders can see it.

DROP POLICY IF EXISTS "View portfolio companies" ON saif_companies;

CREATE POLICY "View portfolio companies"
ON saif_companies FOR SELECT
TO authenticated
USING (
  is_partner()
  OR stage = 'saif'
  OR (
    stage = 'portfolio'
    AND (
      is_stealth = FALSE
      OR is_founder_of_company(id)
    )
  )
);
