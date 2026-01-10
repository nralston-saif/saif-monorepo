'use client'

import { useState, useEffect, useRef } from 'react'
import { CollaborativeNoteEditor } from './collaborative'
import { NotesList } from './shared'

type MeetingNotesProps = {
  applicationId: string
  userId: string
  userName: string
  deliberationNotes?: string | null
}

export default function MeetingNotes({
  applicationId,
  userId,
  userName,
  deliberationNotes,
}: MeetingNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentNoteId, setCurrentNoteId] = useState<string | null | undefined>(undefined)
  const prevCurrentNoteIdRef = useRef<string | null | undefined>(undefined)

  // Detect when sharedNoteId transitions from a value to null (Save & New clicked)
  // This triggers a refetch so all users see the finalized note
  useEffect(() => {
    const prev = prevCurrentNoteIdRef.current
    prevCurrentNoteIdRef.current = currentNoteId

    if (prev && prev !== undefined && currentNoteId === null) {
      setRefreshTrigger((p) => p + 1)
    }
  }, [currentNoteId])

  function handleNoteSaved(): void {
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

      {currentNoteId !== undefined && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Notes</h3>
          <NotesList
            noteType="application"
            entityId={applicationId}
            refreshTrigger={refreshTrigger}
            deliberationNotes={deliberationNotes}
            excludeNoteId={currentNoteId}
          />
        </div>
      )}
    </div>
  )
}
