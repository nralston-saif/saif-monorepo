import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Resend the signup confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/verify`,
      },
    })

    if (error) {
      console.error('Error resending verification email:', error)
      // Don't expose the actual error to the client for security
      return NextResponse.json({
        success: false,
        message: 'Unable to resend verification email. Please try again later.'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.'
    })

  } catch (error: any) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
