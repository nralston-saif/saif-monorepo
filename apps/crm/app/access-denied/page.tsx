import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Sorry, you don't have access to this page
        </h1>
        <p className="text-gray-600 mb-8">
          This page is only available to SAIF partners. If you believe you should have access, please contact the team.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
