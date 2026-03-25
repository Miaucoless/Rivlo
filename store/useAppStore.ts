'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  format,
  startOfWeek,
  subDays,
} from 'date-fns'
import type {
  UserProfile,
  WorkoutLog,
  WeightEntry,
  JournalEntry,
  GroceryList,
  GroceryItem,
  WeeklyMealPlan,
  PlannedSlot,
  Workout,
  Notification,
  NotificationPreferenceKey,
  NotificationPreferences,
  SupplementEntry,
  SavedMealItem,
  SavedMealTemplate,
  Recipe,
  CalendarReminder,
  WaterEntry,
} from '@/types'
import {
  DEMO_USER,
  WEIGHT_HISTORY,
  JOURNAL_ENTRIES,
  TODAY_MEALS,
  TODAY_TOTALS,
  type MealLogEntry,
} from '@/lib/mock-data'
import {
  clearGroceryListCloud,
  deleteCustomWorkoutCloud,
  deleteCustomRecipeCloud,
  deleteJournalEntryCloud,
  deleteMealEntryCloud,
  deleteWorkoutLogCloud,
  ensureUuid,
  fetchCloudState,
  saveMetadataCloudState,
  seedCloudFromLocal,
  upsertCustomRecipe,
  upsertCustomWorkout,
  upsertGroceryList,
  upsertJournalEntry,
  upsertMealEntry,
  upsertMealPlan,
  upsertWeightEntry,
  upsertWaterLog,
  deleteWaterLog,
  upsertWorkoutLog,
} from '@/lib/cloud-sync'
import { formatWeightValue, getTodayISO } from '@/lib/utils'

interface AppStore {
  savedMeals: SavedMealTemplate[]
  customRecipes: Recipe[]
  customWorkouts: Workout[]
  notifications: Notification[]
  notificationPreferences: NotificationPreferences
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]

  // Auth & Profile
  user: UserProfile | null
  isAuthenticated: boolean
  isDemoMode: boolean
  cloudHydratedUserId: string | null

  // UI State
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'

  // Data
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  workoutLogs: WorkoutLog[]
  mealEntries: Record<string, MealLogEntry[]>
  waterLogs: Record<string, WaterEntry[]>
  weeklyMealPlan: WeeklyMealPlan | null
  groceryList: GroceryList | null
  streak: number

  // Actions
  setUser: (user: UserProfile | null) => void
  hydrateFromCloud: (userId: string) => Promise<void>
  syncNow: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => void
  loginDemo: () => void
  logout: () => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  refreshNotifications: () => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  updateNotificationPreference: (key: NotificationPreferenceKey, enabled: boolean) => void

  // Weight
  addWeightEntry: (entry: WeightEntry) => void
  removeWeightEntry: (id: string) => void

  // Journal
  addJournalEntry: (entry: JournalEntry) => void
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void
  deleteJournalEntry: (id: string) => void

  // Meals
  addMealEntry: (date: string, meal: MealLogEntry[][0]) => void
  updateMealEntry: (date: string, mealId: string, updates: Partial<MealLogEntry>) => void
  removeMealEntry: (date: string, mealId: string) => void
  addSavedMeal: (meal: SavedMealTemplate) => void
  updateSavedMeal: (mealId: string, updates: Partial<SavedMealTemplate>) => void
  removeSavedMeal: (mealId: string) => void
  addCustomRecipe: (recipe: Recipe) => void
  updateCustomRecipe: (recipeId: string, updates: Partial<Recipe>) => void
  removeCustomRecipe: (recipeId: string) => void
  setWeeklyMealPlan: (plan: WeeklyMealPlan) => void
  setGroceryList: (list: GroceryList) => void
  clearGroceryList: () => void
  toggleGroceryItem: (itemIndex: number) => void
  addGroceryItem: (item: Omit<GroceryItem, 'checked'>) => void
  removeGroceryItem: (itemIndex: number) => void
  updateGroceryItem: (itemIndex: number, updates: Partial<GroceryItem>) => void
  clearCheckedItems: () => void
  addPlannedMeal: (day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', item: import('@/types').PlannedItem) => void
  removePlannedMealItem: (day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', index: number) => void
  clearMealPlan: () => void

  // Water
  waterUnit: 'ml' | 'oz' | 'l'
  setWaterUnit: (unit: 'ml' | 'oz' | 'l') => void
  addWaterEntry: (entry: WaterEntry) => void
  removeWaterEntry: (date: string, entryId: string) => void
  getWaterTotal: (date: string) => number

  // Supplements
  addSupplement: (supplement: SupplementEntry) => void
  updateSupplement: (supplementId: string, updates: Partial<SupplementEntry>) => void
  removeSupplement: (supplementId: string) => void
  toggleSupplementTaken: (supplementId: string, date?: string) => void

  // Calendar reminders
  addCalendarReminder: (reminder: CalendarReminder) => void
  updateCalendarReminder: (id: string, updates: Partial<CalendarReminder>) => void
  removeCalendarReminder: (id: string) => void

  // Workouts
  logWorkout: (log: WorkoutLog) => void
  updateWorkoutLog: (logId: string, updates: Partial<WorkoutLog>) => void
  removeWorkoutLog: (logId: string) => void
  addCustomWorkout: (workout: Workout) => void
  updateCustomWorkout: (workoutId: string, updates: Partial<Workout>) => void
  removeCustomWorkout: (workoutId: string) => void

  // Getters
  getDailyMeals: (date: string) => MealLogEntry[]
  getDailyTotals: (date: string) => typeof TODAY_TOTALS
  getCalendarEvents: () => Array<{
    date: string
    type: string
    title: string
    color: string
  }>
}

// Re-export for components that import from this module
export type { SavedMealItem, SavedMealTemplate } from '@/types'
export type { Recipe } from '@/types'

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  daily_workout_reminder: true,
  meal_logging_reminder: true,
  weekly_progress_summary: false,
  goal_milestone_alerts: true,
}

