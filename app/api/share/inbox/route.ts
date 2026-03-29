import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typeFilter = req.nextUrl.searchParams.get('type')
  const db = getServiceClient()

  const { data, error } = await db
    .from('friend_shares')
    .select(`
      id,
      viewed_at,
      imported_at,
      created_at,
      shared_items (
        id,
        item_type,
        item_name,
        share_token,
        message,
        created_at,
        owner_id
      )
    `)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by type if requested
  const rows = (data ?? []).filter((r: Record<string, unknown>) => {
    if (!r.shared_items) return false
    if (typeFilter) {
      const si = r.shared_items as Record<string, unknown>
      return si.item_type === typeFilter
    }
    return true
  })

  // Enrich with sender names
  const ownerIds = [...new Set(
    rows.map((r: Record<string, unknown>) => (r.shared_items as Record<string, unknown>)?.owner_id as string)
      .filter(Boolean)
  )]

  const { data: profilesData } = ownerIds.length > 0
    ? await db.from('profiles').select('id, name').in('id', ownerIds)
    : { data: [] }

  const profileMap = Object.fromEntries(
    ((profilesData as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name])
  )

  const items = rows.map((r: Record<string, unknown>) => {
    const si = r.shared_items as Record<string, unknown>
    return {
      friend_share_id: r.id,
      viewed_at: r.viewed_at,
      imported_at: r.imported_at,
      share_id: si.id,
      item_type: si.item_type,
      item_name: si.item_name,
      token: si.share_token,
      message: si.message,
      owner_name: profileMap[si.owner_id as string] ?? 'Someone',
      created_at: r.created_at,
    }
  })

  return NextResponse.json(items)
}
