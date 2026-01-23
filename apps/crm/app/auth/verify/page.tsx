'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleVerification() {
      const supabase = createClient()

      // Check for error in URL params (Supabase sends errors this way)
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        console.error('Verification error from URL:', error, errorDescription)
        setErrorMessage(errorDescription || 'Verification failed')
        setStatus('error')
        return
      }

      // Check for code in URL (Supabase PKCE flow)
      const code = searchParams.get('code')

      if (code) {
        // Exchange code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('Code exchange error:', exchangeError)
          setErrorMessage(exchangeError.message)
          setStatus('error')
          return
        }

        // Success - redirect to profile claim
        setStatus('success')
        setTimeout(() => {
          router.push('/profile/claim')
        }, 2000)
        return
      }

      // Check for access_token in hash (older flow)
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        setStatus('success')
        setTimeout(() => {
          router.push('/profile/claim')
        }, 2000)
        return
      }

      // Check if user is already authenticated (maybe verification already processed)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('success')
        setTimeout(() => {
          router.push('/profile/claim')
        }, 2000)
        return
      }

      // No verification token found
      setStatus('error')
    }

    handleVerification()
  }, [router, searchParams])

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Email verified!
          </h2>
          <p className="text-gray-600">
            Your email has been verified successfully. Redirecting you to complete your profile...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Verification failed
        </h2>
        <p className="text-gray-600">
          {errorMessage || "We couldn't verify your email. The link may have expired or is invalid."}
        </p>
        <div className="pt-4">
          <Link
            href="/signup"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
          >
            Try signing up again
          </Link>
        </div>
      </div>
    </div>
  )
}
