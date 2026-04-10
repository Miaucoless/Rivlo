import { createClient } from '@/lib/supabase'
import type {
  CalendarReminder,
  GroceryList,
  JournalEntry,
  Recipe,
  SavedMealTemplate,
  SocialFollowRelationship,
  SocialPost,
  SocialPostComment,
  SupplementEntry,
  WaterEntry,
  WeightEntry,
  WeeklyMealPlan,
  Workout,
  WorkoutLog,
} from '@/types'
import type { MealLogEntry } from '@/lib/content-library'
import { getTodayISO } from '@/lib/utils'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
  dbNotifications: import('@/types').Notification[]
  fetchedScopes: CloudHydrationScope[]
}

export type CloudHydrationScope =
  | 'metadata'
  | 'meals'
  | 'workouts'
  | 'tracking'
  | 'journal'
  | 'planner'
  | 'recipes'
  | 'templates'
  | 'water'
  | 'notifications'

export type CloudHydrationProfile = 'default' | 'dashboard' | 'calendar' | 'meals' | 'workouts'

export const ALL_CLOUD_HYDRATION_SCOPES: CloudHydrationScope[] = [
  'metadata',
  'meals',
  'workouts',
  'tracking',
  'journal',
  'planner',
  'recipes',
  'templates',
  'water',
  'notifications',
]

export function getCloudHydrationProfileForPath(pathname: string): CloudHydrationProfile {
  if (pathname.startsWith('/dashboard/dashboard') || pathname === '/dashboard') {
    return 'dashboard'
  }

  if (pathname.startsWith('/dashboard/calendar')) {
    return 'calendar'
  }

  if (pathname.startsWith('/dashboard/meals')) {
    return 'meals'
  }

  if (pathname.startsWith('/dashboard/workouts')) {
    return 'workouts'
  }

  return 'default'
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
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
}

export function getCloudHydrationScopesForPath(pathname: string): CloudHydrationScope[] {
  if (pathname.startsWith('/dashboard/dashboard') || pathname === '/dashboard') {
    return ['metadata', 'meals', 'workouts', 'tracking', 'journal', 'water', 'notifications']
  }

  if (pathname.startsWith('/dashboard/meals')) {
    return ['metadata', 'meals', 'planner', 'recipes']
  }

  if (pathname.startsWith('/dashboard/workouts')) {
    return ['workouts', 'templates', 'journal']
  }

  if (pathname.startsWith('/dashboard/tracking')) {
    return ['tracking', 'workouts', 'meals']
  }

  if (pathname.startsWith('/dashboard/journal')) {
    return ['journal']
  }

  if (pathname.startsWith('/dashboard/calendar')) {
    return ['metadata', 'meals', 'workouts']
  }

  if (pathname.startsWith('/dashboard/supplements')) {
    return ['metadata']
  }

  if (pathname.startsWith('/dashboard/feed')) {
    return ['metadata', 'planner', 'recipes', 'templates']
  }

  if (pathname.startsWith('/dashboard/profile')) {
    return ['metadata', 'recipes', 'templates']
  }

  if (pathname.startsWith('/dashboard/shared')) {
    return ['metadata', 'planner', 'recipes', 'templates']
  }

  if (pathname.startsWith('/dashboard/settings')) {
    return ['metadata']
  }

  return ['metadata']
}

type MetadataAppState = {
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
}

type SaveMetadataCloudStateOptions = {
  baseState?: MetadataAppState
}

const EMPTY_METADATA_APP_STATE: MetadataAppState = {
  savedMeals: [],
  supplements: [],
  calendarReminders: [],
  socialPosts: [],
  socialFollows: [],
  socialSavedPostIds: [],
  socialLikedPostIds: [],
  socialPostComments: {},
}

const metadataStateCache = new Map<string, MetadataAppState>()

type FetchMetadataAppStateOptions = {
  includeSocial?: boolean
}

function cloneMetadataAppState(state: MetadataAppState): MetadataAppState {
  return {
    savedMeals: [...state.savedMeals],
    supplements: [...state.supplements],
    calendarReminders: [...state.calendarReminders],
    socialPosts: [...state.socialPosts],
    socialFollows: [...state.socialFollows],
    socialSavedPostIds: [...state.socialSavedPostIds],
    socialLikedPostIds: [...state.socialLikedPostIds],
    socialPostComments: { ...state.socialPostComments },
  }
}

