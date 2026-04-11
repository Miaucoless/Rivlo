import { NextRequest, NextResponse } from 'next/server'
import { deleteRedisKeys } from '@/lib/redis'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'
import type { GroceryItem, GroceryList, SavedMealTemplate } from '@/types'

function inboxCacheKeys(userId: string) {
  return [
    `share-inbox:v1:${userId}:all`,
    `share-inbox:v1:${userId}:recipe`,
    `share-inbox:v1:${userId}:workout`,
    `share-inbox:v1:${userId}:saved_meal`,
    `share-inbox:v1:${userId}:grocery_list`,
    `share-inbox:v1:${userId}:weekly_recap`,
    `share-inbox:v1:${userId}:social_post`,
  ]
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeGroceryItem(raw: unknown, resetChecked = false): GroceryItem {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  return {
    ingredient:
      typeof item.ingredient === 'string' && item.ingredient.trim()
        ? item.ingredient.trim()
        : typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : 'Item',
    amount: parseNumber(item.amount, 1),
    unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'serving',
    estimated_price: parseNumber(item.estimated_price, 0),
    category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Other',
    checked: resetChecked ? false : Boolean(item.checked),
  }
}

function normalizeGroceryListRow(row: Record<string, unknown>, userId: string): GroceryList {
  const items = Array.isArray(row.items)
    ? row.items.map((item) => normalizeGroceryItem(item))
    : []

  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    user_id: typeof row.user_id === 'string' ? row.user_id : userId,
    week_start: typeof row.week_start === 'string' ? row.week_start : new Date().toISOString().split('T')[0],
    items,
    total_estimated_cost: parseNumber(
      row.total_cost ?? row.total_estimated_cost,
      items.reduce((sum, item) => sum + item.estimated_price, 0)
    ),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }
}

function normalizeSavedMealTemplate(raw: unknown, fallbackName: string): SavedMealTemplate {
  const meal = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const rawItems = Array.isArray(meal.items) ? meal.items : []
  const savedFrom = meal.saved_from && typeof meal.saved_from === 'object'
    ? meal.saved_from as SavedMealTemplate['saved_from']
    : undefined

  return {
    id: typeof meal.id === 'string' && meal.id ? meal.id : crypto.randomUUID(),
    name: typeof meal.name === 'string' && meal.name.trim() ? meal.name.trim() : fallbackName,
    meal_type:
      meal.meal_type === 'breakfast' ||
      meal.meal_type === 'lunch' ||
      meal.meal_type === 'dinner' ||
      meal.meal_type === 'snack' ||
      meal.meal_type === 'drink'
        ? meal.meal_type
        : 'lunch',
    macros: {
      calories: parseNumber((meal.macros as Record<string, unknown> | undefined)?.calories, 0),
      protein_g: parseNumber((meal.macros as Record<string, unknown> | undefined)?.protein_g, 0),
      carbs_g: parseNumber((meal.macros as Record<string, unknown> | undefined)?.carbs_g, 0),
      fat_g: parseNumber((meal.macros as Record<string, unknown> | undefined)?.fat_g, 0),
    },
    items: rawItems.map((item) => {
      const rawItem = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const matchedName =
        typeof rawItem.matched_name === 'string' && rawItem.matched_name.trim()
          ? rawItem.matched_name.trim()
          : typeof rawItem.name === 'string' && rawItem.name.trim()
            ? rawItem.name.trim()
            : typeof rawItem.input === 'string' && rawItem.input.trim()
              ? rawItem.input.trim()
              : 'Item'

      return {
        input:
          typeof rawItem.input === 'string' && rawItem.input.trim()
            ? rawItem.input.trim()
            : matchedName,
        matched_name: matchedName,
        amount: parseNumber(rawItem.amount, 1),
        unit: typeof rawItem.unit === 'string' && rawItem.unit.trim() ? rawItem.unit.trim() : 'serving',
        macros: rawItem.macros && typeof rawItem.macros === 'object'
          ? {
              calories: parseNumber((rawItem.macros as Record<string, unknown>).calories, 0),
              protein_g: parseNumber((rawItem.macros as Record<string, unknown>).protein_g, 0),
              carbs_g: parseNumber((rawItem.macros as Record<string, unknown>).carbs_g, 0),
              fat_g: parseNumber((rawItem.macros as Record<string, unknown>).fat_g, 0),
            }
          : undefined,
      }
    }),
    updated_at: typeof meal.updated_at === 'string' && meal.updated_at ? meal.updated_at : new Date().toISOString(),
    saved_from: savedFrom,
  }
}

