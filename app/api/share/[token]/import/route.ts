import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const friend_share_id = body.friend_share_id
  const db = getServiceClient()

  // Fetch the shared item
  const { data: item } = await db
    .from('shared_items')
    .select('id, item_type, item_data, item_name')
    .eq('share_token', params.token)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  // Idempotency: check if already imported
  const { data: existing } = await db
    .from('imported_items')
    .select('result_id')
    .eq('user_id', user.id)
    .eq('share_id', item.id)
    .maybeSingle()

  if (existing) {
    if (friend_share_id) {
      await db
        .from('friend_shares')
        .update({ imported_at: new Date().toISOString() })
        .eq('id', friend_share_id)
        .eq('recipient_id', user.id)
    }
    return NextResponse.json({ result_id: existing.result_id, already_imported: true })
  }

  // Clone item into user's tables
  let resultId: string | null = null
  const data = item.item_data as Record<string, unknown>

  if (item.item_type === 'recipe') {
    const { data: inserted } = await db
      .from('recipes')
      .insert({ ...data, id: undefined, user_id: user.id, source: 'imported' })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'workout') {
    const { data: inserted } = await db
      .from('workout_templates')
      .insert({ ...data, id: undefined, user_id: user.id })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'workout_log') {
    const { data: inserted } = await db
      .from('workout_logs')
      .insert({ ...data, id: undefined, user_id: user.id })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'saved_meal') {
    const { data: userData } = await db.auth.admin.getUserById(user.id)
    const appState = (userData?.user?.user_metadata as { app_state?: { savedMeals?: unknown[] } } | undefined)?.app_state ?? {}
    const existingSavedMeals = Array.isArray(appState.savedMeals) ? appState.savedMeals : []
    const newMeal = { ...data, id: `imported-${Date.now()}` }
    await db.auth.admin.updateUserById(user.id, {
      data: { app_state: { ...appState, savedMeals: [...existingSavedMeals, newMeal] } }
    })
    resultId = newMeal.id as string
  }

  if (!resultId) {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }

  // Record in imported_items
  await db.from('imported_items').insert({
    user_id: user.id,
    share_id: item.id,
    result_id: resultId,
  })

  // Update friend_shares imported_at if applicable
  if (friend_share_id) {
    await db
      .from('friend_shares')
      .update({ imported_at: new Date().toISOString() })
      .eq('id', friend_share_id)
      .eq('recipient_id', user.id)
  }

  return NextResponse.json({ result_id: resultId, already_imported: false })
}
