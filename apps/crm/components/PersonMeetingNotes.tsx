'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomProvider, useOthers, useUpdateMyPresence, useStorage, useMutation, ClientSideSuspense } from '@/lib/liveblocks'
import { LiveObject } from '@liveblocks/client'

type PersonNote = {
  id: string
  person_id: string
  user_id: string
  content: string
  meeting_date: string
  created_at: string
  updated_at?: string
  user_name?: string
}

type PersonMeetingNotesProps = {
  personId: string
  personName: string
  userId: string
  userName: string
  onClose: () => void
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
        rows={8}
        className="input resize-y w-full min-h-[200px]"
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

// Meeting notes input component (inside RoomProvider)
function MeetingNotesInput({
  personId,
  userId,
  userName,
  editingNote,
  onEditComplete,
  onNoteAdded,
}: {
  personId: string
  userId: string
  userName: string
  editingNote: PersonNote | null
  onEditComplete: () => void
  onNoteAdded: () => void
}) {
  const [meetingDate, setMeetingDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState(0) // Triggers auto-save effect
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
          .from('saifcrm_people_notes')
          .update({
            content,
            meeting_date: meetingDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', noteId)

        if (error) throw error
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('saifcrm_people_notes')
          .insert({
            person_id: personId,
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

      // Reset to 'idle' after a moment so user knows it's saved
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
    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {editingNote ? 'Editing Note' : lastSavedNoteId ? 'Current Note' : 'New Note'}
        </h3>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Live sync</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-500 mb-1">Meeting Date</label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="input"
          />
        </div>
        {(editingNote || lastSavedNoteId) && (
          <button
            onClick={handleNewNote}
            className="btn btn-secondary text-sm"
          >
            + New Note
          </button>
        )}
      </div>

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
  personId,
  refreshTrigger,
  onEditNote,
  editingNoteId,
}: {
  personId: string
  refreshTrigger: number
  onEditNote: (note: PersonNote) => void
  editingNoteId: string | null
}) {
  const [notes, setNotes] = useState<PersonNote[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('saifcrm_people_notes')
      .select('*, author:saif_people!saifcrm_people_notes_user_id_fkey(name, first_name, last_name)')
      .eq('person_id', personId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching people notes:', error)
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
  }, [personId, supabase])

  // Initial fetch
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes, refreshTrigger])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`people_notes:${personId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saifcrm_people_notes',
          filter: `person_id=eq.${personId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [personId, supabase, fetchNotes])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

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

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No meeting notes yet</p>
        <p className="text-sm">Start typing above to create your first note</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
        Previous Notes ({notes.length})
      </h3>
      <div className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onEditNote(note)}
            className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm ${
              editingNoteId === note.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {note.meeting_date && (
                  <span className="badge bg-gray-100 text-gray-700">
                    {formatDate(note.meeting_date)}
                  </span>
                )}
                {note.user_name && (
                  <span className="text-sm text-gray-500">
                    by {note.user_name}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">Click to edit</span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">
              {note.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main component with Liveblocks room
function PersonMeetingNotesContent({
  personId,
  personName,
  userId,
  userName,
  onClose,
}: PersonMeetingNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [editingNote, setEditingNote] = useState<PersonNote | null>(null)

  const handleNoteAdded = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleEditNote = (note: PersonNote) => {
    setEditingNote(note)
  }

  const handleEditComplete = () => {
    setEditingNote(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Meeting Notes
              </h2>
              <p className="text-gray-500 mt-1">{personName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <MeetingNotesInput
            personId={personId}
            userId={userId}
            userName={userName}
            editingNote={editingNote}
            onEditComplete={handleEditComplete}
            onNoteAdded={handleNoteAdded}
          />
          <NotesList
            personId={personId}
            refreshTrigger={refreshTrigger}
            onEditNote={handleEditNote}
            editingNoteId={editingNote?.id || null}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Wrapper with RoomProvider
export default function PersonMeetingNotes(props: PersonMeetingNotesProps) {
  const roomId = `person-notes-${props.personId}`

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{ cursor: null, name: props.userName, isTyping: false }}
      initialStorage={{ draft: new LiveObject({ draft: '' }).toObject().draft || '' }}
    >
      <ClientSideSuspense
        fallback={
          <div className="modal-backdrop">
            <div className="modal-content max-w-2xl">
              <div className="p-6 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
          </div>
        }
      >
        <PersonMeetingNotesContent {...props} />
      </ClientSideSuspense>
    </RoomProvider>
  )
}
