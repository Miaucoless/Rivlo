import { getServiceClient } from '@/lib/supabase-server'

export type ProfileRow = {
  id: string
  name: string
  username?: string | null
  avatar_url?: string | null
}

export type ShareItemRecord = {
  id: string
  item_type: string
  item_name: string
  share_token: string
  message?: string | null
  created_at: string
  owner_id: string
  item_data?: Record<string, unknown> | null
}

export type ResolvedConversationData = {
  counterpart: ProfileRow | null
  receivedItems: Array<{
    friendShareId: string
    viewedAt: string | null
    sharedItem: ShareItemRecord | null
  }>
  sentItems: Array<{
    friendShareId: string
    viewedAt: string | null
    sharedItem: ShareItemRecord | null
  }>
  comments: Array<{
    id: string
    share_id: string
    user_id: string
    body: string
    created_at: string
  }>
}

export function inboxCacheKeys(userId: string) {
  return [
    `share-inbox:v1:${userId}:all`,
    `share-inbox:v1:${userId}:recipe`,
    `share-inbox:v1:${userId}:workout`,
    `share-inbox:v1:${userId}:saved_meal`,
    `share-inbox:v1:${userId}:grocery_list`,
    `share-inbox:v1:${userId}:weekly_recap`,
    `share-inbox:v1:${userId}:social_post`,
  ]
}

export async function resolveConversationData(userId: string, counterpartId: string): Promise<ResolvedConversationData> {
  const db = getServiceClient()

  const [{ data: counterpartProfile, error: counterpartError }, { data: receivedRows, error: receivedError }, { data: sentRows, error: sentError }] = await Promise.all([
    db
      .from('profiles')
      .select('id, name, username, avatar_url')
      .eq('id', counterpartId)
      .single(),
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
          owner_id,
          item_data
        )
      `)
      .eq('recipient_id', userId)
      .eq('shared_items.owner_id', counterpartId)
      .order('created_at', { ascending: true }),
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
        item_data,
        friend_shares!inner (
          id,
          recipient_id,
          viewed_at,
          created_at
        )
      `)
      .eq('owner_id', userId)
      .eq('friend_shares.recipient_id', counterpartId)
      .order('created_at', { ascending: true }),
  ])

  if (counterpartError) throw new Error(counterpartError.message)
  if (receivedError) throw new Error(receivedError.message)
  if (sentError) throw new Error(sentError.message)

  const counterpart = counterpartProfile as ProfileRow | null
  const receivedItems = ((receivedRows ?? []) as Array<{ id: string; viewed_at?: string | null; created_at: string; shared_items: ShareItemRecord | ShareItemRecord[] | null }>)
    .map((row) => ({
      friendShareId: row.id,
      viewedAt: row.viewed_at ?? null,
      sharedItem: Array.isArray(row.shared_items) ? row.shared_items[0] : row.shared_items,
    }))
    .filter((entry) => entry.sharedItem)

  const sentItems = ((sentRows ?? []) as Array<ShareItemRecord & { friend_shares: Array<{ id: string; recipient_id: string; viewed_at?: string | null; created_at: string }> }>)
    .flatMap((item) => item.friend_shares.map((friendShare) => ({
      friendShareId: friendShare.id,
      viewedAt: friendShare.viewed_at ?? null,
      sharedItem: item,
    })))

  const allShareIds = [...new Set([...receivedItems, ...sentItems].map((entry) => entry.sharedItem?.id).filter(Boolean))] as string[]

  const { data: comments, error: commentsError } = allShareIds.length > 0
    ? await db
        .from('share_comments')
        .select('id, share_id, user_id, body, created_at')
        .in('share_id', allShareIds)
        .in('user_id', [userId, counterpartId])
        .order('created_at', { ascending: true })
    : { data: [], error: null }

  if (commentsError) throw new Error(commentsError.message)

  return {
    counterpart,
    receivedItems,
    sentItems,
    comments: comments ?? [],
  }
}

export function buildConversationDetailPayload(
  userId: string,
  resolved: ResolvedConversationData
) {
  const shareMap = new Map<string, {
    id: string
    share_id: string
    friend_share_id: string
    token: string
    item_type: string
    item_name: string
    message?: string | null
    item_data?: Record<string, unknown> | null
    created_at: string
    direction: 'incoming' | 'outgoing'
  }>()

  resolved.receivedItems.forEach((entry) => {
    if (!entry.sharedItem) return
    shareMap.set(entry.sharedItem.id, {
      id: `share-${entry.sharedItem.id}`,
      share_id: entry.sharedItem.id,
      friend_share_id: entry.friendShareId,
      token: entry.sharedItem.share_token,
      item_type: entry.sharedItem.item_type,
      item_name: entry.sharedItem.item_name,
      message: entry.sharedItem.message,
      item_data: entry.sharedItem.item_data,
      created_at: entry.sharedItem.created_at,
      direction: 'incoming',
    })
  })

  resolved.sentItems.forEach((entry) => {
    if (!entry.sharedItem) return
    shareMap.set(entry.sharedItem.id, {
      id: `share-${entry.sharedItem.id}`,
      share_id: entry.sharedItem.id,
      friend_share_id: entry.friendShareId,
      token: entry.sharedItem.share_token,
      item_type: entry.sharedItem.item_type,
      item_name: entry.sharedItem.item_name,
      message: entry.sharedItem.message,
      item_data: entry.sharedItem.item_data,
      created_at: entry.sharedItem.created_at,
      direction: 'outgoing',
    })
  })

  const timeline = [
    ...[...shareMap.values()].map((entry) => ({
      ...entry,
      type: 'share' as const,
    })),
    ...resolved.comments.map((comment) => ({
      id: `message-${comment.id}`,
      type: 'message' as const,
      created_at: comment.created_at,
      body: comment.body,
      share_id: comment.share_id,
      direction: comment.user_id === userId ? 'outgoing' as const : 'incoming' as const,
    })),
  ].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())

  const latestShare = [...shareMap.values()].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null

  return {
    counterpart: resolved.counterpart,
    latest_share_id: latestShare?.share_id ?? null,
    latest_share_token: latestShare?.token ?? null,
    timeline,
  }
}
