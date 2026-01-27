'use client'

import Link from 'next/link'

interface PartnerViewBannerProps {
  /** The URL to return to the partner view (without query params) */
  returnPath: string
}

/**
 * Banner shown to partners when viewing the community dashboard.
 * Provides a "Back to Partner View" link to return to the full CRM view.
 */
export default function PartnerViewBanner({ returnPath }: PartnerViewBannerProps) {
  return (
    <div className="bg-gray-100 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">You are viewing the Community Dashboard</span>
        <Link
          href={returnPath}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Partner View
        </Link>
      </div>
    </div>
  )
}
