'use client'

import CompanyNotes from './CompanyNotes'

type InvestmentMeetingNotesProps = {
  investmentId: string
  companyId: string
  companyName: string
  userId: string
  userName: string
  onClose: () => void
}

export default function InvestmentMeetingNotes({
  investmentId,
  companyId,
  companyName,
  userId,
  userName,
  onClose,
}: InvestmentMeetingNotesProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Meeting Notes</h2>
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
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <CompanyNotes
            companyId={companyId}
            companyName={companyName}
            userId={userId}
            userName={userName}
            contextType="portfolio"
            contextId={investmentId}
            placeholder="Type your meeting notes here... Changes auto-save and sync in real-time with other users."
            minHeight="200px"
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
