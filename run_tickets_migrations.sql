-- =====================================================
-- COMBINED TICKETS MIGRATIONS
-- Run this entire file in Supabase SQL Editor
-- =====================================================

-- Migration 011: Create Tickets Table
-- =====================================================

-- Create enums for ticket status and priority
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'archived');
CREATE TYPE ticket_priority AS ENUM ('high', 'medium', 'low');

-- Create tickets table
CREATE TABLE IF NOT EXISTS saif_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core Fields
  title text NOT NULL,
  description text,
  status ticket_status DEFAULT 'open' NOT NULL,
  priority ticket_priority DEFAULT 'medium' NOT NULL,

  -- Dates
  due_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,

  -- Assignments & Relationships
  assigned_to uuid REFERENCES saif_people(id) ON DELETE SET NULL,
  created_by uuid REFERENCES saif_people(id) NOT NULL,
  related_company uuid REFERENCES saif_companies(id) ON DELETE CASCADE,
  related_person uuid REFERENCES saif_people(id) ON DELETE SET NULL,

  -- Categories/Tags (stored as array for flexibility)
  tags text[]
);

-- Create indexes for performance
CREATE INDEX idx_tickets_status ON saif_tickets(status);
CREATE INDEX idx_tickets_priority ON saif_tickets(priority);
CREATE INDEX idx_tickets_assigned_to ON saif_tickets(assigned_to);
CREATE INDEX idx_tickets_created_by ON saif_tickets(created_by);
CREATE INDEX idx_tickets_due_date ON saif_tickets(due_date);
CREATE INDEX idx_tickets_related_company ON saif_tickets(related_company);
CREATE INDEX idx_tickets_related_person ON saif_tickets(related_person);
CREATE INDEX idx_tickets_tags ON saif_tickets USING GIN(tags);

-- Create composite index for common dashboard query
CREATE INDEX idx_tickets_active_assigned ON saif_tickets(assigned_to, status)
WHERE status IN ('open', 'in_progress');

-- Trigger for updated_at timestamp
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON saif_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function and trigger to automatically set resolved_at when status changes to resolved
CREATE OR REPLACE FUNCTION set_ticket_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  ELSIF NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_resolved_timestamp
  BEFORE UPDATE ON saif_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_resolved_at();

-- Add comments for documentation
COMMENT ON TABLE saif_tickets IS 'Ticketing system for partner task management and follow-ups';
COMMENT ON COLUMN saif_tickets.title IS 'Short title describing the ticket';
COMMENT ON COLUMN saif_tickets.description IS 'Detailed description of the ticket';
COMMENT ON COLUMN saif_tickets.status IS 'Current status: open, in_progress, resolved, or archived';
COMMENT ON COLUMN saif_tickets.priority IS 'Priority level: high, medium, or low';
COMMENT ON COLUMN saif_tickets.due_date IS 'Optional deadline for ticket completion';
COMMENT ON COLUMN saif_tickets.assigned_to IS 'Partner assigned to ticket (FK to saif_people where role=partner)';
COMMENT ON COLUMN saif_tickets.created_by IS 'Person who created the ticket (FK to saif_people)';
COMMENT ON COLUMN saif_tickets.related_company IS 'Optional FK to related company (cascades on delete)';
COMMENT ON COLUMN saif_tickets.related_person IS 'Optional FK to related person (nulls on delete)';
COMMENT ON COLUMN saif_tickets.tags IS 'Array of tags for categorization (e.g., follow-up, diligence, legal)';
COMMENT ON COLUMN saif_tickets.resolved_at IS 'Timestamp when ticket was marked as resolved (auto-set by trigger)';

SELECT 'Migration 011: Tickets table created successfully' as status;

-- =====================================================
-- Migration 012: Tickets RLS Policies
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

SELECT 'Migration 012: RLS policies created successfully' as status;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show final results
SELECT
  'SUCCESS' as migration_status,
  COUNT(*) as total_tickets,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'saif_tickets') as rls_policies_count
FROM saif_tickets;
