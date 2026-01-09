'use client'

import { useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useLiveblocksExtension } from '@liveblocks/react-tiptap'
import { useSelf, useUpdateMyPresence } from '@/lib/liveblocks'

type CollaborativeTiptapEditorProps = {
  /** Callback when content changes (plain text for database saving) */
  onContentChange?: (content: string) => void
  /** Callback when user starts/stops typing */
  onTypingChange?: (isTyping: boolean) => void
  /** Callback when editor loses focus */
  onBlur?: () => void
  /** Placeholder text */
  placeholder?: string
  /** Minimum height of the editor */
  minHeight?: string
  /** Additional CSS class */
  className?: string
}

// Generate a consistent color for a user based on their name
function getUserColor(name: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function CollaborativeTiptapEditor({
  onContentChange,
  onTypingChange,
  onBlur,
  placeholder = 'Start typing your notes...',
  minHeight = '300px',
  className = '',
}: CollaborativeTiptapEditorProps) {
  const self = useSelf()
  const updateMyPresence = useUpdateMyPresence()

  // Get user info for cursor display
  const userName = self?.info?.name || self?.presence?.name || 'Anonymous'
  const userColor = useMemo(() => getUserColor(userName), [userName])

  // Use Liveblocks extension which handles Yjs internally
  const liveblocks = useLiveblocksExtension()

  // Content change handler
  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    const text = editor.getText()
    onContentChange?.(text)
  }, [onContentChange])

  // Handle typing status
  const handleFocus = useCallback(() => {
    onTypingChange?.(true)
    updateMyPresence({ isTyping: true })
  }, [onTypingChange, updateMyPresence])

  const handleBlurCallback = useCallback(() => {
    onTypingChange?.(false)
    updateMyPresence({ isTyping: false })
    onBlur?.()
  }, [onTypingChange, updateMyPresence, onBlur])

  const editor = useEditor({
    extensions: [
      liveblocks,
      StarterKit.configure({
        // Liveblocks extension handles history
        history: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none prose prose-sm max-w-none',
        style: `min-height: calc(${minHeight} - 24px)`,
      },
    },
    onUpdate: handleUpdate,
    onFocus: handleFocus,
    onBlur: handleBlurCallback,
    immediatelyRender: false,
  })

  return (
    <div
      className={`tiptap-editor border border-gray-300 rounded-lg bg-white overflow-hidden ${className}`}
      style={{ minHeight }}
    >
      <EditorContent
        editor={editor}
        className="p-3 h-full"
      />
    </div>
  )
}
