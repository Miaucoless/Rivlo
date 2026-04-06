# Progressive Overload Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subtle, rule-based suggestion strip below each strength exercise header in the active workout modal that nudges users toward progressive overload based on their logged history.

**Architecture:** Pure logic in `lib/progression-suggestions.ts` → stateful React hook `hooks/useProgressionSuggestion.ts` → dumb UI component `components/workout/ProgressionSuggestion.tsx` → injected into `ActiveWorkoutModal` with ~5 lines of JSX. No external APIs, no new DB queries — all computed from data already in the Zustand store.

**Tech Stack:** TypeScript, React (hooks + forwardRef), Zustand store (read-only), localStorage for dismissal persistence, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/progression-suggestions.ts` | **Create** | Pure functions: suggestion logic, signature, weight increment |
| `hooks/useProgressionSuggestion.ts` | **Create** | React hook: memoization, localStorage dismissal, apply/dismiss actions |
| `components/workout/ProgressionSuggestion.tsx` | **Create** | UI-only component: renders suggestion row, calls onApply/onDismiss |
| `app/dashboard/workouts/page.tsx` | **Modify** | Add `journalEntries` prop to `ActiveWorkoutModal`, add `applyWeightToAllSets`, inject `<ProgressionSuggestion>` |

---

## Task 1: Pure logic — `lib/progression-suggestions.ts`

**Files:**
- Create: `lib/progression-suggestions.ts`

- [ ] **Step 1: Create the file with types and `getWeightIncrement`**

```ts
// lib/progression-suggestions.ts
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
```

- [ ] **Step 2: Add `getBestSet` helper**

```ts
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
```

- [ ] **Step 3: Add `getExerciseLogs` helper — filters workout logs for a specific exercise**

```ts
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
```

- [ ] **Step 4: Add `getProgressionSuggestion` — main logic function**

```ts
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
      const suggested = lastWeight + increment
      return {
        type: 'streak',
        text: `10+ reps two sessions running — ready for ${suggested} kg`,
        suggestedWeight_kg: suggested,
      }
    }
  }

  // ── Priority 3: Increase Weight (≥10 reps last session)
  if (lastBest.actual_reps >= 10) {
    const suggested = lastWeight + increment
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
    const suggested = Math.max(0, lastWeight - increment)
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
```

- [ ] **Step 5: Add `getSuggestionSignature`**

```ts
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
```

- [ ] **Step 6: Manually verify the logic is correct in your head**

  Walk through these scenarios with the code above:

  | Scenario | Expected result |
  |---|---|
  | `logs = []` | `null` |
  | Last best = 11 reps @ 84 kg, upper body | `increase`, suggested = 86.5 kg |
  | Last two bests both ≥ 10 reps, upper body | `streak`, suggested = last + 2.5 |
  | Last best = 3 reps @ 100 kg, lower body | `decrease`, suggested = 95 kg |
  | Last best = 8 reps (in-range) | `null` |
  | Last log was 25 days ago | `absence`, suggested = last × 0.9 rounded to 2.5 |
  | Same weight + reps for 4 logs | `plateau` |
  | `completedSetsThisSession` beats all-time best | `pr` |
  | Journal energy = 1 today, compound lift | `low_energy` |

- [ ] **Step 7: Commit**

```bash
git add lib/progression-suggestions.ts
git commit -m "feat: add pure progression suggestion logic"
```

---

## Task 2: React hook — `hooks/useProgressionSuggestion.ts`

**Files:**
- Create: `hooks/useProgressionSuggestion.ts`

- [ ] **Step 1: Create the hook**

```ts
// hooks/useProgressionSuggestion.ts
import { useCallback, useMemo, useState } from 'react'
import {
  getProgressionSuggestion,
  getSuggestionSignature,
  type SuggestionInput,
  type ProgressionSuggestion,
} from '@/lib/progression-suggestions'

const STORAGE_KEY = 'rivora-progression-dismissed'

function readDismissed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeDismissed(record: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage unavailable (SSR, private mode) — silently ignore
  }
}

