import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import FounderNavigation from '@/components/FounderNavigation'
import PartnerViewBanner from '@/components/PartnerViewBanner'
import PeopleClient from './PeopleClient'
import PeopleGrid from './PeopleGrid'
import { getActiveProfile } from '@/lib/impersonation'
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
  alternative_emails: string[] | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  avatar_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  tags: string[]
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
  searchParams: Promise<{ search?: string; view?: string }>
}) {
  const { search: initialSearch, view } = await searchParams
  const supabase = await createClient()

  const { profile } = await getActiveProfile()

  if (!profile) {
    redirect('/login')
  }

  const isPartner = profile.role === 'partner'
  const wantsCommunityView = view === 'community'

  // For partners (not viewing community), show the full CRM people view with notes
  if (isPartner && !wantsCommunityView) {
    // Run independent queries in parallel for better performance
    const [
      { data: people },
      { data: investments },
      { data: applications },
    ] = await Promise.all([
      // Get all people (only fields we need)
      supabase
        .from('saif_people')
        .select(`
          id,
          name,
          first_name,
          last_name,
          email,
          role,
          status,
          title,
          bio,
          avatar_url,
          linkedin_url,
          twitter_url,
          mobile_phone,
          location,
          tags,
          first_met_date,
          introduced_by,
          introduction_context,
          relationship_notes,
          created_at
        `)
        .order('first_name', { ascending: true }),
      // Get portfolio companies (investments)
      supabase
        .from('saif_investments')
        .select('id, company:saif_companies(name)')
        .limit(300),
      // Get applications (pipeline and deliberation)
      supabase
        .from('saifcrm_applications')
        .select('id, company_name, stage')
        .limit(1000),
    ])

    const personIds = people?.map(p => p.id) || []

    // Run person-dependent queries in parallel
    const [
      { data: associations },
      { data: notes },
    ] = await Promise.all([
      // Get company associations
      supabase
        .from('saif_company_people')
        .select('user_id, relationship_type, title, company_id')
        .in('user_id', personIds)
        .limit(2000),
      // Get note counts
      supabase
        .from('saifcrm_people_notes')
        .select('person_id')
        .in('person_id', personIds),
    ])

    // Get companies for associations
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

    // Create a map of person_id -> note count
    const noteCountMap: Record<string, number> = {}
    notes?.forEach(note => {
      noteCountMap[note.person_id] = (noteCountMap[note.person_id] || 0) + 1
    })

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
      const companyName = (inv.company as { name: string } | null)?.name
      if (companyName) {
        const key = companyName.toLowerCase()
        companyLocationMap[key] = { page: 'portfolio', id: inv.id }
      }
    })

    // Attach associations, note counts, and construct display name
    const peopleWithNotes: PersonWithNotes[] = (people || []).map(person => {
      // Cast to include fields which may not be in generated types yet
      const p = person as typeof person & { alternative_emails?: string[] | null; tags?: string[] }
      const displayName = p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.first_name || p.last_name || p.name || null

      return {
        id: p.id,
        name: p.name,
        first_name: p.first_name,
        last_name: p.last_name,
        displayName,
        email: p.email,
        alternative_emails: p.alternative_emails || null,
        role: p.role as UserRole,
        status: p.status as UserStatus,
        title: p.title,
        bio: p.bio,
        avatar_url: p.avatar_url,
        linkedin_url: p.linkedin_url,
        twitter_url: p.twitter_url,
        mobile_phone: p.mobile_phone,
        location: p.location,
        tags: p.tags || [],
        first_met_date: p.first_met_date,
        introduced_by: p.introduced_by,
        introduction_context: p.introduction_context,
        relationship_notes: p.relationship_notes,
        created_at: p.created_at,
        company_associations: associationsByPerson[p.id] || [],
        noteCount: noteCountMap[p.id] || 0,
      }
    })

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
          <PeopleClient
            people={peopleWithNotes as any}
            userId={profile?.id || ''}
            userName={profile?.name || profile?.email || 'User'}
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
          stage,
          is_active
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
        is_active: boolean | null
      } | null
    }[]
  })[]

  // Filter to show:
  // 1. Partners (always shown as part of SAIF community)
  // 2. People with an active relationship to a portfolio company (no end_date, stage='portfolio')
  const activePeople = typedPeople.filter(person => {
    // Partners are always shown
    if (person.role === 'partner') {
      return true
    }

    // For everyone else, check if they have an active relationship with a portfolio company
    const hasActivePortfolioRelationship = person.companies?.some(
      cp => !cp.end_date && cp.company?.stage === 'portfolio' && cp.company?.is_active !== false
    )

    return hasActivePortfolioRelationship
  })

  const isPartnerViewingAsCommunity = isPartner && wantsCommunityView

  return (
    <div className="min-h-screen bg-white">
      <FounderNavigation isPartnerViewingAsCommunity={isPartnerViewingAsCommunity} personId={profile.id} />

      {isPartnerViewingAsCommunity && <PartnerViewBanner returnPath="/people" />}

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
