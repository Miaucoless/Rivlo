import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_type, item_data, item_name, message } = await req.json()
  if (!item_type || !item_data || !item_name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = getServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  // Retry up to 3x on token collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('shared_items')
      .insert({ owner_id: user.id, item_type, item_name, item_data, message })
      .select('id, share_token')
      .single()

    if (!error && data) {
      const url = `${appUrl}/share/${data.share_token}`
      return NextResponse.json({ share_id: data.id, token: data.share_token, url })
    }
    // only retry on unique constraint violation
    if (!error?.message?.includes('unique')) {
      return NextResponse.json({ error: error?.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not generate share token' }, { status: 500 })
}
