'use client'

import { format } from 'date-fns'
import { RECIPES, WORKOUTS } from '@/lib/content-library'
import type { MealLogEntry } from '@/lib/content-library'
import type {
  DayData,
  MealData,
  Recipe,
  SavedMealTemplate,
  SocialFeedFilter,
  SocialFeedSort,
  SocialPost,
  SocialPostDraft,
  SocialPostUser,
  SocialWorkoutExercise,
  SupplementEntry,
  Workout,
  WorkoutData,
  WorkoutExercise,
  WorkoutLog,
  WorkoutSplit,
} from '@/types'

const SOCIAL_CREATORS: SocialPostUser[] = [
  {
    id: 'creator-marina',
    name: 'Marina Lee',
    username: 'marinalee',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: 'Strength-focused coach sharing repeatable high-protein meals and upper-body sessions that are easy to recover from.',
    profile_visibility: 'public',
  },
  {
    id: 'creator-devon',
    name: 'Devon Clark',
    username: 'devonclark',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Meal-prep heavy, consistency first. I post practical lunches, efficient grocery setups, and workouts that fit real schedules.',
    profile_visibility: 'public',
  },
  {
    id: 'creator-priya',
    name: 'Priya Shah',
    username: 'priyashah',
    avatar_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
    bio: 'Performance-minded lifter building cleaner cuts, balanced training weeks, and recipes that still feel satisfying.',
    profile_visibility: 'private',
  },
  {
    id: 'creator-luca',
    name: 'Luca Grant',
    username: 'lucagrant',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: 'I keep nutrition and training simple: fast wraps, structured pull days, and progress you can actually repeat weekly.',
    profile_visibility: 'public',
  },
  {
    id: 'creator-ian',
    name: 'Ian Brooks',
    username: 'ianbrooks',
    avatar_url: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=400&q=80',
    bio: 'Upper-lower split, straightforward volume, and sessions designed to feel productive without dragging out the whole day.',
    profile_visibility: 'private',
  },
  {
    id: 'creator-kira',
    name: 'Kira Stone',
    username: 'kirastone',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    bio: 'Focused on efficient programming, heavier top sets, and recipes that support recovery without overcomplicating prep.',
    profile_visibility: 'public',
  },
]

const WORKOUT_IMAGES = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1200&q=80',
]

export const SOCIAL_FILTER_OPTIONS: Array<{ value: SocialFeedFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'meals', label: 'Meals' },
  { value: 'workouts', label: 'Workouts' },
  { value: 'plans', label: 'Plans' },
  { value: 'progress', label: 'Progress' },
]

export type MealSubFilter =
  | 'high-protein'
  | 'vegan'
  | 'vegetarian'
  | 'gluten-free'
  | 'low-carb'
  | 'low-calorie'
  | 'meal-prep'
  | 'quick'

export type WorkoutSubFilter =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'full-body'
  | 'chest'
  | 'back'
  | 'at-home'
  | 'beginner'
  | 'advanced'

export type SocialSubFilter = MealSubFilter | WorkoutSubFilter

export const MEAL_SUB_FILTER_OPTIONS: Array<{ value: MealSubFilter; label: string }> = [
  { value: 'high-protein', label: 'High Protein' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'low-carb', label: 'Low Carb' },
  { value: 'low-calorie', label: 'Low Calorie' },
  { value: 'meal-prep', label: 'Meal Prep' },
  { value: 'quick', label: 'Quick' },
]

export const WORKOUT_SUB_FILTER_OPTIONS: Array<{ value: WorkoutSubFilter; label: string }> = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
  { value: 'full-body', label: 'Full Body' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'at-home', label: 'At Home' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
]

