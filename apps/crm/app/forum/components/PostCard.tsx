'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReactionBar from './ReactionBar'
import ReplyThread from './ReplyThread'
import type { ForumPostWithAuthor, ReactionSummary } from '@/lib/types/database'

type PostCardProps = {
  post: ForumPostWithAuthor
  reactions: ReactionSummary[]
  replyCount: number
  currentUserId: string
  onDeleted: (postId: string) => void
}

export default function PostCard({ post, reactions, replyCount, currentUserId, onDeleted }: PostCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const isAuthor = post.author_id === currentUserId

  const authorName = post.author
    ? [post.author.first_name, post.author.last_name].filter(Boolean).join(' ')
    : 'Unknown'

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

  return (
    <div id={`post-${post.id}`} className="relative group">
      {/* Timeline connector dot */}
      <div className="absolute left-0 top-6 w-2.5 h-2.5 rounded-full bg-gray-300 group-hover:bg-gray-400 transition-colors -translate-x-[calc(50%+0.5px)] z-10" />

      <div className="pl-6 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{authorName}</span>
                  {post.author?.role === 'partner' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-900 text-white rounded font-medium">Partner</span>
                  )}
                  {post.author?.role === 'founder' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-medium">Founder</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
              </div>
            </div>

            {/* Actions menu (only for author) */}
            {isAuthor && (
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