export function useProgressionSuggestion(input: SuggestionInput): {
  suggestion: ProgressionSuggestion | null
  shouldShow: boolean
  dismiss: () => void
  apply: () => number | null
} {
  const { exerciseId, workoutLogs } = input

  const suggestion = useMemo(
    () => getProgressionSuggestion(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, workoutLogs, input.completedSetsThisSession, input.journalEntries]
  )

  const currentSignature = useMemo(
    () => getSuggestionSignature(exerciseId, workoutLogs),
    [exerciseId, workoutLogs]
  )

  // Track dismissal in local state so shouldShow re-evaluates immediately on dismiss
  const [dismissed, setDismissed] = useState<string | null>(() => {
    return readDismissed()[exerciseId] ?? null
  })

  const shouldShow = suggestion !== null && currentSignature !== null && currentSignature !== dismissed

  const dismiss = useCallback(() => {
    if (!currentSignature) return
    setDismissed(currentSignature)
    const record = readDismissed()
    record[exerciseId] = currentSignature
    writeDismissed(record)
  }, [exerciseId, currentSignature])

  const apply = useCallback((): number | null => {
    return suggestion?.suggestedWeight_kg ?? null
  }, [suggestion])

  return { suggestion, shouldShow, dismiss, apply }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useProgressionSuggestion.ts
git commit -m "feat: add useProgressionSuggestion hook with localStorage dismissal"
```

---

## Task 3: UI component — `components/workout/ProgressionSuggestion.tsx`

**Files:**
- Create: `components/workout/ProgressionSuggestion.tsx`

The component is a thin wrapper around the hook. It renders nothing when `shouldShow` is false.

- [ ] **Step 1: Create the component**

```tsx
// components/workout/ProgressionSuggestion.tsx
'use client'

import type { JournalEntry, MuscleGroup, WorkoutLog } from '@/types'
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion'

interface Props {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>
  onApply: (weight_kg: number) => void
}

const HAS_APPLY_BUTTON: Array<string> = ['increase', 'streak', 'decrease', 'absence']

export function ProgressionSuggestion({
  exerciseId,
  exerciseName,
  muscleGroups,
  workoutLogs,
  journalEntries,
  completedSetsThisSession,
  onApply,
}: Props) {
  const { suggestion, shouldShow, dismiss, apply } = useProgressionSuggestion({
    exerciseId,
    exerciseName,
    muscleGroups,
    workoutLogs,
    journalEntries,
    completedSetsThisSession,
  })

  if (!shouldShow || !suggestion) return null

  const isStreak = suggestion.type === 'streak'
  const showApply = HAS_APPLY_BUTTON.includes(suggestion.type)

  function handleApply() {
    const kg = apply()
    if (kg !== null) onApply(kg)
    dismiss()
  }

  return (
    <div className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2.5">
      <span
        className={`flex-1 text-xs leading-snug ${
          isStreak ? 'text-emerald-400/85' : 'text-emerald-400/60'
        }`}
      >
        {suggestion.text}
      </span>
      {showApply && (
        <button
          type="button"
          onClick={handleApply}
          className="whitespace-nowrap text-xs underline underline-offset-2 text-emerald-400/55 hover:text-emerald-400/90 transition-colors"
        >
          Apply
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-0.5"
        aria-label="Dismiss suggestion"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/workout/ProgressionSuggestion.tsx
git commit -m "feat: add ProgressionSuggestion UI component"
```

---

## Task 4: Integration — `app/dashboard/workouts/page.tsx`

**Files:**
- Modify: `app/dashboard/workouts/page.tsx`

This task has 4 sub-steps: add import, add `journalEntries` prop to `ActiveWorkoutModal`, add `applyWeightToAllSets` helper, inject `<ProgressionSuggestion>` in the exercise loop, pass `journalEntries` at the call sites.

- [ ] **Step 1: Add the import at the top of the file**

Find the block of import statements. Add after the last local import (around line 30–38):

```ts
import { ProgressionSuggestion } from '@/components/workout/ProgressionSuggestion'
```

- [ ] **Step 2: Add `journalEntries` to `ActiveWorkoutModal` props**

Find the `ActiveWorkoutModal` function signature (around line 1890). Add `journalEntries` to the destructured props and its type:

In the destructured params, add:
```ts
journalEntries,
```

In the type annotation block, add:
```ts
journalEntries: import('@/types').JournalEntry[]
```

The full props destructure (showing just the changed part) will look like:
```ts
function ActiveWorkoutModal({
  workout,
  metProfile,
  unitSystem,
  workoutLogs,
  journalEntries,         // ← add this
  initialExercises,
  ...
}: {
  workout: Workout
  metProfile: MetProfile
  unitSystem: UnitSystem
  workoutLogs: import('@/types').WorkoutLog[]
  journalEntries: import('@/types').JournalEntry[]   // ← add this
  initialExercises?: ActiveExercise[]
  ...
})
```

- [ ] **Step 3: Add `applyWeightToAllSets` helper inside `ActiveWorkoutModal`**

Add this function immediately after the `removeExerciseFromLiveWorkout` function (around line 2229):

```ts
const applyWeightToAllSets = (exerciseIndex: number, weight_kg: number) => {
  setExercises((current) =>
    current.map((exercise, currentExerciseIndex) =>
      currentExerciseIndex === exerciseIndex
        ? {
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set, actual_weight: weight_kg })),
          }
        : exercise
    )
  )
}
```

- [ ] **Step 4: Inject `<ProgressionSuggestion>` inside the exercise loop**

Find the exercise card return block starting at line 2614:
```tsx
return <div key={`${exercise.exercise.id}-${exerciseIndex}`} className="rounded-2xl border border-border/60 bg-card p-4">
```

Inside this card, find where the sets list ends (after the closing `</div>` of the sets list, before the closing `</div>` of the card). The sets list is wrapped in a `<div className="space-y-...">` block. Add the `ProgressionSuggestion` immediately after it closes, still inside the card `<div>`:

```tsx
{!isCardioExercise(exercise.exercise) && (
  <ProgressionSuggestion
    exerciseId={exercise.exercise.id}
    exerciseName={exercise.exercise.name}
    muscleGroups={exercise.exercise.muscle_groups}
    workoutLogs={workoutLogs}
    journalEntries={journalEntries}
    completedSetsThisSession={exercise.sets
      .filter((s) => s.completed)
      .map((s) => ({ actual_reps: s.actual_reps ?? 0, weight_kg: s.actual_weight ?? 0 }))}
    onApply={(weight_kg) => applyWeightToAllSets(exerciseIndex, weight_kg)}
  />
)}
```

- [ ] **Step 5: Pass `journalEntries` at both `<ActiveWorkoutModal>` call sites**

There are two call sites (around lines 5372 and 5475). Both currently pass `workoutLogs={workoutLogs}`. Add `journalEntries={journalEntries}` to each:

```tsx
<ActiveWorkoutModal
  ...
  workoutLogs={workoutLogs}
  journalEntries={journalEntries}   // ← add to both call sites
  ...
/>
```

- [ ] **Step 6: Build check**

```bash
cd /Users/miaucoles/Downloads/Fitness/Fitness
npx tsc --noEmit
```

Expected: no errors. If TypeScript reports errors:
- `journalEntries` prop missing → check both call sites have it
- `JournalEntry` type not found → ensure `import('@/types').JournalEntry[]` is correct
- `isCardioExercise` not found → it's defined at the top of the same file (line 159), no import needed

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "feat: integrate ProgressionSuggestion into ActiveWorkoutModal"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and start a workout**

  1. Log in and navigate to Workouts
  2. Open any saved workout containing a strength exercise (e.g., Barbell Bench Press)
  3. Confirm the suggestion strip renders below the exercise name (if history exists)
  4. If no history yet: the strip should not render — nothing shown

- [ ] **Step 3: Test each suggestion type**

  Check the logic fires correctly by looking at existing workout logs:

  | What to do | Expected |
  |---|---|
  | Open an exercise you last did ≥10 reps | "Hit N reps last time — try X kg × 8" |
  | Open an exercise you did ≥10 reps in last 2 sessions | "10+ reps two sessions running — ready for X kg" with brighter text |
  | Open an exercise you last did ≤5 reps | "Only hit N reps last time — try X kg to reach 8" |
  | Open an exercise you last did 6–9 reps | Nothing shown |
  | Open an exercise you haven't done in 3+ weeks | "First time logging this in N weeks..." |
  | Click Apply | All set weight inputs prefill with suggested weight |
  | Click ✕ | Suggestion disappears, stays gone on page refresh for same data |
  | Log a new workout for that exercise | Suggestion reappears on next open (signature changed) |

- [ ] **Step 4: Verify PR detection fires mid-session**

  1. Complete a set during a live workout with more reps than your all-time best
  2. The PR suggestion should appear: "New PR — best set ever for this exercise"
  3. No Apply button — only Dismiss ✕

- [ ] **Step 5: Commit (only if final fixes needed)**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: correct progression suggestion edge cases"
```

---

## Spec Coverage Checklist

- [x] All 8 suggestion types implemented in priority order
- [x] `getSuggestionSignature` implements `exerciseId:lastWeightKg:bestReps:consecutiveStreak` format
- [x] localStorage key `rivora-progression-dismissed` used
- [x] Weight increments: upper body ±2.5 kg, lower body ±5 kg
- [x] Long absence: `× 0.9`, rounded to nearest 2.5 kg
- [x] Best set tiebreaker: highest weight, then first set_number
- [x] Cardio exercises excluded via `isCardioExercise()`
- [x] Missing `actual_reps` / `weight_kg` → sets filtered out (in `getExerciseLogs`)
- [x] No history → nothing rendered
- [x] Apply button absent for `pr`, `plateau`, `low_energy`
- [x] `streak` type uses `text-emerald-400/85`, others use `/60`
- [x] `applyWeightToAllSets` updates `actual_weight` (kg) on all sets, user completes them manually
- [x] `journalEntries` passed into `ActiveWorkoutModal` at both call sites
