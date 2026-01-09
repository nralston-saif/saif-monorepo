-- =====================================================
-- Migration 019: Create Ticket Comments
-- Description: Add commenting functionality to tickets
-- =====================================================

-- Create ticket comments table
CREATE TABLE IF NOT EXISTS saif_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES saif_tickets(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES saif_people(id) NOT NULL,
  content TEXT NOT NULL,
  is_final_comment BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT saif_ticket_comments_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for performance
CREATE INDEX idx_ticket_comments_ticket_id ON saif_ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author_id ON saif_ticket_comments(author_id);
CREATE INDEX idx_ticket_comments_created_at ON saif_ticket_comments(created_at DESC);

-- Ensure only one final comment per ticket
CREATE UNIQUE INDEX idx_ticket_comments_one_final_per_ticket
  ON saif_ticket_comments(ticket_id)
  WHERE is_final_comment = TRUE;

-- Enable RLS
ALTER TABLE saif_ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Partners view all ticket comments"
ON saif_ticket_comments FOR SELECT
TO authenticated
USING (is_partner());

CREATE POLICY "Partners create ticket comments"
ON saif_ticket_comments FOR INSERT
TO authenticated
WITH CHECK (
  is_partner()
  AND author_id = get_person_id()
);

CREATE POLICY "Partners update own ticket comments"
ON saif_ticket_comments FOR UPDATE
TO authenticated
USING (
  is_partner()
  AND author_id = get_person_id()
)
WITH CHECK (
  is_partner()
  AND author_id = get_person_id()
);

CREATE POLICY "Partners delete own ticket comments"
ON saif_ticket_comments FOR DELETE
TO authenticated
USING (
  is_partner()
  AND author_id = get_person_id()
);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_ticket_comments_updated_at
  BEFORE UPDATE ON saif_ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE saif_ticket_comments IS 'Comments on tickets for partner collaboration';
COMMENT ON COLUMN saif_ticket_comments.ticket_id IS 'Reference to the ticket this comment belongs to';
COMMENT ON COLUMN saif_ticket_comments.author_id IS 'Partner who wrote this comment';
COMMENT ON COLUMN saif_ticket_comments.content IS 'Comment text content';
COMMENT ON COLUMN saif_ticket_comments.is_final_comment IS 'True if this is the final summary comment when archiving';
COMMENT ON COLUMN saif_ticket_comments.created_at IS 'When the comment was created';
COMMENT ON COLUMN saif_ticket_comments.updated_at IS 'When the comment was last modified';

-- Display results
SELECT 'Ticket comments table created successfully' as status;
