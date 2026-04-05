import { NextRequest, NextResponse } from 'next/server'
import { deleteRedisKeys } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'
import { buildConversationDetailPayload, inboxCacheKeys, resolveConversationData } from '@/lib/shared-conversations'

type ProfileRow = {
  id: string
  name: string
  username?: string | null
  avatar_url?: string | null
}

type SharedItemRow = {
  id: string
  item_type: string
  item_name: string
  share_token: string
  message?: string | null
  created_at: string
  owner_id: string
}

type FriendShareRow = {
  id: string
  recipient_id: string
  viewed_at?: string | null
  created_at: string
  shared_items: SharedItemRow | SharedItemRow[] | null
}

const MAX_SHARE_SUMMARY_ROWS = 120
const MAX_COMMENT_SUMMARY_ROWS = 160
const MAX_CONVERSATIONS = 40

export async function GET(_req: NextRequest) {
  const user = await getAuthUser(_req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const [{ data: receivedRows, error: receivedError }, { data: sentItems, error: sentError }] = await Promise.all([
    db
      .from('friend_shares')
      .select(`
        id,
        recipient_id,
        viewed_at,
        created_at,
        shared_items!inner (
          id,
          item_type,
          item_name,
          share_token,
          message,
          created_at,
          owner_id
        )
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_SHARE_SUMMARY_ROWS),
    db
      .from('shared_items')
      .select(`
        id,
        item_type,
        item_name,
        share_token,
        message,
        created_at,
        owner_id,
        friend_shares (
          id,
          recipient_id,
          viewed_at,
          created_at
        )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_SHARE_SUMMARY_ROWS),
  ])

  if (receivedError) return NextResponse.json({ error: receivedError.message }, { status: 500 })
  if (sentError) return NextResponse.json({ error: sentError.message }, { status: 500 })

  const received = ((receivedRows ?? []) as FriendShareRow[]).map((row) => ({
    friendShareId: row.id,
    viewedAt: row.viewed_at ?? null,
    createdAt: row.created_at,
    sharedItem: Array.isArray(row.shared_items) ? row.shared_items[0] : row.shared_items,
  })).filter((row) => row.sharedItem)

  const sent = ((sentItems ?? []) as Array<SharedItemRow & { friend_shares?: Array<Pick<FriendShareRow, 'id' | 'recipient_id' | 'viewed_at' | 'created_at'>> | null }>).flatMap((item) =>
    (item.friend_shares ?? []).map((share) => ({
      friendShareId: share.id,
      viewedAt: share.viewed_at ?? null,
      createdAt: share.created_at,
      recipientId: share.recipient_id,
      sharedItem: item,
    }))
  )

  const counterpartIds = new Set<string>()
  received.forEach((row) => {
    if (row.sharedItem?.owner_id) counterpartIds.add(row.sharedItem.owner_id)
  })
  sent.forEach((row) => {
    if (row.recipientId) counterpartIds.add(row.recipientId)
  })

  const shareToCounterpartId = new Map<string, string>()
  received.forEach((row) => {
    const shareId = row.sharedItem?.id
    const counterpartId = row.sharedItem?.owner_id
    if (shareId && counterpartId) shareToCounterpartId.set(shareId, counterpartId)
  })
  sent.forEach((row) => {
    const shareId = row.sharedItem?.id
    if (shareId && row.recipientId) shareToCounterpartId.set(shareId, row.recipientId)
  })

  const shareIds = [...shareToCounterpartId.keys()]

  const { data: comments, error: commentsError } = shareIds.length > 0
    ? await db
        .from('share_comments')
        .select('id, share_id, user_id, body, created_at')
        .in('share_id', shareIds)
        .order('created_at', { ascending: false })
        .limit(MAX_COMMENT_SUMMARY_ROWS)
    : { data: [], error: null }

  const { data: profiles, error: profileError } = counterpartIds.size > 0
    ? await db
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', [...counterpartIds])
    : { data: [], error: null }

  if (commentsError) return NextResponse.json({ error: commentsError.message }, { status: 500 })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const profileMap = Object.fromEntries(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))

  const conversationMap = new Map<string, {
    id: string
    title: string
    username?: string | null
    avatar_url?: string | null
    latest_at: string
    latest_preview: string
    unread_count: number
    item_count: number
  }>()

  const applyEntry = (counterpartId: string, preview: string, createdAt: string, unreadIncrement = 0) => {
    const profile = profileMap[counterpartId]
    if (!profile) return

    const current = conversationMap.get(counterpartId)
    if (!current) {
      conversationMap.set(counterpartId, {
        id: counterpartId,
        title: profile.name,
        username: profile.username ?? null,
        avatar_url: profile.avatar_url ?? null,
        latest_at: createdAt,
        latest_preview: preview,
        unread_count: unreadIncrement,
        item_count: 1,
      })
      return
    }

    const isNewer = new Date(createdAt).getTime() > new Date(current.latest_at).getTime()
    conversationMap.set(counterpartId, {
      ...current,
      latest_at: isNewer ? createdAt : current.latest_at,
      latest_preview: isNewer ? preview : current.latest_preview,
      unread_count: current.unread_count + unreadIncrement,
      item_count: current.item_count + 1,
    })
  }

  received.forEach((row) => {
    const item = row.sharedItem
    if (!item) return
    const preview = item.message?.trim() || `Shared ${item.item_name}`
    applyEntry(item.owner_id, preview, row.createdAt, row.viewedAt ? 0 : 1)
  })

  sent.forEach((row) => {
    const item = row.sharedItem
    const preview = item.message?.trim() || `You shared ${item.item_name}`
    applyEntry(row.recipientId, preview, row.createdAt, 0)
  })

  ;(comments ?? []).forEach((comment) => {
    const counterpartId = shareToCounterpartId.get(comment.share_id)
    if (!counterpartId) return

    const preview = typeof comment.body === 'string' && comment.body.trim()
      ? comment.user_id === user.id
        ? `You: ${comment.body.trim()}`
        : comment.body.trim()
      : 'New message'

    applyEntry(counterpartId, preview, comment.created_at, 0)
  })

  const conversations = [...conversationMap.values()]
    .sort((left, right) => new Date(right.latest_at).getTime() - new Date(left.latest_at).getTime())
    .slice(0, MAX_CONVERSATIONS)
  const selectedConversationId = _req.nextUrl.searchParams.get('selected')

  let initialDetail = null
  let initialConversationId: string | null = null

  if (selectedConversationId && conversations.some((conversation) => conversation.id === selectedConversationId)) {
    initialConversationId = selectedConversationId

    try {
      const db = getServiceClient()
      const resolved = await resolveConversationData(user.id, selectedConversationId)
      const unseenIncomingIds = resolved.receivedItems.filter((item) => !item.viewedAt).map((item) => item.friendShareId)

      if (unseenIncomingIds.length > 0) {
        await db
          .from('friend_shares')
          .update({ viewed_at: new Date().toISOString() })
          .in('id', unseenIncomingIds)
          .eq('recipient_id', user.id)

        await deleteRedisKeys(inboxCacheKeys(user.id))
      }

      if (resolved.counterpart) {
        initialDetail = buildConversationDetailPayload(user.id, resolved)
      }
    } catch {
      initialDetail = null
    }
  }

  return NextResponse.json({
    conversations,
    initialConversationId,
    initialDetail,
  })
}
