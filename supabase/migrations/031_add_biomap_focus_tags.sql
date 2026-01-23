-- Add category column to saif_tags for differentiating tag types
ALTER TABLE saif_tags ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Create index for efficient category lookups
CREATE INDEX IF NOT EXISTS idx_saif_tags_category ON saif_tags(category);

-- Seed biomap focus tags with predefined colors
-- Insert each tag separately to avoid partial failures
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('prevention', '#10B981', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#10B981';

INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('detection', '#3B82F6', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#3B82F6';

INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('treatment', '#8B5CF6', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#8B5CF6';

INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('therapeutics', '#F59E0B', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#F59E0B';

INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('advocacy', '#EC4899', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#EC4899';
