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
    `share-inbox:v1:${userId}:social_post`,
  ]
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { friendShareId: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const { error } = await db
    .from('friend_shares')
    .delete()
    .eq('id', params.friendShareId)
    .eq('recipient_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await deleteRedisKeys(inboxCacheKeys(user.id))

  return NextResponse.json({ success: true })
}
