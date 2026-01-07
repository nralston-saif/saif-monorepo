import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import FounderNavigation from '@/components/FounderNavigation'
import Navigation from '@/components/Navigation'
import CompanyView from './CompanyView'

type Company = Database['public']['Tables']['saif_companies']['Row']
type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']

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

  // Check if current user can edit this company
  const isPartner = currentPerson.role === 'partner'
  const userName = `${currentPerson.first_name || ''} ${currentPerson.last_name || ''}`.trim() || 'User'
  const isFounder = company.people?.some(
    (cp: any) =>
      cp.user_id === currentPerson.id &&
      cp.relationship_type === 'founder' &&
      !cp.end_date
  ) || false

  const canEdit = isPartner || isFounder

  const typedCompany = company as Company & {
    people?: (CompanyPerson & {
      person: Person | null
    })[]
    investments?: any[]
  }

  return (
    <div className="min-h-screen bg-white">
      {isPartner ? <Navigation userName={userName} /> : <FounderNavigation />}

      {/* Main Content */}
      <CompanyView
        company={typedCompany}
        canEdit={canEdit}
        isPartner={isPartner}
        currentPersonId={currentPerson.id}
      />
    </div>
  )
}
