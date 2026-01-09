'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CollaborativeNoteEditor } from './collaborative'
import DeleteNoteModal from './DeleteNoteModal'

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

// Notes list component showing historical notes
function NotesList({
  applicationId,
  refreshTrigger,
  deliberationNotes,
  excludeNoteId,
}: {
  applicationId: string
  refreshTrigger: number
  deliberationNotes?: string | null
  excludeNoteId?: string | null
}) {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(true)
  const [noteToDelete, setNoteToDelete] = useState<MeetingNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
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

  // Handle note deletion
  const handleDeleteNote = async () => {
    if (!noteToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    // Use .select() to verify the delete actually happened
    // RLS silently blocks deletes without returning an error
    const { data, error } = await supabase
      .from('saifcrm_meeting_notes')
      .delete()
      .eq('id', noteToDelete.id)
      .select()

    if (error) {
      console.error('Error deleting note:', error)
      setDeleteError(error.message || 'Failed to delete note. Please try again.')
      setIsDeleting(false)
      return
    }

    // Check if anything was actually deleted
    if (!data || data.length === 0) {
      console.error('Delete returned no rows - likely blocked by RLS')
      setDeleteError('You do not have permission to delete this note.')
      setIsDeleting(false)
      return
    }

    fetchNotes()
    setIsDeleting(false)
    setNoteToDelete(null)
  }

  // Close delete modal and clear error
  const handleCloseDeleteModal = () => {
    setNoteToDelete(null)
    setDeleteError(null)
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

  // Filter out the note currently being edited
  const filteredNotes = excludeNoteId
    ? notes.filter(note => note.id !== excludeNoteId)
    : notes

  // Only show deliberation notes if no other notes exist
  if (filteredNotes.length === 0 && !deliberationNotes) {
    return (
      <div className="text-center py-8 text-gray-500">
        No meeting notes yet. Start typing above to create the first note!
      </div>
    )
  }

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

  // Group notes by date
  const groupedNotes: { [date: string]: MeetingNote[] } = {}
  filteredNotes.forEach((note) => {
    const date = note.meeting_date
    if (!groupedNotes[date]) {
      groupedNotes[date] = []
    }
    groupedNotes[date].push(note)
  })

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
                className="bg-gray-50 rounded-lg p-4 border border-gray-100 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {(note.user_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{note.user_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">Last updated {formatTime(note.updated_at || note.created_at)}</p>
                  </div>
                  <button
                    onClick={() => setNoteToDelete(note)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete note"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <DeleteNoteModal
        isOpen={!!noteToDelete}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteNote}
        isDeleting={isDeleting}
        notePreview={noteToDelete?.content}
        error={deleteError}
      />
    </div>
  )
}

// Main export
export default function MeetingNotes({ applicationId, userId, userName, deliberationNotes }: MeetingNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)

  const handleNoteSaved = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <CollaborativeNoteEditor
        key={applicationId}
        context={{ type: 'application', id: applicationId }}
        userId={userId}
        userName={userName}
        showDatePicker={true}
        placeholder="Type your meeting notes here... Changes auto-save and sync in real-time with other users."
        onNoteSaved={handleNoteSaved}
        onCurrentNoteIdChange={setCurrentNoteId}
      />

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Notes</h3>
        <NotesList
          applicationId={applicationId}
          refreshTrigger={refreshTrigger}
          deliberationNotes={deliberationNotes}
          excludeNoteId={currentNoteId}
        />
      </div>
    </div>
  )
}
