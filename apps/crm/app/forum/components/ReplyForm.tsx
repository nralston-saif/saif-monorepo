'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MentionInput from './MentionInput'

type ReplyFormProps = {
  postId: string
  currentUserId: string
  onReplyCreated: () => void
}

export default function ReplyForm({ postId, currentUserId, onReplyCreated }: ReplyFormProps) {
  const [content, setContent] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return

    setSubmitting(true)
    try {
      // Create the reply
      const { data: reply, error } = await supabase
        .from('saif_forum_replies')
        .insert({
          post_id: postId,
          author_id: currentUserId,
          content: content.trim(),
        })
        .select('id')
        .single()

      if (error) throw error

      // Create mentions if any
      if (mentionedIds.length > 0 && reply) {
        await supabase.from('saif_forum_mentions').insert(
          mentionedIds.map(id => ({
            mentioned_person_id: id,
            reply_id: reply.id,
          }))
        )
      }

      // Send notifications
      if (reply) {
        try {
          await fetch('/api/forum/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'reply',
              postId,
              replyId: reply.id,
              actorId: currentUserId,
              mentionedIds,
            }),
          })
        } catch {
          // Non-blocking
        }
      }

      setContent('')
      setMentionedIds([])
      onReplyCreated()
    } catch (error) {
      console.error('Error creating reply:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <MentionInput
        value={content}
        onChange={setContent}
        onMentionsChange={setMentionedIds}
        placeholder="Write a reply..."
        minRows={2}
      />
      <div className="flex justify-end mt-2">
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="px-3 py-1.5 bg-[#1a1a1a] text-white text-sm rounded-lg hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Replying...' : 'Reply'}
        </button>
      </div>
    </form>
  )
}
