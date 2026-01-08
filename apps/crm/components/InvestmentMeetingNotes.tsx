'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CollaborativeNoteEditor } from './collaborative'

type InvestmentNote = {
  id: string
  investment_id: string
  user_id: string
  content: string
  meeting_date: string
  created_at: string
  updated_at?: string
  user_name?: string
}

type InvestmentMeetingNotesProps = {
  investmentId: string
  companyName: string
  userId: string
  userName: string
  onClose: () => void
}

// Notes list component with real-time updates
function NotesList({
  investmentId,
  refreshTrigger,
}: {
  investmentId: string
  refreshTrigger: number
}) {
  const [notes, setNotes] = useState<InvestmentNote[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('saifcrm_investment_notes')
      .select('*, author:saif_people!saifcrm_investment_notes_user_id_fkey(name, first_name, last_name)')
      .eq('investment_id', investmentId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching investment notes:', error)
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
  }, [investmentId, supabase])

  // Initial fetch
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes, refreshTrigger])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`investment_notes:${investmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saifcrm_investment_notes',
          filter: `investment_id=eq.${investmentId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [investmentId, supabase, fetchNotes])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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

  // Group notes by date
  const groupedNotes: { [date: string]: InvestmentNote[] } = {}
  notes.forEach((note) => {
    const date = note.meeting_date
    if (!groupedNotes[date]) {
      groupedNotes[date] = []
    }
    groupedNotes[date].push(note)
  })

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
        Previous Notes ({notes.length})
      </h3>
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
                className="bg-gray-50 rounded-lg p-4 border border-gray-100"
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

// Main component - modal wrapper
export default function InvestmentMeetingNotes({
  investmentId,
  companyName,
  userId,
  userName,
  onClose,
}: InvestmentMeetingNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleNoteSaved = () => {
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
              <p className="text-gray-500 mt-1">{companyName}</p>
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
          <CollaborativeNoteEditor
            key={investmentId}
            context={{ type: 'investment', id: investmentId }}
            userId={userId}
            userName={userName}
            showDatePicker={true}
            placeholder="Type your meeting notes here... Changes auto-save and sync in real-time with other users."
            minHeight="200px"
            onNoteSaved={handleNoteSaved}
          />

          <NotesList
            investmentId={investmentId}
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
