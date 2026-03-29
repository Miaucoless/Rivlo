import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendship_id, action } = await req.json()
  if (!friendship_id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const db = getServiceClient()

  const { data: friendship } = await db
    .from('friendships')
    .select('id, addressee_id, status')
    .eq('id', friendship_id)
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Friendship not found or not pending' }, { status: 404 })
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  await db.from('friendships').update({ status: newStatus }).eq('id', friendship_id)

  return NextResponse.json({ ok: true, status: newStatus })
}
