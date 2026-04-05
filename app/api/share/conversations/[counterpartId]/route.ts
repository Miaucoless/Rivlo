import { NextRequest, NextResponse } from 'next/server'
import { deleteRedisKeys } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'
import { buildConversationDetailPayload, inboxCacheKeys, resolveConversationData } from '@/lib/shared-conversations'

export async function GET(
  _req: NextRequest,
  { params }: { params: { counterpartId: string } }
) {
  const user = await getAuthUser(_req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const db = getServiceClient()
    const resolved = await resolveConversationData(user.id, params.counterpartId)
    const { counterpart, receivedItems } = resolved

    if (!counterpart) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    const unseenIncomingIds = receivedItems.filter((item) => !item.viewedAt).map((item) => item.friendShareId)
    if (unseenIncomingIds.length > 0) {
      await db
        .from('friend_shares')
        .update({ viewed_at: new Date().toISOString() })
        .in('id', unseenIncomingIds)
        .eq('recipient_id', user.id)

      await deleteRedisKeys(inboxCacheKeys(user.id))
    }

    return NextResponse.json(buildConversationDetailPayload(user.id, resolved))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load conversation.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { counterpartId: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { body?: string; share_id?: string } | null
  const message = body?.body?.trim()

  if (!message) {
    return NextResponse.json({ error: 'Write a message first.' }, { status: 400 })
  }

  if (message.length > 280) {
    return NextResponse.json({ error: 'Messages must be 280 characters or less.' }, { status: 400 })
  }

  try {
    const db = getServiceClient()
    const { counterpart, receivedItems, sentItems } = await resolveConversationData(user.id, params.counterpartId)
    if (!counterpart) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    const explicitShareId = body?.share_id?.trim() || null
    const latestShare = [...receivedItems, ...sentItems]
      .map((entry) => entry.sharedItem)
      .filter((entry): entry is ShareItemRecord => Boolean(entry))
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]

    const targetShareId = explicitShareId ?? latestShare?.id ?? null
    if (!targetShareId) {
      return NextResponse.json({ error: 'There is nothing shared in this conversation yet.' }, { status: 400 })
    }

    const { error } = await db.from('share_comments').insert({
      share_id: targetShareId,
      user_id: user.id,
      body: message,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await db.from('notifications').insert({
      user_id: params.counterpartId,
      type: 'info',
      title: 'New message in shared items',
      message: `${user.user_metadata?.name || user.email || 'Someone'} sent you a message in shared items.`,
      action_url: `/dashboard/shared?conversation=${params.counterpartId}`,
      read: false,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not send message.' }, { status: 500 })
  }
}
