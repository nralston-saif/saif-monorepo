import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyReadyForDeliberation } from '@/lib/notifications'

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notifications/check-votes
 * Check if an application has reached 3 votes and send notification if so
 */
export async function POST(request: NextRequest) {
  try {
    const { applicationId, voterId } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
    }

    // Get the application with vote count
    const { data: votes, error: votesError } = await supabase
      .from('saifcrm_votes')
      .select('id')
      .eq('application_id', applicationId)
      .eq('vote_type', 'initial')

    if (votesError) {
      console.error('Error fetching votes:', votesError)
      return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
    }

    const voteCount = votes?.length || 0

    // If exactly 3 votes, send notification (this triggers on the 3rd vote)
    if (voteCount === 3) {
      // Get the application name
      const { data: app } = await supabase
        .from('saifcrm_applications')
        .select('company_name')
        .eq('id', applicationId)
        .single()

      if (app) {
        await notifyReadyForDeliberation(applicationId, app.company_name, voterId)
        return NextResponse.json({ notified: true, voteCount })
      }
    }

    return NextResponse.json({ notified: false, voteCount })
  } catch (error) {
    console.error('Error in check-votes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
