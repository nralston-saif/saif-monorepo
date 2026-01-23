'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
export default function ClaimProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAndClaimProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setUserEmail(user.email || null)
        setClaiming(true)

        // Call the server-side API to claim the profile
        const response = await fetch('/api/auth/claim-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })

        const result = await response.json()

        if (result.success && result.redirectTo) {
          router.push(result.redirectTo)
          return
        }

        if (!result.success) {
          setError(result.error || 'An error occurred. Please try again or contact SAIF support.')
          setClaiming(false)
          setLoading(false)
        }
      } catch (err) {
        console.error('Error in profile claim:', err)
        setError('An error occurred. Please try again or contact SAIF support.')
        setClaiming(false)
        setLoading(false)
      }
    }

    checkAndClaimProfile()
  }, [router, supabase])

  // Loading state
  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">
            {claiming ? 'Setting up your profile...' : 'Finding your profile...'}
          </p>
          {userEmail && (
            <p className="mt-2 text-xs text-gray-500">{userEmail}</p>
          )}
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Profile Not Found
          </h2>
          {error && (
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          )}
          {userEmail && (
            <p className="mt-4 text-sm text-gray-500">
              Signed in as: {userEmail}
            </p>
          )}
          <div className="mt-8 space-y-4">
            <a
              href="mailto:support@saif.vc"
              className="block w-full px-4 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
            >
              Contact SAIF Support
            </a>
            <Link
              href="/login"
              className="block w-full px-4 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
