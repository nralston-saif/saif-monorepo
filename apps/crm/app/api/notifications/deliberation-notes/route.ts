import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyNewDeliberationNotes } from '@/lib/notifications'
import { requirePartnerApi } from '@/lib/auth/requirePartnerApi'

// Server-side Supabase client (service role for notifications)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notifications/deliberation-notes
 * Send notification about new deliberation notes
 * Rate limited to prevent spam during auto-save
 * Requires partner authentication.
 */
export async function POST(request: NextRequest) {
  // Verify partner authentication
  const auth = await requirePartnerApi()
  if (!auth.success) {
    return auth.response
  }

  try {
    const { applicationId, actorId, actorName } = await request.json()

    if (!applicationId || !actorId || !actorName) {
      return NextResponse.json(
        { error: 'applicationId, actorId, and actorName required' },
        { status: 400 }
      )
    }

    // Check if a notification was already sent in the last hour for this application
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: recentNotification } = await supabase
      .from('saifcrm_notifications')
      .select('id')
      .eq('application_id', applicationId)
      .eq('type', 'new_deliberation_notes')
      .gte('created_at', oneHourAgo)
      .limit(1)
      .single()

    if (recentNotification) {
      // Already sent a notification recently, skip
      return NextResponse.json({ notified: false, reason: 'rate_limited' })
    }

    // Get the application name
    const { data: app, error: appError } = await supabase
      .from('saifcrm_applications')
      .select('company_name')
      .eq('id', applicationId)
      .single()

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Send notification
    await notifyNewDeliberationNotes(applicationId, app.company_name, actorId, actorName)

    return NextResponse.json({ notified: true })
  } catch (error) {
    console.error('Error in deliberation-notes notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
