import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

async function mergeSavedMealIntoUserState(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  newMeal: Record<string, unknown>
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: appStateRow, error: appStateError } = await db
      .from('user_app_state')
      .select('saved_meals, supplements, calendar_reminders')
      .eq('user_id', userId)
      .maybeSingle()

    if (appStateError) {
      throw new Error(appStateError.message)
    }

    const existingSavedMeals = Array.isArray(appStateRow?.saved_meals) ? appStateRow.saved_meals : []
    const existingSupplements = Array.isArray(appStateRow?.supplements) ? appStateRow.supplements : []
    const existingCalendarReminders = Array.isArray(appStateRow?.calendar_reminders) ? appStateRow.calendar_reminders : []

    const mergedSavedMeals = [
      ...(existingSavedMeals.filter((meal) => (meal as { id?: string }).id !== newMeal.id)),
      newMeal,
    ]

    const { error } = await db
      .from('user_app_state')
      .upsert({
        user_id: userId,
        saved_meals: mergedSavedMeals,
        supplements: existingSupplements,
        calendar_reminders: existingCalendarReminders,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      throw new Error(error.message)
    }

    const { data: verifyRow, error: verifyError } = await db
      .from('user_app_state')
      .select('saved_meals')
      .eq('user_id', userId)
      .maybeSingle()

    if (verifyError) {
      throw new Error(verifyError.message)
    }

    const verifiedSavedMeals = Array.isArray(verifyRow?.saved_meals) ? verifyRow.saved_meals : []
    const hasMeal = verifiedSavedMeals.some((meal) => (meal as { id?: string }).id === newMeal.id)
    if (hasMeal) return
  }

  throw new Error('Could not save imported meal reliably')
}

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
    return NextResponse.json({
      result_id: existing.result_id,
      item_type: item.item_type,
      already_imported: true,
    })
  }

  // Clone item into user's tables
  let resultId: string | null = null
  let importedItem: Record<string, unknown> | null = null
  const data = item.item_data as Record<string, unknown>

  if (item.item_type === 'recipe') {
    const { data: inserted, error } = await db
      .from('recipes')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description ?? null,
        ingredients: data.ingredients ?? [],
        instructions: data.instructions ?? null,
        macros: data.macros ?? null,
        servings: data.servings ?? 1,
        source: 'imported',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'workout') {
    const workoutId = `cw-${crypto.randomUUID()}`
    const { data: inserted, error } = await db
      .from('workout_templates')
      .insert({
        id: workoutId,
        user_id: user.id,
        name: typeof data.name === 'string' ? data.name : item.item_name,
        description: typeof data.description === 'string' ? data.description : '',
        day_label: typeof data.day_label === 'string' ? data.day_label : '',
        muscle_groups: Array.isArray(data.muscle_groups) ? data.muscle_groups : [],
        exercises: Array.isArray(data.exercises) ? data.exercises : [],
        estimated_duration_min: typeof data.estimated_duration_min === 'number' ? data.estimated_duration_min : 0,
        difficulty: data.difficulty === 'beginner' || data.difficulty === 'intermediate' || data.difficulty === 'advanced'
          ? data.difficulty
          : 'beginner',
        split_type: data.split_type === 'ppl' || data.split_type === 'upper_lower' || data.split_type === '3day_fullbody' || data.split_type === '4day' || data.split_type === '5day' || data.split_type === '6day' || data.split_type === 'cardio_focus'
          ? data.split_type
          : '4day',
        source: 'custom',
        updated_at: new Date().toISOString(),
      })
      .select('id, name, description, day_label, muscle_groups, exercises, estimated_duration_min, difficulty, split_type, source, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultId = inserted?.id ?? null
    importedItem = inserted ? {
      id: inserted.id,
      name: inserted.name,
      description: inserted.description,
      day_label: inserted.day_label,
      muscle_groups: inserted.muscle_groups,
      exercises: inserted.exercises,
      estimated_duration_min: inserted.estimated_duration_min,
      difficulty: inserted.difficulty,
      split_type: inserted.split_type,
      source: inserted.source,
      updated_at: inserted.updated_at,
    } : null
  } else if (item.item_type === 'saved_meal') {
    const newMeal = {
      ...data,
      id: crypto.randomUUID(),
      name: typeof data.name === 'string' ? data.name : item.item_name,
      meal_type: typeof data.meal_type === 'string' ? data.meal_type : 'lunch',
      macros: typeof data.macros === 'object' && data.macros ? data.macros : {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
      items: Array.isArray(data.items) ? data.items : [],
      updated_at: new Date().toISOString(),
    }
    try {
      await mergeSavedMealIntoUserState(db, user.id, newMeal)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save imported meal' }, { status: 500 })
    }
    resultId = newMeal.id as string
    importedItem = newMeal
  } else if (item.item_type === 'grocery_list') {
    // Merge shared items into user's existing grocery list (or create a new one)
    const sharedItems = (data.items as unknown[]) ?? []
    const { data: existingList } = await db
      .from('grocery_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString().split('T')[0]
    const existingItems = Array.isArray(existingList?.items) ? existingList.items : []
    const mergedItems = [
      ...existingItems,
      ...sharedItems.map((i: unknown) => ({ ...(i as object), checked: false })),
    ]

    const listId = existingList?.id ?? crypto.randomUUID()
    await db.from('grocery_lists').upsert({
      id: listId,
      user_id: user.id,
      week_start: existingList?.week_start ?? now,
      items: mergedItems,
      updated_at: new Date().toISOString(),
    })
    resultId = listId
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

  return NextResponse.json({
    result_id: resultId,
    item_type: item.item_type,
    imported_item: importedItem,
    already_imported: false,
  })
}
