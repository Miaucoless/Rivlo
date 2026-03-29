import { createClient } from '@/lib/supabase'
import type { CalendarReminder, GroceryList, JournalEntry, Recipe, SavedMealTemplate, SupplementEntry, WaterEntry, WeightEntry, WeeklyMealPlan, Workout, WorkoutLog } from '@/types'
import type { MealLogEntry } from '@/lib/mock-data'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonRecord = Record<string, unknown>

type CloudHydrationData = {
  mealEntries: Record<string, MealLogEntry[]>
  workoutLogs: WorkoutLog[]
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  weeklyMealPlan: WeeklyMealPlan | null
  groceryList: GroceryList | null
  customRecipes: Recipe[]
  customWorkouts: Workout[]
  waterLogs: Record<string, WaterEntry[]>
  dbNotifications: import('@/types').Notification[]
}

export type CloudSeedPayload = {
  mealEntries: Record<string, MealLogEntry[]>
  workoutLogs: WorkoutLog[]
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  weeklyMealPlan: WeeklyMealPlan | null
  groceryList: GroceryList | null
  customRecipes: Recipe[]
  customWorkouts: Workout[]
  waterLogs: Record<string, WaterEntry[]>
}

type MetadataAppState = {
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
}

const EMPTY_METADATA_APP_STATE: MetadataAppState = {
  savedMeals: [],
  supplements: [],
  calendarReminders: [],
}

function isUuid(value: string) {
  return UUID_REGEX.test(value)
}

export function ensureUuid(id?: string) {
  if (id && isUuid(id)) return id
  return crypto.randomUUID()
}

function toTimeLabel(isoString?: string | null) {
  if (!isoString) return '12:00 PM'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '12:00 PM'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function parseTimeLabel(time: string) {
  const normalized = time.trim().toUpperCase()
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null
  }

  const hour24 = (hours % 12) + (meridiem === 'PM' ? 12 : 0)
  return { hour24, minutes }
}

function toLoggedAt(dateIso: string, timeLabel: string) {
  const parsed = parseTimeLabel(timeLabel)
  if (!parsed) return new Date(`${dateIso}T12:00:00`).toISOString()
  const hour = String(parsed.hour24).padStart(2, '0')
  const minute = String(parsed.minutes).padStart(2, '0')
  return new Date(`${dateIso}T${hour}:${minute}:00`).toISOString()
}

function parseJsonNotes<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.startsWith('{')) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function fetchMetadataAppState(userId: string): Promise<MetadataAppState> {
  const supabase = createClient()

  // Try the proper table first (new path)
  const { data, error } = await supabase
    .from('user_app_state')
    .select('saved_meals, supplements, calendar_reminders')
    .eq('user_id', userId)
    .maybeSingle()

  if (!error && data) {
    return {
      savedMeals: Array.isArray(data.saved_meals) ? data.saved_meals : [],
      supplements: Array.isArray(data.supplements) ? data.supplements : [],
      calendarReminders: Array.isArray(data.calendar_reminders) ? data.calendar_reminders : [],
    }
  }

  // Fall back to user metadata for users who haven't migrated yet
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return EMPTY_METADATA_APP_STATE

  const appState = (authData.user.user_metadata as { app_state?: MetadataAppState } | undefined)?.app_state
  if (!appState) return EMPTY_METADATA_APP_STATE

  return {
    savedMeals: Array.isArray(appState.savedMeals) ? appState.savedMeals : [],
    supplements: Array.isArray(appState.supplements) ? appState.supplements : [],
    calendarReminders: Array.isArray(appState.calendarReminders) ? appState.calendarReminders : [],
  }
}

