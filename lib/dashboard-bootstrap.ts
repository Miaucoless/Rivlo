import type {
  CalendarReminder,
  JournalEntry,
  SavedMealTemplate,
  SupplementEntry,
  WaterEntry,
  WeightEntry,
  Workout,
  WorkoutLog,
} from '@/types'
import type { MealLogEntry } from '@/lib/content-library'
import { getTodayISO } from '@/lib/utils'

export type DashboardBootstrapState = {
  mealEntries: Record<string, MealLogEntry[]>
  workoutLogs: WorkoutLog[]
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  waterLogs: Record<string, WaterEntry[]>
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
}

function parseJsonNotes<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.startsWith('{')) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function toTimeLabel(isoString?: string | null) {
  if (!isoString) return '12:00 PM'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '12:00 PM'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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

export async function fetchDashboardBootstrapState(userId: string, db: any): Promise<DashboardBootstrapState> {
  const todayIso = getTodayISO()
  const recentDaysIso = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().slice(0, 10)
  }

  const [
    todayMealsResp,
    recentMealsResp,
    todayWorkoutsResp,
    recentWorkoutsResp,
    weightsResp,
    journalsResp,
    waterResp,
    metadataResp,
  ] = await Promise.all([
    db
      .from('meal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayIso)
      .order('logged_at', { ascending: false })
      .limit(24),
    db
      .from('meal_entries')
      .select('id,user_id,date,meal_type,name,calories,protein_g,carbs_g,fat_g,logged_at')
      .eq('user_id', userId)
      .gte('date', recentDaysIso(10))
      .lt('date', todayIso)
      .order('logged_at', { ascending: false })
      .limit(48),
    db
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayIso)
      .order('started_at', { ascending: false })
      .limit(6),
    db
      .from('workout_logs')
      .select('id,user_id,workout_id,workout_name,date,started_at,completed_at,duration_min,rating')
      .eq('user_id', userId)
      .gte('date', recentDaysIso(14))
      .lt('date', todayIso)
      .order('date', { ascending: false })
      .limit(18),
    db
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(21),
    db
      .from('journal_entries')
      .select('id,user_id,date,title,mood,energy,tags,workout_log_id,created_at,updated_at')
      .eq('user_id', userId)
      .gte('date', recentDaysIso(14))
      .order('date', { ascending: false })
      .limit(14),
    db
      .from('water_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', recentDaysIso(10))
      .order('logged_at', { ascending: false })
      .limit(84),
    db
      .from('user_app_state')
      .select('saved_meals, supplements, calendar_reminders')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const mealEntries: Record<string, MealLogEntry[]> = {}
  ;[...(todayMealsResp.data ?? []), ...(recentMealsResp.data ?? [])].forEach((row: any) => {
    const parsed = mealFromRow(row)
    mealEntries[parsed.date] = mealEntries[parsed.date] ? [...mealEntries[parsed.date], parsed.meal] : [parsed.meal]
  })

  const workoutLogs = [...(todayWorkoutsResp.data ?? []), ...(recentWorkoutsResp.data ?? [])].map(workoutFromRow)

  const weightHistory: WeightEntry[] = (weightsResp.data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    weight_kg: Number(row.weight_kg),
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : undefined,
    muscle_mass_kg: row.muscle_mass_kg != null ? Number(row.muscle_mass_kg) : undefined,
    notes: row.notes ?? undefined,
  }))

  const journalEntries: JournalEntry[] = (journalsResp.data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    title: row.title ?? undefined,
    content: '',
    mood: row.mood,
    energy: row.energy,
    tags: row.tags ?? [],
    workout_id: row.workout_log_id ?? undefined,
    prompts_answered: undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  const waterLogs: Record<string, WaterEntry[]> = {}
  ;(waterResp.data ?? []).forEach((row: any) => {
    const entry: WaterEntry = {
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      amount_ml: Number(row.amount_ml),
      logged_at: row.logged_at,
    }
    waterLogs[entry.date] = waterLogs[entry.date] ? [...waterLogs[entry.date], entry] : [entry]
  })

  const metadata = metadataResp.data ?? null

  return {
    mealEntries,
    workoutLogs,
    weightHistory,
    journalEntries,
    waterLogs,
    savedMeals: Array.isArray(metadata?.saved_meals) ? metadata.saved_meals : [],
    supplements: Array.isArray(metadata?.supplements) ? metadata.supplements : [],
    calendarReminders: Array.isArray(metadata?.calendar_reminders) ? metadata.calendar_reminders : [],
  }
}
