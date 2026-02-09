'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import MentionInput from './MentionInput'
import type { ForumTagData } from '@/lib/types/database'

type NewPostFormProps = {
  currentUserId: string
  onPostCreated: () => void
  forumTags: ForumTagData[]
}

export default function NewPostForm({ currentUserId, onPostCreated, forumTags }: NewPostFormProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const tagColorMap: Record<string, string> = {}
  for (const t of forumTags) {
    if (t.color) tagColorMap[t.name] = t.color
  }

  // Filter suggestions: predefined tags not already selected, matching input
  const filteredTags = forumTags.filter(
    t => !selectedTags.includes(t.name) && t.name.toLowerCase().includes(tagInput.toLowerCase())
  )

  // Check if input matches an existing tag name exactly (case-insensitive)
  const exactMatch = forumTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase())
  const showCreateOption = tagInput.trim() && !exactMatch && !selectedTags.includes(tagInput.trim())

  const addTag = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags(prev => [...prev, tagName])
    }
    setTagInput('')
    setShowDropdown(false)
  }

  const removeTag = (tagName: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagName))
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return

    setSubmitting(true)
    try {
      const { data: post, error } = await supabase
        .from('saif_forum_posts')
        .insert({
          author_id: currentUserId,
          content: content.trim(),
          tags: selectedTags,
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
      setSelectedTags([])
      setTagInput('')
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
        placeholder="Share something with the community... Use @ to mention people"
        autoFocus={true}
        minRows={3}
      />

      {/* Tag selector */}
      <div className="mt-3 relative" ref={dropdownRef}>
        <div
          className="flex items-center gap-2 flex-wrap px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-text focus-within:border-gray-400 focus-within:bg-white transition-colors"
          onClick={() => inputRef.current?.focus()}
        >
          {/* Tag icon */}
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>

          {/* Selected tag pills */}
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tagColorMap[tag] || '#6b7280' }}
            >
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                className="hover:opacity-70 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}

          {/* Tag input */}
          <input
            ref={inputRef}
            type="text"
            value={tagInput}
            onChange={e => { setTagInput(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault()
                addTag(tagInput.trim())
              }
              if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
                removeTag(selectedTags[selectedTags.length - 1])
              }
            }}
            placeholder={selectedTags.length === 0 ? 'Add tags...' : 'Add more...'}
            className="flex-1 min-w-[100px] text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
          />

          {/* Chevron */}
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown */}
        {showDropdown && (filteredTags.length > 0 || showCreateOption) && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30 max-h-48 overflow-y-auto">
            {filteredTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color || '#6b7280' }}
                />
                {tag.name}
              </button>
            ))}
            {showCreateOption && (
              <button
                type="button"
                onClick={() => addTag(tagInput.trim())}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-blue-400 border-dashed" />
                Create &ldquo;{tagInput.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => { setOpen(false); setContent(''); setMentionedIds([]); setSelectedTags([]); setTagInput('') }}
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
