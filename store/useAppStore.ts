'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, WorkoutLog, MealEntry, WeightEntry, JournalEntry, GroceryList, WeeklyMealPlan } from '@/types'
import { DEMO_USER, WEIGHT_HISTORY, JOURNAL_ENTRIES, TODAY_MEALS, TODAY_TOTALS, WEEKLY_MEAL_PLAN, GROCERY_LIST, type MealLogEntry } from '@/lib/mock-data'
import { getTodayISO } from '@/lib/utils'
import { format, subDays } from 'date-fns'

interface AppStore {
  // Auth & Profile
  user: UserProfile | null
  isAuthenticated: boolean
  isDemoMode: boolean

  // UI State
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'

  // Data
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  workoutLogs: WorkoutLog[]
  mealEntries: Record<string, MealLogEntry[]> // keyed by date
  weeklyMealPlan: WeeklyMealPlan | null
  groceryList: GroceryList | null
  streak: number

  // Actions
  setUser: (user: UserProfile | null) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  loginDemo: () => void
  logout: () => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Weight
  addWeightEntry: (entry: WeightEntry) => void

  // Journal
  addJournalEntry: (entry: JournalEntry) => void
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void
  deleteJournalEntry: (id: string) => void

  // Meals
  addMealEntry: (date: string, meal: MealLogEntry[][0]) => void
  removeMealEntry: (date: string, mealId: string) => void
  setWeeklyMealPlan: (plan: WeeklyMealPlan) => void
  setGroceryList: (list: GroceryList) => void
  toggleGroceryItem: (itemIndex: number) => void

  // Workouts
  logWorkout: (log: WorkoutLog) => void

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

function generateWorkoutLogs() {
  // Generate last 6 weeks of workout logs
  const logs: WorkoutLog[] = []
  const workoutDays = [1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31, 34, 36, 38, 41]
  workoutDays.forEach((daysAgo, i) => {
    logs.push({
      id: `wl${i}`,
      user_id: DEMO_USER.id,
      workout_id: `w${(i % 3) + 1}`,
      workout: { id: `w${(i % 3) + 1}`, name: ['Push Day A', 'Pull Day A', 'Leg Day A'][i % 3], description: '', day_label: '', muscle_groups: [], exercises: [], estimated_duration_min: 65, difficulty: 'intermediate', split_type: 'ppl' },
      date: format(subDays(new Date(), daysAgo), 'yyyy-MM-dd'),
      started_at: subDays(new Date(), daysAgo).toISOString(),
      completed_at: subDays(new Date(), daysAgo).toISOString(),
      duration_min: 55 + Math.floor(Math.random() * 20),
      exercises: [],
      rating: (Math.floor(Math.random() * 2) + 4) as 4 | 5,
    })
  })
  return logs
}

function generateMealHistory() {
  const history: Record<string, MealLogEntry[]> = {}
  // Today
  history[getTodayISO()] = TODAY_MEALS
  // Past days
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

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
      sidebarCollapsed: false,
      theme: 'dark',
      weightHistory: [],
      journalEntries: [],
      workoutLogs: [],
      mealEntries: {},
      weeklyMealPlan: null,
      groceryList: null,
      streak: 0,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      updateProfile: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      loginDemo: () =>
        set({
          user: DEMO_USER,
          isAuthenticated: true,
          isDemoMode: true,
          weightHistory: WEIGHT_HISTORY,
          journalEntries: JOURNAL_ENTRIES,
          workoutLogs: generateWorkoutLogs(),
          mealEntries: generateMealHistory(),
          weeklyMealPlan: WEEKLY_MEAL_PLAN,
          groceryList: GROCERY_LIST,
          streak: 12,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isDemoMode: false,
          weightHistory: [],
          journalEntries: [],
          workoutLogs: [],
          mealEntries: {},
          weeklyMealPlan: null,
          groceryList: null,
          streak: 0,
        }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),

      addWeightEntry: (entry) =>
        set((state) => ({
          weightHistory: [...state.weightHistory.filter((w) => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)),
        })),

      addJournalEntry: (entry) =>
        set((state) => ({
          journalEntries: [entry, ...state.journalEntries],
        })),

      updateJournalEntry: (id, updates) =>
        set((state) => ({
          journalEntries: state.journalEntries.map((e) =>
            e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
          ),
        })),

      deleteJournalEntry: (id) =>
        set((state) => ({
          journalEntries: state.journalEntries.filter((e) => e.id !== id),
        })),

      addMealEntry: (date, meal) =>
        set((state) => ({
          mealEntries: {
            ...state.mealEntries,
            [date]: [...(state.mealEntries[date] || []), meal],
          },
        })),

      removeMealEntry: (date, mealId) =>
        set((state) => ({
          mealEntries: {
            ...state.mealEntries,
            [date]: (state.mealEntries[date] || []).filter((m) => m.id !== mealId),
          },
        })),

      setWeeklyMealPlan: (plan) => set({ weeklyMealPlan: plan }),

      setGroceryList: (list) => set({ groceryList: list }),

      toggleGroceryItem: (itemIndex) =>
        set((state) => {
          if (!state.groceryList) return state
          const items = [...state.groceryList.items]
          items[itemIndex] = { ...items[itemIndex], checked: !items[itemIndex].checked }
          return { groceryList: { ...state.groceryList, items } }
        }),

      logWorkout: (log) =>
        set((state) => ({
          workoutLogs: [log, ...state.workoutLogs],
          streak: state.streak + (state.workoutLogs.some(w => w.date === getTodayISO()) ? 0 : 1),
        })),

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

      getCalendarEvents: () => {
        const { workoutLogs, mealEntries, weightHistory, journalEntries } = get()
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
          events.push({ date: entry.date, type: 'weight_check', title: `${entry.weight_kg.toFixed(1)} kg`, color: '#f59e0b' })
        })

        journalEntries.forEach((entry) => {
          events.push({ date: entry.date, type: 'journal', title: entry.title || 'Journal Entry', color: '#8b5cf6' })
        })

        return events
      },
    }),
    {
      name: 'grays-fitness-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isDemoMode: state.isDemoMode,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        weightHistory: state.weightHistory,
        journalEntries: state.journalEntries,
        workoutLogs: state.workoutLogs,
        mealEntries: state.mealEntries,
        weeklyMealPlan: state.weeklyMealPlan,
        groceryList: state.groceryList,
        streak: state.streak,
      }),
    }
  )
)
