import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.email_confirmed_at) {
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
      return NextResponse.json(
        { success: false, error: 'Unable to find your profile. Please contact SAIF support.' },
        { status: 404 }
      )
    }

    const { error: updateError } = await serviceClient
      .from('saif_people')
      .update({ auth_user_id: user.id, email: user.email, status: 'active' })
      .eq('id', emailMatch.id)
      .is('auth_user_id', null)

    if (updateError) {
      console.error('Claim error:', updateError)
      return NextResponse.json(
        { success: false, error: 'An error occurred while claiming your profile.' },
        { status: 500 }
      )
    }

    console.log('Profile claimed successfully:', { userId: user.id, profileId: emailMatch.id, email: user.email })
    return NextResponse.json({ success: true, redirectTo: '/dashboard' })
  } catch (error) {
    console.error('Claim profile error:', error)
    return NextResponse.json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
