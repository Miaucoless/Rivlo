import { eachDayOfInterval, format, subDays } from 'date-fns'
import type { MealLogEntry } from '@/lib/content-library'
import type {
  JournalEntry,
  NotificationPreferences,
  SupplementEntry,
  UserProfile,
  WaterEntry,
  WeeklyInsight,
  WeeklyRecapShareData,
  WeeklyRecommendation,
  WeeklyRecoveryAction,
  WeeklyReview,
  WeeklyReviewDay,
  WeeklyReviewStatus,
  WeeklyWeightTrend,
  WeightEntry,
  WorkoutLog,
} from '@/types'

const DEFAULT_REVIEW_DAYS = 7

export type WeeklyReviewInput = {
  user: UserProfile
  workoutLogs: WorkoutLog[]
  mealEntries: Record<string, MealLogEntry[]>
  waterLogs: Record<string, WaterEntry[]>
  weightHistory: WeightEntry[]
  journalEntries: JournalEntry[]
  supplements: SupplementEntry[]
  notificationPreferences?: NotificationPreferences
}

export type BuildWeeklyReviewOptions = {
  endDate?: string
  days?: number
}

function parseDateOnly(value: string) {
  return new Date(`${value}T12:00:00`)
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return clamp(Math.round((value / total) * 100), 0, 100)
}

function average(values: number[]) {
  if (values.length === 0) return undefined
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function inferTargetWorkoutDays(user: UserProfile) {
  if (user.preferred_workout_days?.length) {
    return clamp(user.preferred_workout_days.length, 1, 7)
  }

  switch (user.workout_split) {
    case '3day_fullbody':
      return 3
    case 'upper_lower':
    case '4day':
      return 4
    case '5day':
      return 5
    case '6day':
      return 6
    case 'cardio_focus':
      return 4
    case 'ppl':
    default:
      return 5
  }
}

function getWeightTrend(weightDeltaKg?: number): WeeklyWeightTrend {
  if (typeof weightDeltaKg !== 'number') return 'insufficient_data'
  if (Math.abs(weightDeltaKg) < 0.25) return 'flat'
  return weightDeltaKg < 0 ? 'down' : 'up'
}

function isWeightTrendAlignedWithGoal(goal: UserProfile['fitness_goal'], trend: WeeklyWeightTrend) {
  if (trend === 'insufficient_data') return true

  switch (goal) {
    case 'fat_loss':
      return trend === 'down' || trend === 'flat'
    case 'muscle_gain':
      return trend === 'up' || trend === 'flat'
    case 'maintenance':
      return trend === 'flat'
    case 'athletic_performance':
      return trend !== 'down'
    default:
      return true
  }
}

function getStatus(consistencyScore: number): WeeklyReviewStatus {
  if (consistencyScore >= 80) return 'winning'
  if (consistencyScore >= 60) return 'steady'
  return 'needs_attention'
}

function getReviewDates(endDate: string, days: number) {
  const end = parseDateOnly(endDate)
  const start = subDays(end, days - 1)
  return eachDayOfInterval({ start, end }).map((date) => format(date, 'yyyy-MM-dd'))
}

function buildDailyReview(input: WeeklyReviewInput, dates: string[]) {
  return dates.map<WeeklyReviewDay>((date) => {
    const workouts = input.workoutLogs.filter((log) => log.date === date)
    const meals = input.mealEntries[date] || []
    const waterEntries = input.waterLogs[date] || []
    const journalEntries = input.journalEntries.filter((entry) => entry.date === date)
    const supplementsTaken = input.supplements.reduce((count, supplement) => {
      return count + (supplement.taken_dates.includes(date) ? 1 : 0)
    }, 0)
    const weightEntry = input.weightHistory.find((entry) => entry.date === date)

    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein_g: acc.protein_g + meal.macros.protein_g,
        carbs_g: acc.carbs_g + meal.macros.carbs_g,
        fat_g: acc.fat_g + meal.macros.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )

    const latestJournal = [...journalEntries].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    const waterMl = waterEntries.reduce((sum, entry) => sum + entry.amount_ml, 0)

    return {
      date,
      workouts_completed: workouts.length,
      meals_logged: meals.length,
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      water_ml: waterMl,
      protein_hit: totals.protein_g >= input.user.protein_target_g,
      hydration_hit: waterMl >= input.user.water_goal_ml,
      journal_entries: journalEntries.length,
      supplements_taken: supplementsTaken,
      mood: latestJournal?.mood,
      energy: latestJournal?.energy,
      weight_kg: weightEntry?.weight_kg,
    }
  })
}

