import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = getServiceClient()

  const { data: item, error } = await db
    .from('shared_items')
    .select('id, item_type, item_name, item_data, message, created_at, owner_id')
    .eq('share_token', params.token)
    .single()

  if (error || !item) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired.' },
      { status: 404 }
    )
  }

  const { data: profile } = await db
    .from('profiles')
    .select('name')
    .eq('id', item.owner_id)
    .single()

  return NextResponse.json({
    share_id: item.id,
    item_type: item.item_type,
    item_name: item.item_name,
    item_data: item.item_data,
    owner_name: profile?.name ?? 'Someone',
    message: item.message,
    created_at: item.created_at,
  })
}