export const SOCIAL_SORT_OPTIONS: Array<{ value: SocialFeedSort; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'most_used', label: 'Most Used' },
  { value: 'trending', label: 'Trending' },
  { value: 'most_completed', label: 'Most Completed' },
  { value: 'most_saved', label: 'Most Saved' },
]

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function createMealDataFromRecipe(recipe: Recipe): MealData {
  return {
    calories: recipe.macros.calories,
    protein: recipe.macros.protein_g,
    carbs: recipe.macros.carbs_g,
    fat: recipe.macros.fat_g,
    servings: recipe.servings,
    serving_size: recipe.yield_quantity && recipe.yield_unit ? `${recipe.yield_quantity} ${recipe.yield_unit}` : `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
    })),
    instructions: recipe.instructions,
  }
}

function createMealDataFromSavedMeal(meal: SavedMealTemplate): MealData {
  return {
    calories: meal.macros.calories,
    protein: meal.macros.protein_g,
    carbs: meal.macros.carbs_g,
    fat: meal.macros.fat_g,
    servings: 1,
    serving_size: '1 saved meal',
    ingredients: meal.items.map((item) => ({
      name: item.matched_name || item.input,
      amount: item.amount,
      unit: item.unit,
    })),
    instructions: [],
  }
}

function createMealDataFromMealLogEntry(meal: MealLogEntry): MealData {
  const ingredients = meal.recipe?.ingredients?.map((ingredient) => ({
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
  })) ?? meal.meal_items?.map((item) => ({
    name: item.name,
    amount: item.amount ?? item.servings ?? 1,
    unit: item.unit ?? 'serving',
  })) ?? []

  return {
    calories: meal.macros.calories,
    protein: meal.macros.protein_g,
    carbs: meal.macros.carbs_g,
    fat: meal.macros.fat_g,
    servings:
      meal.recipe_amount?.kind === 'servings'
        ? meal.recipe_amount.servings
        : meal.recipe_amount?.kind === 'units'
          ? meal.recipe_amount.units
          : 1,
    serving_size:
      meal.recipe_amount?.kind === 'servings'
        ? `${meal.recipe_amount.servings} serving${meal.recipe_amount.servings === 1 ? '' : 's'}`
        : meal.recipe_amount?.kind === 'units'
          ? `${meal.recipe_amount.units} unit${meal.recipe_amount.units === 1 ? '' : 's'}`
          : '1 logged meal',
    ingredients,
    instructions: meal.recipe?.instructions ?? [],
  }
}

function createWorkoutDataFromWorkout(workout: Workout): WorkoutData {
  const equipment = Array.from(new Set(workout.exercises.map((exercise) => exercise.exercise.equipment).filter(Boolean)))

  return {
    duration: workout.estimated_duration_min,
    level: workout.difficulty === 'advanced' ? 'Advanced' : workout.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
    equipment,
    focus: workout.muscle_groups.map((group) => group.replace(/_/g, ' ')),
    exercises: workout.exercises.map((exercise) => {
      const primarySet = exercise.sets[0]
      const reps = exercise.sets.every((set) => set.reps === primarySet?.reps)
        ? `${primarySet?.reps ?? 0}`
        : `${Math.min(...exercise.sets.map((set) => set.reps))}-${Math.max(...exercise.sets.map((set) => set.reps))}`

      return {
        name: exercise.exercise.name,
        sets: exercise.sets.length,
        reps,
        weight: primarySet?.weight_kg,
        rest: primarySet?.rest_seconds,
        notes: exercise.notes,
      }
    }),
    notes: workout.description,
  }
}

function createWorkoutDataFromWorkoutLog(log: WorkoutLog): WorkoutData {
  const equipment = Array.from(new Set(
    log.workout.exercises
      .map((exercise) => exercise.exercise.equipment)
      .filter(Boolean)
  ))

  return {
    duration: log.duration_min || log.workout.estimated_duration_min || 0,
    level: log.workout.difficulty === 'advanced' ? 'Advanced' : log.workout.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
    equipment,
    focus: log.workout.muscle_groups.map((group) => group.replace(/_/g, ' ')),
    exercises: log.exercises.map((exercise) => {
      const repValues = exercise.sets
        .map((set) => Number(set.actual_reps ?? set.target_reps))
        .filter((value) => Number.isFinite(value) && value > 0)
      const minReps = repValues.length > 0 ? Math.min(...repValues) : 0
      const maxReps = repValues.length > 0 ? Math.max(...repValues) : 0
      const weightValues = exercise.sets
        .map((set) => Number(set.weight_kg))
        .filter((value) => Number.isFinite(value) && value > 0)

      return {
        name: exercise.exercise_name,
        sets: exercise.sets.length,
        reps: repValues.length === 0 ? '0' : minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`,
        weight: weightValues.length > 0 ? Math.max(...weightValues) : undefined,
        rest: undefined,
      }
    }),
    notes: log.notes || log.workout.description,
  }
}

