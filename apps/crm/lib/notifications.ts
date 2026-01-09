import { createClient } from '@supabase/supabase-js'

// Server-side client with service role for creating notifications
const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type NotificationType =
  | 'new_application'
  | 'ready_for_deliberation'
  | 'new_deliberation_notes'
  | 'decision_made'
  | 'ticket_assigned'
  | 'ticket_archived'
  | 'ticket_status_changed'

export type CreateNotificationParams = {
  recipientId: string
  actorId?: string | null
  type: NotificationType
  title: string
  message?: string
  link?: string
  applicationId?: string
  ticketId?: string
}

/**
 * Create a notification for a single recipient
 * Use this from server-side code (API routes, server actions)
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = getServiceClient()

  const { error } = await supabase.from('saifcrm_notifications').insert({
    recipient_id: params.recipientId,
    actor_id: params.actorId || null,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
    application_id: params.applicationId || null,
    ticket_id: params.ticketId || null,
  })

  if (error) {
    console.error('Error creating notification:', error)
  }

  return { error }
}

/**
 * Create notifications for multiple recipients
 * Excludes the actor from receiving the notification
 */
export async function createNotificationForMany(
  params: Omit<CreateNotificationParams, 'recipientId'> & {
    recipientIds: string[]
    excludeActorId?: string
  }
) {
  const supabase = getServiceClient()

  // Filter out the actor if specified
  const recipients = params.excludeActorId
    ? params.recipientIds.filter((id) => id !== params.excludeActorId)
    : params.recipientIds

  if (recipients.length === 0) {
    return { error: null }
  }

  const notifications = recipients.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: params.actorId || null,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
    application_id: params.applicationId || null,
    ticket_id: params.ticketId || null,
  }))

  const { error } = await supabase.from('saifcrm_notifications').insert(notifications)

  if (error) {
    console.error('Error creating notifications:', error)
  }

  return { error }
}

/**
 * Get all partner IDs for broadcasting notifications
 */
export async function getAllPartnerIds(): Promise<string[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('saif_people')
    .select('id')
    .eq('role', 'partner')

  if (error) {
    console.error('Error fetching partners:', error)
    return []
  }

  return data?.map((p) => p.id) || []
}

/**
 * Get person IDs who voted on an application
 */
export async function getVoterIds(applicationId: string): Promise<string[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('saifcrm_votes')
    .select('user_id')
    .eq('application_id', applicationId)
    .eq('vote_type', 'initial')

  if (error) {
    console.error('Error fetching voters:', error)
    return []
  }

  return data?.map((v) => v.user_id) || []
}

/**
 * Notification: New application submitted
 */
export async function notifyNewApplication(applicationId: string, companyName: string) {
  const partnerIds = await getAllPartnerIds()

  return createNotificationForMany({
    recipientIds: partnerIds,
    type: 'new_application',
    title: `New application: ${companyName}`,
    message: 'A new company has applied. Review and cast your vote.',
    link: `/pipeline#app-${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Application reached 3 votes (ready for deliberation)
 */
export async function notifyReadyForDeliberation(
  applicationId: string,
  companyName: string,
  actorId?: string
) {
  const partnerIds = await getAllPartnerIds()

  return createNotificationForMany({
    recipientIds: partnerIds,
    excludeActorId: actorId,
    actorId,
    type: 'ready_for_deliberation',
    title: `${companyName} ready for deliberation`,
    message: 'All 3 votes are in. Ready to advance.',
    link: `/pipeline#app-${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: New deliberation notes added
 */
export async function notifyNewDeliberationNotes(
  applicationId: string,
  companyName: string,
  actorId: string,
  actorName: string
) {
  const voterIds = await getVoterIds(applicationId)

  return createNotificationForMany({
    recipientIds: voterIds,
    excludeActorId: actorId,
    actorId,
    type: 'new_deliberation_notes',
    title: `New notes on ${companyName}`,
    message: `${actorName} added deliberation notes.`,
    link: `/deliberation/${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Decision made on application
 */
export async function notifyDecisionMade(
  applicationId: string,
  companyName: string,
  decision: 'invested' | 'rejected',
  actorId: string,
  actorName: string
) {
  const voterIds = await getVoterIds(applicationId)

  const decisionText = decision === 'invested' ? 'invested in' : 'rejected'

  return createNotificationForMany({
    recipientIds: voterIds,
    excludeActorId: actorId,
    actorId,
    type: 'decision_made',
    title: `${companyName} ${decisionText}`,
    message: `${actorName} marked ${companyName} as ${decision}.`,
    link: decision === 'invested' ? `/portfolio` : `/deliberation/${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Ticket assigned to someone
 */
export async function notifyTicketAssigned(
  ticketId: string,
  ticketTitle: string,
  assigneeId: string,
  actorId: string,
  actorName: string
) {
  // Don't notify if self-assigning
  if (assigneeId === actorId) {
    return { error: null }
  }

  return createNotification({
    recipientId: assigneeId,
    actorId,
    type: 'ticket_assigned',
    title: `Ticket assigned to you`,
    message: `${actorName} assigned you: "${ticketTitle}"`,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}

/**
 * Notification: Ticket archived (notify creator)
 */
export async function notifyTicketArchived(
  ticketId: string,
  ticketTitle: string,
  creatorId: string,
  actorId: string,
  actorName: string
) {
  // Don't notify if self-archiving
  if (creatorId === actorId) {
    return { error: null }
  }

  return createNotification({
    recipientId: creatorId,
    actorId,
    type: 'ticket_archived',
    title: `Your ticket was archived`,
    message: `${actorName} archived: "${ticketTitle}"`,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}

/**
 * Notification: Ticket status changed (notify creator)
 */
export async function notifyTicketStatusChanged(
  ticketId: string,
  ticketTitle: string,
  creatorId: string,
  actorId: string,
  actorName: string,
  newStatus: string
) {
  // Don't notify if self-updating
  if (creatorId === actorId) {
    return { error: null }
  }

  const statusLabel = newStatus === 'in_progress' ? 'In Progress' : newStatus

  return createNotification({
    recipientId: creatorId,
    actorId,
    type: 'ticket_status_changed',
    title: `Ticket status updated`,
    message: `${actorName} changed "${ticketTitle}" to ${statusLabel}`,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}
