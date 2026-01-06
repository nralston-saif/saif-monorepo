'use client'

import { useState, useEffect, useCallback } from 'react'
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
  user_name?: string
}

type PersonMeetingNotesProps = {
  personId: string
  personName: string
  userId: string
  userName: string
  onClose: () => void
}

// Collaborative text area component with real-time sync
function CollaborativeTextArea({
  userName,
  onContentChange,
}: {
  userName: string
  onContentChange: (value: string) => void
}) {
  const updateMyPresence = useUpdateMyPresence()
  const others = useOthers()

  // Read shared draft from Liveblocks storage
  const draft = useStorage((root) => root.draft) || ''

  // Mutation to update the shared draft
  const updateDraft = useMutation(({ storage }, newDraft: string) => {
    storage.set('draft', newDraft)
  }, [])

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
        placeholder="Type your meeting notes here... Everyone sees changes in real-time!"
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

// Meeting notes input component (inside RoomProvider)
function MeetingNotesInput({
  personId,
  userId,
  onNoteAdded,
  userName,
}: {
  personId: string
  userId: string
  userName: string
  onNoteAdded: () => void
}) {
  const [content, setContent] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const supabase = createClient()
  const others = useOthers()

  // Check if others are currently typing
  const othersTyping = others.filter((user) => user.presence.isTyping)
  const typingNames = othersTyping.map((user) => user.presence.name || 'Someone')

  // Mutation to clear the shared draft after saving
  const clearDraft = useMutation(({ storage }) => {
    storage.set('draft', '')
  }, [])

  const handleFinalizeNote = async (confirmed: boolean = false) => {
    if (!content.trim()) return

    // Always show confirmation first
    if (!confirmed) {
      setShowConfirm(true)
      return
    }

    setSaving(true)
    setShowConfirm(false)
    try {
      const { error } = await supabase.from('saifcrm_people_notes').insert({
        person_id: personId,
        user_id: userId,
        content: content.trim(),
        meeting_date: meetingDate,
      })

      if (error) throw error

      // Clear both local state and shared draft
      setContent('')
      clearDraft()
      onNoteAdded()
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
  }, [])

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Add New Note</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">Live sync enabled</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-500 mb-1">Meeting Date</label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <CollaborativeTextArea
        userName={userName}
        onContentChange={handleContentChange}
      />

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm mb-3">
            {othersTyping.length > 0 ? (
              <>
                <strong>{typingNames.join(', ')}</strong> {typingNames.length === 1 ? 'is' : 'are'} still typing.{' '}
              </>
            ) : null}
            Finalizing will save this note and clear the draft for everyone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => handleFinalizeNote(true)}
              className="btn btn-primary text-sm"
            >
              Confirm & Save
            </button>
          </div>
        </div>
      )}

      {!showConfirm && (
        <div className="flex justify-end">
          <button
            onClick={() => handleFinalizeNote()}
            disabled={saving || !content.trim()}
            className="btn btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Finalize Note'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// Notes list component with real-time updates
function NotesList({
  personId,
  refreshTrigger,
}: {
  personId: string
  refreshTrigger: number
}) {
  const [notes, setNotes] = useState<PersonNote[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('saifcrm_people_notes')
      .select('*, author:saif_people!user_id(name, first_name, last_name)')
      .eq('person_id', personId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })

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
        <p className="text-sm">Add your first note above</p>
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
          <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4">
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

  const handleNoteAdded = () => {
    setRefreshTrigger((prev) => prev + 1)
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
            onNoteAdded={handleNoteAdded}
          />
          <NotesList
            personId={personId}
            refreshTrigger={refreshTrigger}
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