function createDayData(date: string, meals: MealLogEntry[], workoutLogs: WorkoutLog[], supplements: SupplementEntry[]): DayData {
  return {
    date,
    meals: meals.map((meal) => ({
      id: meal.id,
      mealType: meal.meal_type,
      name: meal.name,
      time: meal.time,
      macros: meal.macros,
    })),
    workouts: workoutLogs.map((log) => ({
      id: log.id,
      name: log.workout.name,
      startedAt: log.started_at,
      completedAt: log.completed_at,
      durationMin: log.duration_min,
      caloriesBurnedKcal: log.calories_burned_kcal,
      focus: log.workout.muscle_groups.map((group) => group.replace(/_/g, ' ')),
      exercises: log.exercises.map((exercise) => ({
        name: exercise.exercise_name,
        sets: exercise.sets.map((set) => ({
          label: set.set_type === 'drop' ? `Drop ${set.drop_set_index ?? 1}` : `Set ${set.set_number}`,
          reps: set.actual_reps ?? set.target_reps,
          weightKg: set.weight_kg > 0 ? set.weight_kg : undefined,
        })),
      })),
    })),
    supplements: supplements.map((supplement) => ({
      id: supplement.id,
      name: supplement.name,
      amount: supplement.amount,
      unit: supplement.unit,
      category: supplement.category,
    })),
    totalCalories: meals.reduce((sum, meal) => sum + meal.macros.calories, 0),
    totalProtein: meals.reduce((sum, meal) => sum + meal.macros.protein_g, 0),
  }
}

function makePost(input: Omit<SocialPost, 'id'> & { idSuffix: string }): SocialPost {
  const { idSuffix, ...rest } = input
  return {
    id: `social-${idSuffix}`,
    ...rest,
  }
}

const recipePosts = [
  {
    recipe: RECIPES[0],
    creator: SOCIAL_CREATORS[0],
    caption: 'A fast breakfast build I keep on repeat when I want protein handled before work starts.',
    stats: { completed: 6100, used: 10200, saved: 18000, remixed: 1400 },
    audience: 'followers' as const,
    createdAt: '2026-03-30T08:10:00.000Z',
    tags: ['high-protein', 'breakfast', 'plan'],
  },
  {
    recipe: RECIPES[1],
    creator: SOCIAL_CREATORS[1],
    caption: 'This is the lunch bowl I fall back on when I want something consistent, high-protein, and easy to prep twice a week.',
    stats: { completed: 5400, used: 11800, saved: 15300, remixed: 980 },
    audience: 'public' as const,
    createdAt: '2026-03-28T17:35:00.000Z',
    tags: ['meal-prep', 'lunch', 'plan'],
    taggedUsers: [SOCIAL_CREATORS[0]],
  },
  {
    recipe: RECIPES[2],
    creator: SOCIAL_CREATORS[2],
    caption: 'A cleaner dinner option that still feels substantial when I need to stay inside calories without losing satisfaction.',
    stats: { completed: 7200, used: 12600, saved: 16900, remixed: 1120 },
    audience: 'followers' as const,
    createdAt: '2026-04-01T18:42:00.000Z',
    tags: ['dinner', 'progress', 'high-protein'],
  },
  {
    recipe: RECIPES[5],
    creator: SOCIAL_CREATORS[3],
    caption: 'Simple wrap, high protein, almost no cleanup. I use this when I need a fast lunch between meetings.',
    stats: { completed: 3800, used: 8600, saved: 10900, remixed: 740 },
    audience: 'public' as const,
    createdAt: '2026-04-02T12:15:00.000Z',
    tags: ['quick', 'lunch', 'progress'],
  },
  {
    recipe: RECIPES[4],
    creator: SOCIAL_CREATORS[5],
    caption: 'This is the dinner I use when I want something that feels restaurant-level but still lands clean on macros. The ingredient list stays short, the protein is high, and it reheats well enough to carry two lunches after.',
    stats: { completed: 5900, used: 13400, saved: 19400, remixed: 1260 },
    audience: 'public' as const,
    createdAt: '2026-04-04T16:18:00.000Z',
    tags: ['dinner', 'high-protein', 'meal-prep', 'explore'],
  },
]