type NotificationInputs = Pick<
  AppStore,
  'user' | 'notifications' | 'notificationPreferences' | 'weightHistory' | 'journalEntries' | 'workoutLogs' | 'mealEntries' | 'streak' | 'supplements'
>

// Realistic exercise sets for each PPL day in demo mode
const DEMO_PUSH_EXERCISES: WorkoutLog['exercises'] = [
  { exercise_id: 'e1', exercise_name: 'Barbell Bench Press', sets: [
    { set_number: 1, target_reps: 5, actual_reps: 5, weight_kg: 85 },
    { set_number: 2, target_reps: 5, actual_reps: 5, weight_kg: 85 },
    { set_number: 3, target_reps: 5, actual_reps: 4, weight_kg: 85 },
  ]},
  { exercise_id: 'e2', exercise_name: 'Overhead Press', sets: [
    { set_number: 1, target_reps: 8, actual_reps: 8, weight_kg: 52.5 },
    { set_number: 2, target_reps: 8, actual_reps: 7, weight_kg: 52.5 },
    { set_number: 3, target_reps: 8, actual_reps: 7, weight_kg: 52.5 },
  ]},
  { exercise_id: 'e3', exercise_name: 'Incline Dumbbell Press', sets: [
    { set_number: 1, target_reps: 10, actual_reps: 10, weight_kg: 30 },
    { set_number: 2, target_reps: 10, actual_reps: 10, weight_kg: 30 },
    { set_number: 3, target_reps: 10, actual_reps: 9, weight_kg: 30 },
  ]},
  { exercise_id: 'e4', exercise_name: 'Tricep Pushdown', sets: [
    { set_number: 1, target_reps: 12, actual_reps: 12, weight_kg: 22.5 },
    { set_number: 2, target_reps: 12, actual_reps: 11, weight_kg: 22.5 },
  ]},
]

const DEMO_PULL_EXERCISES: WorkoutLog['exercises'] = [
  { exercise_id: 'e5', exercise_name: 'Barbell Row', sets: [
    { set_number: 1, target_reps: 5, actual_reps: 5, weight_kg: 80 },
    { set_number: 2, target_reps: 5, actual_reps: 5, weight_kg: 80 },
    { set_number: 3, target_reps: 5, actual_reps: 5, weight_kg: 80 },
  ]},
  { exercise_id: 'e6', exercise_name: 'Pull-Up', sets: [
    { set_number: 1, target_reps: 8, actual_reps: 8, weight_kg: 0 },
    { set_number: 2, target_reps: 8, actual_reps: 7, weight_kg: 0 },
    { set_number: 3, target_reps: 8, actual_reps: 6, weight_kg: 0 },
  ]},
  { exercise_id: 'e7', exercise_name: 'Cable Row', sets: [
    { set_number: 1, target_reps: 10, actual_reps: 10, weight_kg: 57.5 },
    { set_number: 2, target_reps: 10, actual_reps: 10, weight_kg: 57.5 },
    { set_number: 3, target_reps: 10, actual_reps: 9, weight_kg: 57.5 },
  ]},
  { exercise_id: 'e8', exercise_name: 'Dumbbell Curl', sets: [
    { set_number: 1, target_reps: 12, actual_reps: 12, weight_kg: 14 },
    { set_number: 2, target_reps: 12, actual_reps: 11, weight_kg: 14 },
  ]},
]

const DEMO_LEG_EXERCISES: WorkoutLog['exercises'] = [
  { exercise_id: 'e9', exercise_name: 'Barbell Squat', sets: [
    { set_number: 1, target_reps: 5, actual_reps: 5, weight_kg: 100 },
    { set_number: 2, target_reps: 5, actual_reps: 5, weight_kg: 100 },
    { set_number: 3, target_reps: 5, actual_reps: 5, weight_kg: 100 },
  ]},
  { exercise_id: 'e10', exercise_name: 'Romanian Deadlift', sets: [
    { set_number: 1, target_reps: 8, actual_reps: 8, weight_kg: 75 },
    { set_number: 2, target_reps: 8, actual_reps: 8, weight_kg: 75 },
    { set_number: 3, target_reps: 8, actual_reps: 7, weight_kg: 75 },
  ]},
  { exercise_id: 'e11', exercise_name: 'Leg Press', sets: [
    { set_number: 1, target_reps: 12, actual_reps: 12, weight_kg: 130 },
    { set_number: 2, target_reps: 12, actual_reps: 12, weight_kg: 130 },
    { set_number: 3, target_reps: 12, actual_reps: 10, weight_kg: 130 },
  ]},
  { exercise_id: 'e12', exercise_name: 'Standing Calf Raise', sets: [
    { set_number: 1, target_reps: 15, actual_reps: 15, weight_kg: 60 },
    { set_number: 2, target_reps: 15, actual_reps: 14, weight_kg: 60 },
  ]},
]

const DEMO_WORKOUT_EXERCISES_BY_INDEX = [DEMO_PUSH_EXERCISES, DEMO_PULL_EXERCISES, DEMO_LEG_EXERCISES]
const DEMO_WORKOUT_NAMES = ['Push Day A', 'Pull Day A', 'Leg Day A']
const DEMO_WORKOUT_MUSCLES: WorkoutLog['workout']['muscle_groups'][] = [
  ['chest', 'shoulders', 'triceps'],
  ['back', 'biceps'],
  ['quads', 'hamstrings', 'glutes', 'calves'],
]

