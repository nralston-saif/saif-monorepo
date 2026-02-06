import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type CommunityAuthResult =
  | { success: true; user: { id: string; email?: string }; profile: { id: string; role: string; name?: string } }
  | { success: false; response: NextResponse }

/**
 * Verify that the request is from an authenticated community member (partner or founder).
 * For use in API routes (returns JSON responses, not redirects).
 */
export async function requireCommunityApi(): Promise<CommunityAuthResult> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Unauthorized - no valid session' },
          { status: 401 }
        )
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('saif_people')
      .select('id, role, first_name, last_name')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Unauthorized - no profile found' },
          { status: 401 }
        )
      }
    }

    if (profile.role !== 'partner' && profile.role !== 'founder') {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Forbidden - community access required' },
          { status: 403 }
        )
      }
    }

    return {
      success: true,
      user: { id: user.id, email: user.email },
      profile: {
        id: profile.id,
        role: profile.role,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      }
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }
}