const workoutPosts = [
  {
    workout: WORKOUTS[0],
    creator: SOCIAL_CREATORS[4],
    caption: 'Balanced upper session with enough pressing volume to feel productive without turning the whole day into a grind.',
    stats: { completed: 4800, used: 9700, saved: 14100, remixed: 890 },
    audience: 'followers' as const,
    createdAt: '2026-03-29T06:55:00.000Z',
    tags: ['push', 'plan', 'strength'],
  },
  {
    workout: WORKOUTS[1],
    creator: SOCIAL_CREATORS[5],
    caption: 'This pull day keeps rows and pulldowns tight so it works well when you want back work without a huge session.',
    stats: { completed: 4500, used: 9300, saved: 12100, remixed: 810 },
    audience: 'public' as const,
    createdAt: '2026-04-03T10:24:00.000Z',
    tags: ['pull', 'back', 'progress'],
    taggedUsers: [SOCIAL_CREATORS[1], SOCIAL_CREATORS[3]],
  },
  {
    workout: WORKOUTS[2],
    creator: SOCIAL_CREATORS[0],
    caption: 'Leg session with enough compound work to move the week forward and enough accessories to keep balance.',
    stats: { completed: 6900, used: 11200, saved: 16000, remixed: 1180 },
    audience: 'followers' as const,
    createdAt: '2026-03-27T14:18:00.000Z',
    tags: ['legs', 'plan', 'volume'],
  },
  {
    workout: WORKOUTS[6],
    creator: SOCIAL_CREATORS[2],
    caption: 'An upper-power option I like for weeks when I want fewer exercises, stronger sets, and clearer progression.',
    stats: { completed: 3400, used: 7600, saved: 9900, remixed: 670 },
    audience: 'public' as const,
    createdAt: '2026-03-31T19:04:00.000Z',
    tags: ['upper', 'strength', 'progress'],
  },
  {
    workout: WORKOUTS[4],
    creator: SOCIAL_CREATORS[1],
    caption: 'This one is built for a strong weekend reset: one main hinge, one press, one row, then just enough accessory work to leave the gym feeling finished instead of buried. It is the workout I use when I want structure without needing ninety minutes.',
    stats: { completed: 5200, used: 11700, saved: 15200, remixed: 980 },
    audience: 'public' as const,
    createdAt: '2026-04-04T13:52:00.000Z',
    tags: ['full-body', 'strength', 'weekend', 'explore'],
  },
]

export const DEFAULT_SOCIAL_POSTS: SocialPost[] = [
  ...recipePosts.map((entry, index) =>
    makePost({
      idSuffix: `meal-${entry.recipe.id}-${entry.creator.id}`,
      type: 'meal',
      user: entry.creator,
      image: entry.recipe.image_url || WORKOUT_IMAGES[index % WORKOUT_IMAGES.length],
      title: entry.recipe.name,
      caption: entry.caption,
      stats: entry.stats,
      createdAt: entry.createdAt,
      tags: entry.tags,
      taggedUsers: entry.taggedUsers,
      audience: entry.audience,
      creationMode: 'structured',
      mealData: createMealDataFromRecipe(entry.recipe),
    })
  ),
  ...workoutPosts.map((entry, index) =>
    makePost({
      idSuffix: `workout-${entry.workout.id}-${entry.creator.id}`,
      type: 'workout',
      user: entry.creator,
      image: WORKOUT_IMAGES[index % WORKOUT_IMAGES.length],
      title: entry.workout.name,
      caption: entry.caption,
      stats: entry.stats,
      createdAt: entry.createdAt,
      tags: entry.tags,
      taggedUsers: entry.taggedUsers,
      audience: entry.audience,
      creationMode: 'structured',
      workoutData: createWorkoutDataFromWorkout(entry.workout),
    })
  ),
]

