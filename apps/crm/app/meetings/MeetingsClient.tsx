'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomProvider, useMutation, useStorage, useOthers, ClientSideSuspense, useStatus } from '@/lib/liveblocks'
import type { Meeting, Person, Company, TicketStatus, TicketPriority } from '@saif/supabase'
import { useToast } from '@saif/ui'
import TagSelector from '../tickets/TagSelector'

type MeetingsClientProps = {
  meetings: Meeting[]
  currentUser: Person
  partners: Person[]
}

export default function MeetingsClient({ meetings, currentUser, partners }: MeetingsClientProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(meetings[0] || null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTicketSidebar, setShowTicketSidebar] = useState(false)
  const [meetingsList, setMeetingsList] = useState<Meeting[]>(meetings)
  const [companies, setCompanies] = useState<Company[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  // Check if Liveblocks is configured (same pattern as MeetingNotes.tsx)
  const hasLiveblocks = !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY

  // Fetch meetings with full content on mount (client-side to avoid serialization issues)
  useEffect(() => {
    const fetchMeetingsWithContent = async () => {
      const { data: meetingsData } = await supabase
        .from('saif_meetings')
        .select('id, title, meeting_date, content, created_by, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (meetingsData) {
        setMeetingsList(meetingsData as Meeting[])
      }
    }

    fetchMeetingsWithContent()
  }, [supabase])

  // Fetch companies and people for ticket creation
  useEffect(() => {
    const fetchData = async () => {
      const { data: companiesData } = await supabase
        .from('saif_companies')
        .select('id, name, logo_url')
        .order('name')

      const { data: peopleData } = await supabase
        .from('saif_people')
        .select('id, first_name, last_name, email')
        .in('status', ['active', 'pending'])
        .order('first_name')

      if (companiesData) setCompanies(companiesData as Company[])
      if (peopleData) setPeople(peopleData as Person[])
    }

    fetchData()
  }, [supabase])

  // Subscribe to new meetings
  useEffect(() => {
    const channel = supabase
      .channel('meetings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saif_meetings' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full meeting data to ensure we have complete content
            const { data } = await supabase
              .from('saif_meetings')
              .select('id, title, meeting_date, content, created_by, created_at, updated_at')
              .eq('id', payload.new.id)
              .single()

            if (data) {
              setMeetingsList((prev) => [data as Meeting, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch full meeting data to ensure we have complete content for search
            const { data } = await supabase
              .from('saif_meetings')
              .select('id, title, meeting_date, content, created_by, created_at, updated_at')
              .eq('id', payload.new.id)
              .single()

            if (data) {
              setMeetingsList((prev) =>
                prev.map((m) => (m.id === data.id ? (data as Meeting) : m))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            setMeetingsList((prev) => prev.filter((m) => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const formatDate = (dateString: string) => {
    // Parse date without timezone issues by treating it as local time
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Filter meetings based on search term
  const filteredMeetings = meetingsList.filter((meeting) => {
    if (!searchTerm.trim()) return true
    const search = searchTerm.toLowerCase()
    const titleMatch = meeting.title.toLowerCase().includes(search)
    const contentMatch = meeting.content && meeting.content.toLowerCase().includes(search)
    return titleMatch || contentMatch
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="mt-1 text-gray-500">Shared notes and collaboration</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTicketSidebar(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            + Create Ticket
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            + New Meeting
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Meetings List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">All Meetings</h2>
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search meetings..."
                  className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredMeetings.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 text-sm">{searchTerm.trim() ? 'No meetings found' : 'No meetings yet'}</p>
                  <p className="text-gray-400 text-xs mt-1">{searchTerm.trim() ? 'Try a different search term' : 'Create one to get started'}</p>
                </div>
              ) : (
                filteredMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className={`relative group ${
                      selectedMeeting?.id === meeting.id ? 'bg-gray-50 border-l-4 border-black' : ''
                    }`}
                  >
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                    >
                      <h3 className="font-medium text-gray-900 text-sm truncate pr-8">{meeting.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(meeting.meeting_date)}</p>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm(`Delete meeting "${meeting.title}"?`)) {
                          const { error } = await supabase
                            .from('saif_meetings')
                            .delete()
                            .eq('id', meeting.id)

                          if (!error) {
                            if (selectedMeeting?.id === meeting.id) {
                              setSelectedMeeting(null)
                            }
                          }
                        }
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      title="Delete meeting"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Meeting Notes Area */}
        <div className="lg:col-span-3">
          {selectedMeeting ? (
            hasLiveblocks ? (
              <LiveblocksWrapper
                key={selectedMeeting.id}
                meeting={selectedMeeting}
                currentUser={currentUser}
                partners={partners}
                onContentSaved={(meetingId, content) => {
                  setMeetingsList(prev =>
                    prev.map(m => m.id === meetingId ? { ...m, content } : m)
                  )
                }}
              />
            ) : (
              <SimpleMeetingEditor
                meeting={selectedMeeting}
                currentUser={currentUser}
                onContentSaved={(meetingId, content) => {
                  setMeetingsList(prev =>
                    prev.map(m => m.id === meetingId ? { ...m, content } : m)
                  )
                }}
              />
            )
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Meeting Selected</h3>
              <p className="text-gray-500">Select a meeting from the list or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          currentUserId={currentUser.id}
          onMeetingCreated={(meeting) => {
            setMeetingsList([meeting, ...meetingsList])
            setSelectedMeeting(meeting)
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Ticket Creation Modal */}
      {showTicketSidebar && (
        <QuickTicketModal
          onClose={() => setShowTicketSidebar(false)}
          currentUserId={currentUser.id}
          partners={partners}
          companies={companies}
          people={people}
        />
      )}
    </div>
  )
}

// Connection status logger (must be inside RoomProvider)
function ConnectionStatusLogger({ roomId }: { roomId: string }) {
  const status = useStatus()

  useEffect(() => {
    console.log(`[Meetings Liveblocks] Room "${roomId}" status:`, status)
  }, [status, roomId])

  return null
}

// Liveblocks wrapper with error handling and timeout
function LiveblocksWrapper({
  meeting,
  currentUser,
  partners,
  onContentSaved,
}: {
  meeting: Meeting
  currentUser: Person
  partners: Person[]
  onContentSaved: (meetingId: string, content: string) => void
}) {
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Debug logging
  useEffect(() => {
    console.log('[Meetings Liveblocks] Attempting to connect:', {
      roomId: `meeting-${meeting.id}`,
      hasPublicKey: !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
      keyPrefix: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.substring(0, 10),
    })
  }, [meeting.id])

  // Timeout after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[Meetings Liveblocks] Connection timed out after 15s')
      setHasTimedOut(true)
    }, 15000)

    return () => clearTimeout(timer)
  }, [meeting.id])

  // If timed out, show error with fallback option
  if (hasTimedOut) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="text-center mb-4">
          <p className="text-amber-600 mb-2">Real-time collaboration is taking longer than expected to connect.</p>
          <p className="text-gray-500 text-sm">You can continue editing without real-time sync:</p>
        </div>
        <SimpleMeetingEditorInner
          meeting={meeting}
          currentUser={currentUser}
          onContentSaved={onContentSaved}
        />
      </div>
    )
  }

  return (
    <RoomProvider
      id={`meeting-${meeting.id}`}
      initialPresence={{
        cursor: null,
        name: currentUser.name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Unknown',
        isTyping: false
      }}
      initialStorage={{ draft: '' }}
    >
      <ConnectionStatusLogger roomId={`meeting-${meeting.id}`} />
      <ClientSideSuspense
        fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-black rounded-full" />
              <span className="text-gray-600">Connecting to real-time collaboration...</span>
            </div>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          </div>
        }
      >
        {() => (
          <MeetingNotesEditor
            meeting={meeting}
            currentUser={currentUser}
            partners={partners}
            onContentSaved={onContentSaved}
          />
        )}
      </ClientSideSuspense>
    </RoomProvider>
  )
}

// Simple editor for inside the wrapper (reuses SimpleMeetingEditor logic)
function SimpleMeetingEditorInner({
  meeting,
  currentUser,
  onContentSaved,
}: {
  meeting: Meeting
  currentUser: Person
  onContentSaved: (meetingId: string, content: string) => void
}) {
  const [content, setContent] = useState(meeting.content || '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle')
  const supabase = createClient()

  // Auto-save
  useEffect(() => {
    if (content === meeting.content) return

    setSaveStatus('unsaved')

    const timer = setTimeout(async () => {
      setSaveStatus('saving')

      const { error } = await supabase
        .from('saif_meetings')
        .update({ content })
        .eq('id', meeting.id)

      if (error) {
        console.error('Error saving:', error)
        setSaveStatus('error')
      } else {
        onContentSaved(meeting.id, content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [content, meeting.id, meeting.content, supabase, onContentSaved])

  return (
    <div>
      <div className="flex justify-end mb-2">
        {saveStatus !== 'idle' && (
          <span className={`text-xs ${
            saveStatus === 'saved' ? 'text-green-600' :
            saveStatus === 'saving' ? 'text-blue-600' :
            saveStatus === 'error' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && '⚠ Error saving'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
          </span>
        )}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start typing your meeting notes here..."
        className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-y font-mono text-sm"
      />
    </div>
  )
}

// Meeting Notes Editor Component (with Liveblocks)
function MeetingNotesEditor({
  meeting,
  currentUser,
  partners,
  onContentSaved,
}: {
  meeting: Meeting
  currentUser: Person
  partners: Person[]
  onContentSaved: (meetingId: string, content: string) => void
}) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const [hasLoadedContent, setHasLoadedContent] = useState(false)

  const supabase = createClient()
  const others = useOthers()
  const draft = useStorage((root) => root.draft)
  const updateDraft = useMutation(({ storage }, text: string) => {
    storage.set('draft', text)
  }, [])

  // Load meeting content into Liveblocks storage on mount (like MeetingNotes.tsx pattern)
  useEffect(() => {
    // Only load content once when the room first connects
    if (!hasLoadedContent && draft !== undefined) {
      // If there's database content and the storage is empty, load it
      if (meeting.content && draft === '') {
        updateDraft(meeting.content)
      }
      setHasLoadedContent(true)
    }
  }, [meeting.content, draft, updateDraft, hasLoadedContent])

  // Auto-save draft to database
  useEffect(() => {
    if (!draft || !hasLoadedContent) return

    if (saveStatus !== 'unsaved') {
      setSaveStatus('unsaved')
    }

    // Clear existing timer
    if (saveTimer) {
      clearTimeout(saveTimer)
    }

    // Set new timer for auto-save
    const timer = setTimeout(async () => {
      setSaveStatus('saving')

      const { error } = await supabase
        .from('saif_meetings')
        .update({ content: draft })
        .eq('id', meeting.id)

      if (error) {
        console.error('Error saving content:', error)
        setSaveStatus('error')
      } else {
        // Update the meetings list so search works immediately
        onContentSaved(meeting.id, draft)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 2000)

    setSaveTimer(timer)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [draft, meeting.id, supabase, hasLoadedContent])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateDraft(e.target.value)
  }

  const formatMeetingDate = (dateString: string) => {
    // Parse date without timezone issues by treating it as local time
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getAuthorName = (person: Person) => {
    return person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
  }

  const getTypingUsers = () => {
    return others
      .filter((other) => other.presence.isTyping)
      .map((other) => {
        const partner = partners.find((p) => p.id === currentUser.id)
        return partner ? getAuthorName(partner) : other.presence.name || 'Someone'
      })
  }

  const typingUsers = getTypingUsers()

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Meeting Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{meeting.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {formatMeetingDate(meeting.meeting_date)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connected users */}
            {others.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Also here:</span>
                <div className="flex -space-x-2">
                  {others.slice(0, 5).map((other) => (
                    <div
                      key={other.connectionId}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-white"
                      title={other.presence.name || 'Anonymous'}
                    >
                      <span className="text-white text-xs font-medium">
                        {(other.presence.name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {others.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center ring-2 ring-white">
                      <span className="text-gray-600 text-xs">+{others.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{typingUsers.join(', ')} typing...</span>
              </div>
            )}
            {/* Save status */}
            {saveStatus !== 'idle' && (
              <span className={`text-xs ${
                saveStatus === 'saved' ? 'text-green-600' :
                saveStatus === 'saving' ? 'text-blue-600' :
                saveStatus === 'error' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'error' && '⚠ Error saving'}
                {saveStatus === 'unsaved' && 'Unsaved changes'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Shared Document Editor */}
      <div className="flex-1 p-6 overflow-auto">
        <textarea
          value={draft ?? ''}
          onChange={handleTextChange}
          placeholder="Start typing your meeting notes here... Everyone can edit this document together in real-time!"
          className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-y font-mono text-sm"
        />
      </div>
    </div>
  )
}

// Simple Meeting Editor (fallback when Liveblocks is not configured)
function SimpleMeetingEditor({
  meeting,
  currentUser,
  onContentSaved,
}: {
  meeting: Meeting
  currentUser: Person
  onContentSaved: (meetingId: string, content: string) => void
}) {
  const [content, setContent] = useState(meeting.content || '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)

  const supabase = createClient()

  // Reset content when meeting changes
  useEffect(() => {
    setContent(meeting.content || '')
    setSaveStatus('idle')
  }, [meeting.id, meeting.content])

  // Auto-save
  useEffect(() => {
    if (content === meeting.content) return

    setSaveStatus('unsaved')

    if (saveTimer) clearTimeout(saveTimer)

    const timer = setTimeout(async () => {
      setSaveStatus('saving')

      const { error } = await supabase
        .from('saif_meetings')
        .update({ content })
        .eq('id', meeting.id)

      if (error) {
        console.error('Error saving:', error)
        setSaveStatus('error')
      } else {
        onContentSaved(meeting.id, content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 2000)

    setSaveTimer(timer)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [content, meeting.id, supabase])

  const formatMeetingDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{meeting.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{formatMeetingDate(meeting.meeting_date)}</p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus !== 'idle' && (
              <span className={`text-xs ${
                saveStatus === 'saved' ? 'text-green-600' :
                saveStatus === 'saving' ? 'text-blue-600' :
                saveStatus === 'error' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'error' && '⚠ Error saving'}
                {saveStatus === 'unsaved' && 'Unsaved changes'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing your meeting notes here..."
          className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-y font-mono text-sm"
        />
      </div>
    </div>
  )
}

// Create Meeting Modal Component
function CreateMeetingModal({
  onClose,
  currentUserId,
  onMeetingCreated,
}: {
  onClose: () => void
  currentUserId: string
  onMeetingCreated: (meeting: Meeting) => void
}) {
  // Get today's date in local timezone (YYYY-MM-DD format)
  const getTodayLocalDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [title, setTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState(getTodayLocalDate())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)

    const { data, error } = await supabase
      .from('saif_meetings')
      .insert({
        title: title.trim(),
        meeting_date: meetingDate,
        created_by: currentUserId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating meeting:', error)
      setIsSubmitting(false)
      return
    }

    onMeetingCreated(data as Meeting)
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Meeting</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Partner Sync"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Date *
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Quick Ticket Creation Modal Component (Simple UI for meetings page)
function QuickTicketModal({
  onClose,
  currentUserId,
  partners,
  companies,
  people,
}: {
  onClose: () => void
  currentUserId: string
  partners: Person[]
  companies: Company[]
  people: Person[]
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
    assigned_to: '',
    related_company: '',
  })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const getPersonName = (person: Person) => {
    if (person.first_name && person.last_name) {
      return `${person.first_name} ${person.last_name}`
    }
    return person.email || 'Unknown'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('saif_tickets').insert({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: 'open' as TicketStatus,
      priority: formData.priority,
      assigned_to: formData.assigned_to || null,
      related_company: formData.related_company || null,
      created_by: currentUserId,
    })

    setLoading(false)

    if (error) {
      showToast('Failed to create ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket created successfully', 'success')
      onClose()
    }
  }

  return (
    <>
      {/* No backdrop - keep meeting notes fully visible */}

      {/* Small centered modal with shadow */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-50 max-h-[85vh] overflow-y-auto border-2 border-gray-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-gray-900">Quick Ticket</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="e.g., Follow up with founder"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              rows={2}
              placeholder="Add details..."
            />
          </div>

          {/* Priority & Assigned To (Two columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                required
              >
                <option value="">Select assignee...</option>
                <option value="everyone">Everyone</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>
                    {getPersonName(partner)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Related Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Related Company
            </label>
            <select
              value={formData.related_company}
              onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            >
              <option value="">None</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 text-sm"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// Ticket Creation Sidebar Component
function TicketSidebar({
  onClose,
  currentUserId,
  partners,
  companies,
  people,
}: {
  onClose: () => void
  currentUserId: string
  partners: Person[]
  companies: Company[]
  people: Person[]
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open' as TicketStatus,
    priority: 'medium' as TicketPriority,
    due_date: '',
    assigned_to: '',
    related_company: '',
    related_person: '',
    tags: [] as string[],
  })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const getPersonName = (person: Person) => {
    if (person.first_name && person.last_name) {
      return `${person.first_name} ${person.last_name}`
    }
    return person.email || 'Unknown'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('saif_tickets').insert({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      due_date: formData.due_date || null,
      assigned_to: formData.assigned_to || null,
      related_company: formData.related_company || null,
      related_person: formData.related_person || null,
      tags: formData.tags.length > 0 ? formData.tags : null,
      created_by: currentUserId,
    })

    setLoading(false)

    if (error) {
      showToast('Failed to create ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket created successfully', 'success')
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create Ticket</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="e.g., Follow up with founder"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              rows={4}
              placeholder="Add details about this ticket..."
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>

          {/* Due Date & Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              >
                <option value="">Select assignee...</option>
                <option value="everyone">Everyone</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>
                    {getPersonName(partner)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Related Company & Person */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Company
              </label>
              <select
                value={formData.related_company}
                onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">None</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Person
              </label>
              <select
                value={formData.related_person}
                onChange={(e) => setFormData({ ...formData, related_person: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">None</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>
                    {getPersonName(person)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <TagSelector
              selectedTags={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              currentUserId={currentUserId}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
