-- Create AI news articles table for storing daily curated news
CREATE TABLE IF NOT EXISTS saifcrm_ai_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Article metadata from NewsAPI
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  source_name TEXT,
  source_id TEXT,
  author TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,

  -- AI classification (Claude API)
  topic TEXT NOT NULL CHECK (topic IN (
    'llm',
    'robotics',
    'regulation',
    'business',
    'research',
    'healthcare',
    'ai_safety',
    'general'
  )),
  is_ai_safety BOOLEAN NOT NULL DEFAULT FALSE,
  classification_confidence DECIMAL(3,2),

  -- Fetch metadata
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetch_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying articles by date (most common query)
CREATE INDEX idx_ai_news_fetch_date ON saifcrm_ai_news_articles(fetch_date DESC);

-- Index for filtering by topic
CREATE INDEX idx_ai_news_topic ON saifcrm_ai_news_articles(topic, fetch_date DESC);

-- Index for AI safety articles
CREATE INDEX idx_ai_news_safety ON saifcrm_ai_news_articles(is_ai_safety, fetch_date DESC);

-- RLS policies - partners can read all articles
ALTER TABLE saifcrm_ai_news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view all news articles"
  ON saifcrm_ai_news_articles
  FOR SELECT
  TO authenticated
  USING (is_partner());

-- Service role can insert articles (for cron job)
CREATE POLICY "Service role can insert news articles"
  ON saifcrm_ai_news_articles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE saifcrm_ai_news_articles IS 'Stores AI news articles fetched daily from NewsAPI and classified by topic';
