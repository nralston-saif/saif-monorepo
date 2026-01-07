import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'
import { LOGIN_URL } from '@/lib/constants'
import PeopleGrid from '../people/PeopleGrid'
import Navigation from '@/components/Navigation'

type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
type Company = Database['public']['Tables']['saif_companies']['Row']

type PersonWithCompanies = Person & {
  companies?: (CompanyPerson & {
    company: Company | null
  })[]
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get current user session
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(LOGIN_URL)
  }

  // Fetch user's profile from saif_people
  const { data: person, error: personError } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (personError || !person) {
    redirect('/profile/claim')
  }

  const typedPerson = person as Person

  // Fetch user's company relationships separately
  const { data: userCompanies, error: companiesError } = await supabase
    .from('saif_company_people')
    .select(`
      id,
      relationship_type,
      title,
      is_primary_contact,
      end_date,
      company:saif_companies(id, name, logo_url, stage, website, short_description, industry, city, country)
    `)
    .eq('user_id', person.id)

  // Get the user's primary/active company and their title
  const activeCompanies = (userCompanies || []).filter(
    (c: any) => c.company && !c.end_date
  )
  const primaryCompanyRelation = activeCompanies.find((c: any) => c.is_primary_contact) || activeCompanies[0]
  const userCompany = primaryCompanyRelation?.company
  const founderTitle = primaryCompanyRelation?.title

  // Fetch all founders for this company
  let founders: { id: string; first_name: string | null; last_name: string | null; title: string | null }[] = []
  if (userCompany) {
    const { data: founderRelations } = await supabase
      .from('saif_company_people')
      .select(`
        title,
        person:saif_people(id, first_name, last_name)
      `)
      .eq('company_id', userCompany.id)
      .eq('relationship_type', 'founder')
      .is('end_date', null)

    founders = (founderRelations || []).map((rel: any) => ({
      id: rel.person?.id,
      first_name: rel.person?.first_name,
      last_name: rel.person?.last_name,
      title: rel.title,
    })).filter((f: any) => f.id)
  }

  // Fetch all people for the community listing (same query as people page)
  const { data: people } = await supabase
    .from('saif_people')
    .select(`
      *,
      companies:saif_company_people(
        id,
        relationship_type,
        title,
        is_primary_contact,
        end_date,
        company:saif_companies(id, name, logo_url, stage)
      )
    `)
    .order('first_name')

  // Filter to active/pending people (same as people page)
  const communityList = ((people || []) as PersonWithCompanies[]).filter(
    p => p.status === 'active' || p.status === 'pending'
  )

  const isPartner = typedPerson.role === 'partner'

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Avatar */}
        <div className="mb-8 flex items-center space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {typedPerson.avatar_url ? (
              <img
                src={typedPerson.avatar_url}
                alt={`${typedPerson.first_name} ${typedPerson.last_name}`}
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <span className="text-2xl font-semibold text-gray-500">
                  {typedPerson.first_name?.[0] || '?'}
                </span>
              </div>
            )}
          </div>

          {/* Welcome Text */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome back{typedPerson.first_name ? `, ${typedPerson.first_name}` : ''}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {founderTitle || (typedPerson.role.charAt(0).toUpperCase() + typedPerson.role.slice(1))}
              {userCompany && <> at <Link href={`/companies/${userCompany.id}`} className="font-medium text-gray-900 hover:underline">{userCompany.name}</Link></>}
            </p>
          </div>
        </div>

        {/* Company Card */}
        {userCompany && (
          <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {userCompany.logo_url ? (
                  <img
                    src={userCompany.logo_url}
                    alt={userCompany.name}
                    className="h-16 w-16 object-contain rounded-lg border border-gray-200 p-1"
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <span className="text-2xl font-bold text-gray-400">{userCompany.name[0]}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{userCompany.name}</h3>
                  {userCompany.short_description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{userCompany.short_description}</p>
                  )}
                  {founders.length > 0 && (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="text-gray-500">Founders:</span>{' '}
                      {founders.map((f, idx) => (
                        <span key={f.id}>
                          {idx > 0 && ', '}
                          <Link href={`/people/${f.id}`} className="hover:underline">
                            {f.first_name} {f.last_name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    {userCompany.industry && <span>{userCompany.industry}</span>}
                    {userCompany.city && userCompany.country && (
                      <span>• {userCompany.city}, {userCompany.country}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href={`/companies/${userCompany.id}`}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                View Company
              </Link>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/companies"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Browse SAIF Companies
            </Link>
            <Link
              href="/people"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Browse SAIF People
            </Link>
            <a
              href="https://calendly.com/geoffralston/saif-hours"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Schedule Office Hours
            </a>
          </div>
        </div>

        {/* SAIF Community */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            SAIF Community
          </h3>
          <PeopleGrid people={communityList} isPartner={isPartner} />
        </div>
      </main>
    </div>
  )
}
