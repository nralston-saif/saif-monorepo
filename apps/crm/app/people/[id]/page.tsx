import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FounderNavigation from '@/components/FounderNavigation'
import Navigation from '@/components/Navigation'
import PartnerViewBanner from '@/components/PartnerViewBanner'
import PersonView from './PersonView'

export default async function PersonPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams])
  const supabase = await createClient()

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

  // Fetch introducer name if set
  let introducerName: string | null = null
  if (person.introduced_by) {
    const { data: introducer } = await supabase
      .from('saif_people')
      .select('first_name, last_name, name')
      .eq('id', person.introduced_by)
      .single()

    if (introducer) {
      introducerName = introducer.name || `${introducer.first_name || ''} ${introducer.last_name || ''}`.trim() || null
    }
  }

  // Get active company associations
  const activeCompanies = person.companies?.filter(
    (c: any) => c.company && !c.end_date
  ) || []

  const isPartner = currentPerson.role === 'partner'
  const wantsCommunityView = view === 'community'
  const isPartnerViewingAsCommunity = isPartner && wantsCommunityView
  const showPartnerView = isPartner && !wantsCommunityView
  const userName = currentPerson.first_name || 'User'

  // Can edit if partner (in partner view) or viewing own profile
  const canEdit = showPartnerView || currentPerson.id === person.id

  return (
    <div className="min-h-screen bg-white">
      {showPartnerView ? <Navigation userName={userName} personId={currentPerson.id} /> : <FounderNavigation isPartnerViewingAsCommunity={isPartnerViewingAsCommunity} />}

      {isPartnerViewingAsCommunity && <PartnerViewBanner returnPath={`/people/${id}`} />}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PersonView
          person={person as any}
          introducerName={introducerName}
          activeCompanies={activeCompanies as any}
          canEdit={canEdit}
          isPartner={showPartnerView}
          currentUserId={currentPerson.id}
          currentUserName={currentPerson.first_name || 'User'}
        />
      </main>
    </div>
  )
}
