'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReplyForm from './ReplyForm'
import ReactionBar from './ReactionBar'
import type { ForumReplyWithAuthor, ReactionSummary, ReactionEmoji, ForumReaction } from '@/lib/types/database'

type ReplyThreadProps = {
  postId: string
  currentUserId: string
  replyCount: number
}

export default function ReplyThread({ postId, currentUserId, replyCount }: ReplyThreadProps) {
  const [expanded, setExpanded] = useState(false)
  const [replies, setReplies] = useState<ForumReplyWithAuthor[]>([])
  const [replyReactions, setReplyReactions] = useState<Record<string, ReactionSummary[]>>({})
  const [loading, setLoading] = useState(false)
  const [localReplyCount, setLocalReplyCount] = useState(replyCount)
  const supabase = createClient()

  const fetchReplies = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('saif_forum_replies')
        .select('*, author:saif_people!saif_forum_replies_author_id_fkey(id, first_name, last_name, avatar_url, role)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setReplies((data as ForumReplyWithAuthor[]) || [])

      // Fetch reactions for all replies
      if (data && data.length > 0) {
        const replyIds = data.map(r => r.id)
        const { data: reactionsData } = await supabase
          .from('saif_forum_reactions')
          .select('*')
          .in('reply_id', replyIds)

        if (reactionsData) {
          const grouped: Record<string, ReactionSummary[]> = {}
          for (const reply of data) {
            const replyReacts = (reactionsData as ForumReaction[]).filter(r => r.reply_id === reply.id)
            grouped[reply.id] = summarizeReactions(replyReacts, currentUserId)
          }
          setReplyReactions(grouped)
        }
      }
    } catch (error) {
      console.error('Error fetching replies:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = () => {
    if (!expanded) {
      fetchReplies()
    }
    setExpanded(!expanded)
  }

  // Real-time subscription for new replies
  useEffect(() => {
    if (!expanded) return

    const channel = supabase
      .channel(`replies-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'saif_forum_replies',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchReplies()
          setLocalReplyCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [expanded, postId, supabase])

  const handleReplyCreated = () => {
    fetchReplies()
    setLocalReplyCount(prev => prev + 1)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        onClick={toggleExpanded}
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {localReplyCount === 0
          ? 'Reply'
          : `${localReplyCount} ${localReplyCount === 1 ? 'reply' : 'replies'}`}
      </button>

      {/* Expanded reply thread */}
      {expanded && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200">
          {loading && replies.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">Loading replies...</div>
          ) : (
            <>
              {replies.map(reply => {
                const authorName = reply.author
                  ? [reply.author.first_name, reply.author.last_name].filter(Boolean).join(' ')
                  : 'Unknown'

                return (
                  <div key={reply.id} className="py-2 first:pt-0">
                    <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                        {reply.author?.avatar_url ? (
                          <img src={reply.author.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          reply.author?.first_name?.charAt(0) || '?'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{authorName}</span>
                          {reply.author?.role === 'partner' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Partner</span>
                          )}
                          <span className="text-xs text-gray-400">{formatTime(reply.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{reply.content}</p>
                        <div className="mt-1.5">
                          <ReactionBar
                            replyId={reply.id}
                            reactions={replyReactions[reply.id] || []}
                            currentUserId={currentUserId}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          <ReplyForm
            postId={postId}
            currentUserId={currentUserId}
            onReplyCreated={handleReplyCreated}
          />
        </div>
      )}
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
