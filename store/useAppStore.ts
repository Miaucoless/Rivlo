'use client'

import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  format,
  startOfWeek,
  subDays,
  subMinutes,
} from 'date-fns'
import type {
  SplitSchedule,
  UserProfile,
  WorkoutSplit,
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
  SocialPostComment,
  SocialFollowRelationship,
  SocialPost,
  SocialPostDraft,
  SocialPostStats,
} from '@/types'
import {
  DEMO_USER,
  RECIPES,
  WEIGHT_HISTORY,
  JOURNAL_ENTRIES,
  TODAY_MEALS,
  TODAY_TOTALS,
  WORKOUTS,
  type MealLogEntry,
} from '@/lib/content-library'
import { DEFAULT_SOCIAL_POSTS, createSocialPostFromDraft } from '@/lib/social-feed'
import {
  clearGroceryListCloud,
  deleteCustomWorkoutCloud,
  deleteCustomRecipeCloud,
  deleteJournalEntryCloud,
  deleteMealEntryCloud,
  deleteWorkoutLogCloud,
  deleteWeightEntryCloud,
  ALL_CLOUD_HYDRATION_SCOPES,
  type CloudHydrationProfile,
  type CloudHydrationScope,
  ensureUuid,
  fetchCloudState,
  getCloudHydrationScopesForPath,
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
import { updateProfile as updateProfileCloud } from '@/lib/auth'
import { toast } from 'sonner'
import { formatWeightValue, getTodayISO } from '@/lib/utils'
import { buildDefaultSchedule } from '@/lib/split-schedule'

interface AppStore {
  savedMeals: SavedMealTemplate[]
  customRecipes: Recipe[]
  customWorkouts: Workout[]
  notifications: Notification[]
  notificationPreferences: NotificationPreferences
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  deletedSavedMealIds: string[]
  deletedCustomWorkoutIds: string[]
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
  socialComposerPrefill: SocialPostDraft | null

  // Auth & Profile
  user: UserProfile | null
  isAuthenticated: boolean
  isDemoMode: boolean
  cloudHydratedUserId: string | null
  cloudHydratedScopes: CloudHydrationScope[]

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
  syncStatus: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt: string | null
  pendingCloudWrites: number

  // Actions
  setUser: (user: UserProfile | null) => void
  restoreUserDataBackup: (userId: string) => void
  hydrateFromCloud: (userId: string, scopes?: CloudHydrationScope[], profile?: CloudHydrationProfile) => Promise<void>
  syncNow: (options?: { force?: boolean; scopes?: CloudHydrationScope[]; profile?: CloudHydrationProfile }) => Promise<void>
  flushPendingCloudWrites: () => Promise<void>
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
  removeSavedMeal: (mealId: string) => Promise<boolean>
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
  toggleCalendarReminderComplete: (id: string) => void
  removeCalendarReminder: (id: string) => void

  // Workouts
  logWorkout: (log: WorkoutLog) => void
  updateWorkoutLog: (logId: string, updates: Partial<WorkoutLog>) => void
  removeWorkoutLog: (logId: string) => void
  addCustomWorkout: (workout: Workout) => void
  updateCustomWorkout: (workoutId: string, updates: Partial<Workout>) => void
  removeCustomWorkout: (workoutId: string) => Promise<boolean>
  createSocialPost: (draft: SocialPostDraft) => string
  removeSocialPost: (postId: string) => void
  requestToFollowUser: (target: { id: string; profile_visibility?: 'public' | 'private' }) => 'accepted' | 'pending' | 'noop'
  acceptFollowRequest: (followerId: string) => void
  declineFollowRequest: (followerId: string) => void
  cancelFollowRequest: (followingId: string) => void
  unfollowUser: (followingId: string) => void
  setSocialComposerPrefill: (draft: SocialPostDraft | null) => void
  toggleSaveSocialPost: (postId: string, sourcePost?: SocialPost) => void
  toggleLikeSocialPost: (postId: string, sourcePost?: SocialPost) => void
  addCommentToSocialPost: (postId: string, body: string) => void
  incrementSocialPostStats: (postId: string, updates: Partial<SocialPostStats>) => void

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

function calculateActivityStreak(state: Pick<AppStore, 'weightHistory' | 'journalEntries' | 'workoutLogs' | 'mealEntries' | 'supplements'>) {
  const activeDates = new Set<string>()

  state.workoutLogs.forEach((log) => {
    if (log.date) activeDates.add(log.date)
  })

  Object.entries(state.mealEntries).forEach(([date, meals]) => {
    if (meals.length > 0) activeDates.add(date)
  })

  state.journalEntries.forEach((entry) => {
    if (entry.date) activeDates.add(entry.date)
  })

  state.weightHistory.forEach((entry) => {
    if (entry.date) activeDates.add(entry.date)
  })

  state.supplements.forEach((supplement) => {
    supplement.taken_dates.forEach((date) => {
      if (date) activeDates.add(date)
    })
  })

  if (activeDates.size === 0) return 0

  const sortedDates = Array.from(activeDates).sort()
  const todayIso = getTodayISO()
  const yesterdayIso = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const latestDate = sortedDates[sortedDates.length - 1]

  if (latestDate !== todayIso && latestDate !== yesterdayIso) return 0

  let streak = 0
  let cursor = latestDate

  while (activeDates.has(cursor)) {
    streak += 1
    cursor = format(subDays(new Date(`${cursor}T12:00:00`), 1), 'yyyy-MM-dd')
  }

  return streak
}

function generateDemoSocialFollows(): SocialFollowRelationship[] {
  const now = new Date().toISOString()
  return [
    { followerId: DEMO_USER.id, followingId: 'creator-devon', status: 'accepted', createdAt: now },
    { followerId: DEMO_USER.id, followingId: 'creator-kira', status: 'accepted', createdAt: now },
    { followerId: 'creator-marina', followingId: DEMO_USER.id, status: 'accepted', createdAt: now },
    { followerId: 'creator-luca', followingId: DEMO_USER.id, status: 'accepted', createdAt: now },
  ]
}

function slugifyUsername(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'rivorauser'
}

const pendingCloudWriteQueue: Array<() => Promise<void>> = []
function getSplitPreferencesStorageKey(userId: string) {
  return `rivora-split-preferences:${userId}`
}

function readStoredSplitPreferences(userId: string): { workout_split?: WorkoutSplit; split_schedule?: SplitSchedule } | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getSplitPreferencesStorageKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as { workout_split?: WorkoutSplit; split_schedule?: SplitSchedule }
  } catch {
    return null
  }
}

function writeStoredSplitPreferences(userId: string, preferences: { workout_split?: WorkoutSplit; split_schedule?: SplitSchedule }) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getSplitPreferencesStorageKey(userId), JSON.stringify(preferences))
  } catch {
    // ignore
  }
}

function mergeUserWithStoredSplitPreferences(user: UserProfile | null): UserProfile | null {
  if (!user) return null

  const stored = readStoredSplitPreferences(user.id)
  if (!stored) {
    return {
      ...user,
      split_schedule: user.split_schedule ?? buildDefaultSchedule(user.workout_split),
    }
  }

  const workoutSplit = stored.workout_split ?? user.workout_split
  return {
    ...user,
    workout_split: workoutSplit,
    split_schedule: stored.split_schedule ?? user.split_schedule ?? buildDefaultSchedule(workoutSplit),
  }
}

let flushingPendingCloudWrites = false
let isHydratingFromCloud = false
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000

function isOfflineClient() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function flushCloudWriteQueue(set: any) {
  if (flushingPendingCloudWrites) return

  if (isOfflineClient()) {
    set({ syncStatus: 'offline', pendingCloudWrites: pendingCloudWriteQueue.length })
    return
  }

  if (pendingCloudWriteQueue.length === 0) {
    set({ syncStatus: 'idle', pendingCloudWrites: 0, lastSyncedAt: new Date().toISOString() })
    return
  }

  flushingPendingCloudWrites = true
  set({ syncStatus: 'syncing', pendingCloudWrites: pendingCloudWriteQueue.length })

  try {
    while (pendingCloudWriteQueue.length > 0) {
      const task = pendingCloudWriteQueue[0]
      await task()
      pendingCloudWriteQueue.shift()
      set({
        syncStatus: pendingCloudWriteQueue.length > 0 ? 'syncing' : 'idle',
        pendingCloudWrites: pendingCloudWriteQueue.length,
        lastSyncedAt: new Date().toISOString(),
      })
    }
  } catch {
    set({
      syncStatus: isOfflineClient() ? 'offline' : 'error',
      pendingCloudWrites: pendingCloudWriteQueue.length,
    })
  } finally {
    flushingPendingCloudWrites = false
  }
}