function buildSharedSaveOrigin(
  item: { id: string; item_name: string },
  friendShareId: unknown
): NonNullable<SavedMealTemplate['saved_from']> {
  return {
    source: 'shared',
    label: item.item_name,
    share_id: item.id,
    friend_share_id: typeof friendShareId === 'string' ? friendShareId : undefined,
    saved_at: new Date().toISOString(),
  }
}

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
    let existingImportedItem: Record<string, unknown> | null = null
    if (item.item_type === 'saved_meal' && typeof existing.result_id === 'string') {
      const { data: appStateRow } = await db
        .from('user_app_state')
        .select('saved_meals')
        .eq('user_id', user.id)
        .maybeSingle()

      const existingSavedMeals = Array.isArray(appStateRow?.saved_meals) ? appStateRow.saved_meals : []
      const matchingMeal = existingSavedMeals.find((meal) => (meal as { id?: string }).id === existing.result_id)
      if (matchingMeal && typeof matchingMeal === 'object') {
        const normalizedMeal = normalizeSavedMealTemplate(matchingMeal, item.item_name)
        existingImportedItem = {
          ...normalizedMeal,
          saved_from: normalizedMeal.saved_from ?? buildSharedSaveOrigin(item, friend_share_id),
        } as unknown as Record<string, unknown>
      }
    }

    if (item.item_type === 'workout' && typeof existing.result_id === 'string') {
      const { data: existingWorkout } = await db
        .from('workout_templates')
        .select('id, name, description, day_label, muscle_groups, exercises, estimated_duration_min, difficulty, split_type, source, updated_at')
        .eq('id', existing.result_id)
        .maybeSingle()

      if (existingWorkout && typeof existingWorkout === 'object') {
        existingImportedItem = {
          ...(existingWorkout as Record<string, unknown>),
          saved_from: buildSharedSaveOrigin(item, friend_share_id),
        }
      }
    }

    if (item.item_type === 'grocery_list' && typeof existing.result_id === 'string') {
      const { data: existingList } = await db
        .from('grocery_lists')
        .select('*')
        .eq('id', existing.result_id)
        .maybeSingle()

      if (existingList) {
        existingImportedItem = normalizeGroceryListRow(existingList as Record<string, unknown>, user.id) as unknown as Record<string, unknown>
      }
    }

    if (friend_share_id) {
      await db
        .from('friend_shares')
        .update({ imported_at: new Date().toISOString() })
        .eq('id', friend_share_id)
        .eq('recipient_id', user.id)
      await deleteRedisKeys(inboxCacheKeys(user.id))
    }
    return NextResponse.json({
      result_id: existing.result_id,
      item_type: item.item_type,
      imported_item: existingImportedItem,
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
        split_type: data.split_type === 'ppl' || data.split_type === 'upper_lower' || data.split_type === '3day_fullbody' || data.split_type === '4day' || data.split_type === '5day' || data.split_type === '6day' || data.split_type === 'cardio_focus' || data.split_type === 'custom'
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
      saved_from: buildSharedSaveOrigin(item, friend_share_id),
    } : null
  } else if (item.item_type === 'saved_meal') {
    const newMeal = normalizeSavedMealTemplate({
      ...data,
      id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
      saved_from: buildSharedSaveOrigin(item, friend_share_id),
    }, item.item_name)
    try {
      await mergeSavedMealIntoUserState(db, user.id, newMeal as unknown as Record<string, unknown>)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save imported meal' }, { status: 500 })
    }
    resultId = newMeal.id
    importedItem = newMeal as unknown as Record<string, unknown>
  } else if (item.item_type === 'grocery_list') {
    const sharedItems = Array.isArray(data.items)
      ? data.items.map((sharedItem) => normalizeGroceryItem(sharedItem, true))
      : []

    const { data: existingList } = await db
      .from('grocery_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString().split('T')[0]
    const normalizedExistingList = existingList
      ? normalizeGroceryListRow(existingList as Record<string, unknown>, user.id)
      : null

    const existingItems = normalizedExistingList?.items ?? []
    const mergedItems = [
      ...existingItems,
      ...sharedItems,
    ]

    const listId = normalizedExistingList?.id ?? crypto.randomUUID()
    const weekStart = normalizedExistingList?.week_start ?? now
    const createdAt = normalizedExistingList?.created_at ?? new Date().toISOString()
    const totalEstimatedCost = mergedItems.reduce((sum, groceryItem) => sum + groceryItem.estimated_price, 0)

    const { error: groceryError } = await db.from('grocery_lists').upsert({
      id: listId,
      user_id: user.id,
      week_start: weekStart,
      items: mergedItems,
      total_cost: totalEstimatedCost,
      created_at: createdAt,
    })

    if (groceryError) {
      return NextResponse.json({ error: groceryError.message }, { status: 500 })
    }

    const importedList: GroceryList = {
      id: listId,
      user_id: user.id,
      week_start: weekStart,
      items: mergedItems,
      total_estimated_cost: totalEstimatedCost,
      created_at: createdAt,
    }

    resultId = listId
    importedItem = importedList as unknown as Record<string, unknown>
  } else if (item.item_type === 'weekly_recap' || item.item_type === 'social_post') {
    return NextResponse.json({ error: `${item.item_type === 'social_post' ? 'Social posts' : 'Weekly recaps'} are view-only.` }, { status: 422 })
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
    await deleteRedisKeys(inboxCacheKeys(user.id))
  }

  return NextResponse.json({
    result_id: resultId,
    item_type: item.item_type,
    imported_item: importedItem,
    already_imported: false,
  })
}
