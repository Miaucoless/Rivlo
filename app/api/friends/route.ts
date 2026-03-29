import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const { data, error } = await db
    .from('friendships')
    .select('id, requester_id, addressee_id, invited_email, status, created_at, updated_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .neq('status', 'declined')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Collect all user IDs to resolve profiles
  const userIds = new Set<string>()
  for (const f of data ?? []) {
    if (f.requester_id) userIds.add(f.requester_id)
    if (f.addressee_id) userIds.add(f.addressee_id)
  }

  const { data: profiles } = userIds.size > 0
    ? await db.from('profiles').select('id, name, username, avatar_url').in('id', [...userIds])
    : { data: [] }

  const profileMap = Object.fromEntries(
    ((profiles ?? []) as { id: string; name: string; username?: string; avatar_url?: string }[])
      .map((p) => [p.id, p])
  )

  const enriched = (data ?? []).map((f) => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
    return {
      ...f,
      other_user: otherId ? (profileMap[otherId] ?? null) : null,
    }
  })

  return NextResponse.json(enriched)
}