function enqueueCloudWrite(set: any, task: () => Promise<void>) {
  pendingCloudWriteQueue.push(task)
  set({
    syncStatus: isOfflineClient() ? 'offline' : 'syncing',
    pendingCloudWrites: pendingCloudWriteQueue.length,
  })
  void flushCloudWriteQueue(set)
}

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
  const workoutDays = [0, 1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31, 34, 36, 38, 41]
  workoutDays.forEach((daysAgo, i) => {
    const idx = i % 3
    const durationMin = 55 + Math.floor(Math.random() * 20)
    const completedAt = subDays(new Date(), daysAgo)
    completedAt.setHours(17 + (i % 3), 12 + ((i * 7) % 36), 0, 0)
    const startedAt = subMinutes(completedAt, durationMin)
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
      date: format(completedAt, 'yyyy-MM-dd'),
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_min: durationMin,
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

function generateDemoSavedMeals(): SavedMealTemplate[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'demo-saved-meal-yogurt-bowl',
      name: 'Alex Protein Yogurt Bowl',
      meal_type: 'breakfast',
      macros: { calories: 385, protein_g: 32, carbs_g: 45, fat_g: 6 },
      items: [
        { input: 'Greek yogurt', matched_name: 'Greek yogurt (0% fat)', amount: 200, unit: 'g', macros: { calories: 114, protein_g: 20, carbs_g: 8, fat_g: 1 } },
        { input: 'Mixed berries', matched_name: 'Mixed berries', amount: 100, unit: 'g', macros: { calories: 57, protein_g: 1, carbs_g: 14, fat_g: 0 } },
        { input: 'Granola', matched_name: 'Granola', amount: 30, unit: 'g', macros: { calories: 135, protein_g: 4, carbs_g: 21, fat_g: 6 } },
        { input: 'Honey', matched_name: 'Honey', amount: 15, unit: 'g', macros: { calories: 45, protein_g: 0, carbs_g: 12, fat_g: 0 } },
      ],
      updated_at: now,
    },
    {
      id: 'demo-saved-meal-chicken-bowl',
      name: 'Weekday Chicken Rice Bowl',
      meal_type: 'lunch',
      macros: { calories: 548, protein_g: 52, carbs_g: 48, fat_g: 12 },
      items: [
        { input: 'Chicken breast', matched_name: 'Chicken breast', amount: 6, unit: 'oz', macros: { calories: 280, protein_g: 52, carbs_g: 0, fat_g: 6 } },
        { input: 'Jasmine rice', matched_name: 'Jasmine rice (cooked)', amount: 1, unit: 'cup', macros: { calories: 205, protein_g: 4, carbs_g: 45, fat_g: 0 } },
        { input: 'Broccoli', matched_name: 'Broccoli', amount: 1, unit: 'cup', macros: { calories: 34, protein_g: 3, carbs_g: 7, fat_g: 0 } },
        { input: 'Tahini', matched_name: 'Tahini', amount: 1, unit: 'tbsp', macros: { calories: 89, protein_g: 3, carbs_g: 3, fat_g: 8 } },
      ],
      updated_at: now,
    },
    {
      id: 'demo-saved-meal-salmon-dinner',
      name: 'Salmon Dinner Plate',
      meal_type: 'dinner',
      macros: { calories: 612, protein_g: 48, carbs_g: 42, fat_g: 24 },
      items: [
        { input: 'Salmon fillet', matched_name: 'Salmon fillet', amount: 7, unit: 'oz', macros: { calories: 416, protein_g: 40, carbs_g: 0, fat_g: 26 } },
        { input: 'Sweet potato', matched_name: 'Sweet potato', amount: 1, unit: 'large', macros: { calories: 172, protein_g: 3, carbs_g: 40, fat_g: 0 } },
        { input: 'Asparagus', matched_name: 'Asparagus', amount: 1, unit: 'cup', macros: { calories: 20, protein_g: 2, carbs_g: 4, fat_g: 0 } },
      ],
      updated_at: now,
    },
    {
      id: 'demo-saved-meal-protein-wrap',
      name: 'Tuna Crunch Wrap',
      meal_type: 'lunch',
      macros: { calories: 470, protein_g: 41, carbs_g: 31, fat_g: 18 },
      items: [
        { input: 'Tuna', matched_name: 'Tuna in water', amount: 1, unit: 'can', macros: { calories: 120, protein_g: 26, carbs_g: 0, fat_g: 1 } },
        { input: 'Whole wheat wrap', matched_name: 'Whole wheat wrap', amount: 1, unit: 'wrap', macros: { calories: 210, protein_g: 8, carbs_g: 31, fat_g: 6 } },
        { input: 'Greek yogurt mayo mix', matched_name: 'Greek yogurt mayo mix', amount: 2, unit: 'tbsp', macros: { calories: 60, protein_g: 3, carbs_g: 2, fat_g: 4 } },
        { input: 'Celery', matched_name: 'Celery', amount: 0.5, unit: 'cup', macros: { calories: 10, protein_g: 0, carbs_g: 2, fat_g: 0 } },
      ],
      updated_at: now,
    },
  ]
}

function generateDemoSavedWorkouts(): Workout[] {
  const now = new Date().toISOString()
  return WORKOUTS.slice(0, 5).map((workout, index) => ({
    ...workout,
    id: `demo-${workout.id}`,
    name: index < 3 ? `${workout.name} Template` : workout.name,
    description: workout.description || 'Saved to demo mode so you can preview, edit, and reuse it.',
    source: 'custom',
    updated_at: now,
  }))
}

function generateDemoWaterLogs(): Record<string, WaterEntry[]> {
  const entries: Record<string, WaterEntry[]> = {}
  const dayConfigs = [
    [500, 750, 600],
    [400, 600, 350],
    [750, 500, 500, 250],
    [600, 450],
    [500, 500, 500],
  ]

  dayConfigs.forEach((amounts, index) => {
    const date = format(subDays(new Date(), index), 'yyyy-MM-dd')
    entries[date] = amounts.map((amountMl, amountIndex) => ({
      id: `demo-water-${index}-${amountIndex}`,
      user_id: DEMO_USER.id,
      date,
      amount_ml: amountMl,
      logged_at: new Date(`${date}T${String(8 + amountIndex * 3).padStart(2, '0')}:15:00`).toISOString(),
    }))
  })

  return entries
}

function generateDemoWeeklyMealPlan(savedMeals: SavedMealTemplate[]): WeeklyMealPlan {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const byId = Object.fromEntries(savedMeals.map((meal) => [meal.id, meal]))
  const recipeBreakfast = RECIPES.find((recipe) => recipe.id === 'r1') ?? RECIPES[0]
  const recipeLunch = RECIPES.find((recipe) => recipe.id === 'r2') ?? RECIPES[1]
  const recipeDinner = RECIPES.find((recipe) => recipe.id === 'r3') ?? RECIPES[2]

  return {
    id: 'wmp_demo',
    user_id: DEMO_USER.id,
    week_start: weekStart,
    days: {
      monday: {
        breakfast: [{ type: 'saved', savedMeal: byId['demo-saved-meal-yogurt-bowl'] }],
        lunch: [{ type: 'recipe', recipe: recipeLunch }],
        dinner: [{ type: 'saved', savedMeal: byId['demo-saved-meal-salmon-dinner'] }],
        snack: [],
      },
      tuesday: {
        breakfast: [{ type: 'recipe', recipe: recipeBreakfast }],
        lunch: [{ type: 'saved', savedMeal: byId['demo-saved-meal-chicken-bowl'] }],
        dinner: [{ type: 'recipe', recipe: recipeDinner }],
        snack: [],
      },
      wednesday: {
        breakfast: [{ type: 'saved', savedMeal: byId['demo-saved-meal-yogurt-bowl'] }],
        lunch: [{ type: 'saved', savedMeal: byId['demo-saved-meal-protein-wrap'] }],
        dinner: [{ type: 'saved', savedMeal: byId['demo-saved-meal-salmon-dinner'] }],
        snack: [],
      },
      thursday: {
        breakfast: [{ type: 'recipe', recipe: recipeBreakfast }],
        lunch: [{ type: 'recipe', recipe: recipeLunch }],
        dinner: [{ type: 'saved', savedMeal: byId['demo-saved-meal-salmon-dinner'] }],
        snack: [],
      },
      friday: {
        breakfast: [{ type: 'saved', savedMeal: byId['demo-saved-meal-yogurt-bowl'] }],
        lunch: [{ type: 'saved', savedMeal: byId['demo-saved-meal-chicken-bowl'] }],
        dinner: [{ type: 'recipe', recipe: recipeDinner }],
        snack: [],
      },
      saturday: { breakfast: [], lunch: [], dinner: [], snack: [] },
      sunday: { breakfast: [], lunch: [], dinner: [], snack: [] },
    },
  }
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
  const nextStreak = calculateActivityStreak(nextState)
  nextState.streak = nextStreak

  return {
    ...updates,
    streak: nextStreak,
    notifications: buildNotifications(nextState),
  }
}

