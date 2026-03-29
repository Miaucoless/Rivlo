import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const cacheEnabled = hasRedisClient()
  const cacheKey = `friends-search:v1:${user.id}:${normalizeRedisKeyPart(q)}`

  if (cacheEnabled) {
    const cached = await getRedisJson<unknown[]>(cacheKey)
    if (cached !== null) {
      return withRedisCacheHeader(NextResponse.json(cached), 'hit')
    }
  }

  const db = getServiceClient()

  let results: { id: string; name: string; username?: string; avatar_url?: string }[] = []

  const isEmail = q.includes('@') && !q.startsWith('@')

  if (isEmail) {
    const { data } = await db
      .from('profiles')
      .select('id, name, username, avatar_url')
      .eq('email', q)
      .neq('id', user.id)
    results = data ?? []
  } else {
    const { data } = await db
      .from('profiles')
      .select('id, name, username, avatar_url')
      .eq('username', q.replace(/^@/, '').toLowerCase())
      .neq('id', user.id)
    results = data ?? []
  }

  if (results.length === 0) {
    if (cacheEnabled) {
      await setRedisJson(cacheKey, [], 60)
    }
    return withRedisCacheHeader(NextResponse.json([]), cacheEnabled ? 'miss' : 'skip')
  }

  // Exclude users already in a friendship with current user
  const { data: existing } = await db
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .neq('status', 'declined')

  const existingIds = new Set<string>()
  for (const f of existing ?? []) {
    if (f.requester_id) existingIds.add(f.requester_id)
    if (f.addressee_id) existingIds.add(f.addressee_id)
  }

  const payload = results.filter((r) => !existingIds.has(r.id))

  if (cacheEnabled) {
    await setRedisJson(cacheKey, payload, 60)
  }

  return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
}