function buildInsights(review: WeeklyReview, input: WeeklyReviewInput) {
  const wins: WeeklyInsight[] = []
  const focusAreas: WeeklyInsight[] = []
  const { summary } = review
  const totalDays = review.days.length

  if (summary.workout_completion_rate_pct >= 90) {
    wins.push({
      id: 'win-workouts',
      type: 'win',
      area: 'workouts',
      tone: 'success',
      title: 'Training stayed on schedule',
      detail: `You completed ${summary.workouts_completed} of ${summary.target_workout_days} planned workout days.`,
      metric_label: 'Workout completion',
      metric_value: `${summary.workout_completion_rate_pct}%`,
    })
  }

  if (summary.protein_hit_days >= Math.ceil(totalDays * 0.7)) {
    wins.push({
      id: 'win-protein',
      type: 'win',
      area: 'nutrition',
      tone: 'success',
      title: 'Protein consistency held up',
      detail: `You hit your protein goal on ${summary.protein_hit_days} of ${totalDays} days.`,
      metric_label: 'Protein-hit days',
      metric_value: `${summary.protein_hit_days}/${totalDays}`,
    })
  }

  if (summary.hydration_hit_days >= Math.ceil(totalDays * 0.7)) {
    wins.push({
      id: 'win-hydration',
      type: 'win',
      area: 'hydration',
      tone: 'success',
      title: 'Hydration backed up the plan',
      detail: `You hit your water goal on ${summary.hydration_hit_days} of ${totalDays} days.`,
      metric_label: 'Hydration-hit days',
      metric_value: `${summary.hydration_hit_days}/${totalDays}`,
    })
  }

  if (
    typeof summary.average_energy === 'number' &&
    typeof summary.average_mood === 'number' &&
    summary.average_energy >= 4 &&
    summary.average_mood >= 4
  ) {
    wins.push({
      id: 'win-recovery',
      type: 'win',
      area: 'recovery',
      tone: 'success',
      title: 'Recovery markers looked strong',
      detail: `Mood averaged ${summary.average_mood}/5 and energy averaged ${summary.average_energy}/5.`,
      metric_label: 'Mood / energy',
      metric_value: `${summary.average_mood}/${summary.average_energy}`,
    })
  }

  if (summary.workout_completion_rate_pct < 70) {
    focusAreas.push({
      id: 'focus-workouts',
      type: 'focus',
      area: 'workouts',
      tone: 'warning',
      title: 'The workout schedule needs to flex more',
      detail: `You completed ${summary.workouts_completed} of ${summary.target_workout_days} planned days, so next week should be built around the days you actually make it in.`,
      metric_label: 'Workout completion',
      metric_value: `${summary.workout_completion_rate_pct}%`,
    })
  }

  if (summary.protein_hit_rate_pct < 60) {
    focusAreas.push({
      id: 'focus-protein',
      type: 'focus',
      area: 'nutrition',
      tone: 'warning',
      title: 'Protein is the easiest nutrition lever to tighten',
      detail: `You hit your protein target on ${summary.protein_hit_days} of ${totalDays} days. Adding one reliable high-protein meal will move the whole week.`,
      metric_label: 'Protein-hit days',
      metric_value: `${summary.protein_hit_days}/${totalDays}`,
    })
  }

  if (summary.hydration_hit_rate_pct < 60) {
    focusAreas.push({
      id: 'focus-hydration',
      type: 'focus',
      area: 'hydration',
      tone: 'warning',
      title: 'Hydration slipped more than training',
      detail: `Water goals were met on ${summary.hydration_hit_days} of ${totalDays} days, which can drag down energy and consistency.`,
      metric_label: 'Hydration-hit days',
      metric_value: `${summary.hydration_hit_days}/${totalDays}`,
    })
  }

  if (
    !isWeightTrendAlignedWithGoal(input.user.fitness_goal, summary.weight_trend) &&
    summary.weight_trend !== 'insufficient_data'
  ) {
    focusAreas.push({
      id: 'focus-weight-trend',
      type: 'focus',
      area: 'weight_trend',
      tone: 'neutral',
      title: 'Scale trend and goal are drifting apart',
      detail: `Your weight moved ${summary.weight_trend} this week, so next week should tighten the parts of the plan that most affect your goal.`,
      metric_label: 'Weight change',
      metric_value: `${summary.weight_delta_kg ?? 0} kg`,
    })
  }

  if (
    typeof summary.average_energy === 'number' &&
    summary.average_energy <= 2.5 &&
    summary.workouts_completed >= Math.max(2, summary.target_workout_days - 1)
  ) {
    focusAreas.push({
      id: 'focus-recovery',
      type: 'focus',
      area: 'recovery',
      tone: 'warning',
      title: 'You kept showing up, but recovery looked strained',
      detail: `Energy averaged ${summary.average_energy}/5 while training stayed fairly consistent. Next week should keep the habit but lower the grind.`,
      metric_label: 'Average energy',
      metric_value: `${summary.average_energy}/5`,
    })
  }

  if (summary.meal_logging_rate_pct < 50) {
    focusAreas.push({
      id: 'focus-mindset',
      type: 'focus',
      area: 'mindset',
      tone: 'neutral',
      title: 'Logging needs a lower-friction version',
      detail: 'The data suggests the week got busy. A simpler meal structure and fewer manual decisions will make consistency easier.',
      metric_label: 'Meal logging',
      metric_value: `${summary.meal_logging_rate_pct}%`,
    })
  }

  return { wins: wins.slice(0, 3), focusAreas: focusAreas.slice(0, 3) }
}