function buildSocialMetadataState(state: Pick<AppStore, 'socialPosts' | 'socialFollows' | 'socialSavedPostIds' | 'socialLikedPostIds' | 'socialPostComments'>) {
  return {
    socialPosts: state.socialPosts,
    socialFollows: state.socialFollows,
    socialSavedPostIds: state.socialSavedPostIds,
    socialLikedPostIds: state.socialLikedPostIds,
    socialPostComments: state.socialPostComments,
  }
}

type SocialMetadataState = ReturnType<typeof buildSocialMetadataState>

const EMPTY_SOCIAL_METADATA_STATE: SocialMetadataState = {
  socialPosts: [],
  socialFollows: [],
  socialSavedPostIds: [],
  socialLikedPostIds: [],
  socialPostComments: {},
}

function socialBackupStorageKey(userId: string) {
  return `rivora-social-backup:${userId}`
}

function readSocialMetadataBackup(userId: string): SocialMetadataState {
  if (typeof window === 'undefined') return EMPTY_SOCIAL_METADATA_STATE

  try {
    const raw = window.localStorage.getItem(socialBackupStorageKey(userId))
    if (!raw) return EMPTY_SOCIAL_METADATA_STATE
    const parsed = JSON.parse(raw) as Partial<SocialMetadataState> | null
    if (!parsed || typeof parsed !== 'object') return EMPTY_SOCIAL_METADATA_STATE
    return {
      socialPosts: Array.isArray(parsed.socialPosts) ? parsed.socialPosts : [],
      socialFollows: Array.isArray(parsed.socialFollows) ? parsed.socialFollows : [],
      socialSavedPostIds: Array.isArray(parsed.socialSavedPostIds) ? parsed.socialSavedPostIds : [],
      socialLikedPostIds: Array.isArray(parsed.socialLikedPostIds) ? parsed.socialLikedPostIds : [],
      socialPostComments:
        parsed.socialPostComments && typeof parsed.socialPostComments === 'object'
          ? (parsed.socialPostComments as Record<string, SocialPostComment[]>)
          : {},
    }
  } catch {
    return EMPTY_SOCIAL_METADATA_STATE
  }
}

function writeSocialMetadataBackup(userId: string, state: SocialMetadataState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(socialBackupStorageKey(userId), JSON.stringify(state))
  } catch {
    // Best-effort fallback only; normal persisted Zustand state still exists.
  }
}

