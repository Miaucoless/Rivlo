import { NextRequest, NextResponse } from 'next/server'
import { getRedisJson, hasRedisClient, normalizeRedisKeyPart, setRedisJson, withRedisCacheHeader } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function scoreProfileMatch(
  profile: { name: string; username?: string | null },
  query: string
) {
  const normalizedQuery = normalizeSearchValue(query)
  const normalizedName = normalizeSearchValue(profile.name)
  const normalizedUsername = normalizeSearchValue(profile.username)

  if (!normalizedQuery) return 0
  if (normalizedUsername === normalizedQuery) return 500
  if (normalizedName === normalizedQuery) return 460
  if (normalizedUsername.startsWith(normalizedQuery)) return 380
  if (normalizedName.startsWith(normalizedQuery)) return 340

  const usernameWords = normalizedUsername.split(/[^a-z0-9]+/).filter(Boolean)
  const nameWords = normalizedName.split(/[^a-z0-9]+/).filter(Boolean)
  if (usernameWords.some((word) => word.startsWith(normalizedQuery))) return 300
  if (nameWords.some((word) => word.startsWith(normalizedQuery))) return 270
  if (normalizedUsername.includes(normalizedQuery)) return 220
  if (normalizedName.includes(normalizedQuery)) return 180
  return 0
}

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
  const normalizedLookup = q.replace(/^@/, '').trim()
  const escapedLookup = normalizedLookup.replace(/[%_,]/g, (char) => `\\${char}`)

  if (isEmail) {
    let { data, error } = await db
      .from('profiles')
      .select('id, name, username, avatar_url')
      .eq('email', q)
      .neq('id', user.id)

    if (error && (error.message.includes('username') || error.message.includes('schema cache'))) {
      const fallback = await db
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('email', q)
        .neq('id', user.id)
      data = fallback.data?.map((profile) => ({ ...profile, username: undefined })) ?? []
    }

    results = data ?? []
  } else {
    let { data, error } = await db
      .from('profiles')
      .select('id, name, username, avatar_url')
      .or(`username.ilike.%${escapedLookup}%,name.ilike.%${escapedLookup}%`)
      .neq('id', user.id)
      .limit(20)

    if (error && (error.message.includes('username') || error.message.includes('schema cache'))) {
      const fallback = await db
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${escapedLookup}%`)
        .neq('id', user.id)
        .limit(20)
      data = fallback.data?.map((profile) => ({ ...profile, username: undefined })) ?? []
    }

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

  const payload = results
    .filter((r) => !existingIds.has(r.id))
    .sort((a, b) => {
      const scoreDiff = scoreProfileMatch(b, normalizedLookup) - scoreProfileMatch(a, normalizedLookup)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name)
    })
    .slice(0, 8)

  if (cacheEnabled) {
    await setRedisJson(cacheKey, payload, 60)
  }

  return withRedisCacheHeader(NextResponse.json(payload), cacheEnabled ? 'miss' : 'skip')
}
