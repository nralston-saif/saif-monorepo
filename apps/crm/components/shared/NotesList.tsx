'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeleteNoteModal from '../DeleteNoteModal'

// ============================================================================
// TYPES
// ============================================================================

export type NoteType = 'application' | 'investment' | 'person'

type TableName = 'saifcrm_meeting_notes' | 'saifcrm_investment_notes' | 'saifcrm_people_notes'

type BaseNote = {
  id: string
  user_id: string
  content: string
  meeting_date: string
  created_at: string
  updated_at?: string
  user_name?: string
}

type NotesListProps = {
  noteType: NoteType
  entityId: string
  refreshTrigger: number
  excludeNoteId?: string | null
  deliberationNotes?: string | null
  showHeader?: boolean
}

// ============================================================================
// TABLE & COLUMN CONFIGURATION
// ============================================================================

const NOTE_CONFIG: Record<NoteType, {
  table: TableName
  foreignKey: string
  authorJoin: string
  channelPrefix: string
}> = {
  application: {
    table: 'saifcrm_meeting_notes',
    foreignKey: 'application_id',
    authorJoin: 'author:saif_people!meeting_notes_user_id_fkey(name, first_name, last_name)',
    channelPrefix: 'meeting-notes',
  },
  investment: {
    table: 'saifcrm_investment_notes',
    foreignKey: 'investment_id',
    authorJoin: 'author:saif_people!saifcrm_investment_notes_user_id_fkey(name, first_name, last_name)',
    channelPrefix: 'investment-notes',
  },
  person: {
    table: 'saifcrm_people_notes',
    foreignKey: 'person_id',
    authorJoin: 'author:saif_people!saifcrm_people_notes_user_id_fkey(name, first_name, last_name)',
    channelPrefix: 'people-notes',
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getAuthorName(author: { name?: string; first_name?: string; last_name?: string } | null): string {
  if (!author) return 'Unknown'
  if (author.first_name && author.last_name) {
    return `${author.first_name} ${author.last_name}`
  }
  return author.name || 'Unknown'
}

function groupNotesByDate<T extends { meeting_date: string }>(notes: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const note of notes) {
    const date = note.meeting_date
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(note)
  }
  return grouped
}

// ============================================================================
// COMPONENTS
// ============================================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

function EmptyState({ hasDeliberationNotes }: { hasDeliberationNotes: boolean }) {
  if (hasDeliberationNotes) {
    return <></>
  }

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

function DeliberationNotesSection({ notes }: { notes: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Imported Notes
      </h4>
      <p className="text-amber-900 whitespace-pre-wrap">{notes}</p>
    </div>
  )
}

function NoteCard({ note, onDelete }: { note: BaseNote; onDelete: (note: BaseNote) => void }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 group">
      <div className="flex items-start gap-3">
        <p className="text-gray-700 whitespace-pre-wrap break-words break-all flex-1">
          {note.content}
        </p>
        <button
          onClick={() => onDelete(note)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
          title="Delete note"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function DateGroup({
  date,
  notes,
  onDeleteNote,
  useLongDate = true,
}: {
  date: string
  notes: BaseNote[]
  onDeleteNote: (note: BaseNote) => void
  useLongDate?: boolean
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {useLongDate ? formatDate(date) : formatShortDate(date)}
      </h4>
      <div className="space-y-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onDelete={onDeleteNote} />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotesList({
  noteType,
  entityId,
  refreshTrigger,
  excludeNoteId,
  deliberationNotes,
  showHeader = false,
}: NotesListProps) {
  const [notes, setNotes] = useState<BaseNote[]>([])
  const [loading, setLoading] = useState(true)
  const [noteToDelete, setNoteToDelete] = useState<BaseNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const supabase = createClient()
  const config = NOTE_CONFIG[noteType]

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from(config.table)
      .select(`*, ${config.authorJoin}`)
      .eq(config.foreignKey, entityId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error(`Error fetching ${noteType} notes:`, error)
    }

    if (!error && data) {
      setNotes(
        data.map((note: any) => ({
          ...note,
          user_name: getAuthorName(note.author),
        }))
      )
    }
    setLoading(false)
  }, [entityId, supabase, config, noteType])

  // Fetch notes on mount and when refreshTrigger changes
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes, refreshTrigger])

  // Real-time subscription for DELETE events only
  useEffect(() => {
    const channel = supabase
      .channel(`${config.channelPrefix}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: config.table,
          filter: `${config.foreignKey}=eq.${entityId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [entityId, supabase, fetchNotes, config])

  async function handleDeleteNote(): Promise<void> {
    if (!noteToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    const { data, error } = await supabase
      .from(config.table)
      .delete()
      .eq('id', noteToDelete.id)
      .select()

    if (error) {
      console.error('Error deleting note:', error)
      setDeleteError(error.message || 'Failed to delete note. Please try again.')
      setIsDeleting(false)
      return
    }

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

  function handleCloseDeleteModal(): void {
    setNoteToDelete(null)
    setDeleteError(null)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const filteredNotes = excludeNoteId
    ? notes.filter((note) => note.id !== excludeNoteId)
    : notes

  const hasDeliberationNotes = Boolean(deliberationNotes)

  if (filteredNotes.length === 0 && !hasDeliberationNotes) {
    return <EmptyState hasDeliberationNotes={hasDeliberationNotes} />
  }

  const groupedNotes = groupNotesByDate(filteredNotes)
  const useLongDate = noteType === 'application'

  return (
    <div className="space-y-6">
      {showHeader && filteredNotes.length > 0 && (
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Previous Notes ({notes.length})
        </h3>
      )}

      {hasDeliberationNotes && (
        <DeliberationNotesSection notes={deliberationNotes!} />
      )}

      {Object.entries(groupedNotes).map(([date, dateNotes]) => (
        <DateGroup
          key={date}
          date={date}
          notes={dateNotes}
          onDeleteNote={setNoteToDelete}
          useLongDate={useLongDate}
        />
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
