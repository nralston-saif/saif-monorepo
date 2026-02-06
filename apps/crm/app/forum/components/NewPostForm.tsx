'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MentionInput from './MentionInput'

type NewPostFormProps = {
  currentUserId: string
  onPostCreated: () => void
}

export default function NewPostForm({ currentUserId, onPostCreated }: NewPostFormProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return

    setSubmitting(true)
    try {
      // Create the post
      const { data: post, error } = await supabase
        .from('saif_forum_posts')
        .insert({
          author_id: currentUserId,
          content: content.trim(),
        })
        .select('id')
        .single()

      if (error) throw error

      // Create mentions if any
      if (mentionedIds.length > 0 && post) {
        await supabase.from('saif_forum_mentions').insert(
          mentionedIds.map(id => ({
            mentioned_person_id: id,
            post_id: post.id,
          }))
        )
      }

      // Send notifications for mentions
      if (mentionedIds.length > 0 && post) {
        try {
          await fetch('/api/forum/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'mention',
              postId: post.id,
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
      setOpen(false)
      onPostCreated()
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New post
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <MentionInput
        value={content}
        onChange={setContent}
        onMentionsChange={setMentionedIds}
        placeholder="Share something with the community..."
        autoFocus={true}
        minRows={3}
      />
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => { setOpen(false); setContent(''); setMentionedIds([]) }}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded-lg hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  )
}
