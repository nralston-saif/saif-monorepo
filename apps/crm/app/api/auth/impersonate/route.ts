import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const IMPERSONATE_COOKIE = 'saif_impersonate'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is a partner
    const { data: currentPerson } = await supabase
      .from('saif_people')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!currentPerson || currentPerson.role !== 'partner') {
      return NextResponse.json({ error: 'Only partners can impersonate users' }, { status: 403 })
    }

    const body = await request.json()
    const { targetPersonId } = body

    if (!targetPersonId) {
      return NextResponse.json({ error: 'Target person ID required' }, { status: 400 })
    }

    // Verify target user exists and is not a partner
    const { data: targetPerson } = await supabase
      .from('saif_people')
      .select('id, first_name, last_name, role, auth_user_id')
      .eq('id', targetPersonId)
      .single()

    if (!targetPerson) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetPerson.role === 'partner') {
      return NextResponse.json({ error: 'Cannot impersonate other partners' }, { status: 403 })
    }

    if (!targetPerson.auth_user_id) {
      return NextResponse.json({ error: 'Cannot impersonate users who have not signed up' }, { status: 400 })
    }

    // Set impersonation cookie
    const cookieStore = await cookies()
    cookieStore.set(IMPERSONATE_COOKIE, JSON.stringify({
      targetPersonId: targetPerson.id,
      targetName: `${targetPerson.first_name || ''} ${targetPerson.last_name || ''}`.trim(),
      realPersonId: currentPerson.id,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    })

    return NextResponse.json({
      success: true,
      impersonating: {
        id: targetPerson.id,
        name: `${targetPerson.first_name || ''} ${targetPerson.last_name || ''}`.trim(),
      }
    })
  } catch (error: any) {
    console.error('Impersonate error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(IMPERSONATE_COOKIE)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Stop impersonation error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)

    if (!impersonateCookie) {
      return NextResponse.json({ impersonating: null })
    }

    const data = JSON.parse(impersonateCookie.value)
    return NextResponse.json({
      impersonating: {
        id: data.targetPersonId,
        name: data.targetName,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ impersonating: null })
  }
}
