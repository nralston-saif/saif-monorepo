import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import FounderNavigation from '@/components/FounderNavigation'
import PeopleClient from './PeopleClient'
import PeopleGrid from './PeopleGrid'
import type { Database } from '@/lib/types/database'
import type { UserRole, UserStatus } from '@saif/supabase'

type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
type Company = Database['public']['Tables']['saif_companies']['Row']

// Type that matches what PeopleClient expects
type PersonWithNotes = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  displayName: string | null
  email: string | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  first_met_date: string | null
  introduced_by: string | null
  introduction_context: string | null
  relationship_notes: string | null
  created_at: string | null
  company_associations: {
    relationship_type: string | null
    title: string | null
    company: { id: string; name: string } | null
  }[]
  noteCount: number
}

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
    .select('id, first_name, last_name, name, email, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/profile/claim')
  }

  const isPartner = profile.role === 'partner'

  // For partners, show the full CRM people view with notes
  if (isPartner) {
    // Get all people (limit columns, no nested associations yet)
    const { data: people } = await supabase
      .from('saif_people')
      .select('id, auth_user_id, first_name, last_name, name, email, role, status, avatar_url, linkedin_url, title, bio, twitter_url, mobile_phone, location, tags, first_met_date, introduced_by, introduction_context, relationship_notes, created_at, updated_at')
      .order('first_name', { ascending: true })
      .limit(500)

    // Get company associations separately
    const personIds = people?.map(p => p.id) || []
    const { data: associations } = await supabase
      .from('saif_company_people')
      .select('user_id, relationship_type, title, company_id')
      .in('user_id', personIds)
      .limit(2000)

    // Get companies for these associations
    const companyIds = [...new Set(associations?.map(a => a.company_id) ?? [])]
    const { data: companies } = await supabase
      .from('saif_companies')
      .select('id, name')
      .in('id', companyIds as string[])

    // Create company map
    const companyMap: Record<string, { id: string; name: string }> = {}
    companies?.forEach(c => {
      companyMap[c.id] = c
    })

    // Create association map by person
    const associationsByPerson: Record<string, Array<{
      relationship_type: string | null
      title: string | null
      company: { id: string; name: string } | null
    }>> = {}

    associations?.forEach(assoc => {
      if (!associationsByPerson[assoc.user_id]) {
        associationsByPerson[assoc.user_id] = []
      }
      associationsByPerson[assoc.user_id].push({
        relationship_type: assoc.relationship_type,
        title: assoc.title,
        company: assoc.company_id ? companyMap[assoc.company_id] : null,
      })
    })

    // Get note counts for each person
    const { data: notes } = await supabase
      .from('saifcrm_people_notes')
      .select('person_id')
      .in('person_id', personIds)

    // Create a map of person_id -> note count
    const noteCountMap: Record<string, number> = {}
    notes?.forEach(note => {
      noteCountMap[note.person_id] = (noteCountMap[note.person_id] || 0) + 1
    })

    // Get portfolio companies (investments)
    const { data: investments } = await supabase
      .from('saifcrm_investments')
      .select('id, company_name')
      .limit(500)

    // Get applications (pipeline and deliberation)
    const { data: applications } = await supabase
      .from('saifcrm_applications')
      .select('id, company_name, stage')
      .limit(1000)

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

    // Attach associations, note counts, and construct display name
    const peopleWithNotes: PersonWithNotes[] = (people || []).map(person => {
      const displayName = person.first_name && person.last_name
        ? `${person.first_name} ${person.last_name}`
        : person.first_name || person.last_name || person.name || null

      return {
        id: person.id,
        name: person.name,
        first_name: person.first_name,
        last_name: person.last_name,
        displayName,
        email: person.email,
        role: person.role as UserRole,
        status: person.status as UserStatus,
        title: person.title,
        bio: person.bio,
        linkedin_url: person.linkedin_url,
        twitter_url: person.twitter_url,
        mobile_phone: person.mobile_phone,
        location: person.location,
        first_met_date: person.first_met_date,
        introduced_by: person.introduced_by,
        introduction_context: person.introduction_context,
        relationship_notes: person.relationship_notes,
        created_at: person.created_at,
        company_associations: associationsByPerson[person.id] || [],
        noteCount: noteCountMap[person.id] || 0,
      }
    })

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
          <PeopleClient
            people={peopleWithNotes as any}
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
      id,
      first_name,
      last_name,
      name,
      email,
      role,
      status,
      avatar_url,
      linkedin_url,
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
    .limit(500)

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
