'use client'

import { useState } from 'react'
import FeedbackModal from './FeedbackModal'

interface FeedbackButtonProps {
  personId: string
}

export default function FeedbackButton({ personId }: FeedbackButtonProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      {/* Floating Action Button - bottom right */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-black transition-all hover:scale-105 group"
        title="Submit feedback"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <span className="hidden sm:inline text-sm font-medium">Feedback</span>
      </button>

      {/* Feedback Modal */}
      {showModal && (
        <FeedbackModal
          personId={personId}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </>
  )
}