function buildRecommendation(review: WeeklyReview, input: WeeklyReviewInput): WeeklyRecommendation {
  const { summary } = review

  if (
    typeof summary.average_energy === 'number' &&
    summary.average_energy <= 2.5 &&
    summary.workouts_completed >= Math.max(2, summary.target_workout_days - 1)
  ) {
    return {
      area: 'recovery',
      title: 'Keep the routine, reduce the strain',
      detail: 'Stay on your normal workout days next week, but trim one session or reduce volume by about 10 to 15 percent so energy can rebound.',
      reason: `Energy averaged ${summary.average_energy}/5 even though you mostly kept up with training.`,
      confidence: 'high',
    }
  }

  if (summary.workout_completion_rate_pct < 70) {
    return {
      area: 'workouts',
      title: 'Rebuild next week around the days you actually train',
      detail: 'Shift the remaining training load onto your most realistic days instead of trying to force the original schedule.',
      reason: `You completed ${summary.workouts_completed} of ${summary.target_workout_days} planned workout days.`,
      confidence: 'high',
    }
  }

  if (summary.protein_hit_rate_pct < 60) {
    return {
      area: 'nutrition',
      title: 'Lock in one repeatable protein anchor meal',
      detail: 'Add a breakfast or snack that guarantees 25 to 35 grams of protein so the week does not depend on perfect dinners.',
      reason: `Protein goals were hit on only ${summary.protein_hit_days} of ${review.days.length} days.`,
      confidence: 'high',
    }
  }

  if (summary.hydration_hit_rate_pct < 60) {
    return {
      area: 'hydration',
      title: 'Lower the friction around water intake',
      detail: 'Use one larger bottle and two default refill times next week so hydration becomes automatic instead of reactive.',
      reason: `Hydration goals were met on only ${summary.hydration_hit_days} of ${review.days.length} days.`,
      confidence: 'high',
    }
  }

  if (
    !isWeightTrendAlignedWithGoal(input.user.fitness_goal, summary.weight_trend) &&
    summary.weight_trend !== 'insufficient_data'
  ) {
    return {
      area: 'weight_trend',
      title: 'Make a small goal-aligned adjustment',
      detail: input.user.fitness_goal === 'fat_loss'
        ? 'Tighten the highest-calorie meals and keep protein high before changing your whole plan.'
        : input.user.fitness_goal === 'muscle_gain'
        ? 'Add a modest calorie bump on training days and keep protein consistent.'
        : 'Hold a steadier intake and training rhythm for one more week before making bigger changes.',
      reason: `Your weight trend moved ${summary.weight_trend} while your goal is ${input.user.fitness_goal.replace('_', ' ')}.`,
      confidence: 'medium',
    }
  }

  return {
    area: 'mindset',
    title: 'Keep the plan steady and repeat what worked',
    detail: 'Your data looks stable enough that the best move is to stay consistent and avoid making unnecessary changes next week.',
    reason: `Consistency landed at ${summary.consistency_score}%, with no major warning signals.`,
    confidence: 'medium',
  }
}

