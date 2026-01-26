import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/profile/claim'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful verification - redirect to claim profile
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Log the error for debugging
    console.error('Auth callback error:', error)
  }

  // Return to verify page with error
  const errorUrl = new URL('/auth/verify', origin)
  errorUrl.searchParams.set('error', 'verification_failed')
  errorUrl.searchParams.set('error_description', 'Unable to verify your email. Please try signing up again.')
  return NextResponse.redirect(errorUrl.toString())
}
