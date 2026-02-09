import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveProfile } from '@/lib/impersonation'
import Navigation from '@/components/Navigation'
import ForumClient from './ForumClient'
import type { ForumPostWithAuthor, ReactionSummary, ReactionEmoji, ForumReaction, ForumTagData, CompanyInfo } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type PostWithMeta = {
  post: ForumPostWithAuthor
  reactions: ReactionSummary[]
  replyCount: number
}

type SearchParams = Promise<{ tag?: string }>

export default async function ForumPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const params = await searchParams

  const { profile } = await getActiveProfile()

  if (!profile) {
    redirect('/login')
  }

  // Partners only during testing (founders will be added later)
  if (profile.role !== 'partner') {
    redirect('/access-denied')
  }

  const initialTag = params?.tag || null

  // Fetch initial 20 posts with author info, pinned first
  let postsQuery = supabase
    .from('saif_forum_posts')
    .select('*, author:saif_people!saif_forum_posts_author_id_fkey(id, first_name, last_name, avatar_url, role)')
    .order('is_pinned', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (initialTag) {
    postsQuery = postsQuery.contains('tags', [initialTag])
  }

  const { data: postsData } = await postsQuery

  const posts = (postsData || []) as ForumPostWithAuthor[]
  const postIds = posts.map(p => p.id)
  const authorIds = [...new Set(posts.map(p => p.author_id))]

  // Fetch reactions, reply counts, company associations, and tags in parallel
  const [reactionsResult, replyCountsResult, companyResult, tagsResult] = await Promise.all([
    // Reactions
    postIds.length > 0
      ? supabase.from('saif_forum_reactions').select('*').in('post_id', postIds)
      : { data: [] as ForumReaction[] },
    // Reply counts
    postIds.length > 0
      ? supabase.from('saif_forum_replies').select('post_id').in('post_id', postIds)
      : { data: [] as { post_id: string }[] },
    // Company associations for all authors
    authorIds.length > 0
      ? supabase
          .from('saif_company_people')
          .select('user_id, company:saif_companies(id, name)')
          .in('user_id', authorIds)
          .is('end_date', null)
      : { data: [] },
    // Forum tags
    supabase
      .from('saif_tags')
      .select('id, name, color, category')
      .in('category', ['forum', 'general'])
      .order('name'),
  ])

  const reactionsData = (reactionsResult.data as ForumReaction[] | null) || []
  const replyCounts = (replyCountsResult.data as { post_id: string }[] | null) || []

  // Build company-by-author map
  const companyByAuthor: Record<string, CompanyInfo> = {}
  if (companyResult.data) {
    for (const row of companyResult.data as { user_id: string; company: CompanyInfo | null }[]) {
      if (row.company && !companyByAuthor[row.user_id]) {
        companyByAuthor[row.user_id] = row.company
      }
    }
  }

  const forumTags = (tagsResult.data as ForumTagData[] | null) || []

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
        currentUserRole={profile.role}
        companyByAuthor={companyByAuthor}
        forumTags={forumTags}
        initialTag={initialTag}
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
