-- ============================================
-- 050: Create Forum Tables
-- Community forum for partners and founders
-- ============================================

-- 1. Forum Posts (top-level posts)
CREATE TABLE saif_forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Forum Replies (flat, one level deep)
CREATE TABLE saif_forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES saif_forum_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Forum Reactions (emoji toggles)
CREATE TABLE saif_forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,
  post_id UUID REFERENCES saif_forum_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES saif_forum_replies(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('thumbsup', 'heart', 'tada', 'bulb')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure reaction is on either a post or a reply, not both
  CONSTRAINT reaction_target_check CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (post_id IS NULL AND reply_id IS NOT NULL)
  ),
  -- One reaction per emoji per user per target
  CONSTRAINT unique_post_reaction UNIQUE (user_id, post_id, emoji),
  CONSTRAINT unique_reply_reaction UNIQUE (user_id, reply_id, emoji)
);

-- 4. Forum Mentions (@mention tracking)
CREATE TABLE saif_forum_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_person_id UUID NOT NULL REFERENCES saif_people(id) ON DELETE CASCADE,
  post_id UUID REFERENCES saif_forum_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES saif_forum_replies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure mention is on either a post or a reply, not both
  CONSTRAINT mention_target_check CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

-- ============================================
-- Indexes
-- ============================================

-- Posts: newest first feed
CREATE INDEX idx_forum_posts_created_at ON saif_forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_author_id ON saif_forum_posts(author_id);

-- Replies: by post, newest first
CREATE INDEX idx_forum_replies_post_id ON saif_forum_replies(post_id);
CREATE INDEX idx_forum_replies_created_at ON saif_forum_replies(created_at DESC);
CREATE INDEX idx_forum_replies_author_id ON saif_forum_replies(author_id);

-- Reactions: lookup by target
CREATE INDEX idx_forum_reactions_post_id ON saif_forum_reactions(post_id);
CREATE INDEX idx_forum_reactions_reply_id ON saif_forum_reactions(reply_id);

-- Mentions: lookup by person
CREATE INDEX idx_forum_mentions_person_id ON saif_forum_mentions(mentioned_person_id);

-- ============================================
-- Auto-updating timestamps
-- ============================================

CREATE TRIGGER update_saif_forum_posts_updated_at
  BEFORE UPDATE ON saif_forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_saif_forum_replies_updated_at
  BEFORE UPDATE ON saif_forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE saif_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saif_forum_mentions ENABLE ROW LEVEL SECURITY;

-- Posts: partners and founders can read all
CREATE POLICY "Forum posts readable by community"
  ON saif_forum_posts FOR SELECT
  USING (is_partner() OR is_founder());

-- Posts: partners and founders can create
CREATE POLICY "Forum posts creatable by community"
  ON saif_forum_posts FOR INSERT
  WITH CHECK (is_partner() OR is_founder());

-- Posts: author can update own posts
CREATE POLICY "Forum posts updatable by author"
  ON saif_forum_posts FOR UPDATE
  USING (author_id = get_person_id());

-- Posts: author can delete own posts
CREATE POLICY "Forum posts deletable by author"
  ON saif_forum_posts FOR DELETE
  USING (author_id = get_person_id());

-- Replies: partners and founders can read all
CREATE POLICY "Forum replies readable by community"
  ON saif_forum_replies FOR SELECT
  USING (is_partner() OR is_founder());

-- Replies: partners and founders can create
CREATE POLICY "Forum replies creatable by community"
  ON saif_forum_replies FOR INSERT
  WITH CHECK (is_partner() OR is_founder());

-- Replies: author can update own replies
CREATE POLICY "Forum replies updatable by author"
  ON saif_forum_replies FOR UPDATE
  USING (author_id = get_person_id());

-- Replies: author can delete own replies
CREATE POLICY "Forum replies deletable by author"
  ON saif_forum_replies FOR DELETE
  USING (author_id = get_person_id());

-- Reactions: partners and founders can read all
CREATE POLICY "Forum reactions readable by community"
  ON saif_forum_reactions FOR SELECT
  USING (is_partner() OR is_founder());

-- Reactions: partners and founders can create
CREATE POLICY "Forum reactions creatable by community"
  ON saif_forum_reactions FOR INSERT
  WITH CHECK (is_partner() OR is_founder());

-- Reactions: user can delete own reactions (toggle off)
CREATE POLICY "Forum reactions deletable by owner"
  ON saif_forum_reactions FOR DELETE
  USING (user_id = get_person_id());

-- Mentions: partners and founders can read all
CREATE POLICY "Forum mentions readable by community"
  ON saif_forum_mentions FOR SELECT
  USING (is_partner() OR is_founder());

-- Mentions: partners and founders can create
CREATE POLICY "Forum mentions creatable by community"
  ON saif_forum_mentions FOR INSERT
  WITH CHECK (is_partner() OR is_founder());

-- ============================================
-- Real-time publication
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE saif_forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE saif_forum_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE saif_forum_reactions;