export function buildSocialDraftFromSavedMeal(meal: SavedMealTemplate): SocialPostDraft {
  return {
    type: 'meal',
    title: meal.name,
    caption: '',
    tags: [meal.meal_type],
    audience: 'public',
    creationMode: 'structured',
    mealData: createMealDataFromSavedMeal(meal),
    linkedSource: {
      kind: 'saved_meal',
      id: meal.id,
      label: meal.name,
    },
  }
}

export function buildSocialDraftFromRecipe(recipe: Recipe): SocialPostDraft {
  return {
    type: 'meal',
    image: recipe.image_url,
    title: recipe.name,
    caption: '',
    tags: recipe.tags,
    audience: 'public',
    creationMode: 'structured',
    mealData: createMealDataFromRecipe(recipe),
    linkedSource: {
      kind: 'recipe',
      id: recipe.id,
      label: recipe.name,
    },
  }
}

export function buildSocialDraftFromWorkout(workout: Workout): SocialPostDraft {
  return {
    type: 'workout',
    title: workout.name,
    caption: '',
    tags: workout.muscle_groups.map((group) => group.replace(/_/g, ' ')),
    audience: 'public',
    creationMode: 'structured',
    workoutData: createWorkoutDataFromWorkout(workout),
    linkedSource: {
      kind: 'workout',
      id: workout.id,
      label: workout.name,
    },
  }
}

export function buildSocialDraftFromMealLogEntry(meal: MealLogEntry, date?: string): SocialPostDraft {
  return {
    type: 'meal',
    title: meal.name,
    caption: '',
    tags: [meal.meal_type, 'calendar'],
    audience: 'public',
    creationMode: 'structured',
    mealData: createMealDataFromMealLogEntry(meal),
    linkedSource: {
      kind: 'day',
      id: meal.id,
      label: date ? `${meal.name} • ${format(new Date(date), 'MMM d')}` : meal.name,
    },
  }
}

export function buildSocialDraftFromWorkoutLog(log: WorkoutLog): SocialPostDraft {
  return {
    type: 'workout',
    title: log.workout.name,
    caption: '',
    tags: [...log.workout.muscle_groups.map((group) => group.replace(/_/g, ' ')), 'calendar'],
    audience: 'public',
    creationMode: 'structured',
    workoutData: createWorkoutDataFromWorkoutLog(log),
    linkedSource: {
      kind: 'day',
      id: log.id,
      label: `${log.workout.name} • ${format(new Date(log.date), 'MMM d')}`,
    },
  }
}

export function buildSocialDraftFromCalendarDay({
  date,
  meals,
  workoutLogs,
  supplements,
}: {
  date: string
  meals: MealLogEntry[]
  workoutLogs: WorkoutLog[]
  supplements: SupplementEntry[]
}): SocialPostDraft {
  const parsedDate = new Date(`${date}T12:00:00`)
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate

  return {
    type: 'day',
    title: `Day Snapshot • ${format(safeDate, 'MMM d')}`,
    caption: '',
    tags: ['plan', 'calendar'],
    audience: 'public',
    creationMode: 'structured',
    dayData: createDayData(date, meals, workoutLogs, supplements),
    linkedSource: {
      kind: 'day',
      id: date,
      label: format(safeDate, 'EEEE, MMM d'),
    },
  }
}