export async function saveMetadataCloudState(userId: string, state: MetadataAppState) {
  const supabase = createClient()
  const { error } = await supabase.from('user_app_state').upsert({
    user_id: userId,
    saved_meals: state.savedMeals,
    supplements: state.supplements,
    calendar_reminders: state.calendarReminders,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}

function mealToRow(userId: string, date: string, meal: MealLogEntry) {
  return {
    id: ensureUuid(meal.id),
    user_id: userId,
    date,
    meal_type: meal.meal_type === 'drink' ? 'snack' : meal.meal_type,
    name: meal.name,
    calories: meal.macros.calories,
    protein_g: meal.macros.protein_g,
    carbs_g: meal.macros.carbs_g,
    fat_g: meal.macros.fat_g,
    notes: JSON.stringify({
      time: meal.time,
      recipe: meal.recipe,
      recipe_amount: (meal as any).recipe_amount,
      meal_items: meal.meal_items,
      entry_source: meal.entry_source,
      original_meal_type: meal.meal_type,
    }),
    logged_at: toLoggedAt(date, meal.time),
  }
}

function mealFromRow(row: any): { date: string; meal: MealLogEntry } {
  const metadata = parseJsonNotes<{
    time?: string
    recipe?: MealLogEntry['recipe']
    recipe_amount?: any
    meal_items?: MealLogEntry['meal_items']
    entry_source?: MealLogEntry['entry_source']
    original_meal_type?: MealLogEntry['meal_type']
  }>(row.notes)

  return {
    date: row.date,
    meal: {
      id: row.id,
      meal_type: metadata?.original_meal_type ?? row.meal_type,
      name: row.name,
      macros: {
        calories: Number(row.calories ?? 0),
        protein_g: Number(row.protein_g ?? 0),
        carbs_g: Number(row.carbs_g ?? 0),
        fat_g: Number(row.fat_g ?? 0),
      },
      time: metadata?.time ?? toTimeLabel(row.logged_at),
      recipe: metadata?.recipe ?? null,
      ...(metadata?.recipe_amount ? { recipe_amount: metadata.recipe_amount } : {}),
      meal_items: metadata?.meal_items,
      entry_source: metadata?.entry_source,
    },
  }
}

function workoutToRow(userId: string, log: WorkoutLog) {
  return {
    id: ensureUuid(log.id),
    user_id: userId,
    workout_id: log.workout_id,
    workout_name: log.workout.name,
    date: log.date,
    started_at: log.started_at,
    completed_at: log.completed_at,
    duration_min: log.duration_min,
    exercises: log.exercises,
    notes: JSON.stringify({
      notes: log.notes,
      workout: log.workout,
      calories_burned_kcal: log.calories_burned_kcal,
      total_volume_kg: log.total_volume_kg,
    }),
    rating: log.rating,
  }
}

function workoutFromRow(row: any): WorkoutLog {
  const metadata = parseJsonNotes<{
    notes?: string
    workout?: Workout
    calories_burned_kcal?: number
    total_volume_kg?: number
  }>(row.notes)

  const fallbackWorkout: Workout = {
    id: row.workout_id,
    name: row.workout_name,
    description: '',
    day_label: row.workout_name,
    muscle_groups: ['full_body'],
    exercises: [],
    estimated_duration_min: Number(row.duration_min ?? 0),
    difficulty: 'intermediate',
    split_type: 'ppl',
    source: 'custom',
    updated_at: row.completed_at ?? row.started_at ?? new Date().toISOString(),
  }

  return {
    id: row.id,
    user_id: row.user_id,
    workout_id: row.workout_id,
    workout: metadata?.workout ?? fallbackWorkout,
    date: row.date,
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_min: row.duration_min,
    exercises: row.exercises ?? [],
    notes: metadata?.notes,
    rating: row.rating,
    calories_burned_kcal: metadata?.calories_burned_kcal,
    total_volume_kg: metadata?.total_volume_kg,
  }
}

function recipeToRow(userId: string, recipe: Recipe) {
  return {
    id: ensureUuid(recipe.id),
    user_id: userId,
    name: recipe.name,
    description: recipe.description,
    meal_type: recipe.meal_type,
    prep_time_min: recipe.prep_time_min,
    cook_time_min: recipe.cook_time_min,
    servings: recipe.servings,
    instructions: recipe.instructions,
    ingredients: recipe.ingredients,
    macros: recipe.macros,
    tags: recipe.tags,
    image_url: recipe.image_url ?? null,
    is_public: false,
  }
}

function recipeFromRow(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    meal_type: row.meal_type,
    prep_time_min: row.prep_time_min ?? 0,
    cook_time_min: row.cook_time_min ?? 0,
    servings: row.servings ?? 1,
    instructions: row.instructions ?? [],
    ingredients: row.ingredients ?? [],
    macros: row.macros,
    tags: row.tags ?? [],
    image_url: row.image_url ?? undefined,
  }
}

export async function fetchCloudState(userId: string): Promise<CloudHydrationData | null> {
  const supabase = createClient()

  const isMissingRelation = (err: unknown) => {
    if (!err || typeof err !== 'object') return false
    const anyErr = err as { code?: string; message?: string }
    return anyErr.code === '42P01' || (anyErr.message?.includes('does not exist') ?? false)
  }

  const selectOrEmpty = async <T>(promise: Promise<{ data: T; error: any }>, empty: T) => {
    const resp = await promise
    if (resp.error && isMissingRelation(resp.error)) {
      console.warn('Cloud table missing; treating as empty:', resp.error?.message ?? resp.error)
      return { data: empty, error: null as any }
    }
    return resp
  }

  const [
    mealsResp,
    workoutsResp,
    weightsResp,
    journalsResp,
    mealPlanResp,
    groceryResp,
    recipesResp,
    customWorkoutsResp,
    waterLogsResp,
    metadataState,
    notificationsResp,
  ] = await Promise.all([
    supabase.from('meal_entries').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
    supabase.from('workout_logs').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('weight_entries').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('journal_entries').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('meal_plans').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('grocery_lists').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('workout_templates').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
    selectOrEmpty(
      supabase.from('water_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      [] as any[]
    ),
    fetchMetadataAppState(userId),
    selectOrEmpty(
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50) as any,
      [] as any[]
    ),
  ])

  if (mealsResp.error || workoutsResp.error || weightsResp.error || journalsResp.error || recipesResp.error || customWorkoutsResp.error || waterLogsResp.error) {
    console.error('Cloud fetch failed', {
      meals: mealsResp.error,
      workouts: workoutsResp.error,
      weights: weightsResp.error,
      journals: journalsResp.error,
      recipes: recipesResp.error,
      templates: customWorkoutsResp.error,
      waterLogs: waterLogsResp.error,
    })
    return null
  }

  const mealEntries: Record<string, MealLogEntry[]> = {}
  ;(mealsResp.data ?? []).forEach((row) => {
    const parsed = mealFromRow(row)
    mealEntries[parsed.date] = mealEntries[parsed.date] ? [...mealEntries[parsed.date], parsed.meal] : [parsed.meal]
  })

  const workoutLogs = (workoutsResp.data ?? []).map(workoutFromRow)

  const weightHistory: WeightEntry[] = (weightsResp.data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    weight_kg: Number(row.weight_kg),
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : undefined,
    muscle_mass_kg: row.muscle_mass_kg != null ? Number(row.muscle_mass_kg) : undefined,
    notes: row.notes ?? undefined,
  }))

  const journalEntries: JournalEntry[] = (journalsResp.data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    title: row.title ?? undefined,
    content: row.content,
    mood: row.mood,
    energy: row.energy,
    tags: row.tags ?? [],
    workout_id: row.workout_log_id ?? undefined,
    prompts_answered: row.prompts_answered ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  const weeklyMealPlan: WeeklyMealPlan | null = mealPlanResp.data
    ? {
        id: mealPlanResp.data.id,
        user_id: mealPlanResp.data.user_id,
        week_start: mealPlanResp.data.week_start,
        days: mealPlanResp.data.days,
      }
    : null

  const groceryList: GroceryList | null = groceryResp.data
    ? {
        id: groceryResp.data.id,
        user_id: groceryResp.data.user_id,
        week_start: groceryResp.data.week_start,
        items: groceryResp.data.items ?? [],
        total_estimated_cost: Number(groceryResp.data.total_cost ?? 0),
        created_at: groceryResp.data.created_at,
      }
    : null

  const customRecipes = (recipesResp.data ?? []).map(recipeFromRow)

  const waterLogs: Record<string, WaterEntry[]> = {}
  ;(waterLogsResp.data ?? []).forEach((row: any) => {
    const entry: WaterEntry = {
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      amount_ml: Number(row.amount_ml),
      logged_at: row.logged_at,
    }
    waterLogs[entry.date] = waterLogs[entry.date] ? [...waterLogs[entry.date], entry] : [entry]
  })

  const customWorkouts: Workout[] = (customWorkoutsResp.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    day_label: row.day_label ?? '',
    muscle_groups: row.muscle_groups ?? [],
    exercises: row.exercises ?? [],
    estimated_duration_min: row.estimated_duration_min ?? 0,
    difficulty: row.difficulty,
    split_type: row.split_type,
    source: row.source,
    updated_at: row.updated_at,
  }))

  return {
    mealEntries,
    workoutLogs,
    weightHistory,
    journalEntries,
    savedMeals: metadataState.savedMeals,
    supplements: metadataState.supplements,
    calendarReminders: metadataState.calendarReminders,
    weeklyMealPlan,
    groceryList,
    customRecipes,
    customWorkouts,
    waterLogs,
    dbNotifications: (notificationsResp.data ?? []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      type: n.type as 'info' | 'success' | 'warning' | 'error' | 'share_received',
      title: n.title as string,
      message: n.message as string,
      read: n.read as boolean,
      action_url: n.action_url as string | undefined,
      created_at: n.created_at as string,
    })),
  }
}

