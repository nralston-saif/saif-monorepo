-- Allow founders (and all authenticated users) to read AI news articles
-- Previously only partners could read due to is_partner() check

CREATE POLICY "All authenticated users can view news articles"
  ON saifcrm_ai_news_articles
  FOR SELECT
  TO authenticated
  USING (true);
