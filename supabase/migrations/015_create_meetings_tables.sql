-- Create saif_meetings table for general meetings
CREATE TABLE IF NOT EXISTS saif_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES saif_people(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT saif_meetings_title_not_empty CHECK (length(trim(title)) > 0)
);

-- Create saif_meeting_notes table for notes associated with meetings
CREATE TABLE IF NOT EXISTS saif_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES saif_meetings(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES saif_people(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT saif_meeting_notes_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for fast lookups
CREATE INDEX idx_saif_meetings_created_by ON saif_meetings(created_by);
CREATE INDEX idx_saif_meetings_meeting_date ON saif_meetings(meeting_date DESC);
CREATE INDEX idx_saif_meeting_notes_meeting_id ON saif_meeting_notes(meeting_id);
CREATE INDEX idx_saif_meeting_notes_author_id ON saif_meeting_notes(author_id);
CREATE INDEX idx_saif_meeting_notes_created_at ON saif_meeting_notes(created_at DESC);

-- Enable RLS
ALTER TABLE saif_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saif_meetings
CREATE POLICY "Partners can view all meetings" ON saif_meetings FOR SELECT TO authenticated USING (is_partner());
CREATE POLICY "Partners can create meetings" ON saif_meetings FOR INSERT TO authenticated WITH CHECK (is_partner());
CREATE POLICY "Partners can update meetings" ON saif_meetings FOR UPDATE TO authenticated USING (is_partner());
CREATE POLICY "Partners can delete meetings" ON saif_meetings FOR DELETE TO authenticated USING (is_partner());

-- RLS Policies for saif_meeting_notes
CREATE POLICY "Partners can view all meeting notes" ON saif_meeting_notes FOR SELECT TO authenticated USING (is_partner());
CREATE POLICY "Partners can create meeting notes" ON saif_meeting_notes FOR INSERT TO authenticated WITH CHECK (is_partner());
CREATE POLICY "Partners can update their own meeting notes" ON saif_meeting_notes FOR UPDATE TO authenticated USING (author_id = get_person_id());
CREATE POLICY "Partners can delete their own meeting notes" ON saif_meeting_notes FOR DELETE TO authenticated USING (author_id = get_person_id());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_saif_meetings_updated_at BEFORE UPDATE ON saif_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saif_meeting_notes_updated_at BEFORE UPDATE ON saif_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
