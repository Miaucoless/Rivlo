import type { MuscleGroup, WorkoutLog, JournalEntry, ExercisePrimaryType, ExerciseModifier } from '@/types'

// ── Suggestion types ──────────────────────────────────────────────────────────

export type SuggestionType =
  | 'increase_load'
  | 'near_increase'
  | 'consolidate_performance'
  | 'top_set_only_increase'
  | 'hold_inconsistent_sets'
  | 'hold_recent_jump'
  | 'reduce_and_rebuild'
  | 'fatigue_management'
  | 'increase_volume'
  | 'improve_control'
  | 'microload_if_available'
  | 'reduce_assistance'
  | 'harder_variation'
  | 'pr'
  | 'absence'

export interface ProgressionSuggestion {
  type: SuggestionType
  text: string
  suggestedWeight_kg?: number
}

export interface SuggestionInput {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  equipment?: string
  primaryType?: ExercisePrimaryType
  modifiers?: ExerciseModifier[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>
  unitSystem?: 'imperial' | 'metric'
}

// ── Exercise classification ───────────────────────────────────────────────────

type ExerciseCategory = 'compound' | 'accessory' | 'machine' | 'bodyweight' | 'assisted_bodyweight'

const UPPER_BODY: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']
const LOWER_BODY: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves']
const COMPOUND_MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings']

/** Reps at or above this → ready to progress load. */
const TARGET_UPPER = 10
/** Reps at or below this → too heavy, needs to come down. */
const TARGET_LOWER = 5
/** Relative increment size above which a standard jump is considered too large (use microloading instead). */
const MICROLOAD_THRESHOLD = 0.05

function classifyExercise(input: SuggestionInput): ExerciseCategory {
  if (input.modifiers?.includes('assisted')) return 'assisted_bodyweight'
  if (input.primaryType === 'bodyweight') return 'bodyweight'
  const eq = (input.equipment ?? '').toLowerCase().trim()
  if (eq === 'bodyweight') return 'bodyweight'
  if (eq === 'machine' || eq.includes('machine') || eq === 'smith machine') return 'machine'
  const isCompound = COMPOUND_MUSCLE_GROUPS.some((mg) => input.muscleGroups.includes(mg))
  return isCompound ? 'compound' : 'accessory'
}

// ── Weight helpers ────────────────────────────────────────────────────────────

/** Returns the standard weight increment in kg for the given muscle groups and unit system. */
export function getWeightIncrement(muscleGroups: MuscleGroup[], unitSystem?: 'imperial' | 'metric'): number {
  if (unitSystem === 'imperial') {
    const lbIncrement = muscleGroups.some((mg) => UPPER_BODY.includes(mg)) ? 5 : 10
    return lbIncrement / 2.20462
  }
  if (muscleGroups.some((mg) => UPPER_BODY.includes(mg))) return 2.5
  if (muscleGroups.some((mg) => LOWER_BODY.includes(mg))) return 5
  return 5
}

function roundToGymWeight(kg: number, unitSystem?: 'imperial' | 'metric'): number {
  if (unitSystem === 'imperial') {
    const lb = kg * 2.20462
    return (Math.round(lb / 5) * 5) / 2.20462
  }
  return Math.round(kg / 2.5) * 2.5
}

function formatWeight(kg: number, unitSystem?: 'imperial' | 'metric'): string {
  if (unitSystem === 'imperial') return `${Math.round((kg * 2.20462) / 5) * 5} lb`
  return `${kg} kg`
}

// ── Session analysis ──────────────────────────────────────────────────────────

interface SessionStats {
  date: string
  /** Weight of the best-rep set (0 for unweighted bodyweight). */
  weight: number
  totalSets: number
  bestReps: number
  worstReps: number
  avgReps: number
  /** bestReps − worstReps: how spread out performance was across sets. */
  repSpread: number
  setsAboveUpper: number
  /** Every valid set reached TARGET_UPPER reps. */
  allSetsAboveUpper: boolean
  /** The best set reached TARGET_UPPER reps. */
  topSetAboveUpper: boolean
  sets: Array<{ actual_reps: number; weight_kg: number }>
}

function getExerciseSessions(
  exerciseId: string,
  workoutLogs: WorkoutLog[],
  requireWeight: boolean,
): SessionStats[] {
  const result: SessionStats[] = []

  for (const log of [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date))) {
    const exEntry = log.exercises.find((ex) => ex.exercise_id === exerciseId)
    if (!exEntry) continue

    const valid = exEntry.sets.filter(
      (s) =>
        typeof s.actual_reps === 'number' &&
        s.actual_reps > 0 &&
        (!requireWeight || (typeof s.weight_kg === 'number' && s.weight_kg > 0)),
    )
    if (valid.length === 0) continue

    const reps = valid.map((s) => s.actual_reps)
    const bestReps = Math.max(...reps)
    const worstReps = Math.min(...reps)
    const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length

    // Weight from the best-rep set (highest reps, then highest weight on ties)
    const bestSet = valid.reduce((best, s) => {
      if (s.actual_reps > best.actual_reps) return s
      if (s.actual_reps === best.actual_reps && s.weight_kg > best.weight_kg) return s
      return best
    })

    result.push({
      date: log.date,
      weight: bestSet.weight_kg,
      totalSets: valid.length,
      bestReps,
      worstReps,
      avgReps,
      repSpread: bestReps - worstReps,
      setsAboveUpper: valid.filter((s) => s.actual_reps >= TARGET_UPPER).length,
      allSetsAboveUpper: valid.every((s) => s.actual_reps >= TARGET_UPPER),
      topSetAboveUpper: bestReps >= TARGET_UPPER,
      sets: valid.map((s) => ({ actual_reps: s.actual_reps, weight_kg: s.weight_kg })),
    })
  }

