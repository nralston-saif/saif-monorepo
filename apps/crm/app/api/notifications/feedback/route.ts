import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyNewFounderFeedback } from '@/lib/notifications'

/**
 * POST /api/notifications/feedback
 * Send notification for new founder feedback submission
 * Called by founders after successfully submitting feedback
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get person record and verify they're a founder
    const { data: person, error: personError } = await supabase
      .from('saif_people')
      .select('id, first_name, last_name, role')
      .eq('auth_user_id', user.id)
      .single()

    if (personError || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    if (person.role !== 'founder') {
      return NextResponse.json({ error: 'Only founders can submit feedback' }, { status: 403 })
    }

    const { ticketId, ticketTitle, feedbackType } = await request.json()

    if (!ticketId || !ticketTitle || !feedbackType) {
      return NextResponse.json(
        { error: 'ticketId, ticketTitle, and feedbackType required' },
        { status: 400 }
      )
    }

    // Get founder's company name (if any)
    const { data: companyRelations } = await supabase
      .from('saif_company_people')
      .select('company:saif_companies(name)')
      .eq('user_id', person.id)
      .eq('relationship_type', 'founder')
      .limit(1)

    const companyName = companyRelations?.[0]?.company?.name || null
    const founderName = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'A founder'

    await notifyNewFounderFeedback(
      ticketId,
      ticketTitle,
      feedbackType,
      founderName,
      companyName
    )

    return NextResponse.json({ notified: true })
  } catch (error) {
    console.error('Error in feedback notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
