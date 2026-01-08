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

  // Get user profile (using auth_user_id to link to auth.users)
  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .single()

  // Only partners can access portfolio
  if (!profile || profile.role !== 'partner') {
    redirect('/access-denied')
  }

  // Get all investments
  const { data: investments } = await supabase
    .from('saifcrm_investments')
    .select('id, company_name, investment_date, amount, terms, stealthy, contact_email, contact_name, website, description, founders, other_funders, notes, created_at, updated_at')
    .order('investment_date', { ascending: false })
    .limit(200)

  // Get company logos from saif_companies (keyed by name for matching)
  const { data: companies } = await supabase
    .from('saif_companies')
    .select('name, logo_url')
    .not('logo_url', 'is', null)

  // Create map of company name (lowercase) -> logo_url
  const logoMap: Record<string, string> = {}
  companies?.forEach(company => {
    if (company.logo_url) {
      logoMap[company.name.toLowerCase()] = company.logo_url
    }
  })

  // Get applications with deliberation notes (no meeting notes to avoid nested joins)
  const { data: applications } = await supabase
    .from('saifcrm_applications')
    .select(`
      id,
      company_name,
      stage,
      deliberation:saifcrm_deliberations(thoughts)
    `)
    .eq('stage', 'invested')
    .limit(500)

  // Get meeting notes separately for these applications
  const applicationIds = applications?.map(app => app.id) || []
  const { data: meetingNotes } = await supabase
    .from('saifcrm_meeting_notes')
    .select('id, application_id, content, meeting_date, created_at, user_id')
    .in('application_id', applicationIds)
    .limit(1000)

  // Get people for these meeting notes
  const userIds = [...new Set(meetingNotes?.map(note => note.user_id).filter(Boolean) || [])]
  const { data: people } = await supabase
    .from('saif_people')
    .select('id, name')
    .in('id', userIds as string[])

  // Create people map
  const peopleMap: Record<string, string> = {}
  people?.forEach(person => {
    peopleMap[person.id] = person.name || 'Unknown'
  })

  // Create map of application_id -> meeting notes
  const appMeetingNotesMap: Record<string, Array<{
    id: string
    content: string
    meeting_date: string | null
    created_at: string
    user_name: string | null
  }>> = {}

  meetingNotes?.forEach(note => {
    if (!appMeetingNotesMap[note.application_id]) {
      appMeetingNotesMap[note.application_id] = []
    }
    appMeetingNotesMap[note.application_id].push({
      id: note.id,
      content: note.content,
      meeting_date: note.meeting_date,
      created_at: note.created_at,
      user_name: note.user_id ? peopleMap[note.user_id] : null,
    })
  })

  // Create maps for company name -> application data
  const companyAppMap: Record<string, {
    applicationId: string
    deliberationNotes: string | null
    meetingNotes: Array<{
      id: string
      content: string
      meeting_date: string | null
      created_at: string
      user_name: string | null
    }>
  }> = {}

  applications?.forEach(app => {
    const deliberation = Array.isArray(app.deliberation) ? app.deliberation[0] : app.deliberation
    const meetingNotes = appMeetingNotesMap[app.id] || []

    companyAppMap[app.company_name.toLowerCase()] = {
      applicationId: app.id,
      deliberationNotes: deliberation?.thoughts || null,
      meetingNotes: meetingNotes,
    }
  })

  // Attach application data and logos to investments
  const investmentsWithNotes = (investments || []).map(inv => {
    const appData = companyAppMap[inv.company_name.toLowerCase()]
    return {
      ...inv,
      applicationId: appData?.applicationId || null,
      deliberationNotes: appData?.deliberationNotes || null,
      meetingNotes: appData?.meetingNotes || [],
      logo_url: logoMap[inv.company_name.toLowerCase()] || null,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.name || user.email || 'User'} />
      <PortfolioClient
        investments={investmentsWithNotes}
        userId={profile?.id || ''}
        userName={profile?.name || user.email || 'User'}
      />
    </div>
  )
}
