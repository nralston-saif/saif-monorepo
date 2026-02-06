'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ReactionEmoji, ReactionSummary } from '@/lib/types/database'

const EMOJI_MAP: Record<ReactionEmoji, string> = {
  thumbsup: '\uD83D\uDC4D',
  heart: '\u2764\uFE0F',
  tada: '\uD83C\uDF89',
  bulb: '\uD83D\uDCA1',
}

const EMOJI_ORDER: ReactionEmoji[] = ['thumbsup', 'heart', 'tada', 'bulb']

type ReactionBarProps = {
  postId?: string
  replyId?: string
  reactions: ReactionSummary[]
  currentUserId: string
}

export default function ReactionBar({ postId, replyId, reactions, currentUserId }: ReactionBarProps) {
  const [localReactions, setLocalReactions] = useState<ReactionSummary[]>(reactions)
  const [loading, setLoading] = useState<ReactionEmoji | null>(null)
  const supabase = createClient()

  const handleToggle = async (emoji: ReactionEmoji) => {
    if (loading) return
    setLoading(emoji)

    const existing = localReactions.find(r => r.emoji === emoji)
    const wasReacted = existing?.reacted || false

    // Optimistic update
    setLocalReactions(prev => {
      return EMOJI_ORDER.map(e => {
        const current = prev.find(r => r.emoji === e) || { emoji: e, count: 0, reacted: false }
        if (e !== emoji) return current
        return {
          emoji: e,
          count: wasReacted ? Math.max(0, current.count - 1) : current.count + 1,
          reacted: !wasReacted,
        }
      }).filter(r => r.count > 0 || r.reacted)
    })

    try {
      if (wasReacted) {
        // Remove reaction
        let query = supabase
          .from('saif_forum_reactions')
          .delete()
          .eq('user_id', currentUserId)
          .eq('emoji', emoji)

        if (postId) query = query.eq('post_id', postId)
        if (replyId) query = query.eq('reply_id', replyId)

        await query
      } else {
        // Add reaction
        await supabase.from('saif_forum_reactions').insert({
          user_id: currentUserId,
          post_id: postId || null,
          reply_id: replyId || null,
          emoji,
        })
      }
    } catch (error) {
      // Revert on error
      setLocalReactions(reactions)
      console.error('Error toggling reaction:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EMOJI_ORDER.map(emoji => {
        const reaction = localReactions.find(r => r.emoji === emoji)
        const count = reaction?.count || 0
        const reacted = reaction?.reacted || false

        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            disabled={loading === emoji}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
              reacted
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
            } ${count === 0 && !reacted ? 'opacity-60 hover:opacity-100' : ''}`}
            title={emoji}
          >
            <span className="text-sm">{EMOJI_MAP[emoji]}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
