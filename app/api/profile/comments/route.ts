import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: comments, error } = await db
    .from('share_comments')
    .select('id, body, created_at, share_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const shareIds = [...new Set((comments ?? []).map((comment) => comment.share_id).filter(Boolean))]
  const { data: sharedItems, error: sharedItemsError } = shareIds.length > 0
    ? await db
        .from('shared_items')
        .select('id, item_name, item_type, share_token')
        .in('id', shareIds)
    : { data: [], error: null }

  if (sharedItemsError) {
    return NextResponse.json({ error: sharedItemsError.message }, { status: 500 })
  }

  const sharedItemMap = Object.fromEntries((sharedItems ?? []).map((item) => [item.id, item]))
  const postComments = (comments ?? []).filter((comment) => sharedItemMap[comment.share_id]?.item_type === 'social_post')

  return NextResponse.json(
    postComments.map((comment) => {
      const sharedItem = sharedItemMap[comment.share_id]
      return {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        share_id: comment.share_id,
        item_name: sharedItem?.item_name ?? 'Shared post',
        item_type: sharedItem?.item_type ?? 'social_post',
        share_token: sharedItem?.share_token ?? null,
      }
    })
  )
}
