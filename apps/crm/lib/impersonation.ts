import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const IMPERSONATE_COOKIE = 'saif_impersonate'

export type ImpersonationInfo = {
  targetPersonId: string
  targetName: string
  realPersonId: string
}

/**
 * Get the active profile, respecting impersonation.
 * If a partner is impersonating someone, returns the impersonated profile.
 * Otherwise returns the real user's profile.
 */
export async function getActiveProfile() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { profile: null, isImpersonating: false, realProfile: null }
  }

  // Get the real user's profile
  const { data: realProfile } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!realProfile) {
    return { profile: null, isImpersonating: false, realProfile: null }
  }

  // Check for impersonation (partners only)
  if (realProfile.role === 'partner') {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)

    if (impersonateCookie) {
      try {
        const data: ImpersonationInfo = JSON.parse(impersonateCookie.value)
        const { data: impersonatedProfile } = await supabase
          .from('saif_people')
          .select('*')
          .eq('id', data.targetPersonId)
          .single()

        if (impersonatedProfile && impersonatedProfile.role !== 'partner') {
          return {
            profile: impersonatedProfile,
            isImpersonating: true,
            realProfile,
          }
        }
      } catch (e) {
        // Invalid cookie, ignore
      }
    }
  }

  return { profile: realProfile, isImpersonating: false, realProfile }
}
