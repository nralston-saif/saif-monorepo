-- =====================================================
-- Migration 008: Fix RLS for Founder Management
-- Description: Allow partners and founders to add new people and relationships
-- =====================================================

-- Allow partners to insert new people (for adding founders)
CREATE POLICY "Partners insert people"
ON saif_people FOR INSERT
TO authenticated
WITH CHECK (is_partner());

-- Allow founders to create relationships for their company
-- (not just for themselves, but for any person at their company)
CREATE POLICY "Founders create company relationships"
ON saif_company_people FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM saif_company_people
    WHERE user_id = get_person_id()
      AND relationship_type = 'founder'
      AND end_date IS NULL
  )
);

-- Display results
SELECT 'Founder Management RLS Fixed' as status;