function buildRecoveryActions(review: WeeklyReview, input: WeeklyReviewInput) {
  const actions: WeeklyRecoveryAction[] = []
  const { summary } = review
  const notificationPreferences = input.notificationPreferences ?? input.user.notification_preferences

  if (summary.workouts_completed < summary.target_workout_days) {
    actions.push({
      id: 'recovery-shift-workouts',
      type: 'shift_workouts',
      priority: 'high',
      title: 'Shift the remaining workouts onto realistic days',
      description: 'Rebuild next week around the days you usually follow through, even if it means doing fewer total sessions.',
      reason: `There was a shortfall of ${summary.target_workout_days - summary.workouts_completed} workout day(s) this week.`,
      cta_label: 'Rebuild workout week',
      metadata: {
        suggested_days: input.user.preferred_workout_days ?? [],
        workouts_to_place: summary.target_workout_days - summary.workouts_completed,
      },
    })
  }

  if (summary.protein_hit_days < Math.ceil(review.days.length * 0.7) || summary.meal_logging_days < Math.ceil(review.days.length * 0.6)) {
    actions.push({
      id: 'recovery-simplify-meals',
      type: 'simplify_meals',
      priority: 'high',
      title: 'Simplify the next 3 days of meals',
      description: 'Use a shorter, more repeatable meal plan with fewer decisions so protein and calories stop depending on motivation.',
      reason: `Protein-hit days were ${summary.protein_hit_days}/${review.days.length} and meal logging landed at ${summary.meal_logging_rate_pct}%.`,
      cta_label: 'Create a 3-day reset',
      metadata: {
        days: 3,
        focus: 'protein_first',
      },
    })
  }

  if (
    summary.hydration_hit_days < Math.ceil(review.days.length * 0.5) ||
    (typeof summary.average_energy === 'number' && summary.average_energy <= 3)
  ) {
    actions.push({
      id: 'recovery-lighter-targets',
      type: 'lighter_targets',
      priority: 'medium',
      title: 'Use lighter recovery targets until the weekend',
      description: 'Keep the basics non-negotiable, but lower the strain by focusing on hydration, one workout, and simpler meals first.',
      reason: typeof summary.average_energy === 'number'
        ? `Energy averaged ${summary.average_energy}/5 and hydration goals were met on ${summary.hydration_hit_days}/${review.days.length} days.`
        : `Hydration goals were met on only ${summary.hydration_hit_days}/${review.days.length} days.`,
      cta_label: 'Start lighter week',
      metadata: {
        focus_hydration: true,
        focus_protein: true,
      },
    })
  }

  const reminderTypes: string[] = []
  if (summary.workout_completion_rate_pct < 70 && notificationPreferences?.daily_workout_reminder === false) {
    reminderTypes.push('daily_workout_reminder')
  }
  if (summary.meal_logging_rate_pct < 60 && notificationPreferences?.meal_logging_reminder === false) {
    reminderTypes.push('meal_logging_reminder')
  }
  if (review.status === 'needs_attention' && notificationPreferences?.weekly_progress_summary === false) {
    reminderTypes.push('weekly_progress_summary')
  }

  if (reminderTypes.length > 0) {
    actions.push({
      id: 'recovery-focused-reminders',
      type: 'focused_reminders',
      priority: 'medium',
      title: 'Turn on reminders that match the weak spots',
      description: 'Only enable the reminders that support the habits that slipped, so nudges feel useful instead of noisy.',
      reason: 'The week suggests you would benefit more from targeted prompts than from stricter goals.',
      cta_label: 'Turn on focused reminders',
      metadata: {
        reminder_types: reminderTypes,
      },
    })
  }

  return actions.slice(0, 3)
}

