import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'
import { getServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const cacheEnabled = hasRedisClient()
  const cacheKey = `share-token:v1:${normalizeRedisKeyPart(params.token)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<Record<string, unknown>>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  const db = getServiceClient()

  const { data: item, error } = await db
    .from('shared_items')
    .select('id, item_type, item_name, item_data, message, created_at, owner_id')
    .eq('share_token', params.token)
    .single()

  if (error || !item) {
    return withRedisCacheHeader(NextResponse.json(
      { error: 'This link is invalid or has expired.' },
      { status: 404 }
    ), cacheEnabled ? 'miss' : 'skip')
  }

  const { data: profile } = await db
    .from('profiles')
    .select('name')
    .eq('id', item.owner_id)
    .single()

  const payload = {
    share_id: item.id,
    item_type: item.item_type,
    item_name: item.item_name,
    item_data: item.item_data,
    owner_name: profile?.name ?? 'Someone',
    message: item.message,
    created_at: item.created_at,
  }

  if (cacheEnabled) {
    await setRedisJson(cacheKey, payload, 60 * 5)
  }

  return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
}
