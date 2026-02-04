import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEventAsync } from '@/lib/audit'
import { notifyProfileClaimed } from '@/lib/notifications'
import { logAuthEvent } from '@/lib/auth/log-auth-event'

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ClaimProfileResponse = {
  success: boolean
  error?: string
  redirectTo?: string
}

export async function POST(_request: NextRequest): Promise<NextResponse<ClaimProfileResponse>> {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      await logAuthEvent({
        eventType: 'claim_failed',
        success: false,
        errorCode: 'not_authenticated',
        errorMessage: authError?.message ?? 'No user',
        request: _request,
      })
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Log claim attempt
    await logAuthEvent({
      eventType: 'claim_attempt',
      email: user.email,
      userId: user.id,
      success: false,
      request: _request,
    })

    if (!user.email_confirmed_at) {
      await logAuthEvent({
        eventType: 'claim_failed',
        email: user.email,
        userId: user.id,
        success: false,
        errorCode: 'email_not_confirmed',
        errorMessage: 'Email not confirmed',
        request: _request,
      })
      return NextResponse.json(
        { success: false, error: 'Please verify your email address before claiming your profile.' },
        { status: 403 }
      )
    }

    const serviceClient = getServiceClient()

    const { data: existingProfile } = await serviceClient
      .from('saif_people')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({ success: true, redirectTo: '/dashboard' })
    }

    if (!user.email) {
      return NextResponse.json({ success: false, error: 'No email associated with account' }, { status: 400 })
    }

    const { data: emailMatch, error: searchError } = await serviceClient
      .from('saif_people')
      .select('id, email, auth_user_id, status')
      .ilike('email', user.email)
      .is('auth_user_id', null)
      .single()

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching profile:', searchError)
      return NextResponse.json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 })
    }

    if (!emailMatch) {
      await logAuthEvent({
        eventType: 'claim_failed',
        email: user.email,
        userId: user.id,
        success: false,
        errorCode: 'profile_not_found',
        errorMessage: 'No unclaimed profile found for email',
        request: _request,
      })
      return NextResponse.json(
        { success: false, error: 'Unable to find your profile. Please contact SAIF support.' },
        { status: 404 }
      )
    }

    // Get name from auth metadata (provided during signup)
    const authFirstName = user.user_metadata?.first_name as string | undefined
    const authLastName = user.user_metadata?.last_name as string | undefined

    // Build update object - include names from auth metadata
    const updateData: Record<string, unknown> = {
      auth_user_id: user.id,
      email: user.email,
      status: 'active',
    }

    // Sync names from auth metadata (user entered during signup)
    if (authFirstName) {
      updateData.first_name = authFirstName
    }
    if (authLastName) {
      updateData.last_name = authLastName
    }
    if (authFirstName && authLastName) {
      updateData.name = `${authFirstName} ${authLastName}`
    }

    const { error: updateError } = await serviceClient
      .from('saif_people')
      .update(updateData)
      .eq('id', emailMatch.id)
      .is('auth_user_id', null)

    if (updateError) {
      console.error('Claim error:', updateError)
      // Check for unique constraint violation (profile already claimed by another user)
      if (updateError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This profile has already been claimed.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'An error occurred while claiming your profile.' },
        { status: 500 }
      )
    }

    console.log('Profile claimed successfully:', { userId: user.id, profileId: emailMatch.id, email: user.email })

    // Log auth event for successful claim
    await logAuthEvent({
      eventType: 'claim_success',
      email: user.email,
      userId: user.id,
      success: true,
      metadata: { profileId: emailMatch.id },
      request: _request,
    })

    // Log audit event for profile claim
    logAuditEventAsync({
      actorId: user.id,
      actorEmail: user.email,
      action: 'profile_claim',
      entityType: 'person',
      entityId: emailMatch.id,
      details: {
        previousStatus: emailMatch.status,
        newStatus: 'active',
      },
      request: _request,
    })

    // Notify partners about the profile claim (async, don't block response)
    ;(async () => {
      try {
        // Get founder's name from auth metadata (what they entered during signup)
        const authFirstName = user.user_metadata?.first_name as string | undefined
        const authLastName = user.user_metadata?.last_name as string | undefined

        const founderName = authFirstName && authLastName
          ? `${authFirstName} ${authLastName}`
          : authFirstName || authLastName || 'A founder'

        // Get company name from company association (if any)
        let companyName: string | null = null
        const { data: companyData, error: companyError } = await serviceClient
          .from('saif_company_people')
          .select('company_id')
          .eq('user_id', emailMatch.id)
          .limit(1)
          .maybeSingle()

        if (companyError) {
          console.error('Error fetching company association:', companyError)
        }

        if (companyData?.company_id) {
          const { data: company } = await serviceClient
            .from('saif_companies')
            .select('name')
            .eq('id', companyData.company_id)
            .single()

          companyName = company?.name || null
        }

        await notifyProfileClaimed(emailMatch.id, founderName, companyName)
      } catch (err) {
        console.error('Error sending profile claim notification:', err)
      }
    })()

    return NextResponse.json({ success: true, redirectTo: '/dashboard' })
  } catch (error) {
    console.error('Claim profile error:', error)
    return NextResponse.json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