export function buildWeeklyReview(input: WeeklyReviewInput, options: BuildWeeklyReviewOptions = {}): WeeklyReview {
  const days = Math.max(3, options.days ?? DEFAULT_REVIEW_DAYS)
  const rangeEnd = options.endDate ?? format(new Date(), 'yyyy-MM-dd')
  const dates = getReviewDates(rangeEnd, days)
  const rangeStart = dates[0]
  const targetWorkoutDays = inferTargetWorkoutDays(input.user)
  const daily = buildDailyReview(input, dates)

  const daysTracked = daily.filter((day) => {
    return day.workouts_completed > 0 ||
      day.meals_logged > 0 ||
      day.water_ml > 0 ||
      day.journal_entries > 0 ||
      day.supplements_taken > 0 ||
      typeof day.weight_kg === 'number'
  }).length

  const workoutsCompleted = daily.reduce((sum, day) => sum + day.workouts_completed, 0)
  const mealLoggingDays = daily.filter((day) => day.meals_logged > 0).length
  const proteinHitDays = daily.filter((day) => day.protein_hit).length
  const hydrationHitDays = daily.filter((day) => day.hydration_hit).length
  const journalDays = daily.filter((day) => day.journal_entries > 0).length
  const supplementLoggedDays = daily.filter((day) => day.supplements_taken > 0).length
  const averageCalories = average(daily.filter((day) => day.calories > 0).map((day) => day.calories)) ?? 0
  const averageProteinG = average(daily.filter((day) => day.protein_g > 0).map((day) => day.protein_g)) ?? 0
  const averageMood = average(daily.flatMap((day) => typeof day.mood === 'number' ? [day.mood] : []))
  const averageEnergy = average(daily.flatMap((day) => typeof day.energy === 'number' ? [day.energy] : []))

  const weeklyWeightEntries = input.weightHistory
    .filter((entry) => entry.date >= rangeStart && entry.date <= rangeEnd)
    .sort((a, b) => a.date.localeCompare(b.date))
  const weightDeltaKg = weeklyWeightEntries.length >= 2
    ? round1(weeklyWeightEntries[weeklyWeightEntries.length - 1].weight_kg - weeklyWeightEntries[0].weight_kg)
    : undefined
  const weightTrend = getWeightTrend(weightDeltaKg)

  const workoutCompletionRate = percentage(workoutsCompleted, targetWorkoutDays)
  const proteinHitRate = percentage(proteinHitDays, days)
  const hydrationHitRate = percentage(hydrationHitDays, days)
  const mealLoggingRate = percentage(mealLoggingDays, days)
  const journalRate = percentage(journalDays, days)
  const consistencyScore = Math.round(
    (workoutCompletionRate * 0.3) +
    (proteinHitRate * 0.25) +
    (hydrationHitRate * 0.2) +
    (mealLoggingRate * 0.15) +
    (journalRate * 0.1)
  )

  const reviewBase: WeeklyReview = {
    range_start: rangeStart,
    range_end: rangeEnd,
    week_label: `${format(parseDateOnly(rangeStart), 'MMM d')} - ${format(parseDateOnly(rangeEnd), 'MMM d')}`,
    generated_at: new Date().toISOString(),
    status: getStatus(consistencyScore),
    summary: {
      days_tracked: daysTracked,
      workouts_completed: workoutsCompleted,
      target_workout_days: targetWorkoutDays,
      meal_logging_days: mealLoggingDays,
      protein_hit_days: proteinHitDays,
      hydration_hit_days: hydrationHitDays,
      journal_days: journalDays,
      supplement_logged_days: supplementLoggedDays,
      workout_completion_rate_pct: workoutCompletionRate,
      protein_hit_rate_pct: proteinHitRate,
      hydration_hit_rate_pct: hydrationHitRate,
      meal_logging_rate_pct: mealLoggingRate,
      average_calories: averageCalories,
      average_protein_g: averageProteinG,
      average_mood: averageMood,
      average_energy: averageEnergy,
      consistency_score: consistencyScore,
      weight_delta_kg: weightDeltaKg,
      weight_trend: weightTrend,
    },
    days: daily,
    wins: [],
    focus_areas: [],
    recommendation: {
      area: 'mindset',
      title: '',
      detail: '',
      reason: '',
      confidence: 'medium',
    },
    recovery_actions: [],
  }

  const { wins, focusAreas } = buildInsights(reviewBase, input)
  const review: WeeklyReview = {
    ...reviewBase,
    wins,
    focus_areas: focusAreas,
    recommendation: buildRecommendation(reviewBase, input),
  }

  return {
    ...review,
    recovery_actions: buildRecoveryActions(review, input),
  }
}

export function getWeeklySharePayload(review: WeeklyReview): WeeklyRecapShareData {
  const statusHeadline = review.status === 'winning'
    ? 'Winning week'
    : review.status === 'steady'
    ? 'Solid reset week'
    : 'Reset week in progress'

  const highlight = review.wins[0]?.detail
    ?? review.focus_areas[0]?.detail
    ?? review.recommendation.reason

  return {
    week_label: review.week_label,
    status: review.status,
    headline: `${statusHeadline}: ${review.summary.workouts_completed}/${review.summary.target_workout_days} workouts, ${review.summary.protein_hit_days}/${review.days.length} protein days`,
    workouts_completed: review.summary.workouts_completed,
    target_workout_days: review.summary.target_workout_days,
    protein_hit_days: review.summary.protein_hit_days,
    hydration_hit_days: review.summary.hydration_hit_days,
    consistency_score: review.summary.consistency_score,
    weight_delta_kg: review.summary.weight_delta_kg,
    highlight,
    recommendation: review.recommendation.detail,
  }
}
