import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import FounderNavigation from '@/components/FounderNavigation'
import Navigation from '@/components/Navigation'
import CompanyView from './CompanyView'

type Company = Database['public']['Tables']['saif_companies']['Row']
type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']

export type ActiveDeal = {
  id: string
  company_name: string
  founder_names: string | null
  founder_linkedins: string | null
  founder_bios: string | null
  primary_email: string | null
  company_description: string | null
  website: string | null
  previous_funding: string | null
  deck_link: string | null
  submitted_at: string | null
  stage: string | null
  votes: {
    oduserId: string
    userName: string
    vote: string
    notes: string | null
  }[]
  deliberation: {
    id: string
    meeting_date: string | null
    idea_summary: string | null
    thoughts: string | null
    decision: string
    status: string | null
  } | null
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get current user's profile
  const { data: currentPerson } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentPerson) {
    redirect('/profile/claim')
  }

  // Fetch company with all related data
  const { data: company, error: companyError } = await supabase
    .from('saif_companies')
    .select(`
      *,
      people:saif_company_people(
        id,
        user_id,
        relationship_type,
        title,
        is_primary_contact,
        start_date,
        end_date,
        person:saif_people(
          id,
          first_name,
          last_name,
          email,
          title,
          avatar_url,
          bio,
          linkedin_url,
          twitter_url,
          location
        )
      ),
      investments:saif_investments(
        id,
        investment_date,
        amount,
        round,
        type,
        status,
        post_money_valuation,
        discount,
        shares,
        common_shares,
        preferred_shares,
        fd_shares,
        lead_partner_id,
        exit_date,
        acquirer
      )
    `)
    .eq('id', id)
    .single()

  if (companyError) {
    console.error('Error fetching company:', companyError)
    notFound()
  }

  if (!company) {
    console.error('Company not found for id:', id)
    notFound()
  }

  // Fetch application for this company (any stage - to show application info)
  let activeDeal: ActiveDeal | null = null

  const { data: application } = await supabase
    .from('saifcrm_applications')
    .select(`
      id,
      company_name,
      founder_names,
      founder_linkedins,
      founder_bios,
      primary_email,
      company_description,
      website,
      previous_funding,
      deck_link,
      submitted_at,
      stage
    `)
    .eq('company_id', id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (application) {
    // Fetch votes for this application
    const { data: votes } = await supabase
      .from('saifcrm_votes')
      .select(`
        vote,
        notes,
        voter:saif_people!saifcrm_votes_user_id_fkey(id, first_name, last_name)
      `)
      .eq('application_id', application.id)

    // Fetch deliberation for this application
    const { data: deliberation } = await supabase
      .from('saifcrm_deliberations')
      .select('id, meeting_date, idea_summary, thoughts, decision, status')
      .eq('application_id', application.id)
      .single()

    activeDeal = {
      ...application,
      votes: (votes || []).map((v: any) => ({
        oduserId: v.voter?.id || '',
        userName: v.voter ? `${v.voter.first_name || ''} ${v.voter.last_name || ''}`.trim() : 'Unknown',
        vote: v.vote,
        notes: v.notes,
      })),
      deliberation: deliberation ? {
        ...deliberation,
        decision: deliberation.decision || 'pending',
      } : null,
    }
  }

  // Fetch partners list for decision modal
  const { data: partners } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('first_name')

  const partnersList = (partners || []).map((p: any) => ({
    id: p.id,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
  }))

  // Check if current user can edit this company
  const isPartner = currentPerson.role === 'partner'
  const userName = currentPerson.first_name || 'User'
  const isFounder = company.people?.some(
    (cp: any) =>
      cp.user_id === currentPerson.id &&
      cp.relationship_type === 'founder' &&
      !cp.end_date
  ) || false

  const canEdit = isPartner || isFounder

  // Check if company is published to website (only for portfolio companies)
  const isPortfolioCompany = company.stage === 'portfolio' || (company.investments && company.investments.length > 0)
  let isPublishedToWebsite = false

  if (isPortfolioCompany) {
    const { data: publishedData } = await supabase
      .from('website_portfolio_companies')
      .select('id')
      .eq('company_id', id)
      .single()

    isPublishedToWebsite = !!publishedData
  }

  const typedCompany = company as Company & {
    people?: (CompanyPerson & {
      person: Person | null
    })[]
    investments?: any[]
  }

  return (
    <div className="min-h-screen bg-white">
      {isPartner ? <Navigation userName={userName} personId={currentPerson.id} /> : <FounderNavigation />}

      {/* Main Content */}
      <CompanyView
        company={typedCompany}
        canEdit={canEdit}
        isPartner={isPartner}
        currentPersonId={currentPerson.id}
        userName={userName}
        activeDeal={activeDeal}
        partners={partnersList}
        isPortfolioCompany={isPortfolioCompany}
        isPublishedToWebsite={isPublishedToWebsite}
      />
    </div>
  )
}
