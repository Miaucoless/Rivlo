import { NextRequest, NextResponse } from 'next/server'
import { deleteRedisKeys } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { friendId: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const friendshipId = params.friendId

  const { data: friendship } = await db
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
  }

  const isRequester = friendship.requester_id === user.id
  const isAddressee = friendship.addressee_id === user.id

  if (friendship.status === 'accepted') {
    if (!isRequester && !isAddressee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    // pending/invited: only the requester can cancel
    if (!isRequester) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.from('friendships').delete().eq('id', friendshipId)
  await deleteRedisKeys([
    `friends:v1:${friendship.requester_id}`,
    `friends:v1:${friendship.addressee_id}`,
  ])

  return NextResponse.json({ ok: true })
}
