import { NextRequest } from 'next/server'
import { Liveblocks } from '@liveblocks/node'
import { createClient } from '@/lib/supabase/server'

// Initialize Liveblocks with secret key
const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY || process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || '',
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Get the current user from Supabase auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get the user's profile to check their role
  const { data: profile } = await supabase
    .from('saif_people')
    .select('id, first_name, last_name, name, role, email')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    return new Response('Profile not found', { status: 403 })
  }

  // Only partners can access collaborative features
  if (profile.role !== 'partner') {
    return new Response('Forbidden - Partners only', { status: 403 })
  }

  // Get the room from the request
  const { room } = await request.json()

  // Prepare the session for Liveblocks
  const session = liveblocks.prepareSession(profile.id, {
    userInfo: {
      name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown',
      email: profile.email || '',
    },
  })

  // Allow the user to access the requested room
  session.allow(room, session.FULL_ACCESS)

  // Authorize and return the token
  const { status, body } = await session.authorize()

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
