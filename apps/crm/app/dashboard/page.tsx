import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import DashboardClient from './DashboardClient'
import FounderDashboard from './FounderDashboard'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get full user profile (using auth_user_id to link to auth.users)
  const { data: profile, error: profileError } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  // If no profile, redirect to claim flow
  if (profileError || !profile) {
    redirect('/profile/claim')
  }

  const typedProfile = profile as Person

  // Non-partners (founders, advisors, etc.) see the founder dashboard
  if (typedProfile.role !== 'partner') {
    // Fetch the founder's company
    const { data: companyRelation } = await supabase
      .from('saif_company_people')
      .select(`
        relationship_type,
        title,
        company:saif_companies(
          id,
          name,
          short_description,
          logo_url,
          website,
          industry,
          city,
          country
        )
      `)
      .eq('user_id', typedProfile.id)
      .eq('relationship_type', 'founder')
      .is('end_date', null)
      .single()

    const company = companyRelation?.company as {
      id: string
      name: string
      short_description: string | null
      logo_url: string | null
      website: string | null
      industry: string | null
      city: string | null
      country: string | null
    } | null

    // Fetch all founders for this company
    let founders: { id: string; first_name: string | null; last_name: string | null; title: string | null }[] = []
    if (company) {
      const { data: founderRelations } = await supabase
        .from('saif_company_people')
        .select(`
          title,
          person:saif_people(id, first_name, last_name)
        `)
        .eq('company_id', company.id)
        .eq('relationship_type', 'founder')
        .is('end_date', null)

      founders = (founderRelations || []).map((rel: any) => ({
        id: rel.person?.id,
        first_name: rel.person?.first_name,
        last_name: rel.person?.last_name,
        title: rel.title,
      })).filter((f: any) => f.id)
    }

    // Fetch community (active/pending people) - limited for performance
    const { data: communityPeople } = await supabase
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
      .in('status', ['active', 'pending'])
      .order('first_name')
      .limit(100)

    return <FounderDashboard person={typedProfile} userEmail={user.email || ''} company={company} founders={founders} founderTitle={companyRelation?.title} community={communityPeople || []} />
  }

  // Partners see the CRM dashboard
  // Run all queries in parallel for maximum performance
  const [
    { data: pipelineApps },
    { data: deliberationApps },
    { data: statsData },
    { data: myActiveTickets },
    { count: overdueTicketsCount },
    { data: notificationsData },
    { data: portfolioData }
  ] = await Promise.all([
    // Pipeline applications
    supabase
      .from('saifcrm_applications')
      .select(`
        id,
        company_name,
        founder_names,
        company_description,
        submitted_at,
        saifcrm_votes(id, user_id, vote_type)
      `)
      .in('stage', ['new', 'voting'])
      .order('submitted_at', { ascending: false }),

    // Deliberation applications
    supabase
      .from('saifcrm_applications')
      .select(`
        id,
        company_name,
        founder_names,
        submitted_at,
        saifcrm_deliberations(decision)
      `)
      .eq('stage', 'deliberation')
      .order('submitted_at', { ascending: false }),

    // Application stats
    supabase.rpc('get_application_stats'),

    // Active tickets
    supabase
      .from('saif_tickets')
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        status,
        tags,
        company:related_company(name)
      `)
      .in('status', ['open', 'in_progress'])
      .or(`assigned_to.eq.${profile?.id},assigned_to.is.null`)
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10),

    // Overdue tickets count
    supabase
      .from('saif_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress'])
      .lt('due_date', new Date().toISOString().split('T')[0]),

    // Notifications
    supabase
      .from('saifcrm_notifications')
      .select(`
        id,
        type,
        title,
        message,
        link,
        application_id,
        ticket_id,
        read_at,
        created_at,
        actor:actor_id(name, first_name, last_name)
      `)
      .eq('recipient_id', profile?.id)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20),

    // Portfolio stats
    supabase.rpc('get_portfolio_stats')
  ])

  // Filter pipeline apps that need user's vote
  const needsVote = pipelineApps?.filter((app) => {
    const initialVotes = app.saifcrm_votes?.filter((v: any) => v.vote_type === 'initial') || []
    return !initialVotes.some((v: any) => v.user_id === profile?.id)
  }).map(app => ({
    id: app.id,
    company_name: app.company_name,
    founder_names: app.founder_names,
    company_description: app.company_description,
    submitted_at: app.submitted_at,
  })) || []

  // Filter deliberation apps without final decision
  const needsDecision = deliberationApps?.filter(app => {
    const delib = Array.isArray(app.saifcrm_deliberations) ? app.saifcrm_deliberations[0] : app.saifcrm_deliberations
    const decision = (delib as any)?.decision
    return !decision || decision === 'pending' || decision === 'maybe'
  }).map(app => ({
    id: app.id,
    company_name: app.company_name,
    founder_names: app.founder_names,
    submitted_at: app.submitted_at,
  })) || []

  // Process stats
  const statsRow = Array.isArray(statsData) ? statsData[0] : statsData
  const stats = {
    pipeline: Number(statsRow?.pipeline) || 0,
    deliberation: Number(statsRow?.deliberation) || 0,
    invested: Number(statsRow?.invested) || 0,
    rejected: Number(statsRow?.rejected) || 0,
  }

  const portfolioRow = Array.isArray(portfolioData) ? portfolioData[0] : portfolioData
  const portfolioStats = {
    totalInvestments: Number(portfolioRow?.total_investments) || 0,
    totalInvested: Number(portfolioRow?.total_invested) || 0,
    averageCheck: Number(portfolioRow?.average_check) || 0,
  }

  const notifications = (notificationsData || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    application_id: n.application_id,
    ticket_id: n.ticket_id,
    read_at: n.read_at,
    created_at: n.created_at,
    actor_name: n.actor?.first_name && n.actor?.last_name
      ? `${n.actor.first_name} ${n.actor.last_name}`
      : n.actor?.name || null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
      <DashboardClient
        needsVote={needsVote}
        needsDecision={needsDecision}
        myActiveTickets={myActiveTickets || []}
        overdueTicketsCount={overdueTicketsCount || 0}
        stats={stats}
        portfolioStats={portfolioStats}
        notifications={notifications}
        userId={profile?.id || ''}
      />
    </div>
  )
}
