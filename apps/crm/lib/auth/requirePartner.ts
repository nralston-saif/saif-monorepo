import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requirePartner() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/profile/claim')
  }

  if (profile.role !== 'partner') {
    redirect('/access-denied')
  }

  return { user, profile }
}
