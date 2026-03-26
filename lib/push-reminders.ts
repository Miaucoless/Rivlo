import { format, startOfWeek } from 'date-fns'
import type { NotificationPreferences, SupplementEntry } from '@/types'

export type ReminderCandidate = {
  kind: string
  dedupeKey: string
  title: string
  body: string
  actionUrl: string
  smsBody?: string
}

export type ReminderContext = {
  firstName: string
  preferredWorkoutTime?: string | null
  notificationPreferences: NotificationPreferences
  todayIso: string
  currentWeekStart: string
  workoutLoggedToday: boolean
  mealsLoggedToday: number
  workoutsThisWeek: number
  mealDaysThisWeek: number
  supplementsDueToday: SupplementEntry[]
  goalTargetChangeKg: number | null
  achievedChangeKg: number | null
  latestWeightDate?: string | null
  weekday: number
}

export function getReminderDates(now = new Date()) {
  return {
    todayIso: format(now, 'yyyy-MM-dd'),
    currentWeekStart: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    weekday: now.getDay(),
  }
}

export function buildReminderCandidates(context: ReminderContext): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = []
  const workoutWindow = context.preferredWorkoutTime
    ? context.preferredWorkoutTime.replaceAll('_', ' ')
    : 'usual workout'

  if (context.notificationPreferences.daily_workout_reminder && !context.workoutLoggedToday) {
    candidates.push({
      kind: 'daily_workout_reminder',
      dedupeKey: context.todayIso,
      title: `Workout reminder for ${context.firstName}`,
      body: `You have not logged a workout yet today. Your ${workoutWindow} window is still open.`,
      actionUrl: '/dashboard/workouts',
      smsBody: `Rivora: You have not logged a workout yet today. Your ${workoutWindow} window is still open.`,
    })
  }

  if (context.notificationPreferences.meal_logging_reminder && context.mealsLoggedToday === 0) {
    candidates.push({
      kind: 'meal_logging_reminder',
      dedupeKey: context.todayIso,
      title: 'Meal log is still empty today',
      body: 'Add your meals to keep calories and macros accurate for the day.',
      actionUrl: '/dashboard/meals',
      smsBody: 'Rivora: Add your meals to keep calories and macros accurate for the day.',
    })
  }

  if (context.supplementsDueToday.length > 0) {
    const names = context.supplementsDueToday.map((item) => item.name)
    const body = names.length === 1
      ? `${names[0]} is due today. Open supplements to mark it taken.`
      : `${names.slice(0, 2).join(' and ')}${names.length > 2 ? `, plus ${names.length - 2} more` : ''} are due today.`

    candidates.push({
      kind: 'supplements_due',
      dedupeKey: context.todayIso,
      title: 'Supplement reminder',
      body,
      actionUrl: '/dashboard/supplements',
      smsBody: `Rivora: ${body}`,
    })
  }

  if (context.notificationPreferences.weekly_progress_summary && context.weekday === 1) {
    candidates.push({
      kind: 'weekly_progress_summary',
      dedupeKey: context.currentWeekStart,
      title: 'Weekly progress snapshot',
      body: `${context.workoutsThisWeek} workouts logged this week and meals tracked on ${context.mealDaysThisWeek} day${context.mealDaysThisWeek === 1 ? '' : 's'}.`,
      actionUrl: '/dashboard/tracking',
      smsBody: `Rivora weekly snapshot: ${context.workoutsThisWeek} workouts logged and meals tracked on ${context.mealDaysThisWeek} day${context.mealDaysThisWeek === 1 ? '' : 's'}.`,
    })
  }

  if (
    context.notificationPreferences.goal_milestone_alerts &&
    context.goalTargetChangeKg &&
    context.achievedChangeKg !== null &&
    context.goalTargetChangeKg > 0 &&
    context.achievedChangeKg / context.goalTargetChangeKg >= 0.75
  ) {
    candidates.push({
      kind: 'goal_progress_milestone',
      dedupeKey: context.latestWeightDate || context.todayIso,
      title: 'Goal milestone is getting close',
      body: `Based on your logged weigh-ins, you are about ${Math.round((context.achievedChangeKg / context.goalTargetChangeKg) * 100)}% of the way to your target change.`,
      actionUrl: '/dashboard/tracking',
      smsBody: `Rivora: You are about ${Math.round((context.achievedChangeKg / context.goalTargetChangeKg) * 100)}% of the way to your target change.`,
    })
  }

  return candidates
}
