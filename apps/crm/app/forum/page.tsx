import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveProfile } from '@/lib/impersonation'
import Navigation from '@/components/Navigation'
import ForumClient from './ForumClient'
import type { ForumPostWithAuthor, ReactionSummary, ReactionEmoji, ForumReaction } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type PostWithMeta = {
  post: ForumPostWithAuthor
  reactions: ReactionSummary[]
  replyCount: number
}

export default async function ForumPage() {
  const supabase = await createClient()

  const { profile } = await getActiveProfile()

  if (!profile) {
    redirect('/login')
  }

  // Partners only during testing (founders will be added later)
  if (profile.role !== 'partner') {
    redirect('/access-denied')
  }

  // Fetch initial 20 posts with author info
  const { data: postsData } = await supabase
    .from('saif_forum_posts')
    .select('*, author:saif_people!saif_forum_posts_author_id_fkey(id, first_name, last_name, avatar_url, role)')
    .order('created_at', { ascending: false })
    .limit(20)

  const posts = (postsData || []) as ForumPostWithAuthor[]
  const postIds = posts.map(p => p.id)

  // Fetch reactions for all posts
  let reactionsData: ForumReaction[] = []
  if (postIds.length > 0) {
    const { data } = await supabase
      .from('saif_forum_reactions')
      .select('*')
      .in('post_id', postIds)

    reactionsData = (data as ForumReaction[] | null) || []
  }

  // Fetch reply counts for all posts
  let replyCounts: { post_id: string }[] = []
  if (postIds.length > 0) {
    const { data } = await supabase
      .from('saif_forum_replies')
      .select('post_id')
      .in('post_id', postIds)

    replyCounts = data || []
  }

  // Build initial posts with meta
  const initialPosts: PostWithMeta[] = posts.map(post => {
    const postReactions = reactionsData.filter(r => r.post_id === post.id)
    const replyCount = replyCounts.filter(r => r.post_id === post.id).length

    return {
      post,
      reactions: summarizeReactions(postReactions, profile.id),
      replyCount,
    }
  })

  const userName = profile.first_name || 'User'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={userName} personId={profile.id} />
      <ForumClient
        initialPosts={initialPosts}
        currentUserId={profile.id}
      />
    </div>
  )
}

function summarizeReactions(reactions: ForumReaction[], currentUserId: string): ReactionSummary[] {
  const emojiCounts: Record<string, { count: number; reacted: boolean }> = {}

  for (const r of reactions) {
    if (!emojiCounts[r.emoji]) {
      emojiCounts[r.emoji] = { count: 0, reacted: false }
    }
    emojiCounts[r.emoji].count++
    if (r.user_id === currentUserId) {
      emojiCounts[r.emoji].reacted = true
    }
  }

  return Object.entries(emojiCounts).map(([emoji, data]) => ({
    emoji: emoji as ReactionEmoji,
    count: data.count,
    reacted: data.reacted,
  }))
}