function generateWorkoutLogs() {
  const logs: WorkoutLog[] = []
  const workoutDays = [1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31, 34, 36, 38, 41]
  workoutDays.forEach((daysAgo, i) => {
    const idx = i % 3
    // Slightly vary weights each session to simulate progression
    const progressFactor = Math.max(0, Math.floor(i / 3)) // every full PPL cycle = ~1 progression step
    const exercises: WorkoutLog['exercises'] = DEMO_WORKOUT_EXERCISES_BY_INDEX[idx].map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        // Vary reps by ±1 and weight by progression
        actual_reps: Math.max(1, s.actual_reps + (Math.random() > 0.7 ? -1 : 0)),
        weight_kg: s.weight_kg > 0 ? Math.round((s.weight_kg - progressFactor * 2.5) * 2) / 2 : 0,
      })),
    }))
    logs.push({
      id: `wl${i}`,
      user_id: DEMO_USER.id,
      workout_id: `w${idx + 1}`,
      workout: {
        id: `w${idx + 1}`,
        name: DEMO_WORKOUT_NAMES[idx],
        description: '',
        day_label: DEMO_WORKOUT_NAMES[idx],
        muscle_groups: DEMO_WORKOUT_MUSCLES[idx],
        exercises: [],
        estimated_duration_min: 65,
        difficulty: 'intermediate',
        split_type: 'ppl',
      },
      date: format(subDays(new Date(), daysAgo), 'yyyy-MM-dd'),
      started_at: subDays(new Date(), daysAgo).toISOString(),
      completed_at: subDays(new Date(), daysAgo).toISOString(),
      duration_min: 55 + Math.floor(Math.random() * 20),
      exercises,
      calories_burned_kcal: 320 + Math.floor(Math.random() * 120),
      rating: (Math.floor(Math.random() * 2) + 4) as 4 | 5,
    })
  })
  return logs
}

function generateMealHistory() {
  const history: Record<string, MealLogEntry[]> = {}
  history[getTodayISO()] = TODAY_MEALS

  for (let i = 1; i <= 30; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    history[date] = [
      { id: `m${i}1`, meal_type: 'breakfast', name: 'High-Protein Greek Yogurt Bowl', macros: { calories: 385, protein_g: 32, carbs_g: 45, fat_g: 6 }, time: '7:30 AM', recipe: null },
      { id: `m${i}2`, meal_type: 'lunch', name: 'Grilled Chicken Rice Bowl', macros: { calories: 548, protein_g: 52, carbs_g: 48, fat_g: 12 }, time: '12:30 PM', recipe: null },
      { id: `m${i}3`, meal_type: 'dinner', name: 'Salmon & Sweet Potato', macros: { calories: 612, protein_g: 48, carbs_g: 42, fat_g: 24 }, time: '7:00 PM', recipe: null },
    ]
  }

  return history
}

function generateDemoSupplements(): SupplementEntry[] {
  const now = new Date().toISOString()

  return [
    {
      id: 'supp-vitamin-d',
      name: 'Vitamin D3',
      category: 'vitamin',
      amount: 2000,
      unit: 'IU',
      frequency: 'daily',
      notes: 'Take with breakfast.',
      notification_enabled: true,
      taken_dates: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 'supp-magnesium',
      name: 'Magnesium Glycinate',
      category: 'mineral',
      amount: 300,
      unit: 'mg',
      frequency: 'daily',
      notes: 'Usually in the evening.',
      notification_enabled: true,
      taken_dates: [getTodayISO()],
      created_at: now,
      updated_at: now,
    },
    {
      id: 'supp-bloom-greens',
      name: 'Bloom Greens & Superfoods',
      category: 'supplement',
      amount: 1,
      unit: 'scoop',
      frequency: 'daily',
      notes: 'Mixed with water in the morning.',
      notification_enabled: true,
      taken_dates: [],
      created_at: now,
      updated_at: now,
    },
  ]
}

