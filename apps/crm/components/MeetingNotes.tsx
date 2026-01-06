'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomProvider, useOthers, useUpdateMyPresence, useStorage, useMutation, ClientSideSuspense } from '@/lib/liveblocks'

type MeetingNote = {
  id: string
  application_id: string
  user_id: string
  content: string
  meeting_date: string
  created_at: string
  updated_at?: string
  user_name?: string
}

type MeetingNotesProps = {
  applicationId: string
  userId: string
  userName: string
  deliberationNotes?: string | null
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

// Collaborative text area component with real-time sync
function CollaborativeTextArea({
  userName,
  onContentChange,
  onSetDraft,
}: {
  userName: string
  onContentChange: (value: string) => void
  onSetDraft?: (setter: (value: string) => void) => void
}) {
  const updateMyPresence = useUpdateMyPresence()
  const others = useOthers()

  // Read shared draft from Liveblocks storage
  const draft = useStorage((root) => root.draft) || ''

  // Mutation to update the shared draft
  const updateDraft = useMutation(({ storage }, newDraft: string) => {
    storage.set('draft', newDraft)
  }, [])

  // Expose the updateDraft function to parent for editing existing notes
  useEffect(() => {
    if (onSetDraft) {
      onSetDraft(updateDraft)
    }
  }, [onSetDraft, updateDraft])

  // Get who is typing
  const typingUsers = others.filter((user) => user.presence.isTyping)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    updateDraft(newValue)
    onContentChange(newValue)
    updateMyPresence({ isTyping: true })
  }

  const handleBlur = () => {
    updateMyPresence({ isTyping: false })
  }

  // Set initial presence
  useEffect(() => {
    updateMyPresence({ name: userName, isTyping: false, cursor: null })
  }, [userName, updateMyPresence])

  // Sync content changes to parent
  useEffect(() => {
    onContentChange(draft)
  }, [draft, onContentChange])

  return (
    <div className="relative">
      <textarea
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={12}
        className="input resize-y w-full min-h-[300px]"
        placeholder="Type your meeting notes here... Changes auto-save every 2 seconds."
      />

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
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

      {/* Show connected users */}
      {others.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
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

// Save status indicator component
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

// Main meeting notes input component (inside RoomProvider)
function MeetingNotesInput({
  applicationId,
  userId,
  userName,
  editingNote,
  onEditComplete,
  onNoteAdded,
}: {
  applicationId: string
  userId: string
  userName: string
  editingNote: MeetingNote | null
  onEditComplete: () => void
  onNoteAdded: () => void
}) {
  const [meetingDate, setMeetingDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)
  const supabase = createClient()

  // Ref to track the latest draft content (fixes sync bug)
  const draftRef = useRef('')
  const setDraftRef = useRef<((value: string) => void) | null>(null)

  // Mutation to clear the shared draft
  const clearDraft = useMutation(({ storage }) => {
    storage.set('draft', '')
  }, [])

  // Update meeting date when editing a note
  useEffect(() => {
    if (editingNote) {
      setMeetingDate(editingNote.meeting_date)
      setLastSavedNoteId(editingNote.id)
      // Load the note content into the draft
      if (setDraftRef.current) {
        setDraftRef.current(editingNote.content)
      }
    }
  }, [editingNote])

  // Auto-save effect with debounce
  useEffect(() => {
    const content = draftRef.current
    if (!content.trim()) {
      setSaveStatus('idle')
      return
    }

    setSaveStatus('unsaved')

    const timer = setTimeout(async () => {
      await saveNote()
    }, 2000)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftVersion, meetingDate])

  const saveNote = async () => {
    const content = draftRef.current.trim()
    if (!content) return

    setSaveStatus('saving')
    try {
      if (lastSavedNoteId || editingNote) {
        // Update existing note
        const noteId = lastSavedNoteId || editingNote!.id
        const { error } = await supabase
          .from('saifcrm_meeting_notes')
          .update({
            content,
            meeting_date: meetingDate,
          })
          .eq('id', noteId)

        if (error) throw error
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('saifcrm_meeting_notes')
          .insert({
            application_id: applicationId,
            user_id: userId,
            content,
            meeting_date: meetingDate,
          })
          .select('id')
          .single()

        if (error) throw error
        if (data) {
          setLastSavedNoteId(data.id)
        }
      }

      setSaveStatus('saved')
      onNoteAdded()

      // Keep showing 'saved' status
      setTimeout(() => {
        if (draftRef.current.trim() === content) {
          setSaveStatus('saved')
        }
      }, 1000)
    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    }
  }

  const handleContentChange = useCallback((value: string) => {
    draftRef.current = value
    // Increment version to trigger auto-save effect
    setDraftVersion((v) => v + 1)
  }, [])

  const handleSetDraft = useCallback((setter: (value: string) => void) => {
    setDraftRef.current = setter
  }, [])

  const handleNewNote = () => {
    clearDraft()
    draftRef.current = ''
    setLastSavedNoteId(null)
    setMeetingDate(new Date().toISOString().split('T')[0])
    setSaveStatus('idle')
    setDraftVersion(0)
    onEditComplete()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-4 mb-4">
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
        <div className="flex items-center gap-3 pt-6">
          <SaveStatusIndicator status={saveStatus} />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live sync</span>
          </div>
        </div>
      </div>

      {(editingNote || lastSavedNoteId) && (
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {editingNote ? 'Editing note' : 'Current note'}
          </span>
          <button
            onClick={handleNewNote}
            className="btn btn-secondary text-sm"
          >
            + New Note
          </button>
        </div>
      )}

      <CollaborativeTextArea
        userName={userName}
        onContentChange={handleContentChange}
        onSetDraft={handleSetDraft}
      />
    </div>
  )
}

// Notes list component with real-time updates
function NotesList({
  applicationId,
  refreshTrigger,
  deliberationNotes,
  onEditNote,
  editingNoteId,
}: {
  applicationId: string
  refreshTrigger: number
  deliberationNotes?: string | null
  onEditNote: (note: MeetingNote) => void
  editingNoteId: string | null
}) {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('saifcrm_meeting_notes')
      .select('*, author:saif_people!meeting_notes_user_id_fkey(name, first_name, last_name)')
      .eq('application_id', applicationId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching meeting notes:', error)
    }

    if (!error && data) {
      setNotes(
        data.map((note: any) => {
          const author = note.author
          const authorName = author?.first_name && author?.last_name
            ? `${author.first_name} ${author.last_name}`
            : author?.name || 'Unknown'
          return {
            ...note,
            user_name: authorName,
          }
        })
      )
    }
    setLoading(false)
  }, [applicationId, supabase])

  // Initial fetch
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes, refreshTrigger])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`meeting_notes:${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saifcrm_meeting_notes',
          filter: `application_id=eq.${applicationId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [applicationId, supabase, fetchNotes])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (notes.length === 0 && !deliberationNotes) {
    return (
      <div className="text-center py-8 text-gray-500">
        No meeting notes yet. Start typing above to create your first note!
      </div>
    )
  }

  // Group notes by date
  const groupedNotes: { [date: string]: MeetingNote[] } = {}
  notes.forEach((note) => {
    const date = note.meeting_date
    if (!groupedNotes[date]) {
      groupedNotes[date] = []
    }
    groupedNotes[date].push(note)
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Deliberation Notes (imported from spreadsheet) */}
      {deliberationNotes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Imported Notes
          </h4>
          <p className="text-amber-900 whitespace-pre-wrap">{deliberationNotes}</p>
        </div>
      )}

      {Object.entries(groupedNotes).map(([date, dateNotes]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(date)}
          </h4>
          <div className="space-y-3">
            {dateNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => onEditNote(note)}
                className={`bg-gray-50 rounded-lg p-4 border cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm ${
                  editingNoteId === note.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {(note.user_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{note.user_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{formatTime(note.created_at)}</p>
                  </div>
                  <span className="text-xs text-gray-400">Click to edit</span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Wrapper component that provides the Liveblocks room
function MeetingNotesWithRoom({ applicationId, userId, userName, deliberationNotes }: MeetingNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null)

  const handleNoteAdded = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleEditNote = (note: MeetingNote) => {
    setEditingNote(note)
  }

  const handleEditComplete = () => {
    setEditingNote(null)
  }

  return (
    <RoomProvider
      id={`notes-${applicationId}`}
      initialPresence={{ cursor: null, name: userName, isTyping: false }}
      initialStorage={{ draft: '' }}
    >
      <div className="space-y-6">
        <ClientSideSuspense fallback={
          <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4 w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        }>
          {() => (
            <MeetingNotesInput
              applicationId={applicationId}
              userId={userId}
              userName={userName}
              editingNote={editingNote}
              onEditComplete={handleEditComplete}
              onNoteAdded={handleNoteAdded}
            />
          )}
        </ClientSideSuspense>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Notes</h3>
          <NotesList
            applicationId={applicationId}
            refreshTrigger={refreshTrigger}
            deliberationNotes={deliberationNotes}
            onEditNote={handleEditNote}
            editingNoteId={editingNote?.id || null}
          />
        </div>
      </div>
    </RoomProvider>
  )
}

// Main export with Liveblocks check
export default function MeetingNotes(props: MeetingNotesProps) {
  const hasLiveblocks = !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY

  if (!hasLiveblocks) {
    // Fallback without live collaboration
    return <MeetingNotesWithoutLive key={props.applicationId} {...props} />
  }

  // Key forces remount on navigation to reinitialize Liveblocks room
  return <MeetingNotesWithRoom key={props.applicationId} {...props} />
}

// Fallback component when Liveblocks is not configured (also with auto-save)
function MeetingNotesWithoutLive({ applicationId, userId, userName, deliberationNotes }: MeetingNotesProps) {
  const [content, setContent] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null)
  const supabase = createClient()
  const contentRef = useRef('')

  // Auto-save with debounce
  useEffect(() => {
    if (!content.trim()) {
      setSaveStatus('idle')
      return
    }

    setSaveStatus('unsaved')
    contentRef.current = content

    const timer = setTimeout(async () => {
      await saveNote()
    }, 2000)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, meetingDate])

  useEffect(() => {
    if (editingNote) {
      setContent(editingNote.content)
      setMeetingDate(editingNote.meeting_date)
      setLastSavedNoteId(editingNote.id)
    }
  }, [editingNote])

  const saveNote = async () => {
    const noteContent = contentRef.current.trim()
    if (!noteContent) return

    setSaveStatus('saving')
    try {
      if (lastSavedNoteId || editingNote) {
        const noteId = lastSavedNoteId || editingNote!.id
        const { error } = await supabase
          .from('saifcrm_meeting_notes')
          .update({
            content: noteContent,
            meeting_date: meetingDate,
          })
          .eq('id', noteId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('saifcrm_meeting_notes')
          .insert({
            application_id: applicationId,
            user_id: userId,
            content: noteContent,
            meeting_date: meetingDate,
          })
          .select('id')
          .single()

        if (error) throw error
        if (data) {
          setLastSavedNoteId(data.id)
        }
      }

      setSaveStatus('saved')
      setRefreshTrigger((prev) => prev + 1)
    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    }
  }

  const handleNewNote = () => {
    setContent('')
    setLastSavedNoteId(null)
    setMeetingDate(new Date().toISOString().split('T')[0])
    setSaveStatus('idle')
    setEditingNote(null)
  }

  const handleEditNote = (note: MeetingNote) => {
    setEditingNote(note)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
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
          <div className="pt-6">
            <SaveStatusIndicator status={saveStatus} />
          </div>
        </div>

        {(editingNote || lastSavedNoteId) && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {editingNote ? 'Editing note' : 'Current note'}
            </span>
            <button
              onClick={handleNewNote}
              className="btn btn-secondary text-sm"
            >
              + New Note
            </button>
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="input resize-y w-full min-h-[300px]"
          placeholder="Type your meeting notes here... Changes auto-save every 2 seconds."
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Notes</h3>
        <NotesList
          applicationId={applicationId}
          refreshTrigger={refreshTrigger}
          deliberationNotes={deliberationNotes}
          onEditNote={handleEditNote}
          editingNoteId={editingNote?.id || null}
        />
      </div>
    </div>
  )
}
