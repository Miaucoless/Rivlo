import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { friendShareId: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const { error } = await db
    .from('friend_shares')
    .delete()
    .eq('id', params.friendShareId)
    .eq('recipient_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
