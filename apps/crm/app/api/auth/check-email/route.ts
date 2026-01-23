import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role client to bypass RLS for email eligibility checks
const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type CheckEmailResponse = {
  canSignup: boolean
  reason: 'eligible' | 'not_recognized' | 'already_claimed' | 'not_invited' | 'pending_verification'
  message?: string
  canResendVerification?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { canSignup: false, reason: 'not_recognized', message: 'Email is required' } as CheckEmailResponse,
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Find person by email (case-insensitive)
    const { data: person, error: personError } = await supabase
      .from('saif_people')
      .select(`
        id,
        email,
        auth_user_id,
        status,
        invited_to_community,
        role
      `)
      .ilike('email', email)
      .maybeSingle()

    console.log('Check email query:', { email, person, personError })

    if (personError) {
      console.error('Error checking email:', personError)
      return NextResponse.json(
        { canSignup: false, reason: 'not_recognized', message: 'An error occurred. Please try again.' } as CheckEmailResponse,
        { status: 500 }
      )
    }

    // Case 1: Email not found in database
    if (!person) {
      return NextResponse.json({
        canSignup: false,
        reason: 'not_recognized',
        message: 'This email is not recognized. Contact SAIF if you believe this is an error.'
      } as CheckEmailResponse)
    }

    // Case 2: Already has an account (auth_user_id is set)
    if (person.auth_user_id) {
      return NextResponse.json({
        canSignup: false,
        reason: 'already_claimed',
        message: 'An account already exists for this email. Please log in instead.'
      } as CheckEmailResponse)
    }

    // Case 2b: Check if email exists in auth.users (unverified signup)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (!authError && authUsers?.users) {
      const existingAuthUser = authUsers.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (existingAuthUser) {
        // User exists in auth but hasn't claimed profile yet
        if (existingAuthUser.email_confirmed_at) {
          return NextResponse.json({
            canSignup: false,
            reason: 'already_claimed',
            message: 'An account already exists for this email. Please log in and complete your profile.'
          } as CheckEmailResponse)
        } else {
          return NextResponse.json({
            canSignup: false,
            reason: 'pending_verification',
            message: 'A signup is already in progress for this email. Please check your inbox for the verification link.',
            canResendVerification: true
          } as CheckEmailResponse)
        }
      }
    }

    // Case 3: Not in pending status (not invited)
    if (person.status !== 'pending') {
      return NextResponse.json({
        canSignup: false,
        reason: 'not_invited',
        message: 'This email is not eligible for signup. Contact SAIF for assistance.'
      } as CheckEmailResponse)
    }

    // Case 4: Check if explicitly invited to community
    if (person.invited_to_community) {
      return NextResponse.json({
        canSignup: true,
        reason: 'eligible'
      } as CheckEmailResponse)
    }

    // Case 5: Check if portfolio founder
    // Query company_people to see if this person is a founder at a portfolio company
    const { data: founderRelation, error: relationError } = await supabase
      .from('saif_company_people')
      .select(`
        id,
        relationship_type,
        company:saif_companies!inner(
          id,
          stage
        )
      `)
      .eq('user_id', person.id)
      .eq('relationship_type', 'founder')
      .is('end_date', null)
      .limit(1)

    if (relationError) {
      console.error('Error checking founder status:', relationError)
      return NextResponse.json(
        { canSignup: false, reason: 'not_recognized', message: 'An error occurred. Please try again.' } as CheckEmailResponse,
        { status: 500 }
      )
    }

    // Check if any of the founder relations are for portfolio companies
    const isPortfolioFounder = founderRelation?.some((rel: any) =>
      rel.company?.stage === 'portfolio'
    )

    if (isPortfolioFounder) {
      return NextResponse.json({
        canSignup: true,
        reason: 'eligible'
      } as CheckEmailResponse)
    }

    // Not a portfolio founder and not explicitly invited
    return NextResponse.json({
      canSignup: false,
      reason: 'not_invited',
      message: 'This email is not eligible for signup. Contact SAIF for assistance.'
    } as CheckEmailResponse)

  } catch (error: any) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { canSignup: false, reason: 'not_recognized', message: 'An error occurred. Please try again.' } as CheckEmailResponse,
      { status: 500 }
    )
  }
}
