import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import FounderNavigation from '@/components/FounderNavigation'
import PeopleClient from './PeopleClient'
import PeopleGrid from './PeopleGrid'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
type Company = Database['public']['Tables']['saif_companies']['Row']

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search: initialSearch } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/profile/claim')
  }

  const isPartner = profile.role === 'partner'

  // For partners, show the full CRM people view with notes
  if (isPartner) {
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

    // Get portfolio companies (investments)
    const { data: investments } = await supabase
      .from('saifcrm_investments')
      .select('id, company_name')

    // Get applications (pipeline and deliberation)
    const { data: applications } = await supabase
      .from('saifcrm_applications')
      .select('id, company_name, stage')

    // Build company location map: company_name (lowercase) -> { page, id }
    const companyLocationMap: Record<string, { page: string; id: string }> = {}

    applications?.forEach(app => {
      const key = app.company_name.toLowerCase()
      const page = app.stage === 'deliberation' ? 'deliberation' : 'pipeline'
      if (!companyLocationMap[key] || (page === 'deliberation' && companyLocationMap[key].page === 'pipeline')) {
        companyLocationMap[key] = { page, id: app.id }
      }
    })

    investments?.forEach(inv => {
      const key = inv.company_name.toLowerCase()
      companyLocationMap[key] = { page: 'portfolio', id: inv.id }
    })

    // Attach note counts and construct display name
    const peopleWithNotes = (people || []).map(person => {
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
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
          <PeopleClient
            people={peopleWithNotes}
            userId={profile?.id || ''}
            userName={profile?.name || user.email || 'User'}
            companyLocationMap={companyLocationMap}
            initialSearch={initialSearch || ''}
          />
        </Suspense>
      </div>
    )
  }

  // For founders, show the simpler community view
  const { data: people, error: peopleError } = await supabase
    .from('saif_people')
    .select(`
      *,
      companies:saif_company_people(
        id,
        relationship_type,
        title,
        is_primary_contact,
        end_date,
        company:saif_companies(
          id,
          name,
          logo_url,
          stage
        )
      )
    `)
    .order('first_name')

  if (peopleError) {
    console.error('Error fetching people:', peopleError)
  }

  const typedPeople = (people || []) as (Person & {
    companies?: {
      id: string
      relationship_type: string
      title: string | null
      is_primary_contact: boolean
      end_date: string | null
      company: {
        id: string
        name: string
        logo_url: string | null
        stage: string
      } | null
    }[]
  })[]

  // Filter to show active people
  const activePeople = typedPeople.filter(person =>
    person.status === 'active' || person.status === 'pending'
  )

  return (
    <div className="min-h-screen bg-white">
      <FounderNavigation />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SAIF People</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connect with founders and partners in the SAIF community
          </p>
        </div>

        {activePeople.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No people found</p>
          </div>
        ) : (
          <PeopleGrid people={activePeople} isPartner={false} />
        )}
      </main>
    </div>
  )
}
