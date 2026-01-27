import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import FounderNavigation from '@/components/FounderNavigation'
import Navigation from '@/components/Navigation'
import PartnerViewBanner from '@/components/PartnerViewBanner'
import CompanyGrid from './CompanyGrid'

type Company = Database['public']['Tables']['saif_companies']['Row']

export default async function CompaniesPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get user's profile
  const { data: person } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!person) {
    redirect('/profile/claim')
  }

  const isPartner = person.role === 'partner'
  const wantsCommunityView = view === 'community'
  const userName = person.first_name || 'User'

  // Fetch companies based on role:
  // - Partners (not viewing community) see ALL companies (for CRM management)
  // - Founders (and partners in community view) see portfolio + SAIF company
  let companies: any[] | null = null
  let companiesError: any = null

  if (isPartner && !wantsCommunityView) {
    const result = await supabase
      .from('saif_companies')
      .select(`
        id,
        name,
        short_description,
        website,
        logo_url,
        industry,
        city,
        country,
        founded_year,
        yc_batch,
        stage,
        is_aisafety_company,
        tags,
        people:saif_company_people(
          user_id,
          relationship_type,
          is_primary_contact,
          end_date,
          person:saif_people(
            id,
            first_name,
            last_name,
            title,
            avatar_url
          )
        ),
        investments:saif_investments(
          id,
          amount,
          round,
          type
        )
      `)
      .eq('is_active', true)
      .order('name')
    companies = result.data
    companiesError = result.error
  } else {
    // Founders see portfolio companies + SAIF
    const result = await supabase
      .from('saif_companies')
      .select(`
        id,
        name,
        short_description,
        website,
        logo_url,
        industry,
        city,
        country,
        stage,
        people:saif_company_people(
          user_id,
          relationship_type,
          is_primary_contact,
          end_date,
          person:saif_people(
            id,
            first_name,
            last_name,
            title,
            avatar_url
          )
        )
      `)
      .in('stage', ['portfolio', 'saif'] as const)
      .eq('is_active', true)
      .order('name')
    companies = result.data
    companiesError = result.error
  }

  if (companiesError) {
    console.error('Error fetching companies:', companiesError)
  }

  const typedCompanies = (companies || []) as (Company & {
    people?: Array<{
      user_id: string
      relationship_type: string
      is_primary_contact: boolean
      end_date: string | null
      person: {
        id: string
        first_name: string | null
        last_name: string | null
        title: string | null
        avatar_url: string | null
      } | null
    }>
    investments?: Array<{
      id: string
      amount: number | null
      round: string | null
      type: string | null
    }>
  })[]

  const isPartnerViewingAsCommunity = isPartner && wantsCommunityView
  const showPartnerView = isPartner && !wantsCommunityView

  return (
    <div className="min-h-screen bg-white">
      {showPartnerView ? <Navigation userName={userName} personId={person.id} /> : <FounderNavigation isPartnerViewingAsCommunity={isPartnerViewingAsCommunity} />}

      {isPartnerViewingAsCommunity && <PartnerViewBanner returnPath="/companies" />}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Show header for founders only - partners get header in CompanyGrid with count */}
        {!showPartnerView && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">SAIF Companies</h1>
            <p className="mt-2 text-sm text-gray-600">
              Browse and connect with companies in the SAIF portfolio
            </p>
          </div>
        )}

        {typedCompanies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No companies found</p>
          </div>
        ) : (
          <CompanyGrid companies={typedCompanies} isPartner={showPartnerView} userId={person.id} />
        )}
      </main>
    </div>
  )
}
