import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 5

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type CheckEmailResponse = {
  canSignup: boolean
  reason: 'eligible' | 'not_eligible' | 'pending_verification'
  message?: string
  canResendVerification?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse<CheckEmailResponse>> {
  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`check-email:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { canSignup: false, reason: 'not_eligible', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { canSignup: false, reason: 'not_eligible', message: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()
    const notEligibleResponse: CheckEmailResponse = {
      canSignup: false,
      reason: 'not_eligible',
      message: 'This email is not eligible for signup. If you believe this is an error, please contact SAIF.',
    }

    const { data: person, error: personError } = await supabase
      .from('saif_people')
      .select('id, email, auth_user_id, status, role')
      .ilike('email', email)
      .maybeSingle()

    if (personError) {
      console.error('Error checking email:', personError)
      return NextResponse.json(
        { canSignup: false, reason: 'not_eligible', message: 'An error occurred. Please try again.' },
        { status: 500 }
      )
    }

    if (!person || person.auth_user_id) {
      return NextResponse.json(notEligibleResponse)
    }

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (!authError && authUsers?.users) {
      const existingAuthUser = authUsers.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (existingAuthUser) {
        if (existingAuthUser.email_confirmed_at) {
          return NextResponse.json(notEligibleResponse)
        }
        return NextResponse.json({
          canSignup: false,
          reason: 'pending_verification',
          message: 'A signup is already in progress. Please check your inbox for the verification link.',
          canResendVerification: true,
        })
      }
    }

    if (person.status !== 'eligible') {
      return NextResponse.json(notEligibleResponse)
    }

    return NextResponse.json({ canSignup: true, reason: 'eligible' })
  } catch (error) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { canSignup: false, reason: 'not_eligible', message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