function buildNotifications(state: NotificationInputs): Notification[] {
  const notifications: Notification[] = []
  const now = new Date()
  const todayIso = getTodayISO()
  const currentWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const firstName = state.user?.name?.split(' ')[0] || 'there'
  const readMap = new Map(state.notifications.map((notification) => [notification.id, notification.read]))

  const addNotification = (notification: Notification) => {
    notifications.push({
      ...notification,
      read: readMap.get(notification.id) ?? notification.read,
    })
  }

  const todayMeals = state.mealEntries[todayIso] || []
  const workoutLoggedToday = state.workoutLogs.some((log) => log.date === todayIso)
  const journalLoggedToday = state.journalEntries.some((entry) => entry.date === todayIso)
  const workoutsThisWeek = state.workoutLogs.filter((log) => log.date >= currentWeekStart)
  const mealDaysThisWeek = Object.entries(state.mealEntries).filter(([date, meals]) => date >= currentWeekStart && meals.length > 0).length
  const latestWeight = [...state.weightHistory].sort((a, b) => b.date.localeCompare(a.date))[0]
  const earliestWeight = [...state.weightHistory].sort((a, b) => a.date.localeCompare(b.date))[0]
  const targetChangeKg = state.user?.goal_target_change_kg ? Math.abs(Number(state.user.goal_target_change_kg)) : null
  const achievedChangeKg = latestWeight && earliestWeight
    ? Math.abs(Number(latestWeight.weight_kg) - Number(earliestWeight.weight_kg))
    : null

  if (state.notificationPreferences.daily_workout_reminder && !workoutLoggedToday) {
    const preferredWindow = state.user?.preferred_workout_time
      ? state.user.preferred_workout_time.replaceAll('_', ' ')
      : 'usual training'

    addNotification({
      id: `daily-workout-${todayIso}`,
      type: 'info',
      title: `Workout reminder for ${firstName}`,
      message: `You have not logged a workout yet today. Your ${preferredWindow} window is still open.`,
      read: false,
      created_at: now.toISOString(),
      action_url: '/workouts',
    })
  }

  if (state.notificationPreferences.meal_logging_reminder && todayMeals.length === 0) {
    addNotification({
      id: `daily-meals-${todayIso}`,
      type: 'warning',
      title: 'Meal log is empty today',
      message: 'No meals have been logged yet today. Add a meal to keep your nutrition data complete.',
      read: false,
      created_at: now.toISOString(),
      action_url: '/meals',
    })
  }

  if (!journalLoggedToday) {
    addNotification({
      id: `journal-prompt-${todayIso}`,
      type: 'info',
      title: 'Quick reflection prompt',
      message: 'You have not written a journal entry today. A short note can help connect energy, food, and training patterns.',
      read: false,
      created_at: now.toISOString(),
      action_url: '/journal',
    })
  }

  state.supplements
    .filter((supplement) => !supplement.archived && supplement.notification_enabled)
    .filter((supplement) => !supplement.taken_dates.includes(todayIso))
    .slice(0, 4)
    .forEach((supplement) => {
      addNotification({
        id: `supplement-${supplement.id}-${todayIso}`,
        type: 'info',
        title: `${supplement.name} is due`,
        message: `${supplement.amount} ${supplement.unit} • ${supplement.frequency.replaceAll('_', ' ')}. Tap to manage or mark it taken.`,
        read: false,
        created_at: now.toISOString(),
        action_url: '/supplements',
      })
    })

  if (state.notificationPreferences.weekly_progress_summary) {
    addNotification({
      id: `weekly-summary-${currentWeekStart}`,
      type: 'success',
      title: 'Weekly progress snapshot',
      message: `${workoutsThisWeek.length} workouts logged this week, meals tracked on ${mealDaysThisWeek} day${mealDaysThisWeek === 1 ? '' : 's'}, current streak ${state.streak} day${state.streak === 1 ? '' : 's'}.`,
      read: false,
      created_at: now.toISOString(),
      action_url: '/tracking',
    })
  }

  if (state.notificationPreferences.goal_milestone_alerts) {
    if (state.streak > 0 && state.streak % 7 === 0) {
      addNotification({
        id: `streak-milestone-${state.streak}`,
        type: 'success',
        title: 'Streak milestone reached',
        message: `You are on a ${state.streak}-day streak. Consistency is compounding.`,
        read: false,
        created_at: now.toISOString(),
        action_url: '/dashboard',
      })
    }

    if (targetChangeKg && achievedChangeKg !== null && achievedChangeKg / targetChangeKg >= 0.75) {
      addNotification({
        id: `goal-progress-${latestWeight?.date || todayIso}`,
        type: 'success',
        title: 'Goal milestone is close',
        message: `Based on your logged weigh-ins, you are about ${Math.round((achievedChangeKg / targetChangeKg) * 100)}% of the way to your target change.`,
        read: false,
        created_at: now.toISOString(),
        action_url: '/tracking',
      })
    }
  }

  return notifications.sort((a, b) => {
    if (a.read !== b.read) return Number(a.read) - Number(b.read)
    return b.created_at.localeCompare(a.created_at)
  })
}

