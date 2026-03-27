// ─── User & Profile ────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'
export type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'athletic_performance'
export type WorkoutSplit = 'ppl' | 'upper_lower' | '3day_fullbody' | '4day' | '5day' | '6day' | 'cardio_focus'
export type UnitSystem = 'imperial' | 'metric'
export type PreferredWorkoutTime = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'late_night' | 'flexible'
export type SupplementCategory = 'vitamin' | 'mineral' | 'herbal' | 'supplement' | 'medicine' | 'other'
export type SupplementFrequency = 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'as_needed'

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  height_cm: number
  weight_kg: number
  age: number
  unit_system: UnitSystem
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: WorkoutSplit
  goal_target_change_kg?: number
  goal_timeframe_weeks?: number
  preferred_workout_time?: PreferredWorkoutTime
  preferred_foods?: string[]
  avoided_foods?: string[]
  notification_preferences?: NotificationPreferences
  phone_number?: string
  email_notifications_enabled?: boolean
  email_notifications_consent_at?: string
  sms_notifications_enabled?: boolean
  sms_notifications_consent_at?: string
  bmr: number
  tdee: number
  calorie_target: number
  protein_target_g: number
  carb_target_g: number
  fat_target_g: number
  water_goal_ml: number
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
  yield_quantity?: number
  yield_unit?: string
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
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
  recipe?: Recipe
  custom_name?: string
  macros: Macros
  logged_at: string
  recipe_amount?:
    | { kind: 'servings'; servings: number }
    | { kind: 'units'; units: number }
}

export interface DailyNutrition {
  date: string
  meals: MealEntry[]
  totals: Macros
  target: Macros
}

export interface SavedMealItem {
  input: string
  matched_name: string
  amount: number
  unit: string
  macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
}

export interface SavedMealTemplate {
  id: string
  name: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  items: SavedMealItem[]
  updated_at: string
}

export interface CustomMealIngredient {
  name: string
  amount: number
  unit: string
}

export type PlannedItem =
  | { type: 'recipe'; recipe: Recipe }
  | { type: 'saved'; savedMeal: SavedMealTemplate }
  | { type: 'custom'; name: string; ingredients: CustomMealIngredient[] }

// Each slot holds an array of items (empty = nothing planned)
export type PlannedSlot = PlannedItem[]

export interface WeeklyMealPlan {
  id: string
  user_id: string
  week_start: string
  days: {
    [day: string]: {
      breakfast: PlannedSlot
      lunch: PlannedSlot
      dinner: PlannedSlot
      snack: PlannedSlot
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
export type ExerciseSetMetric = 'reps' | 'seconds' | 'minutes' | 'intervals'

export interface Exercise {
  id: string
  name: string
  muscle_groups: MuscleGroup[]
  equipment: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  video_url?: string // YouTube embed URL
  instructions: string[]
  set_metric?: ExerciseSetMetric
}

export type ExercisePrimaryType = 'strength' | 'bodyweight' | 'time' | 'distance' | 'time_distance' | 'intervals' | 'mixed'
export type ExerciseModifier = 'unilateral' | 'alternating' | 'weighted' | 'assisted' | 'distance_based' | 'time_cap' | 'rounds' | 'interval_structure'

export interface ExerciseLibraryItem extends Exercise {
  aliases?: string[]
  default_sets: number
  default_reps: number
  default_rest_seconds: number
  met_base: number
  met_type?: 'resistance' | 'squat_hinge' | 'circuit' | 'bodyweight_light' | 'bodyweight_vigorous' | 'cardio'
  primary_type?: ExercisePrimaryType
  modifiers?: ExerciseModifier[]
}

export interface WorkoutSet {
  set_number: number
  set_type?: 'standard' | 'drop'
  drop_from_set_number?: number
  drop_set_index?: number
  reps: number
  weight_kg?: number
  incline_pct?: number
  speed_mph?: number
  machine_level?: number
  resistance_level?: number
  watts?: number
  cadence_rpm?: number
  interval_duration_sec?: number   // work duration per interval in seconds (sprint/HIIT mode)
  rest_seconds: number
  completed?: boolean
  actual_reps?: number
  actual_weight_kg?: number
  actual_incline_pct?: number
  actual_speed_mph?: number
  actual_machine_level?: number
  actual_resistance_level?: number
  actual_watts?: number
  actual_cadence_rpm?: number
  actual_interval_duration_sec?: number
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
  source?: 'premade' | 'custom'
  updated_at?: string
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
      set_type?: 'standard' | 'drop'
      drop_from_set_number?: number
      drop_set_index?: number
      target_reps: number
      actual_reps: number
      weight_kg: number
      incline_pct?: number
      speed_mph?: number
      machine_level?: number
      resistance_level?: number
      watts?: number
      cadence_rpm?: number
    }>
  }>
  notes?: string
  rating?: 1 | 2 | 3 | 4 | 5
  calories_burned_kcal?: number
  total_volume_kg?: number
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
  linked_item?: {
    type: 'workout' | 'meal' | 'supplement' | 'other'
    id?: string
    label: string
  }
  prompts_answered?: {
    workout_feel?: string
    energy_description?: string
    goals_reflection?: string
  }
  created_at: string
  updated_at: string
}

// ─── Calendar ───────────────────────────────────────────────────────────────────

export interface CalendarReminder {
  id: string
  date: string       // yyyy-MM-dd
  time?: string      // 'HH:mm' 24h, optional
  title: string
  notes?: string
  color: 'default' | 'red' | 'blue' | 'green' | 'yellow' | 'purple'
  created_at: string
}

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

export type NotificationPreferenceKey =
  | 'daily_workout_reminder'
  | 'meal_logging_reminder'
  | 'weekly_progress_summary'
  | 'goal_milestone_alerts'

export interface NotificationPreferences {
  daily_workout_reminder: boolean
  meal_logging_reminder: boolean
  weekly_progress_summary: boolean
  goal_milestone_alerts: boolean
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

export interface SupplementEntry {
  id: string
  name: string
  category: SupplementCategory
  amount: number
  unit: string
  frequency: SupplementFrequency
  notes?: string
  notification_enabled: boolean
  archived?: boolean
  taken_dates: string[]
  created_at: string
  updated_at: string
}

// ─── Water ──────────────────────────────────────────────────────────────────────

export interface WaterEntry {
  id: string
  user_id: string
  date: string       // ISO YYYY-MM-DD
  amount_ml: number
  logged_at: string  // ISO timestamp
}
