'use client'

import { useCallback, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { isChangeOrigin } from '@tiptap/extension-collaboration'
import { useLiveblocksExtension } from '@liveblocks/react-tiptap'
import { useSelf, useUpdateMyPresence } from '@/lib/liveblocks'
import type { Transaction } from '@tiptap/pm/state'

export type CollaborativeTiptapEditorHandle = {
  clearContent: () => void
}

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
  /** Trigger to clear the editor content */
  clearTrigger?: number
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
  clearTrigger = 0,
}: CollaborativeTiptapEditorProps) {
  const self = useSelf()
  const updateMyPresence = useUpdateMyPresence()

  // Get user info for cursor display
  const userName = self?.info?.name || self?.presence?.name || 'Anonymous'
  const userColor = useMemo(() => getUserColor(userName), [userName])

  // Use Liveblocks extension which handles Yjs internally
  const liveblocks = useLiveblocksExtension()

  // Content change handler - only triggers for LOCAL changes
  // Remote Yjs syncs are filtered out to prevent all users from triggering auto-save
  const handleUpdate = useCallback(({ editor, transaction }: { editor: any; transaction: Transaction }) => {
    // isChangeOrigin returns true if the change came from Yjs sync (remote)
    // We only want to trigger content change callback for local edits
    if (isChangeOrigin(transaction)) {
      return // Skip remote changes - don't trigger auto-save for synced content
    }

    // Get text and normalize excessive newlines (3+ newlines → 2)
    // This prevents empty paragraphs from creating large gaps in saved content
    const text = editor.getText().replace(/\n{3,}/g, '\n\n')
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
      StarterKit,
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
      handleKeyDown: (view, event) => {
        // Handle Tab key for indentation
        if (event.key === 'Tab') {
          event.preventDefault()
          view.dispatch(view.state.tr.insertText('\t'))
          return true
        }
        return false
      },
    },
    onUpdate: handleUpdate,
    onFocus: handleFocus,
    onBlur: handleBlurCallback,
    immediatelyRender: false,
  })

  // Clear editor content when clearTrigger changes
  useEffect(() => {
    if (clearTrigger > 0 && editor) {
      editor.commands.clearContent()
    }
  }, [clearTrigger, editor])

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
