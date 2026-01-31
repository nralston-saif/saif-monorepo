import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'
import CompanyView from './CompanyView'
import { LOGIN_URL } from '@/lib/constants'

type Company = Database['public']['Tables']['saif_companies']['Row']
type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(LOGIN_URL)
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

  // Determine partner status FIRST to control what data is fetched
  const isPartner = currentPerson.role === 'partner'

  // Build query based on user role - only partners get investment data
  const baseSelect = `
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
    )
  `

  // Only fetch investments for partners (server-side data filtering)
  const partnerSelect = `
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
  `

  const { data: company, error: companyError } = await supabase
    .from('saif_companies')
    .select(isPartner ? partnerSelect : baseSelect)
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

  // Cast company to include the joined data
  const companyData = company as unknown as Company & {
    people?: (CompanyPerson & { person: Person | null })[]
    investments?: any[]
  }

  // Check if current user can edit this company
  const isFounder = companyData.people?.some(
    (cp: any) =>
      cp.user_id === currentPerson.id &&
      cp.relationship_type === 'founder' &&
      !cp.end_date
  ) || false

  const canEdit = isPartner || isFounder

  // Check if company is published to website (only for portfolio companies)
  const isPortfolioCompany = companyData.stage === 'portfolio'
  let isPublishedToWebsite = false

  if (isPortfolioCompany) {
    // Note: website_portfolio_companies is not in saif-face types, use type assertion
    const { data: publishedData } = await (supabase as any)
      .from('website_portfolio_companies')
      .select('id')
      .eq('company_id', id)
      .single()

    isPublishedToWebsite = !!publishedData
  }

  // For non-partners, filter out former founder info (end_date) from the response
  // This prevents information disclosure about who left companies
  const sanitizedPeople = isPartner
    ? companyData.people
    : companyData.people?.filter((cp: any) => !cp.end_date) // Only show current team members

  const typedCompany = {
    ...companyData,
    people: sanitizedPeople,
    // investments is only present for partners due to conditional select
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                SAIF Community
              </Link>
              <Link
                href="/companies"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Companies
              </Link>
              <Link
                href="/people"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                People
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/profile/edit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Profile
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <CompanyView
        company={typedCompany}
        canEdit={canEdit}
        isPartner={isPartner}
        isFounder={isFounder}
        isPortfolioCompany={isPortfolioCompany}
        isPublishedToWebsite={isPublishedToWebsite}
        currentPersonId={currentPerson.id}
      />
    </div>
  )
}
