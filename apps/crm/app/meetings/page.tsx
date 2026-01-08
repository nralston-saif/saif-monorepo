import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import MeetingsClient from './MeetingsClient'
import type { Meeting, MeetingNote, Person } from '@saif/supabase'

export default async function MeetingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get full user profile
  const { data: profile, error: profileError } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, name, email, role, status, avatar_url')
    .eq('auth_user_id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/profile/claim')
  }

  const typedProfile = profile as Person

  // Only partners can access meetings
  if (typedProfile.role !== 'partner') {
    redirect('/dashboard')
  }

  // Fetch all meetings ordered by creation date (newest first)
  const { data: meetings } = await supabase
    .from('saif_meetings')
    .select('id, title, meeting_date, content, created_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Get all partners for the people selector
  const { data: partners } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, name, avatar_url')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('first_name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={typedProfile.name || user.email || 'User'} />
      <MeetingsClient
        meetings={(meetings || []) as Meeting[]}
        currentUser={typedProfile}
        partners={(partners || []) as Person[]}
      />
    </div>
  )
}
