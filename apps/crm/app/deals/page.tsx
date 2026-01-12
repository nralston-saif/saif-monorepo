import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import DealsClient from './DealsClient'

type RawVote = {
  id: string
  vote: string
  user_id: string
  notes: string | null
  vote_type: string
  saif_people: { name: string } | null
}

type TransformedVote = {
  oduserId: string
  userName: string
  vote: string
  notes: string | null
}

function transformVotes(
  votes: RawVote[] | undefined,
  peopleMap?: Map<string, string | null>
): TransformedVote[] {
  if (!votes) return []

  return votes
    .filter((v) => v.vote_type === 'initial')
    .map((v) => ({
      oduserId: v.user_id,
      userName: v.saif_people?.name || peopleMap?.get(v.user_id) || 'Unknown',
      vote: v.vote,
      notes: v.notes,
    }))
}

export default async function DealsPage(): Promise<React.ReactElement> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, first_name, name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.role !== 'partner') {
    redirect('/access-denied')
  }

  const { data: partners } = await supabase
    .from('saif_people')
    .select('id, name')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('name')

  const { data: people } = await supabase.from('saif_people').select('id, name')

  const peopleMap = new Map(people?.map((p) => [p.id, p.name]) || [])

  // Voting applications
  const { data: votingApplications } = await supabase
    .from('saifcrm_applications')
    .select(
      `
      *,
      saifcrm_votes(id, vote, user_id, notes, vote_type, saif_people(name))
    `
    )
    .in('stage', ['new', 'voting'])
    .order('submitted_at', { ascending: false })

  const votingAppsWithVotes =
    votingApplications?.map((app) => {
      const allVotes = transformVotes(app.saifcrm_votes as RawVote[])
      const userVote = allVotes.find((v) => v.oduserId === profile?.id)

      return {
        id: app.id,
        company_name: app.company_name,
        founder_names: app.founder_names,
        founder_linkedins: app.founder_linkedins,
        founder_bios: app.founder_bios,
        primary_email: app.primary_email,
        company_description: app.company_description,
        website: app.website,
        previous_funding: app.previous_funding,
        deck_link: app.deck_link,
        submitted_at: app.submitted_at,
        votes_revealed: app.votes_revealed,
        voteCount: allVotes.length,
        userVote: userVote?.vote,
        userNotes: userVote?.notes,
        allVotes,
      }
    }) || []

  // Deliberation applications
  const { data: deliberationApplications } = await supabase
    .from('saifcrm_applications')
    .select(
      `
      *,
      saifcrm_votes(id, vote, user_id, notes, vote_type, saif_people(name)),
      saifcrm_deliberations(*),
      email_sender:saif_people!applications_email_sender_id_fkey(name)
    `
    )
    .eq('stage', 'deliberation')
    .eq('votes_revealed', true)

  const deliberationAppsWithVotes =
    deliberationApplications?.map((app) => {
      const votes = transformVotes(app.saifcrm_votes as RawVote[], peopleMap)
      const deliberation = Array.isArray(app.saifcrm_deliberations)
        ? app.saifcrm_deliberations[0]
        : app.saifcrm_deliberations || null

      return {
        id: app.id,
        company_name: app.company_name,
        founder_names: app.founder_names,
        founder_linkedins: app.founder_linkedins,
        founder_bios: app.founder_bios,
        primary_email: app.primary_email,
        company_description: app.company_description,
        website: app.website,
        previous_funding: app.previous_funding,
        deck_link: app.deck_link,
        submitted_at: app.submitted_at,
        stage: app.stage,
        votes,
        voteCount: votes.length,
        allVotes: votes,
        deliberation,
        email_sent: app.email_sent,
        email_sender_name: (app.email_sender as { name: string } | null)?.name || null,
      }
    }) || []

  const undecidedDeliberations = deliberationAppsWithVotes
    .filter(
      (app) =>
        !app.deliberation?.decision ||
        app.deliberation.decision === 'pending' ||
        app.deliberation.decision === 'maybe'
    )
    .sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    )

  const decidedDeliberations = deliberationAppsWithVotes
    .filter(
      (app) =>
        app.deliberation?.decision === 'yes' || app.deliberation?.decision === 'no'
    )
    .sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    )

  // Archived applications
  const { data: archivedApplications } = await supabase
    .from('saifcrm_applications')
    .select(
      `
      *,
      email_sender:saif_people!applications_email_sender_id_fkey(name),
      saifcrm_votes(id, vote, user_id, notes, vote_type, saif_people(name))
    `
    )
    .in('stage', ['invested', 'rejected'])
    .order('submitted_at', { ascending: false })

  const archivedAppsTransformed = (archivedApplications || []).map((app) => ({
    id: app.id,
    company_name: app.company_name,
    founder_names: app.founder_names,
    founder_linkedins: app.founder_linkedins,
    founder_bios: app.founder_bios,
    primary_email: app.primary_email,
    company_description: app.company_description,
    website: app.website,
    previous_funding: app.previous_funding,
    deck_link: app.deck_link,
    stage: app.stage,
    submitted_at: app.submitted_at,
    email_sent: app.email_sent,
    email_sender_name: (app.email_sender as { name: string } | null)?.name || null,
    allVotes: transformVotes(app.saifcrm_votes as RawVote[]),
    draft_rejection_email: (app as { draft_rejection_email?: string }).draft_rejection_email || null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
      <DealsClient
        votingApplications={votingAppsWithVotes}
        undecidedDeliberations={undecidedDeliberations}
        decidedDeliberations={decidedDeliberations}
        archivedApplications={archivedAppsTransformed}
        userId={profile?.id || ''}
        partners={partners || []}
      />
    </div>
  )
}
