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

// What day types are valid for each split
export const SPLIT_DAY_OPTIONS: Record<WorkoutSplit, SplitDayType[]> = {
  ppl: ['push', 'pull', 'legs', 'rest'],
  upper_lower: ['upper', 'lower', 'rest'],
  '3day_fullbody': ['full_body', 'rest'],
  '4day': ['chest', 'back', 'shoulders', 'legs', 'rest'],
  '5day': ['chest', 'back', 'shoulders', 'arms', 'legs', 'rest'],
  '6day': ['push', 'pull', 'legs', 'rest'],
  cardio_focus: ['cardio', 'rest'],
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

  if (label.includes('push') || (muscles.includes('chest') && muscles.includes('triceps'))) return 'push'
  if (label.includes('pull') || (muscles.includes('back') && muscles.includes('biceps'))) return 'pull'
  if (label.includes('leg') || muscles.includes('quads') || muscles.includes('hamstrings') || muscles.includes('glutes')) return 'legs'
  if (label.includes('upper') || (muscles.includes('chest') && muscles.includes('back'))) return 'upper'
  if (label.includes('lower')) return 'lower'
  if (label.includes('full') || label.includes('full body') || label.includes('total')) return 'full_body'
  if (label.includes('chest') || (muscles.includes('chest') && muscles.length <= 2)) return 'chest'
  if (label.includes('back') || (muscles.includes('back') && muscles.length <= 2)) return 'back'
  if (label.includes('shoulder') || (muscles.includes('shoulders') && muscles.length <= 2)) return 'shoulders'
  if (label.includes('arm') || (muscles.includes('biceps') && muscles.includes('triceps'))) return 'arms'
  if (label.includes('cardio') || muscles.includes('cardiovascular')) return 'cardio'
  return null
}

// Get workouts that match a given day type, sorted: saved first, then premade
export function getWorkoutsForDayType(
  dayType: SplitDayType,
  allWorkouts: Workout[],
): Workout[] {
  if (dayType === 'rest') return []
  return allWorkouts.filter((w) => getWorkoutDayType(w) === dayType)
}
