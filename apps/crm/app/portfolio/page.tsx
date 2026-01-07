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
    .select('*')
    .order('investment_date', { ascending: false })

  // Get company logos from saif_companies
  const { data: companies } = await supabase
    .from('saif_companies')
    .select('name, logo_url')
    .not('logo_url', 'is', null)

  // Create map of company name -> logo_url
  const logoMap: Record<string, string> = {}
  companies?.forEach(company => {
    if (company.logo_url) {
      logoMap[company.name.toLowerCase()] = company.logo_url
    }
  })

  // Get applications with deliberation notes and meeting notes to map to investments by company name
  const { data: applications } = await supabase
    .from('saifcrm_applications')
    .select(`
      id,
      company_name,
      deliberation:saifcrm_deliberations(thoughts),
      meeting_notes:saifcrm_meeting_notes(id, content, meeting_date, created_at, user_id, saif_people(name))
    `)

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
    const meetingNotes = (app.meeting_notes || []).map((note: {
      id: string
      content: string
      meeting_date: string | null
      created_at: string
      user_id: string
      saif_people: { name: string | null }
    }) => ({
      id: note.id,
      content: note.content,
      meeting_date: note.meeting_date,
      created_at: note.created_at,
      user_name: note.saif_people?.name || null,
    }))

    companyAppMap[app.company_name.toLowerCase()] = {
      applicationId: app.id,
      deliberationNotes: deliberation?.thoughts || null,
      meetingNotes: meetingNotes,
    }
  })

  // Attach application data and logos to investments
  const investmentsWithNotes = (investments || []).map(inv => {
    const appData = companyAppMap[inv.company_name.toLowerCase()]
    const logoUrl = logoMap[inv.company_name.toLowerCase()] || null
    return {
      ...inv,
      applicationId: appData?.applicationId || null,
      deliberationNotes: appData?.deliberationNotes || null,
      meetingNotes: appData?.meetingNotes || [],
      logo_url: logoUrl,
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
