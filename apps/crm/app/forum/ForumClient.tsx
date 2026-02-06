'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import NewPostForm from './components/NewPostForm'
import PostCard from './components/PostCard'
import type { ForumPostWithAuthor, ReactionSummary, ReactionEmoji, ForumReaction } from '@/lib/types/database'

type PostWithMeta = {
  post: ForumPostWithAuthor
  reactions: ReactionSummary[]
  replyCount: number
}

type ForumClientProps = {
  initialPosts: PostWithMeta[]
  currentUserId: string
}

const PAGE_SIZE = 20

export default function ForumClient({ initialPosts, currentUserId }: ForumClientProps) {
  const [posts, setPosts] = useState<PostWithMeta[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE)
  const supabase = createClient()

  const fetchPosts = useCallback(async (offset: number = 0, append: boolean = false) => {
    setLoading(true)
    try {
      const { data: postsData, error } = await supabase
        .from('saif_forum_posts')
        .select('*, author:saif_people!saif_forum_posts_author_id_fkey(id, first_name, last_name, avatar_url, role)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      if (!postsData) return

      const postIds = postsData.map(p => p.id)

      const { data: reactionsData } = postIds.length > 0
        ? await supabase
            .from('saif_forum_reactions')
            .select('*')
            .in('post_id', postIds)
        : { data: [] }

      const { data: replyCounts } = postIds.length > 0
        ? await supabase
            .from('saif_forum_replies')
            .select('post_id')
            .in('post_id', postIds)
        : { data: [] }

      const newPosts: PostWithMeta[] = postsData.map(post => {
        const postReactions = (reactionsData as ForumReaction[] | null)?.filter(r => r.post_id === post.id) || []
        const replyCount = replyCounts?.filter(r => r.post_id === post.id).length || 0

        return {
          post: post as ForumPostWithAuthor,
          reactions: summarizeReactions(postReactions, currentUserId),
          replyCount,
        }
      })

      if (append) {
        setPosts(prev => [...prev, ...newPosts])
      } else {
        setPosts(newPosts)
      }

      setHasMore(postsData.length >= PAGE_SIZE)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, currentUserId])

  // Real-time subscription for new posts and deletions
  useEffect(() => {
    const channel = supabase
      .channel('forum-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'saif_forum_posts',
        },
        async (payload) => {
          const newPost = payload.new as ForumPostWithAuthor

          const { data } = await supabase
            .from('saif_forum_posts')
            .select('*, author:saif_people!saif_forum_posts_author_id_fkey(id, first_name, last_name, avatar_url, role)')
            .eq('id', newPost.id)
            .single()

          if (data) {
            setPosts(prev => {
              if (prev.some(p => p.post.id === data.id)) return prev
              return [{
                post: data as ForumPostWithAuthor,
                reactions: [],
                replyCount: 0,
              }, ...prev]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'saif_forum_posts',
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setPosts(prev => prev.filter(p => p.post.id !== deletedId))
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saif_forum_reactions',
        },
        () => {
          fetchPosts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchPosts])

  const handleLoadMore = () => {
    fetchPosts(posts.length, true)
  }

  const handlePostCreated = () => {
    fetchPosts()
  }

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.post.id !== postId))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Forum</h1>
        <p className="text-sm text-gray-500 mt-1">Share updates, ask questions, and connect with the community.</p>
      </div>

      {/* New post form */}
      <div className="mb-8">
        <NewPostForm
          currentUserId={currentUserId}
          onPostCreated={handlePostCreated}
        />
      </div>

      {/* Timeline feed */}
      <div className="relative">
        {/* Vertical timeline line */}
        {posts.length > 0 && (
          <div className="absolute left-0 top-6 bottom-0 w-px bg-gray-200" />
        )}

        {posts.map(({ post, reactions, replyCount }) => (
          <PostCard
            key={post.id}
            post={post}
            reactions={reactions}
            replyCount={replyCount}
            currentUserId={currentUserId}
            onDeleted={handlePostDeleted}
          />
        ))}

        {posts.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 text-sm">No posts yet. Be the first to share something!</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-6">
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        )}

        {hasMore && !loading && posts.length > 0 && (
          <div className="text-center py-6 relative">
            <button
              onClick={handleLoadMore}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all"
            >
              Load older posts
            </button>
          </div>
        )}
      </div>
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