export function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${round1(value / 1_000_000)}M`
  if (value >= 1_000) return `${round1(value / 1_000)}K`
  return String(value)
}

export function getSocialPostBadge(post: SocialPost) {
  if (post.type === 'meal' && post.mealData?.instructions.length) return 'Recipe available'
  if (post.type === 'workout' && post.workoutData?.exercises.length) return 'Workout included'
  return null
}

export function getSocialPostPreview(post: SocialPost) {
  if (post.type === 'meal' && post.mealData) {
    return `${post.mealData.calories} cal • ${post.mealData.protein}g protein`
  }

  if (post.type === 'workout' && post.workoutData) {
    return `${post.workoutData.exercises.length} exercises • ${post.workoutData.duration} min`
  }

  if (post.type === 'day' && post.dayData) {
    const mealLabel = `${post.dayData.meals.length} meal${post.dayData.meals.length === 1 ? '' : 's'}`
    const workoutLabel = `${post.dayData.workouts.length} workout${post.dayData.workouts.length === 1 ? '' : 's'}`
    const supplementLabel = `${post.dayData.supplements.length} supplement${post.dayData.supplements.length === 1 ? '' : 's'}`
    return `${mealLabel} • ${workoutLabel} • ${supplementLabel}`
  }

  if (post.type === 'general') {
    return post.tags.slice(0, 2).join(' • ') || null
  }

  return null
}

export function matchesSocialFilter(post: SocialPost, filter: SocialFeedFilter) {
  if (filter === 'all') return true
  if (filter === 'meals') return post.type === 'meal'
  if (filter === 'workouts') return post.type === 'workout'
  if (filter === 'plans') return post.type === 'day' || post.tags.includes('plan')
  if (filter === 'progress') return post.tags.includes('progress')
  return true
}

export function matchesSocialSubFilter(post: SocialPost, subFilter: SocialSubFilter | null): boolean {
  if (!subFilter) return true

  const tags = post.tags.map((t) => t.toLowerCase())
  const focusTerms = (post.workoutData?.focus ?? []).map((f) => f.toLowerCase())
  const equipment = (post.workoutData?.equipment ?? []).map((e) => e.toLowerCase())

  // — Meal sub-filters —
  if (subFilter === 'high-protein') {
    if (post.mealData) return post.mealData.protein >= 25
    return tags.includes('high-protein')
  }
  if (subFilter === 'vegan') return tags.includes('vegan')
  if (subFilter === 'vegetarian') return tags.includes('vegetarian') || tags.includes('vegan')
  if (subFilter === 'gluten-free') return tags.includes('gluten-free') || tags.includes('gluten free')
  if (subFilter === 'low-carb') {
    if (post.mealData) return post.mealData.carbs <= 30
    return tags.includes('low-carb')
  }
  if (subFilter === 'low-calorie') {
    if (post.mealData) return post.mealData.calories <= 400
    return tags.includes('low-calorie')
  }
  if (subFilter === 'meal-prep') return tags.includes('meal-prep')
  if (subFilter === 'quick') return tags.includes('quick')

  // — Workout sub-filters —
  if (subFilter === 'push') {
    return tags.includes('push') || focusTerms.some((f) => ['chest', 'shoulders', 'triceps'].includes(f))
  }
  if (subFilter === 'pull') {
    return tags.includes('pull') || focusTerms.some((f) => ['back', 'biceps', 'lats'].includes(f))
  }
  if (subFilter === 'legs') {
    return tags.includes('legs') || focusTerms.some((f) => ['legs', 'quads', 'hamstrings', 'glutes', 'calves'].includes(f))
  }
  if (subFilter === 'upper') {
    return tags.includes('upper') || focusTerms.some((f) => ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'].includes(f))
  }
  if (subFilter === 'lower') {
    return tags.includes('lower') || focusTerms.some((f) => ['legs', 'quads', 'hamstrings', 'glutes', 'calves'].includes(f))
  }
  if (subFilter === 'full-body') return tags.includes('full-body') || focusTerms.includes('full body')
  if (subFilter === 'chest') return focusTerms.includes('chest') || tags.includes('chest')
  if (subFilter === 'back') return focusTerms.includes('back') || tags.includes('back')
  if (subFilter === 'at-home') {
    return tags.includes('home') || equipment.some((e) => ['bodyweight', 'none', 'home'].includes(e))
  }
  if (subFilter === 'beginner') return post.workoutData?.level === 'Beginner'
  if (subFilter === 'advanced') return post.workoutData?.level === 'Advanced'

  return true
}

export function sortSocialPosts(posts: SocialPost[], sort: SocialFeedSort) {
  return [...posts].sort((a, b) => {
    if (sort === 'new') return b.createdAt.localeCompare(a.createdAt)
    if (sort === 'most_completed') return b.stats.completed - a.stats.completed
    if (sort === 'most_saved') return b.stats.saved - a.stats.saved

    if (sort === 'trending') {
      const score = (post: SocialPost) =>
        (post.stats.used * 1.2) + (post.stats.saved * 0.9) + ((post.stats.remixed ?? 0) * 1.4) + (post.stats.completed * 1.1)
      return score(b) - score(a)
    }

    return b.stats.used - a.stats.used
  })
}

export function searchSocialPosts(posts: SocialPost[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return posts

  return posts.filter((post) => {
    const mealTerms = post.mealData?.ingredients.map((ingredient) => ingredient.name).join(' ') ?? ''
    const workoutTerms = post.workoutData?.exercises.map((exercise) => exercise.name).join(' ') ?? ''
    const dayMealTerms = post.dayData?.meals.map((meal) => meal.name).join(' ') ?? ''
    const dayWorkoutTerms = post.dayData?.workouts.flatMap((workout) => [workout.name, ...workout.exercises.map((exercise) => exercise.name)]).join(' ') ?? ''
    const daySupplementTerms = post.dayData?.supplements.map((supplement) => supplement.name).join(' ') ?? ''
    const searchText = [
      post.title,
      post.caption,
      post.user.username,
      post.user.name,
      post.tags.join(' '),
      (post.taggedUsers ?? []).map((person) => `${person.name} ${person.username}`).join(' '),
      mealTerms,
      workoutTerms,
      dayMealTerms,
      dayWorkoutTerms,
      daySupplementTerms,
    ].join(' ').toLowerCase()

    return searchText.includes(normalized)
  })
}

export function scaleMealData(mealData: MealData, servings: number): MealData {
  return {
    ...mealData,
    calories: Math.round(mealData.calories * servings),
    protein: round1(mealData.protein * servings),
    carbs: round1(mealData.carbs * servings),
    fat: round1(mealData.fat * servings),
    servings: round1(mealData.servings * servings),
    ingredients: mealData.ingredients.map((ingredient) => ({
      ...ingredient,
      amount: round1(ingredient.amount * servings),
    })),
  }
}

export function buildSavedMealFromPost(post: SocialPost, servingsMultiplier: number, title?: string): SavedMealTemplate {
  const mealData = post.mealData
  const scaled = mealData ? scaleMealData(mealData, servingsMultiplier) : null

  return {
    id: `social-meal-${post.id}-${Date.now()}`,
    name: title?.trim() || post.title,
    meal_type: 'lunch',
    macros: {
      calories: scaled?.calories ?? 0,
      protein_g: scaled?.protein ?? 0,
      carbs_g: scaled?.carbs ?? 0,
      fat_g: scaled?.fat ?? 0,
    },
    items: scaled?.ingredients.map((ingredient) => ({
      input: ingredient.name,
      matched_name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      macros: undefined,
    })) ?? [],
    updated_at: new Date().toISOString(),
    saved_from: {
      source: 'feed',
      label: post.title,
      post_id: post.id,
      username: post.user.username,
      saved_at: new Date().toISOString(),
    },
  }
}

export function buildRecipeFromPost(post: SocialPost, servingsMultiplier: number, title?: string): Recipe {
  const mealData = post.mealData ? scaleMealData(post.mealData, servingsMultiplier) : null

  return {
    id: `social-recipe-${post.id}-${Date.now()}`,
    name: title?.trim() || post.title,
    description: post.caption,
    meal_type: 'lunch',
    prep_time_min: 10,
    cook_time_min: 15,
    servings: mealData?.servings || 1,
    ingredients: mealData?.ingredients.map((ingredient, index) => ({
      id: `social-ingredient-${index}`,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      calories_per_unit: 0,
      macros: { protein_g: 0, carbs_g: 0, fat_g: 0 },
    })) ?? [],
    instructions: mealData?.instructions.length ? mealData.instructions : ['Build your own version from this post.'],
    macros: {
      calories: mealData?.calories ?? 0,
      protein_g: mealData?.protein ?? 0,
      carbs_g: mealData?.carbs ?? 0,
      fat_g: mealData?.fat ?? 0,
    },
    tags: post.tags,
    image_url: post.image,
    yield_quantity: mealData?.servings || 1,
    yield_unit: mealData?.serving_size || 'serving',
  }
}

function parseReps(reps: string) {
  const match = reps.match(/\d+/)
  return match ? Number(match[0]) : 10
}

function createWorkoutExerciseFromSocialExercise(exercise: SocialWorkoutExercise, keepWeights: boolean, autoAdjustWeights: boolean): WorkoutExercise {
  const baseWeight = keepWeights ? exercise.weight : undefined
  const adjustedWeight = typeof baseWeight === 'number' && autoAdjustWeights
    ? round1(baseWeight * 1.05)
    : baseWeight

  return {
    exercise: {
      id: `social-exercise-${slugify(exercise.name)}`,
      name: exercise.name,
      muscle_groups: ['full_body'],
      equipment: 'Mixed',
      difficulty: 'beginner',
      description: exercise.notes || exercise.name,
      instructions: ['Use the shared structure as your baseline and adjust to your own equipment or experience.'],
    },
    notes: exercise.notes,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      set_number: index + 1,
      reps: parseReps(exercise.reps),
      weight_kg: adjustedWeight,
      rest_seconds: exercise.rest ?? 75,
    })),
  }
}

export function buildWorkoutFromPost(
  post: SocialPost,
  options: {
    title?: string
    keepWeights: boolean
    autoAdjustWeights: boolean
    splitType: WorkoutSplit
    dayLabel?: string
    inspiredByUsername?: string
  }
): Workout {
  const workoutData = post.workoutData
  const exercises = workoutData?.exercises.map((exercise) =>
    createWorkoutExerciseFromSocialExercise(exercise, options.keepWeights, options.autoAdjustWeights)
  ) ?? []

  return {
    id: `social-workout-${post.id}-${Date.now()}`,
    name: options.title?.trim() || post.title,
    description: [
      post.caption,
      options.inspiredByUsername ? `Inspired by @${options.inspiredByUsername}.` : null,
    ].filter(Boolean).join(' '),
    day_label: options.dayLabel || 'Social Save',
    muscle_groups: ['full_body'],
    exercises,
    estimated_duration_min: workoutData?.duration || 45,
    difficulty: workoutData?.level === 'Advanced' ? 'advanced' : workoutData?.level === 'Intermediate' ? 'intermediate' : 'beginner',
    split_type: options.splitType,
    source: 'custom',
    updated_at: new Date().toISOString(),
    saved_from: {
      source: 'feed',
      label: post.title,
      post_id: post.id,
      username: post.user.username,
      saved_at: new Date().toISOString(),
    },
  }
}

export function createSocialPostFromDraft(draft: SocialPostDraft, user: SocialPostUser): SocialPost {
  const image = draft.image?.trim()

  return {
    id: `social-user-${Date.now()}`,
    type: draft.type,
    user,
    image: image || undefined,
    media: draft.media,
    title: draft.title,
    caption: draft.caption,
    stats: { used: 0, completed: 0, saved: 0, likes: 0, comments: 0, remixed: 0 },
    createdAt: new Date().toISOString(),
    tags: draft.tags,
    taggedUsers: draft.taggedUsers,
    audience: draft.audience,
    creationMode: draft.creationMode,
    mealData: draft.mealData,
    workoutData: draft.workoutData,
    dayData: draft.dayData,
  }
}

export function buildSocialDraftFromPost(post: SocialPost): SocialPostDraft {
  return {
    type: post.type,
    image: post.image,
    media: post.media,
    title: post.title,
    caption: post.caption,
    tags: post.tags,
    taggedUsers: post.taggedUsers,
    audience: post.audience,
    creationMode: post.creationMode,
    mealData: post.mealData,
    workoutData: post.workoutData,
    dayData: post.dayData,
  }
}

export function getDefaultExplorePosts() {
  return DEFAULT_SOCIAL_POSTS.filter((post) => post.audience === 'public')
}

export function getSocialCreatorByUsername(username: string) {
  return SOCIAL_CREATORS.find((creator) => creator.username.toLowerCase() === username.toLowerCase()) ?? null
}

export function getSocialCreatorById(id: string) {
  return SOCIAL_CREATORS.find((creator) => creator.id === id) ?? null
}

export function getSocialCreators() {
  return SOCIAL_CREATORS
}
