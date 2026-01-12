import { NextRequest, NextResponse } from 'next/server'
import { requirePartnerApi } from '@/lib/auth/requirePartnerApi'
import {
  dismissNotificationsForApplication,
  dismissNotificationsForTicket,
  NotificationType,
} from '@/lib/notifications'

/**
 * POST /api/notifications/dismiss
 * Dismiss notifications for a specific application or ticket
 * Requires partner authentication.
 */
export async function POST(request: NextRequest) {
  // Verify partner authentication
  const auth = await requirePartnerApi()
  if (!auth.success) {
    return auth.response
  }

  try {
    const { applicationId, ticketId, types, recipientId } = await request.json()

    if (!applicationId && !ticketId) {
      return NextResponse.json(
        { error: 'Either applicationId or ticketId is required' },
        { status: 400 }
      )
    }

    // Use provided recipientId, or default to current user
    // If recipientId is explicitly null, dismiss for ALL recipients
    const targetRecipientId = recipientId === null ? undefined : (recipientId || auth.profile.id)

    if (applicationId) {
      await dismissNotificationsForApplication(
        applicationId,
        targetRecipientId,
        types as NotificationType[] | undefined
      )
    }

    if (ticketId) {
      await dismissNotificationsForTicket(ticketId, targetRecipientId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error dismissing notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