export async function upsertMealEntry(userId: string, date: string, meal: MealLogEntry) {
  const supabase = createClient()
  await supabase.from('meal_entries').upsert(mealToRow(userId, date, meal))
}

export async function deleteMealEntryCloud(userId: string, mealId: string) {
  if (!isUuid(mealId)) return
  const supabase = createClient()
  await supabase.from('meal_entries').delete().eq('user_id', userId).eq('id', mealId)
}

export async function upsertWorkoutLog(userId: string, log: WorkoutLog) {
  const supabase = createClient()
  await supabase.from('workout_logs').upsert(workoutToRow(userId, log))
}

export async function deleteWorkoutLogCloud(userId: string, logId: string) {
  if (!isUuid(logId)) return
  const supabase = createClient()
  await supabase.from('workout_logs').delete().eq('user_id', userId).eq('id', logId)
}

export async function upsertWaterLog(userId: string, entry: WaterEntry) {
  const supabase = createClient()
  await supabase.from('water_logs').upsert({
    id: ensureUuid(entry.id),
    user_id: userId,
    date: entry.date,
    amount_ml: entry.amount_ml,
    logged_at: entry.logged_at,
  })
}

export async function deleteWaterLog(userId: string, entryId: string) {
  if (!isUuid(entryId)) return
  const supabase = createClient()
  await supabase.from('water_logs').delete().eq('user_id', userId).eq('id', entryId)
}

