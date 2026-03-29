import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addressee_id, email } = await req.json()
  if (!addressee_id && !email) {
    return NextResponse.json({ error: 'Provide addressee_id or email' }, { status: 400 })
  }

  const db = getServiceClient()

  let targetId: string | null = addressee_id ?? null
  let targetEmail: string | null = null

  if (!targetId && email) {
    const { data: existingUser } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      targetId = existingUser.id
    } else {
      targetEmail = email
    }
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
  }

  if (targetId) {
    const { data: existing } = await db
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),` +
        `and(addressee_id.eq.${user.id},requester_id.eq.${targetId})`
      )
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Request already exists', status: existing.status }, { status: 409 })
    }

    const { data, error } = await db
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: targetId, status: 'pending' })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the addressee
    const { data: senderProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
    const senderName = senderProfile?.name ?? 'Someone'
    await db.from('notifications').insert({
      user_id: targetId,
      type: 'info',
      title: 'New friend request',
      message: `${senderName} wants to connect with you.`,
      read: false,
      action_url: '/dashboard/settings?tab=friends',
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ friendship_id: data.id, type: 'request_sent' })
  }

  if (targetEmail) {
    const { data: existingInvite } = await db
      .from('friendships')
      .select('id')
      .eq('requester_id', user.id)
      .eq('invited_email', targetEmail)
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json({ error: 'Invite already sent', status: 'invited' }, { status: 409 })
    }

    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(targetEmail)
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

    const { data } = await db
      .from('friendships')
      .insert({ requester_id: user.id, invited_email: targetEmail, status: 'invited' })
      .select('id')
      .single()

    return NextResponse.json({ friendship_id: data?.id, type: 'invite_sent' })
  }

  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
