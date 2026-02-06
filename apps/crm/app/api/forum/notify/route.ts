import { NextRequest, NextResponse } from 'next/server'
import { requireCommunityApi } from '@/lib/auth/requireCommunityApi'
import { createNotification, createNotificationForMany } from '@/lib/notifications'
import { createClient } from '@supabase/supabase-js'

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/forum/notify
 * Send notifications for forum events (mentions and replies)
 */
export async function POST(request: NextRequest) {
  const auth = await requireCommunityApi()
  if (!auth.success) {
    return auth.response
  }

  try {
    const { type, postId, replyId, actorId, mentionedIds } = await request.json()

    if (!type || !postId || !actorId) {
      return NextResponse.json(
        { error: 'type, postId, and actorId are required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Get actor name
    const { data: actor } = await supabase
      .from('saif_people')
      .select('first_name, last_name')
      .eq('id', actorId)
      .single()

    const actorName = actor
      ? [actor.first_name, actor.last_name].filter(Boolean).join(' ')
      : 'Someone'

    if (type === 'mention' && mentionedIds?.length > 0) {
      // Notify each mentioned person
      await createNotificationForMany({
        recipientIds: mentionedIds,
        excludeActorId: actorId,
        actorId,
        type: 'forum_mention',
        title: `${actorName} mentioned you in a post`,
        message: 'You were mentioned in a forum post.',
        link: `/forum#post-${postId}`,
      })

      return NextResponse.json({ notified: true, type: 'mention', count: mentionedIds.length })
    }

    if (type === 'reply') {
      // Notify the post author
      const { data: post } = await supabase
        .from('saif_forum_posts')
        .select('author_id')
        .eq('id', postId)
        .single()

      if (post && post.author_id !== actorId) {
        await createNotification({
          recipientId: post.author_id,
          actorId,
          type: 'forum_reply',
          title: `${actorName} replied to your post`,
          message: 'Someone replied to your forum post.',
          link: `/forum#post-${postId}`,
        })
      }

      // Also notify mentioned people in the reply
      if (mentionedIds?.length > 0) {
        await createNotificationForMany({
          recipientIds: mentionedIds,
          excludeActorId: actorId,
          actorId,
          type: 'forum_mention',
          title: `${actorName} mentioned you in a reply`,
          message: 'You were mentioned in a forum reply.',
          link: `/forum#post-${postId}`,
        })
      }

      return NextResponse.json({ notified: true, type: 'reply' })
    }

    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  } catch (error) {
    console.error('Error in forum notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
