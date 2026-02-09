'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReactionBar from './ReactionBar'
import ReplyThread from './ReplyThread'
import type { ForumPostWithAuthor, ReactionSummary, ForumTagData } from '@/lib/types/database'

type PostCardProps = {
  post: ForumPostWithAuthor
  reactions: ReactionSummary[]
  replyCount: number
  currentUserId: string
  currentUserRole: string
  companyName: string | null
  forumTags: ForumTagData[]
  onDeleted: (postId: string) => void
  onPinned: (postId: string, pinned: boolean) => void
  onTagClick: (tagName: string) => void
}

export default function PostCard({
  post,
  reactions,
  replyCount,
  currentUserId,
  currentUserRole,
  companyName,
  forumTags,
  onDeleted,
  onPinned,
  onTagClick,
}: PostCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pinning, setPinning] = useState(false)
  const supabase = createClient()

  const isAuthor = post.author_id === currentUserId
  const isPartner = currentUserRole === 'partner'
  const showMenu_ = isAuthor || isPartner

  const authorName = post.author
    ? [post.author.first_name, post.author.last_name].filter(Boolean).join(' ')
    : 'Unknown'

  const tagColorMap: Record<string, string> = {}
  for (const t of forumTags) {
    if (t.color) tagColorMap[t.name] = t.color
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderContent = (text: string) => {
    const parts = text.split(/(@\w+(?:\s\w+)?)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-blue-600 font-medium">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('saif_forum_posts')
        .delete()
        .eq('id', post.id)

      if (error) throw error
      onDeleted(post.id)
    } catch (error) {
      console.error('Error deleting post:', error)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleTogglePin = async () => {
    setPinning(true)
    try {
      const newPinned = !post.is_pinned
      const { error } = await supabase
        .from('saif_forum_posts')
        .update({
          is_pinned: newPinned,
          pinned_at: newPinned ? new Date().toISOString() : null,
          pinned_by: newPinned ? currentUserId : null,
        })
        .eq('id', post.id)

      if (error) throw error
      onPinned(post.id, newPinned)
      setShowMenu(false)
    } catch (error) {
      console.error('Error toggling pin:', error)
    } finally {
      setPinning(false)
    }
  }

  return (
    <div id={`post-${post.id}`} className="relative group">
      {/* Timeline connector dot */}
      <div className={`absolute left-0 top-6 w-2.5 h-2.5 rounded-full transition-colors -translate-x-[calc(50%+0.5px)] z-10 ${
        post.is_pinned ? 'bg-amber-400 group-hover:bg-amber-500' : 'bg-gray-300 group-hover:bg-gray-400'
      }`} />

      <div className="pl-6 pb-8">
        <div className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${
          post.is_pinned
            ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-gray-200'
        }`}>
          {/* Pin badge */}
          {post.is_pinned && (
            <div className="flex items-center gap-1.5 mb-3 text-amber-700">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="text-xs font-medium">Pinned</span>
            </div>
          )}

          {/* Author header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-medium text-white flex-shrink-0 overflow-hidden">
                {post.author?.avatar_url ? (
                  <img src={post.author.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  authorName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{authorName}</span>
                  {companyName && (
                    <span className="text-xs text-gray-400">{companyName}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
              </div>
            </div>

            {/* Actions menu (for author or partner) */}
            {showMenu_ && (
              <div className="relative">
                <button
                  onClick={() => { setShowMenu(!showMenu); setConfirmDelete(false) }}
                  className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => { setShowMenu(false); setConfirmDelete(false) }} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-20">
                      {/* Pin/Unpin (partners only) */}
                      {isPartner && (
                        <button
                          onClick={handleTogglePin}
                          disabled={pinning}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {pinning ? '...' : post.is_pinned ? 'Unpin post' : 'Pin post'}
                        </button>
                      )}

                      {/* Delete (author only) */}
                      {isAuthor && (
                        <>
                          {!confirmDelete ? (
                            <button
                              onClick={() => setConfirmDelete(true)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete post
                            </button>
                          ) : (
                            <div className="px-3 py-2">
                              <p className="text-xs text-gray-500 mb-2">Are you sure?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleDelete}
                                  disabled={deleting}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {deleting ? '...' : 'Delete'}
                                </button>
                                <button
                                  onClick={() => { setConfirmDelete(false); setShowMenu(false) }}
                                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Post content */}
          <div className="mt-3 text-[15px] text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {renderContent(post.content)}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-full text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: tagColorMap[tag] || '#6b7280' }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Reactions + Replies row */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4">
            <ReactionBar
              postId={post.id}
              reactions={reactions}
              currentUserId={currentUserId}
            />
          </div>

          {/* Replies */}
          <ReplyThread
            postId={post.id}
            currentUserId={currentUserId}
            replyCount={replyCount}
          />
        </div>
      </div>
    </div>
  )
}
