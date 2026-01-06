import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'
import PeopleGrid from './PeopleGrid'

type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
type Company = Database['public']['Tables']['saif_companies']['Row']

export default async function PeoplePage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get user's profile
  const { data: currentPerson } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentPerson) {
    redirect('/profile/claim')
  }

  // Fetch all people with their companies (RLS will filter based on user's role)
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
    companies?: (CompanyPerson & {
      company: Company | null
    })[]
  })[]

  // Filter to show active people (those with platform access or tracked founders)
  const activePeople = typedPeople.filter(person =>
    person.status === 'active' || person.status === 'pending'
  )

  const isPartner = currentPerson.role === 'partner'

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
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Companies
              </Link>
              <Link
                href="/people"
                className="text-sm font-medium text-gray-900"
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
          <PeopleGrid people={activePeople} isPartner={isPartner} />
        )}
      </main>
    </div>
  )
}