async function fetchAuthMetadataAppState(
  supabase: ReturnType<typeof createClient>
): Promise<MetadataAppState> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return EMPTY_METADATA_APP_STATE

  const appState = (authData.user.user_metadata as { app_state?: MetadataAppState } | undefined)?.app_state
  if (!appState) return EMPTY_METADATA_APP_STATE

  const normalizedState = {
    savedMeals: Array.isArray(appState.savedMeals) ? appState.savedMeals : [],
    supplements: Array.isArray(appState.supplements) ? appState.supplements : [],
    calendarReminders: Array.isArray(appState.calendarReminders) ? appState.calendarReminders : [],
    socialPosts: Array.isArray(appState.socialPosts) ? appState.socialPosts : [],
    socialFollows: Array.isArray(appState.socialFollows) ? appState.socialFollows : [],
    socialSavedPostIds: Array.isArray(appState.socialSavedPostIds) ? appState.socialSavedPostIds : [],
    socialLikedPostIds: Array.isArray(appState.socialLikedPostIds) ? appState.socialLikedPostIds : [],
    socialPostComments: appState.socialPostComments && typeof appState.socialPostComments === 'object'
      ? appState.socialPostComments
      : {},
  }

  return normalizedState
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

async function fetchMetadataAppState(
  userId: string,
  options?: FetchMetadataAppStateOptions
): Promise<MetadataAppState> {
  const supabase = createClient()
  const includeSocial = options?.includeSocial ?? true
  const cachedState = metadataStateCache.get(userId)

  if (cachedState) {
    return includeSocial
      ? cloneMetadataAppState(cachedState)
      : {
          savedMeals: [...cachedState.savedMeals],
          supplements: [...cachedState.supplements],
          calendarReminders: [...cachedState.calendarReminders],
          socialPosts: [],
          socialFollows: [],
          socialSavedPostIds: [],
          socialLikedPostIds: [],
          socialPostComments: {},
        }
  }

  const selectColumns = includeSocial
    ? 'saved_meals, supplements, calendar_reminders, social_posts, social_follows, social_saved_post_ids, social_liked_post_ids, social_post_comments'
    : 'saved_meals, supplements, calendar_reminders'

  // Try the proper table first (new path)
  let { data, error } = await supabase
    .from('user_app_state')
    .select(selectColumns)
    .eq('user_id', userId)
    .maybeSingle()

  const missingSocialColumns =
    includeSocial &&
    !!error &&
    (
      error.message.includes('social_posts') ||
      error.message.includes('social_follows') ||
      error.message.includes('social_saved_post_ids') ||
      error.message.includes('social_liked_post_ids') ||
      error.message.includes('social_post_comments') ||
      error.message.includes('schema cache')
    )

  if (missingSocialColumns) {
    const fallback = await supabase
      .from('user_app_state')
      .select('saved_meals, supplements, calendar_reminders')
      .eq('user_id', userId)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (!error && data) {
    const authFallback = missingSocialColumns
      ? await fetchAuthMetadataAppState(supabase)
      : EMPTY_METADATA_APP_STATE

    const normalizedState = {
      savedMeals: Array.isArray(data.saved_meals) ? data.saved_meals : [],
      supplements: Array.isArray(data.supplements) ? data.supplements : [],
      calendarReminders: Array.isArray(data.calendar_reminders) ? data.calendar_reminders : [],
      socialPosts: Array.isArray((data as any).social_posts)
        ? (data as any).social_posts
        : authFallback.socialPosts,
      socialFollows: Array.isArray((data as any).social_follows)
        ? (data as any).social_follows
        : authFallback.socialFollows,
      socialSavedPostIds: Array.isArray((data as any).social_saved_post_ids)
        ? (data as any).social_saved_post_ids
        : authFallback.socialSavedPostIds,
      socialLikedPostIds: Array.isArray((data as any).social_liked_post_ids)
        ? (data as any).social_liked_post_ids
        : authFallback.socialLikedPostIds,
      socialPostComments: typeof (data as any).social_post_comments === 'object' && (data as any).social_post_comments
        ? (data as any).social_post_comments
        : authFallback.socialPostComments,
    }

    if (includeSocial) {
      metadataStateCache.set(userId, cloneMetadataAppState(normalizedState))
    }
    return normalizedState
  }

  const fallbackState = includeSocial
    ? await fetchAuthMetadataAppState(supabase)
    : EMPTY_METADATA_APP_STATE
  if (includeSocial) {
    metadataStateCache.set(userId, cloneMetadataAppState(fallbackState))
  }
  return fallbackState
}

export async function saveMetadataCloudState(
  userId: string,
  state: Partial<MetadataAppState>,
  options?: SaveMetadataCloudStateOptions
) {
  const supabase = createClient()
  const existingState = options?.baseState
    ?? metadataStateCache.get(userId)
    ?? await fetchMetadataAppState(userId)
  const nextState: MetadataAppState = {
    savedMeals: state.savedMeals ?? existingState.savedMeals,
    supplements: state.supplements ?? existingState.supplements,
    calendarReminders: state.calendarReminders ?? existingState.calendarReminders,
    socialPosts: state.socialPosts ?? existingState.socialPosts,
    socialFollows: state.socialFollows ?? existingState.socialFollows,
    socialSavedPostIds: state.socialSavedPostIds ?? existingState.socialSavedPostIds,
    socialLikedPostIds: state.socialLikedPostIds ?? existingState.socialLikedPostIds,
    socialPostComments: state.socialPostComments ?? existingState.socialPostComments,
  }

  let { error } = await supabase.from('user_app_state').upsert({
    user_id: userId,
    saved_meals: nextState.savedMeals,
    supplements: nextState.supplements,
    calendar_reminders: nextState.calendarReminders,
    social_posts: nextState.socialPosts,
    social_follows: nextState.socialFollows,
    social_saved_post_ids: nextState.socialSavedPostIds,
    social_liked_post_ids: nextState.socialLikedPostIds,
    social_post_comments: nextState.socialPostComments,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  const missingSocialColumns =
    !!error &&
    (
      error.message.includes('social_posts') ||
      error.message.includes('social_follows') ||
      error.message.includes('social_saved_post_ids') ||
      error.message.includes('social_liked_post_ids') ||
      error.message.includes('social_post_comments') ||
      error.message.includes('schema cache')
    )

  if (missingSocialColumns) {
    const retry = await supabase.from('user_app_state').upsert({
      user_id: userId,
      saved_meals: nextState.savedMeals,
      supplements: nextState.supplements,
      calendar_reminders: nextState.calendarReminders,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    error = retry.error

    const authFallback = await supabase.auth.updateUser({
      data: {
        app_state: nextState,
      },
    })

    if (authFallback.error && error && error.code !== '42501') {
      throw new Error(authFallback.error.message)
    }
  }

  // RLS violations (code 42501) mean the session has expired — local data is
  // preserved and the sync will succeed on the next valid session.
  if (error && error.code !== '42501') throw new Error(error.message)

  metadataStateCache.set(userId, cloneMetadataAppState(nextState))
}

// ─── XP Cloud Sync ───────────────────────────────────────────────────────────
// Writes only the `xp` column — a tiny targeted update, no full-row rewrite.

export async function saveXpCloudState(
  userId: string,
  xpState: import('@/types').XpState,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_app_state')
    .upsert({ user_id: userId, xp: xpState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  const missingXpColumn =
    !!error &&
    (
      error.code === '42703' ||
      error.message.includes('xp') ||
      error.message.includes('schema cache')
    )
  if (missingXpColumn) return
  // RLS violations (42501) mean the session expired — data is safe locally.
  if (error && error.code !== '42501') throw new Error(error.message)
}

export async function fetchXpCloudState(
  userId: string,
): Promise<import('@/types').XpState | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_app_state')
    .select('xp')
    .eq('user_id', userId)
    .single()
  const missingXpColumn =
    !!error &&
    (
      error.code === '42703' ||
      error.message.includes('xp') ||
      error.message.includes('schema cache')
    )
  if (missingXpColumn) return null
  if (error || !data) return null
  const xp = (data as { xp?: unknown }).xp
  if (!xp || typeof xp !== 'object') return null
  const xpObj = xp as Record<string, unknown>
  if (typeof xpObj.total !== 'number') return null
  return xp as import('@/types').XpState
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

export async function fetchCloudState(
  userId: string,
  scopes?: CloudHydrationScope[],
  profile: CloudHydrationProfile = 'default'
): Promise<CloudHydrationData | null> {
  const supabase = createClient()
  const requestedScopes = new Set<CloudHydrationScope>(
    scopes && scopes.length > 0 ? scopes : ALL_CLOUD_HYDRATION_SCOPES
  )
  const shouldFetch = (scope: CloudHydrationScope) => requestedScopes.has(scope)
  const includeSocialMetadata = profile === 'default'
  const todayIso = getTodayISO()
  const recentDaysIso = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().slice(0, 10)
  }
  const queryMealEntries = async () => {
    if (profile === 'dashboard') {
      const [todayResp, recentResp] = await Promise.all([
        supabase
          .from('meal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', todayIso)
          .order('logged_at', { ascending: false })
          .limit(24),
        supabase
          .from('meal_entries')
          .select('id,user_id,date,meal_type,name,calories,protein_g,carbs_g,fat_g,logged_at')
          .eq('user_id', userId)
          .gte('date', recentDaysIso(10))
          .lt('date', todayIso)
          .order('logged_at', { ascending: false })
          .limit(48),
      ])

      return {
        data: [...(todayResp.data ?? []), ...(recentResp.data ?? [])],
        error: todayResp.error ?? recentResp.error,
      }
    }

    let query = supabase.from('meal_entries').select('*').eq('user_id', userId).order('logged_at', { ascending: false })
    if (profile === 'calendar') query = query.gte('date', recentDaysIso(35)).limit(160)
    else if (profile === 'meals') query = query.gte('date', recentDaysIso(60)).limit(320)
    return query
  }
  const queryWorkoutLogs = async () => {
    if (profile === 'dashboard') {
      const [todayResp, recentResp] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('date', todayIso)
          .order('started_at', { ascending: false })
          .limit(6),
        supabase
          .from('workout_logs')
          .select('id,user_id,workout_id,workout_name,date,started_at,completed_at,duration_min,rating')
          .eq('user_id', userId)
          .gte('date', recentDaysIso(14))
          .lt('date', todayIso)
          .order('date', { ascending: false })
          .limit(18),
      ])

      return {
        data: [...(todayResp.data ?? []), ...(recentResp.data ?? [])],
        error: todayResp.error ?? recentResp.error,
      }
    }

    let query = supabase.from('workout_logs').select('*').eq('user_id', userId).order('date', { ascending: false })
    if (profile === 'calendar') query = query.gte('date', recentDaysIso(35)).limit(60)
    else if (profile === 'workouts') query = query.gte('date', recentDaysIso(45)).limit(80)
    return query
  }
  const queryWeightEntries = () => {
    let query = supabase.from('weight_entries').select('*').eq('user_id', userId).order('date', { ascending: false })
    if (profile === 'dashboard') query = query.limit(21)
    return query
  }
  const queryJournalEntries = () => {
    let query = supabase.from('journal_entries').select('*').eq('user_id', userId).order('date', { ascending: false })
    if (profile === 'dashboard') {
      query = supabase
        .from('journal_entries')
        .select('id,user_id,date,title,mood,energy,tags,workout_log_id,created_at,updated_at')
        .eq('user_id', userId)
        .gte('date', recentDaysIso(14))
        .order('date', { ascending: false })
        .limit(14)
    } else if (profile === 'workouts') query = query.limit(30)
    return query
  }
  const queryWaterLogs = () => {
    let query = supabase.from('water_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false })
    if (profile === 'dashboard') query = query.gte('date', recentDaysIso(10)).limit(84)
    return query
  }
  const queryNotifications = () => {
    let query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50) as any
    if (profile === 'dashboard') query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20) as any
    return query
  }

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
    shouldFetch('meals')
      ? queryMealEntries()
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('workouts')
      ? queryWorkoutLogs()
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('tracking')
      ? queryWeightEntries()
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('journal')
      ? queryJournalEntries()
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('planner')
      ? supabase.from('meal_plans').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shouldFetch('planner')
      ? supabase.from('grocery_lists').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shouldFetch('recipes')
      ? supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('templates')
      ? supabase.from('workout_templates').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('water')
      ? selectOrEmpty(
          queryWaterLogs(),
          [] as any[]
        )
      : Promise.resolve({ data: [] as any[], error: null }),
    shouldFetch('metadata')
      ? fetchMetadataAppState(userId, { includeSocial: includeSocialMetadata })
      : Promise.resolve(EMPTY_METADATA_APP_STATE),
    shouldFetch('notifications')
      ? selectOrEmpty(
          queryNotifications(),
          [] as any[]
        )
      : Promise.resolve({ data: [] as any[], error: null }),
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
    content: row.content ?? '',
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
    socialPosts: metadataState.socialPosts,
    socialFollows: metadataState.socialFollows,
    socialSavedPostIds: metadataState.socialSavedPostIds,
    socialLikedPostIds: metadataState.socialLikedPostIds,
    socialPostComments: metadataState.socialPostComments,
    dbNotifications: (notificationsResp.data ?? []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      type: n.type as 'info' | 'success' | 'warning' | 'error' | 'share_received',
      title: n.title as string,
      message: n.message as string,
      read: n.read as boolean,
      action_url: n.action_url as string | undefined,
      created_at: n.created_at as string,
    })),
    fetchedScopes: [...requestedScopes],
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
    socialPosts: payload.socialPosts.length > 0 ? payload.socialPosts : existingMetadata.socialPosts,
    socialFollows: payload.socialFollows.length > 0 ? payload.socialFollows : existingMetadata.socialFollows,
    socialSavedPostIds: payload.socialSavedPostIds.length > 0 ? payload.socialSavedPostIds : existingMetadata.socialSavedPostIds,
    socialLikedPostIds: payload.socialLikedPostIds.length > 0 ? payload.socialLikedPostIds : existingMetadata.socialLikedPostIds,
    socialPostComments: Object.keys(payload.socialPostComments).length > 0 ? payload.socialPostComments : existingMetadata.socialPostComments,
  }, { baseState: existingMetadata }))

  await Promise.all(tasks)
}
