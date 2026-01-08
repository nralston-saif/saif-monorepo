-- Create saif_tags table for persistent tag storage
CREATE TABLE IF NOT EXISTS saif_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280', -- Default gray color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES saif_people(id),
  usage_count INTEGER DEFAULT 0, -- Track how many times tag is used
  CONSTRAINT saif_tags_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create index on name for fast lookups
CREATE INDEX idx_saif_tags_name ON saif_tags(name);
CREATE INDEX idx_saif_tags_usage_count ON saif_tags(usage_count DESC);

-- Enable RLS
ALTER TABLE saif_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Partners can view, create, and update tags
CREATE POLICY "Partners can view all tags"
  ON saif_tags FOR SELECT
  TO authenticated
  USING (is_partner());

CREATE POLICY "Partners can create tags"
  ON saif_tags FOR INSERT
  TO authenticated
  WITH CHECK (is_partner());

CREATE POLICY "Partners can update tags"
  ON saif_tags FOR UPDATE
  TO authenticated
  USING (is_partner());

-- Function to increment tag usage count
CREATE OR REPLACE FUNCTION increment_tag_usage(tag_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE saif_tags
  SET usage_count = usage_count + 1
  WHERE name = tag_name;
END;
$$;

-- Seed with common tags
INSERT INTO saif_tags (name, color) VALUES
  ('email-follow-up', '#3B82F6'),   -- Blue
  ('deliberation', '#F59E0B'),      -- Amber
  ('rejected', '#EF4444'),          -- Red
  ('diligence', '#8B5CF6'),         -- Purple
  ('legal', '#10B981'),             -- Green
  ('financial', '#14B8A6'),         -- Teal
  ('technical', '#6366F1'),         -- Indigo
  ('urgent', '#DC2626'),            -- Dark red
  ('follow-up', '#3B82F6'),         -- Blue
  ('meeting', '#EC4899')            -- Pink
ON CONFLICT (name) DO NOTHING;
