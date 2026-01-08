-- =====================================================
-- Migration 012: Tickets RLS Policies
-- Description: Row Level Security for tickets table
-- =====================================================

-- Enable RLS on tickets table
ALTER TABLE saif_tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: Partners can view all tickets
CREATE POLICY "Partners view all tickets"
ON saif_tickets FOR SELECT
TO authenticated
USING (is_partner());

-- INSERT: Partners can create tickets (must set themselves as creator)
CREATE POLICY "Partners create tickets"
ON saif_tickets FOR INSERT
TO authenticated
WITH CHECK (
  is_partner()
  AND created_by = get_person_id()
);

-- UPDATE: Partners can update any ticket
-- (Allows reassignment and status changes)
CREATE POLICY "Partners update tickets"
ON saif_tickets FOR UPDATE
TO authenticated
USING (is_partner())
WITH CHECK (is_partner());

-- DELETE: Partners can delete tickets
-- Note: Soft delete via 'archived' status is preferred
CREATE POLICY "Partners delete tickets"
ON saif_tickets FOR DELETE
TO authenticated
USING (is_partner());

-- Log results
SELECT 'Tickets RLS policies created successfully' as status;
