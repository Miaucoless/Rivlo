// ─── User & Profile ────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'
export type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'athletic_performance'
export type WorkoutSplit = 'ppl' | 'upper_lower' | '3day_fullbody' | '4day' | '5day' | '6day' | 'cardio_focus'

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  height_cm: number
  weight_kg: number
  age: number
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: WorkoutSplit
  bmr: number
  tdee: number
  calorie_target: number
  protein_target_g: number
  carb_target_g: number
  fat_target_g: number
  onboarded: boolean
  created_at: string
  updated_at: string
}

// ─── Nutrition ──────────────────────────────────────────────────────────────────

export interface Macros {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
}

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: string
  calories_per_unit: number
  macros: Omit<Macros, 'calories'>
  estimated_price?: number
}

export interface Recipe {
  id: string
  name: string
  description: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  prep_time_min: number
  cook_time_min: number
  servings: number
  ingredients: Ingredient[]
  instructions: string[]
  macros: Macros
  tags: string[]
  image_url?: string
}

export interface MealEntry {
  id: string
  user_id: string
  date: string // ISO date YYYY-MM-DD
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe?: Recipe
  custom_name?: string
  macros: Macros
  logged_at: string
}

export interface DailyNutrition {
  date: string
  meals: MealEntry[]
  totals: Macros
  target: Macros
}

export interface WeeklyMealPlan {
  id: string
  user_id: string
  week_start: string
  days: {
    [day: string]: {
      breakfast: Recipe | null
      lunch: Recipe | null
      dinner: Recipe | null
      snack?: Recipe | null
    }
  }
}

export interface GroceryItem {
  ingredient: string
  amount: number
  unit: string
  estimated_price: number
  category: string
  checked: boolean
}

export interface GroceryList {
  id: string
  user_id: string
  week_start: string
  items: GroceryItem[]
  total_estimated_cost: number
  created_at: string
}

// ─── Workouts ───────────────────────────────────────────────────────────────────

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full_body' | 'cardio'

export interface Exercise {
  id: string
  name: string
  muscle_groups: MuscleGroup[]
  equipment: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  video_url?: string // YouTube embed URL
  instructions: string[]
}

export interface WorkoutSet {
  set_number: number
  reps: number
  weight_kg?: number
  rest_seconds: number
  completed?: boolean
  actual_reps?: number
  actual_weight_kg?: number
}

export interface WorkoutExercise {
  exercise: Exercise
  sets: WorkoutSet[]
  notes?: string
}

export interface Workout {
  id: string
  name: string
  description: string
  day_label: string // e.g., "Push Day A", "Leg Day"
  muscle_groups: MuscleGroup[]
  exercises: WorkoutExercise[]
  estimated_duration_min: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  split_type: WorkoutSplit
}

export interface WorkoutLog {
  id: string
  user_id: string
  workout_id: string
  workout: Workout
  date: string
  started_at: string
  completed_at?: string
  duration_min?: number
  exercises: Array<{
    exercise_id: string
    exercise_name: string
    sets: Array<{
      set_number: number
      target_reps: number
      actual_reps: number
      weight_kg: number
    }>
  }>
  notes?: string
  rating?: 1 | 2 | 3 | 4 | 5
}

// ─── Progress Tracking ──────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string
  user_id: string
  date: string
  weight_kg: number
  body_fat_pct?: number
  muscle_mass_kg?: number
  notes?: string
}

export interface ProgressStats {
  starting_weight: number
  current_weight: number
  target_weight?: number
  weight_change: number
  weeks_active: number
  workouts_completed: number
  streak_days: number
  best_streak: number
  total_calories_logged: number
  avg_daily_calories: number
}

// ─── Journal ────────────────────────────────────────────────────────────────────

export type JournalTag = 'mood' | 'energy' | 'diet' | 'workout' | 'stress' | 'sleep' | 'motivation'
export type MoodLevel = 1 | 2 | 3 | 4 | 5
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

export interface JournalEntry {
  id: string
  user_id: string
  date: string
  title?: string
  content: string
  mood: MoodLevel
  energy: EnergyLevel
  tags: JournalTag[]
  workout_id?: string
  meal_plan_id?: string
  prompts_answered?: {
    workout_feel?: string
    energy_description?: string
    goals_reflection?: string
  }
  created_at: string
  updated_at: string
}

// ─── Calendar ───────────────────────────────────────────────────────────────────

export type CalendarEventType = 'workout' | 'meal' | 'weight_check' | 'journal' | 'goal'

export interface CalendarEvent {
  id: string
  date: string
  type: CalendarEventType
  title: string
  description?: string
  data?: WorkoutLog | MealEntry | WeightEntry | JournalEntry
  color: string
}

// ─── App State ──────────────────────────────────────────────────────────────────

export interface AppState {
  user: UserProfile | null
  isLoading: boolean
  isDemoMode: boolean
  theme: 'light' | 'dark' | 'system'
  sidebar: {
    collapsed: boolean
  }
  notifications: Notification[]
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  created_at: string
  action_url?: string
}
