import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import PortfolioClient from './PortfolioClient'

export default async function PortfolioPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, role')
    .eq('auth_user_id', user.id)
    .single()

  // Only partners can access portfolio
  if (!profile || profile.role !== 'partner') {
    redirect('/access-denied')
  }

  const userName = profile.first_name || 'User'

  // Get all investments with company data
  const { data: investments } = await supabase
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
    .order('investment_date', { ascending: false })

  // Get founders for portfolio companies
  const companyIds = [...new Set(investments?.map(inv => inv.company_id) || [])]

  const { data: companyPeople } = await supabase
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
    .is('end_date', null)

  // Create map of company_id -> founders
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

  // Get applications with deliberation notes for these companies
  const { data: applications } = await supabase
    .from('saifcrm_applications')
    .select(`
      id,
      company_id,
      company_name,
      stage,
      deliberation:saifcrm_deliberations(thoughts)
    `)
    .eq('stage', 'invested')

  // Get meeting notes for applications
  const applicationIds = applications?.map(app => app.id) || []
  const { data: meetingNotes } = await supabase
    .from('saifcrm_meeting_notes')
    .select('id, application_id, content, meeting_date, created_at, user_id')
    .in('application_id', applicationIds)

  // Get people for meeting notes
  const noteUserIds = [...new Set(meetingNotes?.map(note => note.user_id).filter(Boolean) || [])]
  const { data: notePeople } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name')
    .in('id', noteUserIds as string[])

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

  // Get which companies are published to the website
  const { data: publishedCompanies } = await supabase
    .from('website_portfolio_companies')
    .select('company_id')
    .in('company_id', companyIds)

  const publishedSet = new Set(publishedCompanies?.map(p => p.company_id) || [])

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
      />
    </div>
  )
}
