import { NextRequest, NextResponse } from 'next/server'
import { deleteRedisKeys } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

function inboxCacheKeys(userId: string) {
  return [
    `share-inbox:v1:${userId}:all`,
    `share-inbox:v1:${userId}:recipe`,
    `share-inbox:v1:${userId}:workout`,
    `share-inbox:v1:${userId}:saved_meal`,
    `share-inbox:v1:${userId}:grocery_list`,
    `share-inbox:v1:${userId}:weekly_recap`,
  ]
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { share_id, recipient_ids } = await req.json()
  if (!share_id || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = getServiceClient()

  // Validate each recipient is an accepted friend (bidirectional check)
  for (const recipientId of recipient_ids) {
    const { data } = await db
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${recipientId}),` +
        `and(addressee_id.eq.${user.id},requester_id.eq.${recipientId})`
      )
      .maybeSingle()

    if (!data) {
      return NextResponse.json(
        { error: `Recipient ${recipientId} is not an accepted friend` },
        { status: 422 }
      )
    }
  }

  // Get share item name for notification
  const { data: shareItem } = await db
    .from('shared_items')
    .select('item_name, share_token')
    .eq('id', share_id)
    .eq('owner_id', user.id)
    .single()

  if (!shareItem) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  // Get sender display name
  const { data: senderProfile } = await db
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()
  const senderName = senderProfile?.name ?? 'Someone'

  // Insert friend_shares rows
  const shares = recipient_ids.map((id: string) => ({
    share_id,
    recipient_id: id,
  }))
  await db.from('friend_shares').upsert(shares, { onConflict: 'share_id,recipient_id' })

  const notifications = recipient_ids.map((id: string) => ({
    user_id: id,
    type: 'share_received',
    title: `${senderName} shared something with you`,
    message: shareItem.item_name,
    read: false,
    action_url: `/share/${shareItem.share_token}`,
    created_at: new Date().toISOString(),
  }))
  await db.from('notifications').insert(notifications)
  await deleteRedisKeys(recipient_ids.flatMap((id: string) => inboxCacheKeys(id)))

  return NextResponse.json({ ok: true })
}
