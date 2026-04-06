import type { MuscleGroup, WorkoutLog, JournalEntry } from '@/types'

export type SuggestionType =
  | 'increase'
  | 'streak'
  | 'decrease'
  | 'pr'
  | 'absence'
  | 'plateau'
  | 'low_energy'

export interface ProgressionSuggestion {
  type: SuggestionType
  text: string
  suggestedWeight_kg?: number
}

export interface SuggestionInput {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>
}

const UPPER_BODY: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']
const LOWER_BODY: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves']
const COMPOUND_MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings']

/** Returns weight increment in kg for the given muscle groups. */
export function getWeightIncrement(muscleGroups: MuscleGroup[]): number {
  if (muscleGroups.some((mg) => UPPER_BODY.includes(mg))) return 2.5
  if (muscleGroups.some((mg) => LOWER_BODY.includes(mg))) return 5
  return 5
}

/** Rounds a weight to the nearest 2.5 kg. */
function roundTo2_5(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

/** Returns the best set (highest actual_reps, then highest weight, then lowest set_number). */
function getBestSet(
  sets: Array<{ set_number: number; actual_reps: number; weight_kg: number }>
): { actual_reps: number; weight_kg: number } | null {
  const valid = sets.filter((s) => typeof s.actual_reps === 'number' && typeof s.weight_kg === 'number')
  if (valid.length === 0) return null
  return valid.reduce((best, s) => {
    if (s.actual_reps > best.actual_reps) return s
    if (s.actual_reps === best.actual_reps && s.weight_kg > best.weight_kg) return s
    if (s.actual_reps === best.actual_reps && s.weight_kg === best.weight_kg && s.set_number < best.set_number) return s
    return best
  })
}

/** Returns all log entries for this exercise, sorted newest-first. */
function getExerciseLogs(exerciseId: string, workoutLogs: WorkoutLog[]) {
  const relevant: Array<{
    date: string
    sets: Array<{ set_number: number; actual_reps: number; weight_kg: number }>
  }> = []

  for (const log of [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date))) {
    const exEntry = log.exercises.find((ex) => ex.exercise_id === exerciseId)
    if (!exEntry) continue
    const validSets = exEntry.sets.filter(
      (s) => typeof s.actual_reps === 'number' && typeof s.weight_kg === 'number'
    )
    if (validSets.length > 0) {
      relevant.push({ date: log.date, sets: validSets as Array<{ set_number: number; actual_reps: number; weight_kg: number }> })
    }
  }

  return relevant
}

/** Returns the highest-priority suggestion for this exercise, or null if nothing to show. */
export function getProgressionSuggestion(input: SuggestionInput): ProgressionSuggestion | null {
  const { exerciseId, muscleGroups, workoutLogs, journalEntries, completedSetsThisSession } = input
  const logs = getExerciseLogs(exerciseId, workoutLogs)
  const increment = getWeightIncrement(muscleGroups)

  // ── Priority 1: Personal Record (fires mid-session after a set is completed)
  if (completedSetsThisSession && completedSetsThisSession.length > 0) {
    const sessionBest = completedSetsThisSession.reduce((best, s) =>
      s.actual_reps > best.actual_reps ? s : (s.actual_reps === best.actual_reps && s.weight_kg > best.weight_kg ? s : best)
    )
    const allTimeBest = logs.flatMap((l) => l.sets).reduce<{ actual_reps: number; weight_kg: number } | null>((best, s) => {
      if (!best) return s
      if (s.actual_reps > best.actual_reps) return s
      if (s.actual_reps === best.actual_reps && s.weight_kg > best.weight_kg) return s
      return best
    }, null)
    if (!allTimeBest || sessionBest.actual_reps > allTimeBest.actual_reps ||
      (sessionBest.actual_reps === allTimeBest.actual_reps && sessionBest.weight_kg > allTimeBest.weight_kg)) {
      return { type: 'pr', text: 'New PR — best set ever for this exercise' }
    }
  }

  if (logs.length === 0) return null

  const lastLog = logs[0]
  const lastBest = getBestSet(lastLog.sets)
  if (!lastBest) return null

  const lastWeight = lastBest.weight_kg

  // ── Priority 2: Consecutive Streak (≥10 reps in 2 consecutive sessions)
  if (logs.length >= 2) {
    const prevBest = getBestSet(logs[1].sets)
    if (lastBest.actual_reps >= 10 && prevBest && prevBest.actual_reps >= 10) {
      const suggested = roundTo2_5(lastWeight + increment)
      return {
        type: 'streak',
        text: `10+ reps two sessions running — ready for ${suggested} kg`,
        suggestedWeight_kg: suggested,
      }
    }
  }

  // ── Priority 3: Increase Weight (≥10 reps last session)
  if (lastBest.actual_reps >= 10) {
    const suggested = roundTo2_5(lastWeight + increment)
    return {
      type: 'increase',
      text: `Hit ${lastBest.actual_reps} reps last time — try ${suggested} kg × 8`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Priority 4: Long Absence (21+ days since last logged)
  const today = new Date()
  const lastDate = new Date(lastLog.date)
  const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince >= 21) {
    const suggested = roundTo2_5(lastWeight * 0.9)
    const weeks = Math.floor(daysSince / 7)
    return {
      type: 'absence',
      text: `First time logging this in ${weeks} week${weeks !== 1 ? 's' : ''} — consider ${suggested} kg to ease back in`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Priority 5: Plateau Warning (same weight AND same best reps across 4+ sessions)
  if (logs.length >= 4) {
    const recentFour = logs.slice(0, 4)
    const allSameWeight = recentFour.every((l) => getBestSet(l.sets)?.weight_kg === lastWeight)
    const allSameReps = recentFour.every((l) => getBestSet(l.sets)?.actual_reps === lastBest.actual_reps)
    if (allSameWeight && allSameReps) {
      return {
        type: 'plateau',
        text: `Same weight, same reps for 4 sessions — try a deload or swap to a variation`,
      }
    }
  }

  // ── Priority 6: Decrease Weight (≤5 reps last session)
  if (lastBest.actual_reps <= 5) {
    const suggested = roundTo2_5(Math.max(0, lastWeight - increment))
    return {
      type: 'decrease',
      text: `Only hit ${lastBest.actual_reps} reps last time — try ${suggested} kg to reach 8`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Priority 7: Low Energy (journal energy ≤2 today AND compound lift)
  const isCompound = muscleGroups.some((mg) => COMPOUND_MUSCLE_GROUPS.includes(mg))
  if (isCompound && journalEntries && journalEntries.length > 0) {
    const todayISO = new Date().toISOString().slice(0, 10)
    const todayEntry = journalEntries.find((e) => e.date === todayISO)
    if (todayEntry && todayEntry.energy <= 2) {
      return { type: 'low_energy', text: 'Energy logged as low today — no pressure to hit a new weight' }
    }
  }

  // ── Priority 8: No suggestion (6–9 reps, in target range)
  return null
}

/** Returns a string signature used to detect whether a suggestion has changed since last dismissed. */
export function getSuggestionSignature(exerciseId: string, workoutLogs: WorkoutLog[]): string | null {
  const logs = getExerciseLogs(exerciseId, workoutLogs)
  if (logs.length === 0) return null

  const lastLog = logs[0]
  const lastBest = getBestSet(lastLog.sets)
  if (!lastBest) return null

  // Compute consecutive streak count
  let streak = 0
  for (const log of logs) {
    const best = getBestSet(log.sets)
    if (best && best.actual_reps >= 10) streak++
    else break
  }

  return `${exerciseId}:${lastBest.weight_kg}:${lastBest.actual_reps}:${streak}`
}
