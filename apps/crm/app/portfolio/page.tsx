import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { getActiveProfile } from '@/lib/impersonation'
import PortfolioClient from './PortfolioClient'

export default async function PortfolioPage() {
  const supabase = await createClient()

  const { profile } = await getActiveProfile()

  if (!profile) {
    redirect('/login')
  }

  // Only partners can access portfolio
  if (profile.role !== 'partner') {
    redirect('/access-denied')
  }

  const userName = profile.first_name || 'User'

  // STEP 1: Fetch investments, applications, companies, and partners in parallel
  const [{ data: investments }, { data: applications }, { data: allCompanies }, { data: partners }] = await Promise.all([
    supabase
      .from('saif_investments')
      .select(`
        id,
        company_id,
        investment_date,
        type,
        amount,
        round,
        post_money_valuation,
        status,
        company:saif_companies(
          id,
          name,
          logo_url,
          short_description,
          website,
          stage
        )
      `)
      .order('investment_date', { ascending: false }),
    supabase
      .from('saifcrm_applications')
      .select(`
        id,
        company_id,
        company_name,
        stage,
        deliberation:saifcrm_deliberations(thoughts)
      `)
      .eq('stage', 'invested'),
    // Fetch all companies for the "Add Investment" modal
    supabase
      .from('saif_companies')
      .select('id, name, stage')
      .eq('is_active', true)
      .order('name'),
    // Fetch partners for lead partner dropdown
    supabase
      .from('saif_people')
      .select('id, first_name, last_name')
      .eq('role', 'partner')
      .order('first_name')
  ])

  // Extract IDs for dependent queries
  const companyIds = [...new Set(investments?.map(inv => inv.company_id) || [])]
  const applicationIds = applications?.map(app => app.id) || []

  // STEP 2: Fetch companyPeople, meetingNotes, and publishedCompanies in parallel
  const [{ data: companyPeople }, { data: meetingNotes }, { data: publishedCompanies }] = await Promise.all([
    supabase
      .from('saif_company_people')
      .select(`
        company_id,
        relationship_type,
        title,
        end_date,
        person:saif_people(
          id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .in('company_id', companyIds)
      .eq('relationship_type', 'founder')
      .is('end_date', null),
    supabase
      .from('saifcrm_meeting_notes')
      .select('id, application_id, content, meeting_date, created_at, user_id')
      .in('application_id', applicationIds),
    supabase
      .from('website_portfolio_companies')
      .select('company_id')
      .in('company_id', companyIds)
  ])

  // STEP 3: Fetch notePeople (depends on meetingNotes)
  const noteUserIds = [...new Set(meetingNotes?.map(note => note.user_id).filter(Boolean) || [])]
  const { data: notePeople } = noteUserIds.length > 0
    ? await supabase
        .from('saif_people')
        .select('id, first_name, last_name')
        .in('id', noteUserIds as string[])
    : { data: [] }

  // Build maps for efficient lookups
  const foundersMap: Record<string, Array<{
    id: string
    name: string
    email: string | null
    avatar_url: string | null
    title: string | null
  }>> = {}

  companyPeople?.forEach(cp => {
    if (!cp.person) return
    const companyId = cp.company_id
    if (!foundersMap[companyId]) {
      foundersMap[companyId] = []
    }
    foundersMap[companyId].push({
      id: cp.person.id,
      name: `${cp.person.first_name || ''} ${cp.person.last_name || ''}`.trim() || 'Unknown',
      email: cp.person.email,
      avatar_url: cp.person.avatar_url,
      title: cp.title,
    })
  })

  const peopleMap: Record<string, string> = {}
  notePeople?.forEach(person => {
    peopleMap[person.id] = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
  })

  // Create map of application notes
  const appNotesMap: Record<string, {
    deliberationNotes: string | null
    meetingNotes: Array<{
      id: string
      content: string
      meeting_date: string | null
      created_at: string | null
      user_name: string | null
    }>
  }> = {}

  applications?.forEach(app => {
    const deliberation = Array.isArray(app.deliberation) ? app.deliberation[0] : app.deliberation
    const notes = meetingNotes?.filter(n => n.application_id === app.id) || []

    // Key by company_id if available, otherwise by company_name
    const key = app.company_id || app.company_name?.toLowerCase()
    if (key) {
      appNotesMap[key] = {
        deliberationNotes: deliberation?.thoughts || null,
        meetingNotes: notes.map(n => ({
          id: n.id,
          content: n.content,
          meeting_date: n.meeting_date,
          created_at: n.created_at,
          user_name: n.user_id ? peopleMap[n.user_id] : null,
        })),
      }
    }
  })

  const publishedSet = new Set(publishedCompanies?.map(p => p.company_id) || [])

  // Transform partners for dropdown
  const partnersList = partners?.map(p => ({
    id: p.id,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'
  })) || []

  // Transform companies for dropdown
  const companiesList = allCompanies?.map(c => ({
    id: c.id,
    name: c.name,
    stage: c.stage
  })) || []

  // Transform investments for the client
  const portfolioCompanies = investments?.map(inv => {
    const company = Array.isArray(inv.company) ? inv.company[0] : inv.company
    const companyId = inv.company_id
    const appData = appNotesMap[companyId] || appNotesMap[company?.name?.toLowerCase() || '']

    return {
      id: inv.id,
      company_id: companyId,
      company_name: company?.name || 'Unknown',
      logo_url: company?.logo_url || null,
      short_description: company?.short_description || null,
      website: company?.website || null,
      investment_date: inv.investment_date,
      type: inv.type,
      amount: inv.amount,
      round: inv.round,
      post_money_valuation: inv.post_money_valuation,
      status: inv.status,
      founders: foundersMap[companyId] || [],
      deliberationNotes: appData?.deliberationNotes || null,
      meetingNotes: appData?.meetingNotes || [],
      isPublishedToWebsite: publishedSet.has(companyId),
    }
  }) || []

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={userName} personId={profile.id} />
      <PortfolioClient
        investments={portfolioCompanies}
        userId={profile.id}
        userName={userName}
        partners={partnersList}
        companies={companiesList}
      />
    </div>
  )
}