function withRefreshedNotifications(current: NotificationInputs, updates: Partial<AppStore>): Partial<AppStore> {
  const nextState = {
    ...current,
    ...updates,
  } as NotificationInputs

  return {
    ...updates,
    notifications: buildNotifications(nextState),
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      savedMeals: [],
      customRecipes: [],
      customWorkouts: [],
      notifications: [],
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      supplements: [],
      calendarReminders: [],
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
      cloudHydratedUserId: null,
      sidebarCollapsed: false,
      theme: 'dark',
      weightHistory: [],
      journalEntries: [],
      workoutLogs: [],
      mealEntries: {},
      waterLogs: {},
      waterUnit: 'ml',
      weeklyMealPlan: null,
      groceryList: null,
      streak: 0,

      setUser: (user) => {
        set((state) => withRefreshedNotifications(state, {
          user,
          isAuthenticated: !!user,
          isDemoMode: false,
          notificationPreferences: user?.notification_preferences ?? state.notificationPreferences,
        }))

        if (user) {
          void get().hydrateFromCloud(user.id)
        }
      },

      hydrateFromCloud: async (userId) => {
        if (!userId || get().isDemoMode) return

        let cloud = await fetchCloudState(userId)
        if (!cloud) return

        const localState = get()
        const seedPayload = {
          mealEntries: Object.keys(cloud.mealEntries).length === 0 ? localState.mealEntries : cloud.mealEntries,
          workoutLogs: cloud.workoutLogs.length === 0 ? localState.workoutLogs : [],
          weightHistory: cloud.weightHistory.length === 0 ? localState.weightHistory : [],
          journalEntries: cloud.journalEntries.length === 0 ? localState.journalEntries : [],
          savedMeals: cloud.savedMeals.length === 0 ? localState.savedMeals : [],
          supplements: cloud.supplements.length === 0 ? localState.supplements : [],
          calendarReminders: cloud.calendarReminders.length === 0 ? localState.calendarReminders : [],
          weeklyMealPlan: cloud.weeklyMealPlan ? null : localState.weeklyMealPlan,
          groceryList: cloud.groceryList ? null : localState.groceryList,
          customRecipes: cloud.customRecipes.length === 0 ? localState.customRecipes : [],
          customWorkouts: cloud.customWorkouts.length === 0 ? localState.customWorkouts : [],
          waterLogs: Object.keys(cloud.waterLogs).length === 0 ? localState.waterLogs : {},
        }

        const shouldSeedAnyBucket =
          Object.keys(seedPayload.mealEntries).length > 0 ||
          seedPayload.workoutLogs.length > 0 ||
          seedPayload.weightHistory.length > 0 ||
          seedPayload.journalEntries.length > 0 ||
          seedPayload.savedMeals.length > 0 ||
          seedPayload.supplements.length > 0 ||
          seedPayload.calendarReminders.length > 0 ||
          seedPayload.customRecipes.length > 0 ||
          seedPayload.customWorkouts.length > 0 ||
          Object.keys(seedPayload.waterLogs).length > 0 ||
          !!seedPayload.weeklyMealPlan ||
          !!seedPayload.groceryList

        if (shouldSeedAnyBucket) {
          await seedCloudFromLocal(userId, seedPayload)

          const refreshedCloud = await fetchCloudState(userId)
          if (refreshedCloud) {
            cloud = refreshedCloud
          }
        }

        set((state) => withRefreshedNotifications(state, {
          mealEntries: cloud.mealEntries,
          workoutLogs: cloud.workoutLogs,
          weightHistory: cloud.weightHistory,
          journalEntries: cloud.journalEntries,
          savedMeals: cloud.savedMeals,
          supplements: cloud.supplements,
          calendarReminders: cloud.calendarReminders,
          weeklyMealPlan: cloud.weeklyMealPlan,
          groceryList: cloud.groceryList,
          customRecipes: cloud.customRecipes,
          customWorkouts: cloud.customWorkouts,
          waterLogs: cloud.waterLogs,
          cloudHydratedUserId: userId,
        }))
      },

      syncNow: async () => {
        const state = get()
        if (!state.user || state.isDemoMode) return
        await state.hydrateFromCloud(state.user.id)
      },

      updateProfile: (updates) =>
        set((state) => withRefreshedNotifications(state, {
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      loginDemo: () =>
        set((state) => withRefreshedNotifications(state, {
          user: DEMO_USER,
          isAuthenticated: true,
          isDemoMode: true,
          cloudHydratedUserId: null,
          weightHistory: WEIGHT_HISTORY,
          journalEntries: JOURNAL_ENTRIES,
          workoutLogs: generateWorkoutLogs(),
          mealEntries: generateMealHistory(),
          weeklyMealPlan: {
            id: 'wmp_demo',
            user_id: DEMO_USER.id,
            week_start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            days: {
              monday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              tuesday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              wednesday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              thursday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              friday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              saturday: { breakfast: [], lunch: [], dinner: [], snack: [] },
              sunday: { breakfast: [], lunch: [], dinner: [], snack: [] },
            },
          },
          groceryList: null,
          streak: 12,
          supplements: generateDemoSupplements(),
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        })),

      logout: () =>
        set({
          savedMeals: [],
          customRecipes: [],
          customWorkouts: [],
          notifications: [],
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          supplements: [],
          calendarReminders: [],
          user: null,
          isAuthenticated: false,
          isDemoMode: false,
          cloudHydratedUserId: null,
          sidebarCollapsed: false,
          theme: 'dark',
          weightHistory: [],
          journalEntries: [],
          workoutLogs: [],
          mealEntries: {},
          waterLogs: {},
          weeklyMealPlan: null,
          groceryList: null,
          streak: 0,
        }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),
      setWaterUnit: (unit) => set({ waterUnit: unit }),

      refreshNotifications: () =>
        set((state) => ({ notifications: buildNotifications(state) })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification
          ),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
        })),

      updateNotificationPreference: (key, enabled) =>
        set((state) => withRefreshedNotifications(state, {
          notificationPreferences: {
            ...state.notificationPreferences,
            [key]: enabled,
          },
          user: state.user
            ? {
                ...state.user,
                notification_preferences: {
                  ...(state.user.notification_preferences ?? state.notificationPreferences),
                  [key]: enabled,
                },
              }
            : null,
        })),

      addWeightEntry: (entry) => {
        const normalizedEntry = { ...entry, id: ensureUuid(entry.id) }
        set((state) => withRefreshedNotifications(state, {
          weightHistory: [...state.weightHistory.filter((weight) => weight.date !== normalizedEntry.date), normalizedEntry].sort((a, b) => a.date.localeCompare(b.date)),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertWeightEntry(state.user.id, normalizedEntry)
        }
      },

      removeWeightEntry: (id) => {
        set((state) => withRefreshedNotifications(state, {
          weightHistory: state.weightHistory.filter((weight) => weight.id !== id),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          // Note: You would need to implement deleteWeightEntryCloud in cloud-sync
          // For now, this will only update local state
          console.log('Weight entry deletion not yet synced to cloud')
        }
      },

      addJournalEntry: (entry) => {
        const normalizedEntry = { ...entry, id: ensureUuid(entry.id) }
        set((state) => withRefreshedNotifications(state, {
          journalEntries: [normalizedEntry, ...state.journalEntries],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertJournalEntry(state.user.id, normalizedEntry)
        }
      },

      updateJournalEntry: (id, updates) => {
        let syncedEntry: JournalEntry | null = null
        set((state) => withRefreshedNotifications(state, {
          journalEntries: state.journalEntries.map((entry) => {
            if (entry.id !== id) return entry
            syncedEntry = { ...entry, ...updates, updated_at: new Date().toISOString() }
            return syncedEntry
          }),
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedEntry) {
          void upsertJournalEntry(state.user.id, syncedEntry)
        }
      },

      deleteJournalEntry: (id) => {
        set((state) => withRefreshedNotifications(state, {
          journalEntries: state.journalEntries.filter((entry) => entry.id !== id),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteJournalEntryCloud(state.user.id, id)
        }
      },

      addMealEntry: (date, meal) => {
        const normalizedMeal = { ...meal, id: ensureUuid(meal.id) }
        set((state) => withRefreshedNotifications(state, {
          mealEntries: {
            ...state.mealEntries,
            [date]: [...(state.mealEntries[date] || []), normalizedMeal],
          },
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertMealEntry(state.user.id, date, normalizedMeal)
        }
      },

      updateMealEntry: (date, mealId, updates) => {
        let syncedMeal: MealLogEntry | null = null
        set((state) => withRefreshedNotifications(state, {
          mealEntries: {
            ...state.mealEntries,
            [date]: (state.mealEntries[date] || []).map((meal) => {
              if (meal.id !== mealId) return meal
              syncedMeal = { ...meal, ...updates }
              return syncedMeal
            }),
          },
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedMeal) {
          void upsertMealEntry(state.user.id, date, syncedMeal)
        }
      },

      removeMealEntry: (date, mealId) => {
        set((state) => withRefreshedNotifications(state, {
          mealEntries: {
            ...state.mealEntries,
            [date]: (state.mealEntries[date] || []).filter((meal) => meal.id !== mealId),
          },
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteMealEntryCloud(state.user.id, mealId)
        }
      },

      addWaterEntry: (entry) => {
        const normalized = { ...entry, id: ensureUuid(entry.id) }
        set((state) => ({
          waterLogs: {
            ...state.waterLogs,
            [entry.date]: [...(state.waterLogs[entry.date] || []), normalized],
          },
        }))
        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertWaterLog(state.user.id, normalized)
        }
      },

      removeWaterEntry: (date, entryId) => {
        set((state) => ({
          waterLogs: {
            ...state.waterLogs,
            [date]: (state.waterLogs[date] || []).filter((e) => e.id !== entryId),
          },
        }))
        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteWaterLog(state.user.id, entryId)
        }
      },

      addSavedMeal: (meal) => {
        set((state) => ({
          savedMeals: [meal, ...state.savedMeals],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      updateSavedMeal: (mealId, updates) => {
        set((state) => ({
          savedMeals: state.savedMeals.map((meal) =>
            meal.id === mealId
              ? { ...meal, ...updates, updated_at: new Date().toISOString() }
              : meal
          ),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      removeSavedMeal: (mealId) => {
        // Collect all log entry IDs linked to this template before removing
        const stateSnap = get()
        const linkedEntryIds: Array<{ date: string; id: string }> = []
        for (const [date, entries] of Object.entries(stateSnap.mealEntries)) {
          for (const entry of entries) {
            if ((entry as { saved_meal_template_id?: string }).saved_meal_template_id === mealId) {
              linkedEntryIds.push({ date, id: entry.id })
            }
          }
        }

        set((state) => {
          // Remove template
          const savedMeals = state.savedMeals.filter((meal) => meal.id !== mealId)
          // Remove linked log entries
          const mealEntries = { ...state.mealEntries }
          for (const { date, id } of linkedEntryIds) {
            mealEntries[date] = (mealEntries[date] || []).filter(e => e.id !== id)
          }
          return { savedMeals, mealEntries }
        })

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
          // Delete linked log entries from cloud
          for (const { id } of linkedEntryIds) {
            void deleteMealEntryCloud(state.user.id, id)
          }
        }
      },

      addCustomRecipe: (recipe) => {
        const normalizedRecipe = { ...recipe, id: ensureUuid(recipe.id) }
        set((state) => ({
          customRecipes: [normalizedRecipe, ...state.customRecipes],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertCustomRecipe(state.user.id, normalizedRecipe)
        }
      },

      updateCustomRecipe: (recipeId, updates) => {
        let syncedRecipe: Recipe | null = null
        set((state) => ({
          customRecipes: state.customRecipes.map((r) => {
            if (r.id !== recipeId) return r
            syncedRecipe = { ...r, ...updates }
            return syncedRecipe
          }),
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedRecipe) {
          void upsertCustomRecipe(state.user.id, syncedRecipe)
        }
      },

      removeCustomRecipe: (recipeId) => {
        set((state) => ({
          customRecipes: state.customRecipes.filter((r) => r.id !== recipeId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteCustomRecipeCloud(state.user.id, recipeId)
        }
      },

      setWeeklyMealPlan: (plan) => {
        const normalizedPlan = { ...plan, id: ensureUuid(plan.id) }
        set({ weeklyMealPlan: normalizedPlan })

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertMealPlan(state.user.id, normalizedPlan)
        }
      },

      setGroceryList: (list) => {
        const normalizedList = { ...list, id: ensureUuid(list.id) }
        set({ groceryList: normalizedList })

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertGroceryList(state.user.id, normalizedList)
        }
      },

      toggleGroceryItem: (itemIndex) => {
        set((state) => {
          if (!state.groceryList) return state
          const items = [...state.groceryList.items]
          items[itemIndex] = { ...items[itemIndex], checked: !items[itemIndex].checked }
          const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
          return { groceryList: { ...state.groceryList, items, total_estimated_cost: Math.round(total * 100) / 100 } }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.groceryList) {
          void upsertGroceryList(state.user.id, state.groceryList)
        }
      },

      addGroceryItem: (item) => {
        set((state) => {
          const newItem = { ...item, checked: false }
          if (!state.groceryList) {
            const list: GroceryList = {
              id: ensureUuid(`gl_${Date.now()}`),
              user_id: state.user?.id ?? 'local',
              week_start: new Date().toISOString().slice(0, 10),
              items: [newItem],
              total_estimated_cost: newItem.estimated_price,
              created_at: new Date().toISOString(),
            }
            return { groceryList: list }
          }
          const items = [...state.groceryList.items, newItem]
          const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
          return { groceryList: { ...state.groceryList, items, total_estimated_cost: Math.round(total * 100) / 100 } }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.groceryList) {
          void upsertGroceryList(state.user.id, state.groceryList)
        }
      },

      removeGroceryItem: (itemIndex) => {
        set((state) => {
          if (!state.groceryList) return state
          const items = state.groceryList.items.filter((_, i) => i !== itemIndex)
          const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
          return { groceryList: { ...state.groceryList, items, total_estimated_cost: Math.round(total * 100) / 100 } }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.groceryList) {
          void upsertGroceryList(state.user.id, state.groceryList)
        }
      },

      updateGroceryItem: (itemIndex, updates) => {
        set((state) => {
          if (!state.groceryList) return state
          const items = state.groceryList.items.map((item, i) =>
            i === itemIndex ? { ...item, ...updates } : item
          )
          const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
          return { groceryList: { ...state.groceryList, items, total_estimated_cost: Math.round(total * 100) / 100 } }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.groceryList) {
          void upsertGroceryList(state.user.id, state.groceryList)
        }
      },

      clearCheckedItems: () => {
        set((state) => {
          if (!state.groceryList) return state
          const items = state.groceryList.items.filter((i) => !i.checked)
          const total = items.reduce((sum, i) => sum + i.estimated_price, 0)
          return { groceryList: { ...state.groceryList, items, total_estimated_cost: Math.round(total * 100) / 100 } }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.groceryList) {
          void upsertGroceryList(state.user.id, state.groceryList)
        }
      },

      clearGroceryList: () => {
        set({ groceryList: null })
        const state = get()
        if (state.user && !state.isDemoMode) {
          void clearGroceryListCloud(state.user.id)
        }
      },

      addPlannedMeal: (day, slot, item) => {
        set((state) => {
          const emptyDay = { breakfast: [] as PlannedSlot, lunch: [] as PlannedSlot, dinner: [] as PlannedSlot, snack: [] as PlannedSlot }
          const existing = state.weeklyMealPlan ?? {
            id: ensureUuid(`wmp_${Date.now()}`),
            user_id: state.user?.id ?? 'local',
            week_start: new Date().toISOString().slice(0, 10),
            days: {
              monday: { ...emptyDay }, tuesday: { ...emptyDay }, wednesday: { ...emptyDay },
              thursday: { ...emptyDay }, friday: { ...emptyDay }, saturday: { ...emptyDay }, sunday: { ...emptyDay },
            },
          }
          const dayData = existing.days[day] ?? { ...emptyDay }
          const currentSlot = dayData[slot]
          const currentItems: PlannedSlot = Array.isArray(currentSlot) ? currentSlot : []
          return {
            weeklyMealPlan: {
              ...existing,
              days: {
                ...existing.days,
                [day]: {
                  ...emptyDay,
                  ...dayData,
                  [slot]: [...currentItems, item],
                },
              },
            },
          }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.weeklyMealPlan) {
          void upsertMealPlan(state.user.id, state.weeklyMealPlan)
        }
      },

      removePlannedMealItem: (day, slot, index) => {
        set((state) => {
          if (!state.weeklyMealPlan) return state
          const dayData = state.weeklyMealPlan.days[day]
          if (!dayData) return state
          return {
            weeklyMealPlan: {
              ...state.weeklyMealPlan,
              days: {
                ...state.weeklyMealPlan.days,
                [day]: {
                  ...dayData,
                  [slot]: dayData[slot].filter((_, i) => i !== index),
                },
              },
            },
          }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.weeklyMealPlan) {
          void upsertMealPlan(state.user.id, state.weeklyMealPlan)
        }
      },

      clearMealPlan: () => {
        set((state) => {
          if (!state.weeklyMealPlan) return state
          const emptyDay = { breakfast: [] as PlannedSlot, lunch: [] as PlannedSlot, dinner: [] as PlannedSlot, snack: [] as PlannedSlot }
          return {
            weeklyMealPlan: {
              ...state.weeklyMealPlan,
              days: Object.fromEntries(
                Object.keys(state.weeklyMealPlan.days).map((d) => [d, { ...emptyDay }])
              ),
            },
          }
        })

        const state = get()
        if (state.user && !state.isDemoMode && state.weeklyMealPlan) {
          void upsertMealPlan(state.user.id, state.weeklyMealPlan)
        }
      },

      addSupplement: (supplement) => {
        const normalizedSupplement = { ...supplement, id: ensureUuid(supplement.id) }
        set((state) => withRefreshedNotifications(state, {
          supplements: [normalizedSupplement, ...state.supplements],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      updateSupplement: (supplementId, updates) => {
        set((state) => withRefreshedNotifications(state, {
          supplements: state.supplements.map((supplement) =>
            supplement.id === supplementId
              ? { ...supplement, ...updates, updated_at: new Date().toISOString() }
              : supplement
          ),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      removeSupplement: (supplementId) => {
        set((state) => withRefreshedNotifications(state, {
          supplements: state.supplements.filter((supplement) => supplement.id !== supplementId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      toggleSupplementTaken: (supplementId, date = getTodayISO()) => {
        set((state) => withRefreshedNotifications(state, {
          supplements: state.supplements.map((supplement) => {
            if (supplement.id !== supplementId) return supplement

            const taken_dates = supplement.taken_dates.includes(date)
              ? supplement.taken_dates.filter((takenDate) => takenDate !== date)
              : [date, ...supplement.taken_dates].sort((a, b) => b.localeCompare(a))

            return {
              ...supplement,
              taken_dates,
              updated_at: new Date().toISOString(),
            }
          }),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      addCalendarReminder: (reminder) => {
        const normalizedReminder = { ...reminder, id: ensureUuid(reminder.id) }
        set((state) => ({ calendarReminders: [normalizedReminder, ...state.calendarReminders] }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      updateCalendarReminder: (id, updates) => {
        set((state) => ({
          calendarReminders: state.calendarReminders.map((r) => r.id === id ? { ...r, ...updates } : r),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      removeCalendarReminder: (id) => {
        set((state) => ({ calendarReminders: state.calendarReminders.filter((r) => r.id !== id) }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void saveMetadataCloudState({
            savedMeals: state.savedMeals,
            supplements: state.supplements,
            calendarReminders: state.calendarReminders,
          })
        }
      },

      logWorkout: (log) => {
        const normalizedLog = { ...log, id: ensureUuid(log.id) }
        set((state) => withRefreshedNotifications(state, {
          workoutLogs: [normalizedLog, ...state.workoutLogs],
          streak: state.streak + (state.workoutLogs.some((workout) => workout.date === getTodayISO()) ? 0 : 1),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertWorkoutLog(state.user.id, normalizedLog)
        }
      },

      updateWorkoutLog: (logId, updates) => {
        let syncedLog: WorkoutLog | null = null
        set((state) => withRefreshedNotifications(state, {
          workoutLogs: state.workoutLogs.map((log) => {
            if (log.id !== logId) return log
            syncedLog = { ...log, ...updates }
            return syncedLog
          }),
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedLog) {
          void upsertWorkoutLog(state.user.id, syncedLog)
        }
      },

      removeWorkoutLog: (logId) => {
        set((state) => withRefreshedNotifications(state, {
          workoutLogs: state.workoutLogs.filter((log) => log.id !== logId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteWorkoutLogCloud(state.user.id, logId)
        }
      },

      addCustomWorkout: (workout) => {
        set((state) => ({
          customWorkouts: [workout, ...state.customWorkouts],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void upsertCustomWorkout(state.user.id, workout)
        }
      },

      updateCustomWorkout: (workoutId, updates) => {
        let syncedWorkout: Workout | null = null
        set((state) => ({
          customWorkouts: state.customWorkouts.map((workout) => {
            if (workout.id !== workoutId) return workout
            syncedWorkout = { ...workout, ...updates, updated_at: new Date().toISOString() }
            return syncedWorkout
          }),
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedWorkout) {
          void upsertCustomWorkout(state.user.id, syncedWorkout)
        }
      },

      removeCustomWorkout: (workoutId) => {
        set((state) => ({
          customWorkouts: state.customWorkouts.filter((workout) => workout.id !== workoutId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          void deleteCustomWorkoutCloud(state.user.id, workoutId)
        }
      },

      getDailyMeals: (date) => {
        const { mealEntries } = get()
        return mealEntries[date] || []
      },

      getDailyTotals: (date) => {
        const meals = get().getDailyMeals(date)
        return meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + meal.macros.calories,
            protein_g: acc.protein_g + meal.macros.protein_g,
            carbs_g: acc.carbs_g + meal.macros.carbs_g,
            fat_g: acc.fat_g + meal.macros.fat_g,
          }),
          { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        )
      },

      getWaterTotal: (date) => {
        return (get().waterLogs[date] || []).reduce((sum, e) => sum + e.amount_ml, 0)
      },

      getCalendarEvents: () => {
        const { workoutLogs, mealEntries, weightHistory, journalEntries, supplements, user } = get()
        const events: Array<{ date: string; type: string; title: string; color: string }> = []

        workoutLogs.forEach((log) => {
          events.push({ date: log.date, type: 'workout', title: log.workout.name || 'Workout', color: '#10b981' })
        })

        Object.entries(mealEntries).forEach(([date, meals]) => {
          if (meals.length > 0) {
            events.push({ date, type: 'meal', title: `${meals.length} meals logged`, color: '#3b82f6' })
          }
        })

        weightHistory.forEach((entry) => {
          events.push({
            date: entry.date,
            type: 'weight_check',
            title: formatWeightValue(entry.weight_kg, user?.unit_system || 'imperial'),
            color: '#f59e0b',
          })
        })

        journalEntries.forEach((entry) => {
          events.push({ date: entry.date, type: 'journal', title: entry.title || 'Journal Entry', color: '#8b5cf6' })
        })

        // Group supplements taken per date
        const supplementsByDate: Record<string, string[]> = {}
        supplements.forEach((supplement) => {
          supplement.taken_dates.forEach((date) => {
            if (!supplementsByDate[date]) supplementsByDate[date] = []
            supplementsByDate[date].push(supplement.name)
          })
        })
        Object.entries(supplementsByDate).forEach(([date, names]) => {
          events.push({ date, type: 'supplement', title: `${names.length} supplement${names.length > 1 ? 's' : ''} taken`, color: '#06b6d4' })
        })

        return events
      },
    }),
    {
      name: 'rivlo-store',
      version: 2, // bumped: PlannedSlot is now PlannedItem[] (array) instead of single item | null
      migrate: () => ({}), // clear stale state on version mismatch
      partialize: (state) => ({
        savedMeals: state.savedMeals,
        customWorkouts: state.customWorkouts,
        notifications: state.notifications,
        notificationPreferences: state.notificationPreferences,
        supplements: state.supplements,
        calendarReminders: state.calendarReminders,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isDemoMode: state.isDemoMode,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        weightHistory: state.weightHistory,
        journalEntries: state.journalEntries,
        workoutLogs: state.workoutLogs,
        mealEntries: state.mealEntries,
        waterLogs: state.waterLogs,
        waterUnit: state.waterUnit,
        weeklyMealPlan: state.weeklyMealPlan,
        groceryList: state.groceryList,
        streak: state.streak,
      }),
    }
  )
)
