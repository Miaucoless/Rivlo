import type { SplitDayType, SplitSchedule, WeekDay, WorkoutSplit } from '@/types'
import type { Workout } from '@/types'

export const WEEK_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

export const SPLIT_DAY_LABELS: Record<SplitDayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  full_body: 'Full Body',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  cardio: 'Cardio',
  rest: 'Rest',
}

export const CUSTOM_SPLIT_DAY_OPTIONS: SplitDayType[] = [
  'push',
  'pull',
  'legs',
  'upper',
  'lower',
  'full_body',
  'chest',
  'back',
  'shoulders',
  'arms',
  'cardio',
  'rest',
]

// What day types are valid for each split
export const SPLIT_DAY_OPTIONS: Record<WorkoutSplit, SplitDayType[]> = {
  ppl: ['push', 'pull', 'legs', 'rest'],
  upper_lower: ['upper', 'lower', 'rest'],
  '3day_fullbody': ['full_body', 'rest'],
  '4day': ['chest', 'back', 'shoulders', 'legs', 'rest'],
  '5day': ['chest', 'back', 'shoulders', 'arms', 'legs', 'rest'],
  '6day': ['push', 'pull', 'legs', 'rest'],
  cardio_focus: ['cardio', 'rest'],
  custom: CUSTOM_SPLIT_DAY_OPTIONS,
}

// Build a default schedule for a split (common patterns)
export function buildDefaultSchedule(split: WorkoutSplit): SplitSchedule {
  switch (split) {
    case 'ppl':
      return { monday: 'push', tuesday: 'pull', wednesday: 'legs', thursday: 'rest', friday: 'push', saturday: 'pull', sunday: 'legs' }
    case 'upper_lower':
      return { monday: 'upper', tuesday: 'lower', wednesday: 'rest', thursday: 'upper', friday: 'lower', saturday: 'rest', sunday: 'rest' }
    case '3day_fullbody':
      return { monday: 'full_body', tuesday: 'rest', wednesday: 'full_body', thursday: 'rest', friday: 'full_body', saturday: 'rest', sunday: 'rest' }
    case '4day':
      return { monday: 'chest', tuesday: 'back', wednesday: 'rest', thursday: 'shoulders', friday: 'legs', saturday: 'rest', sunday: 'rest' }
    case '5day':
      return { monday: 'chest', tuesday: 'back', wednesday: 'shoulders', thursday: 'arms', friday: 'legs', saturday: 'rest', sunday: 'rest' }
    case '6day':
      return { monday: 'push', tuesday: 'pull', wednesday: 'legs', thursday: 'push', friday: 'pull', saturday: 'legs', sunday: 'rest' }
    case 'cardio_focus':
      return { monday: 'cardio', tuesday: 'rest', wednesday: 'cardio', thursday: 'cardio', friday: 'rest', saturday: 'cardio', sunday: 'rest' }
    case 'custom':
      return { monday: 'push', tuesday: 'pull', wednesday: 'legs', thursday: 'rest', friday: 'upper', saturday: 'cardio', sunday: 'rest' }
    default:
      return {}
  }
}

export function getTodayWeekDay(): WeekDay {
  const day = new Date().getDay() // 0 = Sunday
  const map: Record<number, WeekDay> = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  return map[day]
}

// Map workout day_label / muscle_groups to a SplitDayType
export function getWorkoutDayType(workout: Workout): SplitDayType | null {
  const label = workout.day_label?.toLowerCase() ?? ''
  const muscles = workout.muscle_groups.map((m) => m.toLowerCase())

  if (label.includes('push')) return 'push'
  if (label.includes('pull')) return 'pull'
  if (label.includes('leg')) return 'legs'
  if (label.includes('upper')) return 'upper'
  if (label.includes('lower')) return 'lower'
  if (label.includes('full') || label.includes('full body') || label.includes('total')) return 'full_body'
  if (label.includes('chest')) return 'chest'
  if (label.includes('back')) return 'back'
  if (label.includes('shoulder')) return 'shoulders'
  if (label.includes('arm')) return 'arms'
  if (label.includes('cardio')) return 'cardio'

  if (muscles.includes('chest') && muscles.includes('triceps')) return 'push'
  if (muscles.includes('back') && muscles.includes('biceps')) return 'pull'
  if (muscles.includes('quads') || muscles.includes('hamstrings') || muscles.includes('glutes')) return 'legs'
  if (muscles.includes('chest') && muscles.includes('back')) return 'upper'
  if (muscles.includes('chest') && muscles.length <= 2) return 'chest'
  if (muscles.includes('back') && muscles.length <= 2) return 'back'
  if (muscles.includes('shoulders') && muscles.length <= 2) return 'shoulders'
  if (muscles.includes('biceps') && muscles.includes('triceps')) return 'arms'
  if (muscles.includes('cardiovascular')) return 'cardio'
  return null
}

// Get workouts that match a given day type, sorted: saved first, then premade
export function getWorkoutsForDayType(
  dayType: SplitDayType,
  allWorkouts: Workout[],
): Workout[] {
  if (dayType === 'rest') return []
  const matched = allWorkouts.filter((w) => getWorkoutDayType(w) === dayType)
  const saved = matched.filter((workout) => workout.source !== 'premade')
  const premade = matched.filter((workout) => workout.source === 'premade')
  return [...saved, ...premade]
}
