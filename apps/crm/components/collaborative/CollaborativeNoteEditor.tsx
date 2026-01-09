'use client'

import React, { useState, useEffect, useCallback, useRef, Component } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
  ClientSideSuspense,
  useSelf
} from '@/lib/liveblocks'
import { CollaborativeTiptapEditor } from './CollaborativeTiptapEditor'

// ============================================================================
// TYPES
// ============================================================================

export type NoteContext = {
  type: 'application' | 'investment' | 'person' | 'meeting'
  id: string  // applicationId, investmentId, personId, or meetingId
}

export type SavedNote = {
  id: string
  content: string
  meeting_date: string | null
  created_at: string
  updated_at?: string
  last_edited_by?: string
  last_edited_by_name?: string
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

type CollaborativeNoteEditorProps = {
  context: NoteContext
  userId: string
  userName: string
  showDatePicker?: boolean
  placeholder?: string
  minHeight?: string
  onNoteSaved?: () => void
}

// ============================================================================
// PRESENCE & TYPING INDICATORS
// ============================================================================

function PresenceIndicators() {
  const others = useOthers()
  const typingUsers = others.filter((user) => user.presence.isTyping)

  return (
    <div className="flex flex-col gap-2">
      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span>
            {typingUsers.map((user) => user.presence.name || 'Someone').join(', ')}
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </span>
        </div>
      )}

      {/* Connected users */}
      {others.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Also here:</span>
          <div className="flex -space-x-2">
            {others.slice(0, 5).map((user) => (
              <div
                key={user.connectionId}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-white"
                title={user.presence.name || 'Anonymous'}
              >
                <span className="text-white text-xs font-medium">
                  {(user.presence.name || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {others.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center ring-2 ring-white">
                <span className="text-gray-600 text-xs">+{others.length - 5}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SAVE STATUS INDICATOR
// ============================================================================

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'idle' && (
        <span className="text-gray-400">Ready</span>
      )}
      {status === 'unsaved' && (
        <>
          <span className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-yellow-600">Unsaved changes</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-blue-600">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-red-600">Error saving</span>
        </>
      )}
    </div>
  )
}

// ============================================================================
// MAIN EDITOR (INSIDE ROOM)
// ============================================================================

function EditorContent({
  context,
  userId,
  userName,
  showDatePicker = true,
  placeholder = "Type your notes here... Changes auto-save every 2 seconds.",
  minHeight = '300px',
  onNoteSaved,
}: CollaborativeNoteEditorProps) {
  const supabase = createClient()
  const updateMyPresence = useUpdateMyPresence()

  // Local content state - Yjs handles real-time sync, this is for database saving
  const [content, setContent] = useState('')

  // Local state
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [sharedNoteId, setSharedNoteId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Refs for save coordination
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')
  const isSavingRef = useRef(false)

  // Set initial presence
  useEffect(() => {
    updateMyPresence({ name: userName, isTyping: false, cursor: null })
  }, [userName, updateMyPresence])

  // Load existing shared note on mount
  useEffect(() => {
    const loadExistingNote = async () => {
      let data: { id: string; content: string; meeting_date: string | null } | null = null

      // Query the appropriate table based on context type
      if (context.type === 'application') {
        const result = await supabase
          .from('saifcrm_meeting_notes')
          .select('id, content, meeting_date')
          .eq('application_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'investment') {
        const result = await supabase
          .from('saifcrm_investment_notes')
          .select('id, content, meeting_date')
          .eq('investment_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'person') {
        const result = await supabase
          .from('saifcrm_people_notes')
          .select('id, content, meeting_date')
          .eq('person_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'meeting') {
        const result = await supabase
          .from('saif_meeting_notes')
          .select('id, content')
          .eq('meeting_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = { ...result.data, meeting_date: null }
      }

      if (data) {
        setSharedNoteId(data.id)
        if (data.meeting_date) {
          setMeetingDate(data.meeting_date)
        }
        // Note: Yjs will handle syncing the content from the shared document
        // We just need to track the last saved content for comparison
        lastSavedContentRef.current = data.content || ''
      }

      setIsInitialized(true)
    }

    loadExistingNote()
  }, [context.id, context.type, supabase])

  // Auto-save with debounce - triggered by content changes
  useEffect(() => {
    if (!isInitialized) return

    const trimmedContent = content.trim()

    // Nothing to save
    if (!trimmedContent && !sharedNoteId) {
      setSaveStatus('idle')
      return
    }

    // Content unchanged from last save
    if (trimmedContent === lastSavedContentRef.current) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('unsaved')

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new save timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(trimmedContent)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, isInitialized, sharedNoteId, meetingDate])

  // Save note function with conflict prevention
  const saveNote = async (content: string) => {
    // Prevent concurrent saves
    if (isSavingRef.current) return
    isSavingRef.current = true

    setSaveStatus('saving')

    try {
      if (sharedNoteId) {
        // Update existing shared note - use explicit table queries
        let error: Error | null = null

        if (context.type === 'application') {
          const result = await supabase
            .from('saifcrm_meeting_notes')
            .update({ content, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'investment') {
          const result = await supabase
            .from('saifcrm_investment_notes')
            .update({ content, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'person') {
          const result = await supabase
            .from('saifcrm_people_notes')
            .update({ content, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'meeting') {
          const result = await supabase
            .from('saif_meeting_notes')
            .update({ content })
            .eq('id', sharedNoteId)
          error = result.error
        }

        if (error) throw error
      } else if (content) {
        // Create new shared note - use explicit table queries
        let newNoteId: string | null = null
        let error: Error | null = null

        if (context.type === 'application') {
          const result = await supabase
            .from('saifcrm_meeting_notes')
            .insert({ application_id: context.id, content, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'investment') {
          const result = await supabase
            .from('saifcrm_investment_notes')
            .insert({ investment_id: context.id, content, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'person') {
          const result = await supabase
            .from('saifcrm_people_notes')
            .insert({ person_id: context.id, content, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'meeting') {
          const result = await supabase
            .from('saif_meeting_notes')
            .insert({ meeting_id: context.id, content, author_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        }

        if (error) throw error
        if (newNoteId) {
          setSharedNoteId(newNoteId)
        }
      }

      lastSavedContentRef.current = content
      setSaveStatus('saved')
      onNoteSaved?.()

    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }

  // Handle content change from Tiptap editor
  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    // Typing presence is now handled by the Tiptap editor itself
  }, [])

  const handleBlur = useCallback(() => {
    updateMyPresence({ isTyping: false })
  }, [updateMyPresence])

  // Save current note and start a fresh one
  const handleSaveAndStartNew = useCallback(async () => {
    const trimmedContent = content.trim()

    // If there's content, make sure it's saved first
    if (trimmedContent && trimmedContent !== lastSavedContentRef.current) {
      await saveNote(trimmedContent)
    }

    // Only start new if there was actually content
    if (trimmedContent) {
      // Clear the local content (Yjs document will need to be cleared separately if needed)
      setContent('')

      // Reset state for a new note
      setSharedNoteId(null)
      setMeetingDate(new Date().toISOString().split('T')[0])
      lastSavedContentRef.current = ''
      setSaveStatus('idle')

      // Trigger refresh of notes list
      onNoteSaved?.()
    }
  }, [content, onNoteSaved])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header with date picker and status */}
      <div className="flex items-center gap-4 mb-4">
        {showDatePicker && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input"
            />
          </div>
        )}
        <div className={`flex items-center gap-3 ${showDatePicker ? 'pt-6' : ''}`}>
          <SaveStatusIndicator status={saveStatus} />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live sync</span>
          </div>
          {content.trim() && (
            <button
              onClick={handleSaveAndStartNew}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Save this note and start a new one"
            >
              Save & New
            </button>
          )}
        </div>
      </div>

      {/* Collaborative Tiptap editor with Yjs */}
      <CollaborativeTiptapEditor
        onContentChange={handleContentChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        minHeight={minHeight}
      />

      {/* Presence indicators */}
      <div className="mt-3">
        <PresenceIndicators />
      </div>
    </div>
  )
}

// ============================================================================
// ERROR BOUNDARY FOR LIVEBLOCKS
// ============================================================================

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

class LiveblocksErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Liveblocks] Error in collaborative editor:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ============================================================================
// ROOM WRAPPER
// ============================================================================

function EditorWithRoom(props: CollaborativeNoteEditorProps) {
  const roomId = `notes-${props.context.type}-${props.context.id}`

  return (
    <LiveblocksErrorBoundary fallback={<EditorWithoutLiveblocks {...props} />}>
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null, name: props.userName, isTyping: false }}
        initialStorage={{ draft: '' }}
      >
        <ClientSideSuspense fallback={
          <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4 w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        }>
          {() => <EditorContent {...props} />}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksErrorBoundary>
  )
}

// ============================================================================
// FALLBACK WITHOUT LIVEBLOCKS
// ============================================================================

function EditorWithoutLiveblocks({
  context,
  userId,
  userName,
  showDatePicker = true,
  placeholder = "Type your notes here... Changes auto-save every 2 seconds.",
  minHeight = '300px',
  onNoteSaved,
}: CollaborativeNoteEditorProps) {
  const supabase = createClient()

  const [content, setContent] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [sharedNoteId, setSharedNoteId] = useState<string | null>(null)

  const contentRef = useRef('')
  const lastSavedContentRef = useRef('')

  // Load existing note
  useEffect(() => {
    const loadExistingNote = async () => {
      let data: { id: string; content: string; meeting_date: string | null } | null = null

      // Query the appropriate table based on context type
      if (context.type === 'application') {
        const result = await supabase
          .from('saifcrm_meeting_notes')
          .select('id, content, meeting_date')
          .eq('application_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'investment') {
        const result = await supabase
          .from('saifcrm_investment_notes')
          .select('id, content, meeting_date')
          .eq('investment_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'person') {
        const result = await supabase
          .from('saifcrm_people_notes')
          .select('id, content, meeting_date')
          .eq('person_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = result.data
      } else if (context.type === 'meeting') {
        const result = await supabase
          .from('saif_meeting_notes')
          .select('id, content')
          .eq('meeting_id', context.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!result.error) data = { ...result.data, meeting_date: null }
      }

      if (data) {
        setSharedNoteId(data.id)
        setContent(data.content || '')
        contentRef.current = data.content || ''
        lastSavedContentRef.current = data.content || ''
        if (data.meeting_date) {
          setMeetingDate(data.meeting_date)
        }
      }
    }

    loadExistingNote()
  }, [context.id, context.type, supabase])

  // Auto-save
  useEffect(() => {
    const trimmedContent = content.trim()

    if (!trimmedContent && !sharedNoteId) {
      setSaveStatus('idle')
      return
    }

    if (trimmedContent === lastSavedContentRef.current) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('unsaved')
    contentRef.current = content

    const timer = setTimeout(async () => {
      await saveNote()
    }, 2000)

    return () => clearTimeout(timer)
  }, [content, meetingDate])

  const saveNote = async () => {
    const noteContent = contentRef.current.trim()
    if (!noteContent && !sharedNoteId) return

    setSaveStatus('saving')

    try {
      if (sharedNoteId) {
        // Update existing note - use explicit table queries
        let error: Error | null = null

        if (context.type === 'application') {
          const result = await supabase
            .from('saifcrm_meeting_notes')
            .update({ content: noteContent, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'investment') {
          const result = await supabase
            .from('saifcrm_investment_notes')
            .update({ content: noteContent, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'person') {
          const result = await supabase
            .from('saifcrm_people_notes')
            .update({ content: noteContent, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'meeting') {
          const result = await supabase
            .from('saif_meeting_notes')
            .update({ content: noteContent })
            .eq('id', sharedNoteId)
          error = result.error
        }

        if (error) throw error
      } else if (noteContent) {
        // Create new note - use explicit table queries
        let newNoteId: string | null = null
        let error: Error | null = null

        if (context.type === 'application') {
          const result = await supabase
            .from('saifcrm_meeting_notes')
            .insert({ application_id: context.id, content: noteContent, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'investment') {
          const result = await supabase
            .from('saifcrm_investment_notes')
            .insert({ investment_id: context.id, content: noteContent, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'person') {
          const result = await supabase
            .from('saifcrm_people_notes')
            .insert({ person_id: context.id, content: noteContent, meeting_date: meetingDate, user_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'meeting') {
          const result = await supabase
            .from('saif_meeting_notes')
            .insert({ meeting_id: context.id, content: noteContent, author_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        }

        if (error) throw error
        if (newNoteId) {
          setSharedNoteId(newNoteId)
        }
      }

      lastSavedContentRef.current = noteContent
      setSaveStatus('saved')
      onNoteSaved?.()
    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    }
  }

  // Save current note and start a fresh one
  const handleSaveAndStartNew = async () => {
    const noteContent = content.trim()

    // If there's content, make sure it's saved first
    if (noteContent && noteContent !== lastSavedContentRef.current) {
      await saveNote()
    }

    // Only start new if there was actually content
    if (noteContent) {
      // Reset state for a new note
      setContent('')
      setSharedNoteId(null)
      setMeetingDate(new Date().toISOString().split('T')[0])
      contentRef.current = ''
      lastSavedContentRef.current = ''
      setSaveStatus('idle')

      // Trigger refresh of notes list
      onNoteSaved?.()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-4 mb-4">
        {showDatePicker && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input"
            />
          </div>
        )}
        <div className={`flex items-center gap-3 ${showDatePicker ? 'pt-6' : ''}`}>
          <SaveStatusIndicator status={saveStatus} />
          {content.trim() && (
            <button
              onClick={handleSaveAndStartNew}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Save this note and start a new one"
            >
              Save & New
            </button>
          )}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        className="input resize-y w-full"
        style={{ minHeight }}
        placeholder={placeholder}
      />
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function CollaborativeNoteEditor(props: CollaborativeNoteEditorProps) {
  const hasLiveblocks = !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY

  if (!hasLiveblocks) {
    return <EditorWithoutLiveblocks {...props} />
  }

  return <EditorWithRoom {...props} />
}
