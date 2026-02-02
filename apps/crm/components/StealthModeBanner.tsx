'use client'

interface StealthModeBannerProps {
  companyName: string
}

/**
 * Banner shown when viewing a company that is in stealth mode.
 * Reminds founders that their company is hidden from other community members.
 */
export default function StealthModeBanner({ companyName }: StealthModeBannerProps) {
  return (
    <div className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-center gap-3">
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <span className="text-sm font-medium">
          Stealth Mode Active - {companyName} and its team are hidden from the community
        </span>
      </div>
    </div>
  )
}
