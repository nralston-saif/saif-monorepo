'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@saif/ui'
import type { FeedbackType } from '@/lib/types/database'

interface FeedbackModalProps {
  personId: string
  onClose: () => void
  onSuccess: () => void
}

const feedbackTypes: { value: FeedbackType; label: string }[] = [
  { value: 'bug_report', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'question', label: 'Question' },
]

export default function FeedbackModal({ personId, onClose, onSuccess }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug_report')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    if (feedbackType === 'bug_report' && !description.trim()) {
      showToast('Please describe the bug so we can fix it', 'error')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.from('saif_tickets').insert({
      title: title.trim(),
      description: description.trim() || null,
      source: 'founder_feedback',
      feedback_type: feedbackType,
      created_by: personId,
      related_person: personId,
      assigned_to: null,
      status: 'open',
      priority: feedbackType === 'bug_report' ? 'high' : 'medium',
    }).select('id').single()

    if (error) {
      setLoading(false)
      showToast('Failed to submit feedback', 'error')
      console.error('Feedback submission error:', error)
      return
    }

    try {
      await fetch('/api/notifications/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: data.id,
          ticketTitle: title.trim(),
          feedbackType,
        }),
      })
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError)
    }

    setLoading(false)
    showToast('Feedback submitted! Thank you.', 'success')
    onSuccess()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Submit Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 -m-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Feedback Type - Horizontal buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFeedbackType(type.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    feedbackType === type.value
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              placeholder={
                feedbackType === 'bug_report'
                  ? 'e.g., Cannot upload profile photo'
                  : feedbackType === 'suggestion'
                  ? 'e.g., Add dark mode option'
                  : 'e.g., How do I update my company info?'
              }
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details {feedbackType === 'bug_report' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              rows={3}
              placeholder={
                feedbackType === 'bug_report'
                  ? 'What happened? What did you expect?'
                  : 'Additional details (optional)...'
              }
              required={feedbackType === 'bug_report'}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black font-medium transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
