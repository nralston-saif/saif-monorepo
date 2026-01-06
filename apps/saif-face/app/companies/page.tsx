import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'
import CompanyGrid from './CompanyGrid'

type Company = Database['public']['Tables']['saif_companies']['Row']

export default async function CompaniesPage() {
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

  // Fetch portfolio companies (RLS will filter based on user's role)
  // Use separate queries to avoid template literal type parsing issues
  let companies: any[] | null = null
  let companiesError: any = null

  if (isPartner) {
    const result = await supabase
      .from('saif_companies')
      .select(`
        *,
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
      .eq('stage', 'portfolio')
      .eq('is_active', true)
      .order('name')
    companies = result.data
    companiesError = result.error
  } else {
    const result = await supabase
      .from('saif_companies')
      .select(`
        *,
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
      .eq('stage', 'portfolio')
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

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                SAIFface
              </Link>
              <Link
                href="/companies"
                className="text-sm font-medium text-gray-900"
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SAIF Companies</h1>
          <p className="mt-2 text-sm text-gray-600">
            Browse and connect with companies in the SAIF portfolio
          </p>
        </div>

        {typedCompanies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No companies found</p>
          </div>
        ) : (
          <CompanyGrid companies={typedCompanies} isPartner={isPartner} />
        )}
      </main>
    </div>
  )
}
