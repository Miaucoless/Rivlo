import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, username, avatar_url } = body

  const updates: Record<string, string> = {}
  if (name !== undefined) updates.name = name
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (username !== undefined) updates.username = (username as string).toLowerCase()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = getServiceClient()

  const { data, error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, name, username, avatar_url')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