function mergeSocialPosts(primary: SocialPost[], fallback: SocialPost[]) {
  const seen = new Set<string>()
  const merged: SocialPost[] = []

  for (const post of [...primary, ...fallback]) {
    if (!post?.id || seen.has(post.id)) continue
    seen.add(post.id)
    merged.push(post)
  }

  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function mergeSocialFollows(primary: SocialFollowRelationship[], fallback: SocialFollowRelationship[]) {
  const seen = new Set<string>()
  const merged: SocialFollowRelationship[] = []

  for (const relationship of [...primary, ...fallback]) {
    const key = `${relationship.followerId}:${relationship.followingId}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(relationship)
  }

  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function mergeSocialIds(primary: string[], fallback: string[]) {
  return Array.from(new Set([...primary, ...fallback]))
}

function mergeSocialComments(
  primary: Record<string, SocialPostComment[]>,
  fallback: Record<string, SocialPostComment[]>
) {
  const merged: Record<string, SocialPostComment[]> = {}

  for (const postId of new Set([...Object.keys(fallback), ...Object.keys(primary)])) {
    const seen = new Set<string>()
    const comments: SocialPostComment[] = []

    for (const comment of [...(primary[postId] ?? []), ...(fallback[postId] ?? [])]) {
      if (!comment?.id || seen.has(comment.id)) continue
      seen.add(comment.id)
      comments.push(comment)
    }

    if (comments.length > 0) {
      merged[postId] = comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
  }

  return merged
}

function mergeSocialMetadataState(primary: SocialMetadataState, fallback: SocialMetadataState): SocialMetadataState {
  return {
    socialPosts: mergeSocialPosts(primary.socialPosts, fallback.socialPosts),
    socialFollows: mergeSocialFollows(primary.socialFollows, fallback.socialFollows),
    socialSavedPostIds: mergeSocialIds(primary.socialSavedPostIds, fallback.socialSavedPostIds),
    socialLikedPostIds: mergeSocialIds(primary.socialLikedPostIds, fallback.socialLikedPostIds),
    socialPostComments: mergeSocialComments(primary.socialPostComments, fallback.socialPostComments),
  }
}

function queueSocialMetadataSync(set: any, get: () => AppStore) {
  const { user, isDemoMode } = get()
  if (!user || isDemoMode) return

  writeSocialMetadataBackup(user.id, buildSocialMetadataState(get()))

  enqueueCloudWrite(set, async () => {
    const state = get()
    const nextSocialState = buildSocialMetadataState(state)
    writeSocialMetadataBackup(user.id, nextSocialState)
    await saveMetadataCloudState(user.id, nextSocialState)
  })
}

function upsertSocialPostOverride(
  posts: SocialPost[],
  postId: string,
  updater: (post: SocialPost) => SocialPost,
  sourcePost?: SocialPost
) {
  const existing = posts.find((post) => post.id === postId)
  if (existing) {
    return posts.map((post) => (post.id === postId ? updater(post) : post))
  }

  const fallbackPost = sourcePost ?? DEFAULT_SOCIAL_POSTS.find((post) => post.id === postId)
  if (!fallbackPost) return posts
  return [updater(fallbackPost), ...posts]
}

function isQuotaExceededError(error: unknown) {
  if (typeof DOMException === 'undefined' || !(error instanceof DOMException)) return false
  return error.name === 'QuotaExceededError' || error.code === 22
}

const safePersistStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      if (isQuotaExceededError(error)) {
        console.warn('Skipping persisted Rivora cache update because browser storage is full.')
        return
      }

      throw error
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

type UserDataBackup = Pick<
  AppStore,
  | 'savedMeals'
  | 'customRecipes'
  | 'customWorkouts'
  | 'notifications'
  | 'notificationPreferences'
  | 'supplements'
  | 'calendarReminders'
  | 'deletedSavedMealIds'
  | 'deletedCustomWorkoutIds'
  | 'socialPosts'
  | 'socialFollows'
  | 'socialSavedPostIds'
  | 'socialLikedPostIds'
  | 'socialPostComments'
  | 'socialComposerPrefill'
  | 'weightHistory'
  | 'journalEntries'
  | 'workoutLogs'
  | 'mealEntries'
  | 'waterLogs'
  | 'waterUnit'
  | 'weeklyMealPlan'
  | 'groceryList'
  | 'streak'
  | 'lastSyncedAt'
  | 'cloudHydratedUserId'
  | 'cloudHydratedScopes'
>

function userDataBackupKey(userId: string) {
  return `rivora-user-backup:${userId}`
}

function buildUserDataBackup(state: AppStore): UserDataBackup {
  return {
    savedMeals: state.savedMeals,
    customRecipes: state.customRecipes,
    customWorkouts: state.customWorkouts,
    notifications: state.notifications,
    notificationPreferences: state.notificationPreferences,
    supplements: state.supplements,
    calendarReminders: state.calendarReminders,
    deletedSavedMealIds: state.deletedSavedMealIds,
    deletedCustomWorkoutIds: state.deletedCustomWorkoutIds,
    socialPosts: state.socialPosts,
    socialFollows: state.socialFollows,
    socialSavedPostIds: state.socialSavedPostIds,
    socialLikedPostIds: state.socialLikedPostIds,
    socialPostComments: state.socialPostComments,
    socialComposerPrefill: state.socialComposerPrefill,
    weightHistory: state.weightHistory,
    journalEntries: state.journalEntries,
    workoutLogs: state.workoutLogs,
    mealEntries: state.mealEntries,
    waterLogs: state.waterLogs,
    waterUnit: state.waterUnit,
    weeklyMealPlan: state.weeklyMealPlan,
    groceryList: state.groceryList,
    streak: state.streak,
    lastSyncedAt: state.lastSyncedAt,
    cloudHydratedUserId: state.cloudHydratedUserId,
    cloudHydratedScopes: state.cloudHydratedScopes,
  }
}

function readUserDataBackup(userId: string): Partial<UserDataBackup> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(userDataBackupKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Partial<UserDataBackup> : null
  } catch {
    return null
  }
}

function mergeHydratedScopes(
  current: CloudHydrationScope[],
  incoming: CloudHydrationScope[]
) {
  return Array.from(new Set([...current, ...incoming]))
}

function writeUserDataBackup(userId: string, state: AppStore) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(userDataBackupKey(userId), JSON.stringify(buildUserDataBackup(state)))
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('Skipping user backup update because browser storage is full.')
    }
  }
}

function hasHydratedUserData(state: Pick<
  AppStore,
  | 'savedMeals'
  | 'customRecipes'
  | 'customWorkouts'
  | 'supplements'
  | 'calendarReminders'
  | 'socialPosts'
  | 'socialFollows'
  | 'socialSavedPostIds'
  | 'socialLikedPostIds'
  | 'socialPostComments'
  | 'weightHistory'
  | 'journalEntries'
  | 'workoutLogs'
  | 'mealEntries'
  | 'waterLogs'
  | 'weeklyMealPlan'
  | 'groceryList'
>) {
  return (
    state.savedMeals.length > 0 ||
    state.customRecipes.length > 0 ||
    state.customWorkouts.length > 0 ||
    state.supplements.length > 0 ||
    state.calendarReminders.length > 0 ||
    state.socialPosts.length > 0 ||
    state.socialFollows.length > 0 ||
    state.socialSavedPostIds.length > 0 ||
    state.socialLikedPostIds.length > 0 ||
    Object.keys(state.socialPostComments).length > 0 ||
    state.weightHistory.length > 0 ||
    state.journalEntries.length > 0 ||
    state.workoutLogs.length > 0 ||
    Object.keys(state.mealEntries).length > 0 ||
    Object.keys(state.waterLogs).length > 0 ||
    !!state.weeklyMealPlan ||
    !!state.groceryList
  )
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
      deletedSavedMealIds: [],
      deletedCustomWorkoutIds: [],
      socialPosts: [],
      socialFollows: [],
      socialSavedPostIds: [],
      socialLikedPostIds: [],
      socialPostComments: {},
      socialComposerPrefill: null,
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
      waterUnit: 'oz',
      weeklyMealPlan: null,
      groceryList: null,
      streak: 0,

      setUser: (user) => {
        const mergedUser = mergeUserWithStoredSplitPreferences(user)

        set((state) => {
          const isUserSwitch = !!mergedUser && state.user?.id !== mergedUser.id

          if (isUserSwitch) {
            if (state.user?.id && !state.isDemoMode) {
              writeUserDataBackup(state.user.id, state)
            }

            const restoredBackup = mergedUser ? readUserDataBackup(mergedUser.id) : null

            return withRefreshedNotifications(state, {
              savedMeals: [],
              customRecipes: [],
              customWorkouts: [],
              notifications: [],
              supplements: [],
              calendarReminders: [],
              deletedSavedMealIds: [],
              deletedCustomWorkoutIds: [],
              socialPosts: [],
              socialFollows: [],
              socialSavedPostIds: [],
              socialLikedPostIds: [],
              socialPostComments: {},
              socialComposerPrefill: null,
              weightHistory: [],
              journalEntries: [],
              workoutLogs: [],
              mealEntries: {},
      waterLogs: {},
      weeklyMealPlan: null,
      groceryList: null,
      streak: 0,
      syncStatus: 'idle',
      lastSyncedAt: null,
      pendingCloudWrites: 0,
      cloudHydratedScopes: [],
              cloudHydratedUserId: null,
              cloudHydratedScopes: [],
              ...restoredBackup,
              cloudHydratedUserId: restoredBackup?.cloudHydratedUserId ?? mergedUser?.id ?? null,
              cloudHydratedScopes: restoredBackup?.cloudHydratedScopes ?? [],
              user: mergedUser,
              isAuthenticated: !!mergedUser,
              isDemoMode: false,
              notificationPreferences: mergedUser?.notification_preferences ?? restoredBackup?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
            })
          }

          return withRefreshedNotifications(state, {
            user: mergedUser,
            isAuthenticated: !!mergedUser,
            isDemoMode: false,
            notificationPreferences: mergedUser?.notification_preferences ?? state.notificationPreferences,
          })
        })

        if (mergedUser) {
          void get().hydrateFromCloud(mergedUser.id, ['metadata'])
        }
      },

      restoreUserDataBackup: (userId) => {
        if (!userId) return

        const restoredBackup = readUserDataBackup(userId)
        if (!restoredBackup) return

        set((state) => {
          if (state.user?.id !== userId || hasHydratedUserData(state)) {
            return state
          }

          return withRefreshedNotifications(state, {
            ...restoredBackup,
            notificationPreferences: restoredBackup.notificationPreferences ?? state.notificationPreferences,
            cloudHydratedUserId: restoredBackup.cloudHydratedUserId ?? state.cloudHydratedUserId,
            cloudHydratedScopes: restoredBackup.cloudHydratedScopes ?? state.cloudHydratedScopes,
          })
        })
      },

      hydrateFromCloud: async (userId, scopes, profile = 'default') => {
        console.log('🌥 Starting cloud hydration for user:', userId)
        if (!userId || get().isDemoMode) {
          console.log('❌ Skipping hydration - no userId or demo mode')
          return
        }

        if (isHydratingFromCloud) {
          console.log('⏭ Skipping hydration - already in progress')
          return
        }
        isHydratingFromCloud = true

        try {

        set((state) => ({
          syncStatus: isOfflineClient() ? 'offline' : 'syncing',
          pendingCloudWrites: state.pendingCloudWrites,
        }))

        const requestedScopes = scopes && scopes.length > 0 ? scopes : getCloudHydrationScopesForPath('/dashboard')
        const requestedScopeSet = new Set(requestedScopes)
        const hasScope = (scope: CloudHydrationScope) => requestedScopeSet.has(scope)

        const cloud = await fetchCloudState(userId, requestedScopes, profile)
        console.log('☁️ Cloud data received:', cloud ? 'SUCCESS' : 'NULL')
        if (!cloud) {
          set((state) => ({
            syncStatus: isOfflineClient() ? 'offline' : 'error',
            pendingCloudWrites: state.pendingCloudWrites,
          }))
          return
        }

        const localState = get()
        const localSocialState = mergeSocialMetadataState(
          buildSocialMetadataState(localState),
          readSocialMetadataBackup(userId)
        )
        const mergedSocialCloudState = mergeSocialMetadataState(localSocialState, {
          socialPosts: cloud.socialPosts,
          socialFollows: cloud.socialFollows,
          socialSavedPostIds: cloud.socialSavedPostIds,
          socialLikedPostIds: cloud.socialLikedPostIds,
          socialPostComments: cloud.socialPostComments,
        })
        console.log('📱 Local state before hydration:', {
          meals: Object.keys(localState.mealEntries).length,
          workouts: localState.workoutLogs.length,
          weights: localState.weightHistory.length,
          journals: localState.journalEntries.length,
        })

        // Collect IDs already in cloud for each data type so we can find
        // local-only items (e.g. writes that failed silently last session).
        const localOnlyMealEntries: Record<string, MealLogEntry[]> = {}
        if (hasScope('meals')) {
          const cloudMealIds = new Set(
            Object.values(cloud.mealEntries).flatMap((meals) => meals.map((m) => m.id))
          )
          Object.entries(localState.mealEntries).forEach(([date, meals]) => {
            const missing = meals.filter((m) => !cloudMealIds.has(m.id))
            if (missing.length > 0) localOnlyMealEntries[date] = missing
          })
        }

        const localOnlyWorkouts = hasScope('workouts')
          ? localState.workoutLogs.filter((l) => !new Set(cloud.workoutLogs.map((item) => item.id)).has(l.id))
          : []

        const localOnlyWeights = hasScope('tracking')
          ? localState.weightHistory.filter((e) => !new Set(cloud.weightHistory.map((item) => item.id)).has(e.id))
          : []

        const localOnlyJournals = hasScope('journal')
          ? localState.journalEntries.filter((e) => !new Set(cloud.journalEntries.map((item) => item.id)).has(e.id))
          : []

        const localOnlyWaterLogs: Record<string, WaterEntry[]> = {}
        if (hasScope('water')) {
          const cloudWaterIds = new Set(
            Object.values(cloud.waterLogs).flatMap((entries) => entries.map((e) => e.id))
          )
          Object.entries(localState.waterLogs).forEach(([date, entries]) => {
            const missing = entries.filter((e) => !cloudWaterIds.has(e.id))
            if (missing.length > 0) localOnlyWaterLogs[date] = missing
          })
        }

        const localOnlyRecipes = hasScope('recipes')
          ? localState.customRecipes.filter((r) => !new Set(cloud.customRecipes.map((item) => item.id)).has(r.id))
          : []

        const localOnlyWorkoutTemplates =
          hasScope('templates') && localState.cloudHydratedUserId === userId
            ? localState.customWorkouts.filter((w) => !new Set(cloud.customWorkouts.map((item) => item.id)).has(w.id) && !localState.deletedCustomWorkoutIds.includes(w.id))
            : []

        // Seed payload: always upload local data that doesn't exist in cloud yet
        const seedPayload = {
          mealEntries: Object.keys(localOnlyMealEntries).length > 0 ? localOnlyMealEntries : {},
          workoutLogs: localOnlyWorkouts,
          weightHistory: localOnlyWeights,
          journalEntries: localOnlyJournals,
          // Defensive fallback: if cloud metadata is empty, preserve local data
          // This handles cases where user_app_state table doesn't exist yet
          savedMeals: hasScope('metadata') && cloud.savedMeals.length === 0 ? localState.savedMeals : cloud.savedMeals,
          supplements: hasScope('metadata') && cloud.supplements.length === 0 ? localState.supplements : cloud.supplements,
          calendarReminders: hasScope('metadata') && cloud.calendarReminders.length === 0 ? localState.calendarReminders : cloud.calendarReminders,
          weeklyMealPlan: hasScope('planner') && !cloud.weeklyMealPlan ? localState.weeklyMealPlan : null,
          groceryList: hasScope('planner') && !cloud.groceryList ? localState.groceryList : null,
          customRecipes: localOnlyRecipes,
          customWorkouts: localOnlyWorkoutTemplates,
          waterLogs: Object.keys(localOnlyWaterLogs).length > 0 ? localOnlyWaterLogs : {},
          socialPosts: hasScope('metadata') ? mergedSocialCloudState.socialPosts : [],
          socialFollows: hasScope('metadata') ? mergedSocialCloudState.socialFollows : [],
          socialSavedPostIds: hasScope('metadata') ? mergedSocialCloudState.socialSavedPostIds : [],
          socialLikedPostIds: hasScope('metadata') ? mergedSocialCloudState.socialLikedPostIds : [],
          socialPostComments: hasScope('metadata') ? mergedSocialCloudState.socialPostComments : {},
        }

        console.log('🌱 Seed payload prepared:', {
          meals: Object.keys(seedPayload.mealEntries).length,
          workouts: seedPayload.workoutLogs.length,
          weights: seedPayload.weightHistory.length,
          journals: seedPayload.journalEntries.length,
          localOnlyMeals: Object.keys(localOnlyMealEntries).length,
          localOnlyWorkouts: localOnlyWorkouts.length,
        })

        const shouldSeedAnyBucket =
          Object.keys(seedPayload.mealEntries).length > 0 ||
          seedPayload.workoutLogs.length > 0 ||
          seedPayload.weightHistory.length > 0 ||
          seedPayload.journalEntries.length > 0 ||
          (hasScope('metadata') && (
            seedPayload.savedMeals.length > 0 ||
            seedPayload.supplements.length > 0 ||
            seedPayload.calendarReminders.length > 0 ||
            seedPayload.socialPosts.length > 0 ||
            seedPayload.socialFollows.length > 0 ||
            seedPayload.socialSavedPostIds.length > 0 ||
            seedPayload.socialLikedPostIds.length > 0 ||
            Object.keys(seedPayload.socialPostComments).length > 0
          )) ||
          (hasScope('planner') && (!!seedPayload.weeklyMealPlan || !!seedPayload.groceryList)) ||
          (hasScope('recipes') && seedPayload.customRecipes.length > 0) ||
          (hasScope('templates') && seedPayload.customWorkouts.length > 0) ||
          (hasScope('water') && Object.keys(seedPayload.waterLogs).length > 0)

        let finalCloud = cloud

        if (shouldSeedAnyBucket) {
          await seedCloudFromLocal(userId, seedPayload)
          const refreshedCloud = await fetchCloudState(userId)
          if (refreshedCloud) finalCloud = refreshedCloud
        }

        const finalSocialState = hasScope('metadata')
          ? mergeSocialMetadataState(
              {
                socialPosts: finalCloud.socialPosts,
                socialFollows: finalCloud.socialFollows,
                socialSavedPostIds: finalCloud.socialSavedPostIds,
                socialLikedPostIds: finalCloud.socialLikedPostIds,
                socialPostComments: finalCloud.socialPostComments,
              },
              localSocialState
            )
          : localSocialState

        if (hasScope('metadata')) {
          // Merge with current in-store state so the backup also captures any posts
          // created by the user during the async sections of hydration.
          const currentForBackup = buildSocialMetadataState(get())
          writeSocialMetadataBackup(userId, mergeSocialMetadataState(finalSocialState, currentForBackup))
        }

        set((state) => {
          const savedMeals = finalCloud.savedMeals.filter((meal) => !state.deletedSavedMealIds.includes(meal.id))
          const customWorkouts = finalCloud.customWorkouts.filter((workout) => !state.deletedCustomWorkoutIds.includes(workout.id))
          const updates: Partial<AppStore> = {
            cloudHydratedUserId: userId,
            cloudHydratedScopes: mergeHydratedScopes(state.cloudHydratedScopes, requestedScopes),
          }
          if (hasScope('meals')) updates.mealEntries = finalCloud.mealEntries
          if (hasScope('workouts')) updates.workoutLogs = finalCloud.workoutLogs
          if (hasScope('tracking')) updates.weightHistory = finalCloud.weightHistory
          if (hasScope('journal')) updates.journalEntries = finalCloud.journalEntries
          if (hasScope('metadata')) {
            updates.savedMeals = savedMeals
            updates.supplements = finalCloud.supplements
            updates.calendarReminders = finalCloud.calendarReminders
            // Merge with current in-store social data to preserve any posts/likes/comments
            // created by the user during the async hydration window.
            updates.socialPosts = mergeSocialPosts(finalSocialState.socialPosts, state.socialPosts)
            updates.socialFollows = mergeSocialFollows(finalSocialState.socialFollows, state.socialFollows)
            updates.socialSavedPostIds = mergeSocialIds(finalSocialState.socialSavedPostIds, state.socialSavedPostIds)
            updates.socialLikedPostIds = mergeSocialIds(finalSocialState.socialLikedPostIds, state.socialLikedPostIds)
            updates.socialPostComments = mergeSocialComments(finalSocialState.socialPostComments, state.socialPostComments)
          }
          if (hasScope('planner')) {
            updates.weeklyMealPlan = finalCloud.weeklyMealPlan
            updates.groceryList = finalCloud.groceryList
          }
          if (hasScope('recipes')) updates.customRecipes = finalCloud.customRecipes
          if (hasScope('templates')) updates.customWorkouts = customWorkouts
          if (hasScope('water')) updates.waterLogs = finalCloud.waterLogs
          const refreshed = withRefreshedNotifications(state, updates)
          const computed = refreshed.notifications as import('@/types').Notification[]
          const dbNotes = hasScope('notifications')
            ? (finalCloud.dbNotifications ?? []) as import('@/types').Notification[]
            : []
          const existingIds = new Set(computed.map((n) => n.id))
          const merged = [...dbNotes.filter((n) => !existingIds.has(n.id)), ...computed]
          return {
            ...refreshed,
            notifications: merged,
            syncStatus: state.pendingCloudWrites > 0 ? 'syncing' : 'idle',
            lastSyncedAt: new Date().toISOString(),
          }
        })

        const latestState = get()
        if (!latestState.isDemoMode && latestState.user?.id === userId) {
          writeUserDataBackup(userId, latestState)
        }

        } catch (err) {
          console.error('Cloud hydration failed:', err)
          set({ syncStatus: 'error' })
        } finally {
          isHydratingFromCloud = false
        }
      },

      syncNow: async (options) => {
        const state = get()
        if (!state.user || state.isDemoMode) return
        const force = options?.force ?? false
        const requestedScopes = options?.scopes ?? ALL_CLOUD_HYDRATION_SCOPES
        const profile = options?.profile ?? 'default'

        await flushCloudWriteQueue(set)
        const afterFlush = get()
        if (
          !force &&
          afterFlush.pendingCloudWrites === 0 &&
          afterFlush.cloudHydratedUserId === afterFlush.user?.id &&
          requestedScopes.every((scope) => afterFlush.cloudHydratedScopes.includes(scope)) &&
          afterFlush.lastSyncedAt
        ) {
          const lastSyncedAt = Date.parse(afterFlush.lastSyncedAt)
          if (!Number.isNaN(lastSyncedAt) && Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) {
            return
          }
        }

        await afterFlush.hydrateFromCloud(afterFlush.user.id, requestedScopes, profile)
      },

      flushPendingCloudWrites: async () => {
        await flushCloudWriteQueue(set)
      },

      updateProfile: (updates) => {
        // Optimistic local update (instant UI response)
        set((state) => {
          const nextUser = state.user ? { ...state.user, ...updates } : null

          // If profile visuals changed, patch them on all posts authored by this user
          const nextSocialPosts =
            (updates.avatar_url != null || updates.banner_url != null) && state.user
              ? state.socialPosts.map((post) =>
                  post.user.id === state.user!.id
                    ? {
                        ...post,
                        user: {
                          ...post.user,
                          avatar_url: updates.avatar_url ?? post.user.avatar_url,
                          banner_url: updates.banner_url ?? post.user.banner_url,
                        },
                      }
                    : post
                )
              : state.socialPosts

          return withRefreshedNotifications(state, {
            user: nextUser,
            socialPosts: nextSocialPosts,
          })
        })

        const state = get()
        if (!state.user || state.isDemoMode) return

        // Local fallback (per-origin) so goal doesn't "feel" lost if cloud update fails.
        if (typeof window !== 'undefined' && updates.water_goal_ml != null) {
          try {
            window.localStorage.setItem(`rivora-water-goal-ml:${state.user.id}`, String(updates.water_goal_ml))
          } catch {
            // ignore
          }
        }

        if (updates.workout_split != null || updates.split_schedule != null) {
          writeStoredSplitPreferences(state.user.id, {
            workout_split: (updates.workout_split ?? state.user.workout_split) as WorkoutSplit,
            split_schedule: (updates.split_schedule ?? state.user.split_schedule ?? buildDefaultSchedule(updates.workout_split ?? state.user.workout_split)) as SplitSchedule,
          })
        }

        enqueueCloudWrite(set, async () => {
          const resp = await updateProfileCloud(state.user!.id, updates)
          if (!resp.success || !resp.user) {
            const err = String(resp.error || '')
            const missingWaterGoalColumn =
              updates.water_goal_ml != null &&
              (err.includes('water_goal_ml') || err.includes('schema cache'))
            const missingSplitScheduleColumn =
              updates.split_schedule != null &&
              (err.includes('split_schedule') || err.includes('schema cache'))

            if (missingWaterGoalColumn) return
            if (missingSplitScheduleColumn) return

            if (resp.error) toast.error(resp.error)
            throw new Error(resp.error || 'Profile sync failed.')
          }

          set((s) => withRefreshedNotifications(s, { user: mergeUserWithStoredSplitPreferences(resp.user ?? null) }))
        })
      },

      loginDemo: () =>
        set((state) => {
          const demoSavedMeals = generateDemoSavedMeals()
          const demoSavedWorkouts = generateDemoSavedWorkouts()

          return withRefreshedNotifications(state, {
          user: {
            ...DEMO_USER,
            split_schedule: DEMO_USER.split_schedule ?? buildDefaultSchedule(DEMO_USER.workout_split),
          },
          isAuthenticated: true,
          isDemoMode: true,
          cloudHydratedUserId: null,
          cloudHydratedScopes: [],
          savedMeals: demoSavedMeals,
          customRecipes: [],
          customWorkouts: demoSavedWorkouts,
          socialPosts: DEFAULT_SOCIAL_POSTS,
          socialFollows: generateDemoSocialFollows(),
          socialSavedPostIds: [],
          socialLikedPostIds: [],
          socialPostComments: {},
          socialComposerPrefill: null,
          weightHistory: WEIGHT_HISTORY,
          journalEntries: JOURNAL_ENTRIES,
          workoutLogs: generateWorkoutLogs(),
          mealEntries: generateMealHistory(),
          waterLogs: generateDemoWaterLogs(),
          weeklyMealPlan: generateDemoWeeklyMealPlan(demoSavedMeals),
          groceryList: null,
          streak: 12,
          syncStatus: 'idle',
          lastSyncedAt: null,
          pendingCloudWrites: 0,
          supplements: generateDemoSupplements(),
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        })
      }),

      logout: () => {
        const currentState = get()
        if (currentState.user?.id && !currentState.isDemoMode) {
          writeUserDataBackup(currentState.user.id, currentState)
        }
        pendingCloudWriteQueue.length = 0
        set({
          savedMeals: [],
          customRecipes: [],
          customWorkouts: [],
          notifications: [],
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          supplements: [],
          calendarReminders: [],
          socialPosts: [],
          socialFollows: [],
          socialSavedPostIds: [],
          socialLikedPostIds: [],
          socialPostComments: {},
          socialComposerPrefill: null,
          user: null,
          isAuthenticated: false,
          isDemoMode: false,
          cloudHydratedUserId: null,
          cloudHydratedScopes: [],
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
          syncStatus: 'idle',
          lastSyncedAt: null,
          pendingCloudWrites: 0,
        })
      },

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
          enqueueCloudWrite(set, async () => {
            await upsertWeightEntry(state.user.id, normalizedEntry)
          })
        }
      },

      removeWeightEntry: (id) => {
        set((state) => withRefreshedNotifications(state, {
          weightHistory: state.weightHistory.filter((weight) => weight.id !== id),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await deleteWeightEntryCloud(state.user.id, id)
          })
        }
      },

      addJournalEntry: (entry) => {
        const normalizedEntry = { ...entry, id: ensureUuid(entry.id) }
        set((state) => withRefreshedNotifications(state, {
          journalEntries: [normalizedEntry, ...state.journalEntries],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await upsertJournalEntry(state.user.id, normalizedEntry)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertJournalEntry(state.user.id, syncedEntry)
          })
        }
      },

      deleteJournalEntry: (id) => {
        set((state) => withRefreshedNotifications(state, {
          journalEntries: state.journalEntries.filter((entry) => entry.id !== id),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await deleteJournalEntryCloud(state.user.id, id)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertMealEntry(state.user.id, date, normalizedMeal)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertMealEntry(state.user.id, date, syncedMeal)
          })
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
          enqueueCloudWrite(set, async () => {
            await deleteMealEntryCloud(state.user.id, mealId)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertWaterLog(state.user.id, normalized)
          })
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
          enqueueCloudWrite(set, async () => {
            await deleteWaterLog(state.user.id, entryId)
          })
        }
      },

      addSavedMeal: (meal) => {
        set((state) => ({
          savedMeals: [meal, ...state.savedMeals],
          deletedSavedMealIds: state.deletedSavedMealIds.filter((id) => id !== meal.id),
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
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
          deletedSavedMealIds: state.deletedSavedMealIds.filter((id) => id !== mealId),
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      removeSavedMeal: async (mealId) => {
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

        const previousSavedMeals = stateSnap.savedMeals
        const previousMealEntries = stateSnap.mealEntries
        const nextSavedMeals = previousSavedMeals.filter((meal) => meal.id !== mealId)
        const nextMealEntries = { ...previousMealEntries }
        for (const { date, id } of linkedEntryIds) {
          nextMealEntries[date] = (nextMealEntries[date] || []).filter(e => e.id !== id)
        }

        set((state) => ({
          savedMeals: nextSavedMeals,
          mealEntries: nextMealEntries,
          deletedSavedMealIds: state.deletedSavedMealIds.includes(mealId)
            ? state.deletedSavedMealIds
            : [...state.deletedSavedMealIds, mealId],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          try {
            await saveMetadataCloudState(state.user.id, {
              savedMeals: nextSavedMeals,
              supplements: state.supplements,
              calendarReminders: state.calendarReminders,
            })
            for (const { id } of linkedEntryIds) {
              await deleteMealEntryCloud(state.user.id, id)
            }
          } catch {
            set((current) => ({
              savedMeals: previousSavedMeals,
              mealEntries: previousMealEntries,
              deletedSavedMealIds: current.deletedSavedMealIds.filter((id) => id !== mealId),
            }))
            return false
          }
        }
        return true
      },

      addCustomRecipe: (recipe) => {
        const normalizedRecipe = { ...recipe, id: ensureUuid(recipe.id) }
        set((state) => ({
          customRecipes: [normalizedRecipe, ...state.customRecipes],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await upsertCustomRecipe(state.user.id, normalizedRecipe)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertCustomRecipe(state.user.id, syncedRecipe)
          })
        }
      },

      removeCustomRecipe: (recipeId) => {
        set((state) => ({
          customRecipes: state.customRecipes.filter((r) => r.id !== recipeId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await deleteCustomRecipeCloud(state.user.id, recipeId)
          })
        }
      },

      setWeeklyMealPlan: (plan) => {
        const normalizedPlan = { ...plan, id: ensureUuid(plan.id) }
        set({ weeklyMealPlan: normalizedPlan })

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await upsertMealPlan(state.user.id, normalizedPlan)
          })
        }
      },

      setGroceryList: (list) => {
        const normalizedList = { ...list, id: ensureUuid(list.id) }
        set({ groceryList: normalizedList })

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, normalizedList)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, state.groceryList!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, state.groceryList!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, state.groceryList!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, state.groceryList!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertGroceryList(state.user.id, state.groceryList!)
          })
        }
      },

      clearGroceryList: () => {
        set({ groceryList: null })
        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await clearGroceryListCloud(state.user.id)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertMealPlan(state.user.id, state.weeklyMealPlan!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertMealPlan(state.user.id, state.weeklyMealPlan!)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertMealPlan(state.user.id, state.weeklyMealPlan!)
          })
        }
      },

      addSupplement: (supplement) => {
        const normalizedSupplement = { ...supplement, id: ensureUuid(supplement.id) }
        set((state) => withRefreshedNotifications(state, {
          supplements: [normalizedSupplement, ...state.supplements],
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
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

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      removeSupplement: (supplementId) => {
        set((state) => withRefreshedNotifications(state, {
          supplements: state.supplements.filter((supplement) => supplement.id !== supplementId),
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
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

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      addCalendarReminder: (reminder) => {
        const normalizedReminder = {
          ...reminder,
          id: ensureUuid(reminder.id),
          kind: reminder.kind || 'reminder',
          completed: reminder.completed ?? false,
          completed_at: reminder.completed ? reminder.completed_at || new Date().toISOString() : undefined,
        }
        set((state) => ({ calendarReminders: [normalizedReminder, ...state.calendarReminders] }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      updateCalendarReminder: (id, updates) => {
        set((state) => ({
          calendarReminders: state.calendarReminders.map((r) => {
            if (r.id !== id) return r

            const nextCompleted = updates.completed ?? r.completed ?? false

            return {
              ...r,
              ...updates,
              kind: updates.kind ?? r.kind ?? 'reminder',
              completed: nextCompleted,
              completed_at: nextCompleted
                ? updates.completed_at ?? r.completed_at ?? new Date().toISOString()
                : undefined,
            }
          }),
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      toggleCalendarReminderComplete: (id) => {
        set((state) => ({
          calendarReminders: state.calendarReminders.map((r) => {
            if (r.id !== id) return r

            const completed = !(r.completed ?? false)

            return {
              ...r,
              completed,
              completed_at: completed ? new Date().toISOString() : undefined,
            }
          }),
        }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
          })
        }
      },

      removeCalendarReminder: (id) => {
        set((state) => ({ calendarReminders: state.calendarReminders.filter((r) => r.id !== id) }))

        const { user, isDemoMode } = get()
        if (user && !isDemoMode) {
          enqueueCloudWrite(set, async () => {
            const s = get()
            await saveMetadataCloudState(user.id, {
              savedMeals: s.savedMeals,
              supplements: s.supplements,
              calendarReminders: s.calendarReminders,
            })
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
          enqueueCloudWrite(set, async () => {
            await upsertWorkoutLog(state.user.id, normalizedLog)
          })
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
          enqueueCloudWrite(set, async () => {
            await upsertWorkoutLog(state.user.id, syncedLog)
          })
        }
      },

      removeWorkoutLog: (logId) => {
        set((state) => withRefreshedNotifications(state, {
          workoutLogs: state.workoutLogs.filter((log) => log.id !== logId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await deleteWorkoutLogCloud(state.user.id, logId)
          })
        }
      },

      addCustomWorkout: (workout) => {
        set((state) => ({
          customWorkouts: [workout, ...state.customWorkouts],
          deletedCustomWorkoutIds: state.deletedCustomWorkoutIds.filter((id) => id !== workout.id),
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          enqueueCloudWrite(set, async () => {
            await upsertCustomWorkout(state.user.id, workout)
          })
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
          deletedCustomWorkoutIds: state.deletedCustomWorkoutIds.filter((id) => id !== workoutId),
        }))

        const state = get()
        if (state.user && !state.isDemoMode && syncedWorkout) {
          enqueueCloudWrite(set, async () => {
            await upsertCustomWorkout(state.user.id, syncedWorkout)
          })
        }
      },

      removeCustomWorkout: async (workoutId) => {
        const previousWorkouts = get().customWorkouts
        const nextWorkouts = previousWorkouts.filter((workout) => workout.id !== workoutId)

        set((state) => ({
          customWorkouts: nextWorkouts,
          deletedCustomWorkoutIds: state.deletedCustomWorkoutIds.includes(workoutId)
            ? state.deletedCustomWorkoutIds
            : [...state.deletedCustomWorkoutIds, workoutId],
        }))

        const state = get()
        if (state.user && !state.isDemoMode) {
          try {
            await deleteCustomWorkoutCloud(state.user.id, workoutId)
          } catch {
            set((current) => ({
              customWorkouts: previousWorkouts,
              deletedCustomWorkoutIds: current.deletedCustomWorkoutIds.filter((id) => id !== workoutId),
            }))
            return false
          }
        }
        return true
      },

      createSocialPost: (draft) => {
        const state = get()
        const fallbackUser = state.user
          ? {
              id: state.user.id,
              name: state.user.name,
              username: state.user.username || slugifyUsername(state.user.name),
              avatar_url: state.user.avatar_url,
              banner_url: state.user.banner_url,
              bio: state.user.bio,
              profile_visibility: state.user.profile_visibility,
            }
          : {
              id: DEMO_USER.id,
              name: DEMO_USER.name,
              username: 'alexmorgan',
            }
        const nextPost = createSocialPostFromDraft(draft, fallbackUser)

        set((current) => ({
          socialPosts: [nextPost, ...current.socialPosts],
        }))

        queueSocialMetadataSync(set, get)

        return nextPost.id
      },

      removeSocialPost: (postId) => {
        set((state) => ({
          socialPosts: state.socialPosts.filter((post) => post.id !== postId),
          socialSavedPostIds: state.socialSavedPostIds.filter((id) => id !== postId),
          socialLikedPostIds: state.socialLikedPostIds.filter((id) => id !== postId),
          socialPostComments: Object.fromEntries(
            Object.entries(state.socialPostComments).filter(([key]) => key !== postId)
          ),
        }))
        queueSocialMetadataSync(set, get)
      },

      requestToFollowUser: (target) => {
        const state = get()
        const viewerId = state.user?.id ?? DEMO_USER.id
        if (!target.id || target.id === viewerId) return 'noop'

        const existing = state.socialFollows.find(
          (item) => item.followerId === viewerId && item.followingId === target.id
        )
        if (existing?.status === 'accepted') return 'accepted'
        if (existing?.status === 'pending') return 'pending'

        const status = target.profile_visibility === 'private' ? 'pending' : 'accepted'
        set((current) => ({
          socialFollows: [
            {
              followerId: viewerId,
              followingId: target.id,
              status,
              createdAt: new Date().toISOString(),
            },
            ...current.socialFollows,
          ],
        }))
        queueSocialMetadataSync(set, get)
        return status
      },

      acceptFollowRequest: (followerId) => {
        const ownerId = get().user?.id ?? DEMO_USER.id
        set((state) => ({
          socialFollows: state.socialFollows.map((item) => (
            item.followerId === followerId && item.followingId === ownerId && item.status === 'pending'
              ? { ...item, status: 'accepted' }
              : item
          )),
        }))
        queueSocialMetadataSync(set, get)
      },

      declineFollowRequest: (followerId) => {
        const ownerId = get().user?.id ?? DEMO_USER.id
        set((state) => ({
          socialFollows: state.socialFollows.filter(
            (item) => !(item.followerId === followerId && item.followingId === ownerId && item.status === 'pending')
          ),
        }))
        queueSocialMetadataSync(set, get)
      },

      cancelFollowRequest: (followingId) => {
        const viewerId = get().user?.id ?? DEMO_USER.id
        set((state) => ({
          socialFollows: state.socialFollows.filter(
            (item) => !(item.followerId === viewerId && item.followingId === followingId && item.status === 'pending')
          ),
        }))
        queueSocialMetadataSync(set, get)
      },

      unfollowUser: (followingId) => {
        const viewerId = get().user?.id ?? DEMO_USER.id
        set((state) => ({
          socialFollows: state.socialFollows.filter(
            (item) => !(item.followerId === viewerId && item.followingId === followingId)
          ),
        }))
        queueSocialMetadataSync(set, get)
      },

      setSocialComposerPrefill: (draft) => {
        set({ socialComposerPrefill: draft })
      },

      toggleSaveSocialPost: (postId, sourcePost) => {
        set((state) => {
          const alreadySaved = state.socialSavedPostIds.includes(postId)
          return {
            socialSavedPostIds: alreadySaved
              ? state.socialSavedPostIds.filter((id) => id !== postId)
              : [postId, ...state.socialSavedPostIds],
            socialPosts: upsertSocialPostOverride(
              state.socialPosts,
              postId,
              (post) => {
                const nextSaved = Math.max(0, post.stats.saved + (alreadySaved ? -1 : 1))
                return {
                  ...post,
                  stats: {
                    ...post.stats,
                    saved: nextSaved,
                  },
                }
              },
              sourcePost
            ),
          }
        })
        queueSocialMetadataSync(set, get)
      },

      toggleLikeSocialPost: (postId, sourcePost) => {
        set((state) => {
          const alreadyLiked = state.socialLikedPostIds.includes(postId)
          return {
            socialLikedPostIds: alreadyLiked
              ? state.socialLikedPostIds.filter((id) => id !== postId)
              : [postId, ...state.socialLikedPostIds],
            socialPosts: upsertSocialPostOverride(
              state.socialPosts,
              postId,
              (post) => {
                const nextLikes = Math.max(0, (post.stats.likes ?? 0) + (alreadyLiked ? -1 : 1))
                return {
                  ...post,
                  stats: {
                    ...post.stats,
                    likes: nextLikes,
                  },
                }
              },
              sourcePost
            ),
          }
        })
        queueSocialMetadataSync(set, get)
      },

      addCommentToSocialPost: (postId, body) => {
        const trimmed = body.trim()
        if (!trimmed) return

        const state = get()
        const commenter = state.user
          ? {
              userId: state.user.id,
              userName: state.user.name,
              userUsername: state.user.username || slugifyUsername(state.user.name),
            }
          : {
              userId: DEMO_USER.id,
              userName: DEMO_USER.name,
              userUsername: 'alexmorgan',
            }

        const nextComment: SocialPostComment = {
          id: `social-comment-${Date.now()}`,
          postId,
          ...commenter,
          body: trimmed,
          createdAt: new Date().toISOString(),
        }

        set((current) => ({
          socialPostComments: {
            ...current.socialPostComments,
            [postId]: [nextComment, ...(current.socialPostComments[postId] ?? [])],
          },
          socialPosts: upsertSocialPostOverride(
            current.socialPosts,
            postId,
            (post) => ({
              ...post,
              stats: {
                ...post.stats,
                comments: (post.stats.comments ?? 0) + 1,
              },
            })
          ),
        }))
        queueSocialMetadataSync(set, get)
      },

      incrementSocialPostStats: (postId, updates) => {
        set((state) => ({
          socialPosts: upsertSocialPostOverride(
            state.socialPosts,
            postId,
            (post) => ({
              ...post,
              stats: {
                used: Math.max(0, post.stats.used + (updates.used ?? 0)),
                completed: Math.max(0, post.stats.completed + (updates.completed ?? 0)),
                saved: Math.max(0, post.stats.saved + (updates.saved ?? 0)),
                likes: Math.max(0, (post.stats.likes ?? 0) + (updates.likes ?? 0)),
                comments: Math.max(0, (post.stats.comments ?? 0) + (updates.comments ?? 0)),
                remixed: Math.max(0, (post.stats.remixed ?? 0) + (updates.remixed ?? 0)),
              },
            })
          ),
        }))
        queueSocialMetadataSync(set, get)
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
            fiber_g: acc.fiber_g + (meal.macros.fiber_g ?? 0),
          }),
          { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
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
      name: 'rivora-store',
      storage: createJSONStorage(() => safePersistStorage),
      version: 6,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<AppStore>
        return {
          user: state.user ?? null,
          isAuthenticated: Boolean(state.isDemoMode && state.isAuthenticated && state.user),
          isDemoMode: Boolean(state.isDemoMode),
          sidebarCollapsed: Boolean(state.sidebarCollapsed),
          theme: state.theme === 'light' || state.theme === 'system' ? state.theme : 'dark',
          notificationPreferences: state.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
          waterUnit: state.waterUnit === 'ml' || state.waterUnit === 'l' ? state.waterUnit : 'oz',
          lastSyncedAt: typeof state.lastSyncedAt === 'string' ? state.lastSyncedAt : null,
          cloudHydratedScopes: Array.isArray(state.cloudHydratedScopes) ? state.cloudHydratedScopes : [],
          socialPosts: Array.isArray(state.socialPosts) ? state.socialPosts : [],
        }
      },
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isDemoMode ? state.isAuthenticated : false,
        isDemoMode: state.isDemoMode,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        notificationPreferences: state.notificationPreferences,
        waterUnit: state.waterUnit,
        lastSyncedAt: state.lastSyncedAt,
        cloudHydratedScopes: state.cloudHydratedScopes,
        // Persist user's own social posts so they survive page refresh immediately
        // (cloud hydration will merge and sync any newer data from other devices)
        socialPosts: state.socialPosts,
      }),
    }
  )
)

// Expose store globally for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).useAppStore = useAppStore;
  console.log('🔧 Store exposed to window.useAppStore');
}
