import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import PeopleClient from './PeopleClient'

export default async function PeoplePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single()

  // Get all people with their company associations
  const { data: people } = await supabase
    .from('saif_people')
    .select(`
      *,
      company_associations:saif_company_people(
        relationship_type,
        title,
        company:saif_companies(id, name)
      )
    `)
    .order('first_name', { ascending: true })

  // Get note counts for each person
  const { data: noteCounts } = await supabase
    .from('saifcrm_people_notes')
    .select('person_id')

  // Create a map of person_id -> note count
  const noteCountMap: Record<string, number> = {}
  noteCounts?.forEach(note => {
    noteCountMap[note.person_id] = (noteCountMap[note.person_id] || 0) + 1
  })

  // Attach note counts and construct display name
  const peopleWithNotes = (people || []).map(person => {
    // Construct display name from first_name + last_name, fallback to name field
    const displayName = person.first_name && person.last_name
      ? `${person.first_name} ${person.last_name}`
      : person.first_name || person.last_name || person.name || null

    return {
      ...person,
      displayName,
      noteCount: noteCountMap[person.id] || 0,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.name || user.email || 'User'} />
      <PeopleClient
        people={peopleWithNotes}
        userId={profile?.id || ''}
        userName={profile?.name || user.email || 'User'}
      />
    </div>
  )
}