export async function upsertWeightEntry(userId: string, entry: WeightEntry) {
  const supabase = createClient()
  await supabase.from('weight_entries').upsert({
    id: ensureUuid(entry.id),
    user_id: userId,
    date: entry.date,
    weight_kg: entry.weight_kg,
    body_fat_pct: entry.body_fat_pct ?? null,
    muscle_mass_kg: entry.muscle_mass_kg ?? null,
    notes: entry.notes ?? null,
  }, { onConflict: 'user_id,date' })
}

export async function deleteWeightEntryCloud(userId: string, entryId: string) {
  const supabase = createClient()
  await supabase.from('weight_entries').delete().eq('user_id', userId).eq('id', entryId)
}

export async function upsertJournalEntry(userId: string, entry: JournalEntry) {
  const supabase = createClient()
  await supabase.from('journal_entries').upsert({
    id: ensureUuid(entry.id),
    user_id: userId,
    date: entry.date,
    title: entry.title ?? null,
    content: entry.content,
    mood: entry.mood,
    energy: entry.energy,
    tags: entry.tags,
    workout_log_id: entry.workout_id ?? null,
    prompts_answered: entry.prompts_answered ?? null,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteJournalEntryCloud(userId: string, entryId: string) {
  if (!isUuid(entryId)) return
  const supabase = createClient()
  await supabase.from('journal_entries').delete().eq('user_id', userId).eq('id', entryId)
}

export async function upsertMealPlan(userId: string, plan: WeeklyMealPlan) {
  const supabase = createClient()
  await supabase.from('meal_plans').upsert({
    id: ensureUuid(plan.id),
    user_id: userId,
    week_start: plan.week_start,
    days: plan.days,
  }, { onConflict: 'user_id,week_start' })
}

export async function upsertGroceryList(userId: string, list: GroceryList) {
  const supabase = createClient()
  await supabase.from('grocery_lists').upsert({
    id: ensureUuid(list.id),
    user_id: userId,
    week_start: list.week_start,
    items: list.items,
    total_cost: list.total_estimated_cost,
  }, { onConflict: 'user_id,week_start' })
}

export async function clearGroceryListCloud(userId: string) {
  const supabase = createClient()
  await supabase.from('grocery_lists').delete().eq('user_id', userId)
}

export async function upsertCustomRecipe(userId: string, recipe: Recipe) {
  const supabase = createClient()
  await supabase.from('recipes').upsert(recipeToRow(userId, recipe))
}

export async function upsertCustomWorkout(userId: string, workout: Workout) {
  const supabase = createClient()
  await supabase.from('workout_templates').upsert({
    id: ensureUuid(workout.id),
    user_id: userId,
    name: workout.name,
    description: workout.description,
    day_label: workout.day_label,
    muscle_groups: workout.muscle_groups,
    exercises: workout.exercises,
    estimated_duration_min: workout.estimated_duration_min,
    difficulty: workout.difficulty,
    split_type: workout.split_type,
    source: workout.source ?? 'custom',
  })
}

export async function deleteCustomWorkoutCloud(userId: string, workoutId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('workout_templates').delete().eq('user_id', userId).eq('id', workoutId)
  if (error) throw new Error(error.message)
}

export async function deleteCustomRecipeCloud(userId: string, recipeId: string) {
  if (!isUuid(recipeId)) return
  const supabase = createClient()
  await supabase.from('recipes').delete().eq('user_id', userId).eq('id', recipeId)
}

export async function seedCloudFromLocal(userId: string, payload: CloudSeedPayload) {
  const mealTasks = Object.entries(payload.mealEntries).flatMap(([date, meals]) =>
    meals.map((meal) => upsertMealEntry(userId, date, meal))
  )

  const waterTasks = Object.values(payload.waterLogs).flatMap((entries) =>
    entries.map((entry) => upsertWaterLog(userId, entry))
  )

  const tasks: Promise<unknown>[] = [
    ...mealTasks,
    ...waterTasks,
    ...payload.workoutLogs.map((log) => upsertWorkoutLog(userId, log)),
    ...payload.weightHistory.map((entry) => upsertWeightEntry(userId, entry)),
    ...payload.journalEntries.map((entry) => upsertJournalEntry(userId, entry)),
    ...payload.customRecipes.map((recipe) => upsertCustomRecipe(userId, recipe)),
    ...payload.customWorkouts.map((workout) => upsertCustomWorkout(userId, workout)),
  ]

  if (payload.weeklyMealPlan) {
    tasks.push(upsertMealPlan(userId, payload.weeklyMealPlan))
  }

  if (payload.groceryList) {
    tasks.push(upsertGroceryList(userId, payload.groceryList))
  }

  const existingMetadata = await fetchMetadataAppState(userId)
  tasks.push(saveMetadataCloudState(userId, {
    savedMeals: payload.savedMeals.length > 0 ? payload.savedMeals : existingMetadata.savedMeals,
    supplements: payload.supplements.length > 0 ? payload.supplements : existingMetadata.supplements,
    calendarReminders: payload.calendarReminders.length > 0 ? payload.calendarReminders : existingMetadata.calendarReminders,
  }))

  await Promise.all(tasks)
}