  return result
}

// ── PR detection ──────────────────────────────────────────────────────────────

function checkPR(
  completedSets: Array<{ actual_reps: number; weight_kg: number }>,
  history: SessionStats[],
  useWeight: boolean,
): boolean {
  if (completedSets.length === 0) return false

  const sessionBest = completedSets.reduce((best, s) => {
    if (s.actual_reps > best.actual_reps) return s
    if (s.actual_reps === best.actual_reps && useWeight && s.weight_kg > best.weight_kg) return s
    return best
  })

  const allTimeBest = history.flatMap((s) => s.sets).reduce<{ actual_reps: number; weight_kg: number } | null>(
    (best, s) => {
      if (!best) return s
      if (s.actual_reps > best.actual_reps) return s
      if (s.actual_reps === best.actual_reps && useWeight && s.weight_kg > best.weight_kg) return s
      return best
    },
    null,
  )

  if (!allTimeBest) return true
  if (sessionBest.actual_reps > allTimeBest.actual_reps) return true
  if (useWeight && sessionBest.actual_reps === allTimeBest.actual_reps && sessionBest.weight_kg > allTimeBest.weight_kg) return true
  return false
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

// ── Category-specific progression strategies ──────────────────────────────────

function progressWeighted(
  sessions: SessionStats[],
  muscleGroups: MuscleGroup[],
  unitSystem: 'imperial' | 'metric' | undefined,
  category: 'compound' | 'accessory' | 'machine',
  isLowEnergy: boolean,
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>,
): ProgressionSuggestion | null {
  const increment = getWeightIncrement(muscleGroups, unitSystem)

  // ── PR (fires mid-session after a set is completed) ────────────────────────
  if (completedSetsThisSession && completedSetsThisSession.length > 0) {
    if (checkPR(completedSetsThisSession, sessions, true)) {
      return { type: 'pr', text: 'New PR — best set ever for this exercise' }
    }
  }

  if (sessions.length === 0) return null

  const last = sessions[0]
  const weight = last.weight

  // ── Long absence (21+ days) ────────────────────────────────────────────────
  const days = daysSince(last.date)
  if (days >= 21) {
    const suggested = roundToGymWeight(weight * 0.9, unitSystem)
    const weeks = Math.floor(days / 7)
    return {
      type: 'absence',
      text: `${weeks} week${weeks !== 1 ? 's' : ''} since last time — start at ${formatWeight(suggested, unitSystem)} to ease back in`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Recently increased weight (< 3 sessions at new load) ──────────────────
  if (sessions.length >= 2 && weight > sessions[1].weight) {
    let sessionsAtCurrent = 0
    for (const s of sessions) {
      if (s.weight >= weight) sessionsAtCurrent++
      else break
    }
    if (sessionsAtCurrent < 3) {
      const remaining = 3 - sessionsAtCurrent
      return {
        type: 'hold_recent_jump',
        text: `You just stepped up to ${formatWeight(weight, unitSystem)} — settle for ${remaining} more session${remaining !== 1 ? 's' : ''} before pushing heavier`,
      }
    }
  }

  // ── Too heavy (≤ TARGET_LOWER reps on best set) ───────────────────────────
  if (last.bestReps <= TARGET_LOWER) {
    const suggested = roundToGymWeight(Math.max(0, weight - increment), unitSystem)
    return {
      type: 'reduce_and_rebuild',
      text: `Only ${last.bestReps} rep${last.bestReps !== 1 ? 's' : ''} on your best set — drop to ${formatWeight(suggested, unitSystem)} and rebuild to 8+ reps`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Full load increase (all sets ≥ TARGET_UPPER for 2+ consecutive sessions)
  if (sessions.length >= 2 && last.allSetsAboveUpper && sessions[1].allSetsAboveUpper) {
    const suggested = roundToGymWeight(weight + increment, unitSystem)
    return {
      type: 'increase_load',
      text: `All sets at ${TARGET_UPPER}+ reps two sessions running — move up to ${formatWeight(suggested, unitSystem)}`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Compounds only: top set ready but later sets falling apart ────────────
  if (category === 'compound' && last.topSetAboveUpper && last.worstReps < 7) {
    const suggested = roundToGymWeight(weight + increment, unitSystem)
    return {
      type: 'top_set_only_increase',
      text: `Set 1 hit ${last.bestReps} reps but later sets dropped to ${last.worstReps} — try ${formatWeight(suggested, unitSystem)} for set 1 only, hold current weight for the rest`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Top set ready but other sets still catching up ────────────────────────
  if (last.topSetAboveUpper && !last.allSetsAboveUpper) {
    return {
      type: 'consolidate_performance',
      text: `Top set hit ${last.bestReps} reps but others are at ${last.worstReps}–${last.bestReps - 1} — get all sets there before going heavier`,
    }
  }

  // ── Wide rep spread (inconsistent session) ────────────────────────────────
  if (last.repSpread >= 5 && last.bestReps >= 6) {
    return {
      type: 'hold_inconsistent_sets',
      text: `${last.bestReps} on your best set, ${last.worstReps} on your worst — close that gap before adding load`,
    }
  }

  // ── Getting close (8–9 reps, or all sets above upper for first time) ──────
  if (last.bestReps >= 8) {
    const suggested = roundToGymWeight(weight + increment, unitSystem)
    if (last.allSetsAboveUpper) {
      return {
        type: 'near_increase',
        text: `All sets hit ${TARGET_UPPER}+ reps — one more session like this and ${formatWeight(suggested, unitSystem)} is the move`,
      }
    }
    return {
      type: 'near_increase',
      text: `Hitting ${last.bestReps} reps — stay at ${formatWeight(weight, unitSystem)} one more session, then aim for ${formatWeight(suggested, unitSystem)}`,
    }
  }

  // ── Plateau (same weight and same best reps for 4+ sessions) ─────────────
  if (sessions.length >= 4) {
    const recentFour = sessions.slice(0, 4)
    const allSameWeight = recentFour.every((s) => s.weight === weight)
    const allSameReps = recentFour.every((s) => s.bestReps === last.bestReps)
    if (allSameWeight && allSameReps) {
      const incrementPct = weight > 0 ? increment / weight : 0
      if (incrementPct > MICROLOAD_THRESHOLD) {
        return {
          type: 'microload_if_available',
          text: `4 sessions at the same weight and reps — the next standard jump is ${Math.round(incrementPct * 100)}% of your load. Micro-plates or fractional weights would help`,
        }
      }
      return {
        type: 'increase_volume',
        text: `Same weight, same reps for 4 sessions — add an extra set at ${formatWeight(weight, unitSystem)} instead of jumping weight`,
      }
    }
  }

  // ── Low energy on a compound or compound-muscle machine ───────────────────
  const isCompoundMovement = COMPOUND_MUSCLE_GROUPS.some((mg) => muscleGroups.includes(mg))
  if (isCompoundMovement && isLowEnergy) {
    return {
      type: 'fatigue_management',
      text: `Energy is low today — quality reps at ${formatWeight(weight, unitSystem)} beat grinding through a failed attempt`,
    }
  }

  // ── Accessory: tempo suggestion when stuck in 6–9 rep range ───────────────
  if (category === 'accessory' && last.bestReps >= 6 && last.bestReps <= 9 && sessions.length >= 3) {
    const recentThree = sessions.slice(0, 3)
    const stuckInRange = recentThree.every((s) => s.bestReps >= 6 && s.bestReps <= 9)
    if (stuckInRange) {
      return {
        type: 'improve_control',
        text: `${last.bestReps} reps for the past few sessions — try a 3-second lowering phase to build strength through the full range`,
      }
    }
  }

  return null
}

function progressBodyweight(
  sessions: SessionStats[],
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>,
): ProgressionSuggestion | null {
  // ── PR (reps-based only for bodyweight) ───────────────────────────────────
  if (completedSetsThisSession && completedSetsThisSession.length > 0) {
    if (checkPR(completedSetsThisSession, sessions, false)) {
      return { type: 'pr', text: 'New rep PR — best set ever for this exercise' }
    }
  }

  if (sessions.length === 0) return null

  const last = sessions[0]
  const days = daysSince(last.date)

  // ── Long absence ──────────────────────────────────────────────────────────
  if (days >= 21) {
    const weeks = Math.floor(days / 7)
    return {
      type: 'absence',
      text: `${weeks} week${weeks !== 1 ? 's' : ''} since last time — ease back in, don't chase old rep counts`,
    }
  }

  // ── Too few reps (regression or partial ROM needed) ───────────────────────
  if (last.bestReps <= 4) {
    return {
      type: 'reduce_and_rebuild',
      text: `Only ${last.bestReps} rep${last.bestReps !== 1 ? 's' : ''} — try a regressed variation or reduce range of motion to rebuild rep capacity`,
    }
  }

  // ── Consistently hitting high reps → progression (2+ sessions) ───────────
  if (last.bestReps >= TARGET_UPPER && sessions.length >= 2 && sessions[1].bestReps >= TARGET_UPPER) {
    return {
      type: 'harder_variation',
      text: `${TARGET_UPPER}+ reps two sessions running — progress to a harder variation or add external load (weight vest or band)`,
    }
  }

  // ── All sets above upper first time → almost ready ────────────────────────
  if (last.allSetsAboveUpper) {
    return {
      type: 'harder_variation',
      text: `All sets hit ${TARGET_UPPER}+ reps — one more session like this and it's time for a harder variation`,
    }
  }

  // ── Close to ready: suggest quality-focused approach ─────────────────────
  if (last.bestReps >= 8) {
    return {
      type: 'improve_control',
      text: `${last.bestReps} reps — add a 3-second lowering phase to build strength before moving to a harder variation`,
    }
  }

  return null
}

function progressAssistedBodyweight(
  sessions: SessionStats[],
  unitSystem: 'imperial' | 'metric' | undefined,
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>,
): ProgressionSuggestion | null {
  // ── PR ────────────────────────────────────────────────────────────────────
  if (completedSetsThisSession && completedSetsThisSession.length > 0) {
    if (checkPR(completedSetsThisSession, sessions, false)) {
      return { type: 'pr', text: 'New rep PR — best assisted set ever for this exercise' }
    }
  }

  if (sessions.length === 0) return null

  const last = sessions[0]
  const assistanceWeight = last.weight
  const days = daysSince(last.date)

  // ── Long absence ──────────────────────────────────────────────────────────
  if (days >= 21) {
    const weeks = Math.floor(days / 7)
    return {
      type: 'absence',
      text: `${weeks} week${weeks !== 1 ? 's' : ''} since last time — add a little more assistance to ease back in`,
    }
  }

  // ── Too few reps (need more assistance) ───────────────────────────────────
  if (last.bestReps <= TARGET_LOWER) {
    return {
      type: 'reduce_and_rebuild',
      text: `Only ${last.bestReps} reps — increase assistance weight to get into the 8–12 rep range comfortably`,
    }
  }

  // ── Ready to reduce assistance (2+ strong sessions) ──────────────────────
  if (last.bestReps >= TARGET_UPPER && sessions.length >= 2 && sessions[1].bestReps >= TARGET_UPPER) {
    const reduction = roundToGymWeight(assistanceWeight * 0.1, unitSystem)
    const suggested = roundToGymWeight(Math.max(0, assistanceWeight - reduction), unitSystem)
    return {
      type: 'reduce_assistance',
      text: `Strong two sessions in a row — try reducing assistance by ${formatWeight(reduction, unitSystem)} to build toward unassisted`,
      suggestedWeight_kg: suggested,
    }
  }

  // ── Inconsistent sets → consolidate before reducing ───────────────────────
  if (last.repSpread >= 4) {
    return {
      type: 'consolidate_performance',
      text: `${last.bestReps} on top, ${last.worstReps} at the bottom — get all sets consistent before reducing assistance`,
    }
  }

  // ── Close to ready → focus on control ────────────────────────────────────
  if (last.bestReps >= 8) {
    return {
      type: 'improve_control',
      text: `${last.bestReps} reps with assistance — add a 3-second lowering phase to build strength toward unassisted`,
    }
  }

  return null
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the highest-priority suggestion for this exercise, or null if nothing meaningful to show. */
export function getProgressionSuggestion(input: SuggestionInput): ProgressionSuggestion | null {
  const { exerciseId, muscleGroups, workoutLogs, journalEntries, completedSetsThisSession, unitSystem } = input

  const category = classifyExercise(input)

  const sessions = getExerciseSessions(exerciseId, workoutLogs, category !== 'bodyweight')

  const todayISO = new Date().toISOString().slice(0, 10)
  const todayEntry = journalEntries?.find((e) => e.date === todayISO)
  const isLowEnergy = (todayEntry?.energy ?? 5) <= 2

  switch (category) {
    case 'bodyweight':
      return progressBodyweight(sessions, completedSetsThisSession)
    case 'assisted_bodyweight':
      return progressAssistedBodyweight(sessions, unitSystem, completedSetsThisSession)
    default:
      return progressWeighted(sessions, muscleGroups, unitSystem, category, isLowEnergy, completedSetsThisSession)
  }
}

/** Returns a string signature that changes whenever the suggestion state changes, used for dismissal tracking. */
export function getSuggestionSignature(exerciseId: string, workoutLogs: WorkoutLog[]): string | null {
  // Try weighted first; fall back to unweighted for bodyweight exercises
  let sessions = getExerciseSessions(exerciseId, workoutLogs, true)
  let prefix = 'w'

  if (sessions.length === 0) {
    sessions = getExerciseSessions(exerciseId, workoutLogs, false)
    prefix = 'bw'
  }

  if (sessions.length === 0) return null

  const last = sessions[0]

  let consecutiveAboveUpper = 0
  for (const s of sessions) {
    if (s.allSetsAboveUpper) consecutiveAboveUpper++
    else break
  }

  const recentJump = sessions.length >= 2 && last.weight > sessions[1].weight ? 1 : 0

  return `${exerciseId}:${prefix}:${last.weight}:${last.bestReps}:${last.repSpread}:${consecutiveAboveUpper}:${recentJump}`
}
