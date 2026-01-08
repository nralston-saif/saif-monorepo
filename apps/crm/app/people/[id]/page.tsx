import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FounderNavigation from '@/components/FounderNavigation'
import Navigation from '@/components/Navigation'
import PersonCompanyManager from './PersonCompanyManager'
import Link from 'next/link'

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch the person with their company associations
  const { data: person, error: personError } = await supabase
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
          short_description,
          website
        )
      )
    `)
    .eq('id', id)
    .single()

  if (personError || !person) {
    notFound()
  }

  // Get active company associations
  const activeCompanies = person.companies?.filter(
    (c: any) => c.company && !c.end_date
  ) || []

  const primaryCompany = activeCompanies.find((c: any) => c.is_primary_contact)?.company ||
                         activeCompanies[0]?.company

  const isPartner = currentPerson.role === 'partner'
  const userName = `${currentPerson.first_name || ''} ${currentPerson.last_name || ''}`.trim() || 'User'

  return (
    <div className="min-h-screen bg-white">
      {isPartner ? <Navigation userName={userName} /> : <FounderNavigation />}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/people"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to People
        </Link>

        {/* Profile Header */}
        <div className="flex items-start space-x-6 mb-8">
          {person.avatar_url ? (
            <img
              src={person.avatar_url}
              alt={`${person.first_name} ${person.last_name}`}
              className="h-24 w-24 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-semibold text-gray-500">
                {person.first_name?.[0] || '?'}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {person.first_name} {person.last_name}
            </h1>
            {person.title && (
              <p className="mt-1 text-lg text-gray-600">{person.title}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {person.role === 'board_member' ? 'Board Member' :
                 person.role.charAt(0).toUpperCase() + person.role.slice(1)}
              </span>
              {person.location && (
                <span className="text-sm text-gray-500">{person.location}</span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{person.bio}</p>
          </div>
        )}

        {/* Company Associations - managed by client component */}
        <PersonCompanyManager
          personId={person.id}
          personName={`${person.first_name || ''} ${person.last_name || ''}`.trim() || 'this person'}
          personRole={person.role}
          activeCompanies={activeCompanies}
          isPartner={isPartner}
        />

        {/* Contact & Links */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
          <div className="flex flex-wrap gap-3">
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {person.email}
              </a>
            )}
            {person.linkedin_url && (
              <a
                href={person.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn
              </a>
            )}
            {person.twitter_url && (
              <a
                href={person.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
