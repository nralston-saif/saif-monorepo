-- Add SAIF thesis focus area tags for companies
-- Based on investment verticals from https://saif-website.vercel.app/thesis
-- Separated combined areas (e.g., "Alignment and Interpretability" → two separate tags)

-- Alignment (from "Alignment and Interpretability Tools")
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Alignment', '#8B5CF6', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#8B5CF6';

-- Interpretability (from "Alignment and Interpretability Tools")
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Interpretability', '#A855F7', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#A855F7';

-- Security Infrastructure
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Security Infrastructure', '#EF4444', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#EF4444';

-- Governance and Compliance Infrastructure
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Governance & Compliance', '#F97316', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#F97316';

-- Weapons Safety Systems
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Weapons Safety', '#DC2626', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#DC2626';

-- Bio Safety Systems
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Bio Safety', '#10B981', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#10B981';

-- Trust Preservation
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Trust Preservation', '#3B82F6', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#3B82F6';

-- Model Safety (from "Model Safety and Benchmarking")
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Model Safety', '#6366F1', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#6366F1';

-- Benchmarking (from "Model Safety and Benchmarking")
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Benchmarking', '#818CF8', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#818CF8';

-- Decision-making Tools
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Decision-making', '#14B8A6', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#14B8A6';

-- Negotiation Tools
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Negotiation', '#06B6D4', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#06B6D4';

-- Education
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Education', '#F59E0B', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#F59E0B';

-- Social and Emotional Resilience Tools
INSERT INTO saif_tags (name, color, category, usage_count) VALUES
  ('Social & Emotional Resilience', '#EC4899', 'biomap_focus', 0)
ON CONFLICT (name) DO UPDATE SET category = 'biomap_focus', color = '#EC4899';
