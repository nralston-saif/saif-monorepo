import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import TicketsClient from './TicketsClient'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']
type Ticket = Database['public']['Tables']['saif_tickets']['Row']
type Company = Database['public']['Tables']['saif_companies']['Row']

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, email, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/profile/claim')
  }

  // Only partners can access tickets
  if (profile.role !== 'partner') {
    redirect('/access-denied')
  }

  // Fetch all tickets with relationships
  const { data: tickets } = await supabase
    .from('saif_tickets')
    .select(`
      id,
      title,
      description,
      status,
      priority,
      due_date,
      assigned_to,
      created_by,
      related_company,
      related_person,
      tags,
      created_at,
      updated_at,
      archived_at,
      application_id,
      was_unassigned_at_creation,
      assigned_partner:saif_people!saif_tickets_assigned_to_fkey(id, first_name, last_name, email, avatar_url),
      creator:saif_people!saif_tickets_created_by_fkey(id, first_name, last_name, email, avatar_url),
      company:saif_companies!saif_tickets_related_company_fkey(id, name, logo_url),
      person:saif_people!saif_tickets_related_person_fkey(id, first_name, last_name, email),
      application:saifcrm_applications!saif_tickets_application_id_fkey(id, company_name, draft_rejection_email, primary_email),
      comments:saif_ticket_comments(
        id,
        ticket_id,
        author_id,
        content,
        is_final_comment,
        created_at,
        updated_at,
        author:saif_people!saif_ticket_comments_author_id_fkey(id, first_name, last_name, email, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  // Get all active partners for assignment dropdown
  const { data: partners } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, email, avatar_url')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('first_name')

  // Get companies for ticket creation
  const { data: companies } = await supabase
    .from('saif_companies')
    .select('id, name, logo_url')
    .eq('is_active', true)
    .order('name')

  // Get people for ticket creation
  const { data: people } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .order('first_name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile.first_name || 'User'} personId={profile.id} />
      <TicketsClient
        tickets={tickets || []}
        partners={partners || []}
        companies={companies || []}
        people={people || []}
        currentUserId={profile.id}
        userName={profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : user.email || 'User'}
      />
    </div>
  )
}
