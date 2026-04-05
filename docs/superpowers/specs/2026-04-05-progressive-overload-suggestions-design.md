# Progressive Overload Suggestion System — Design Spec

**Date:** 2026-04-05  
**Status:** Approved  

---

## Overview

A subtle, data-driven suggestion layer on top of the existing workout logging flow. When a user opens a saved workout, each strength exercise displays a small inline hint directly below the exercise header — derived from their actual logged history. Suggestions are non-intrusive, dismissible, and suppressed when nothing meaningful has changed.

---

## Goals

- Surface actionable weight/rep guidance without interrupting the workout flow
- Feel like a helpful whisper, not a coaching banner
- Never auto-change user inputs — suggest only
- Avoid repetition: only show a suggestion when data genuinely supports it

---

## Architecture

```
workoutLogs (Zustand store)
       ↓
lib/progression-suggestions.ts   ← pure logic, no React
  getProgressionSuggestion()
  getSuggestionSignature()
  getWeightIncrement()
       ↓
hooks/useProgressionSuggestion.ts  ← state: dismissed signatures, memoization
  returns { suggestion, shouldShow, dismiss, apply }
       ↓
components/workouts/ProgressionSuggestion.tsx  ← UI only
       ↓
app/dashboard/workouts/page.tsx   ← injected into ActiveWorkoutModal (~line 2614)
  strength exercises only, ~5 lines added
```

**Persistence:** `localStorage` key `rivora-progression-dismissed`  
Format: `Record<exerciseId, dismissedSignature>`

---

## Suggestion Types

Eight distinct suggestion types covering all meaningful scenarios. Each has a unique trigger condition so they can never fire simultaneously on the same exercise.

### 1. Increase Weight
**Trigger:** Best set (highest `actual_reps`) from most recent log ≥ 10 reps  
**Copy:** `"Hit 11 reps last time — try 190 lb × 8"`  
**Action:** Apply button (prefills all sets with suggested weight)

### 2. Consecutive Streak — Outgrown
**Trigger:** Best set ≥ 10 reps in **2 consecutive** logged sessions for this exercise  
**Copy:** `"10+ reps two sessions running — ready for 70 lb"`  
**Styling:** Slightly brighter green (`text-emerald-400/85`) to distinguish from type 1  
**Action:** Apply button

### 3. Decrease Weight
**Trigger:** Best set ≤ 5 reps from most recent log  
**Copy:** `"Only hit 5 reps last time — try 130 lb to reach 8"`  
**Action:** Apply button

### 4. No Suggestion (silent)
**Trigger:** Best set is 6–9 reps — in the target range, nothing to act on  
**Output:** `null` — nothing rendered

### 5. Personal Record
**Trigger:** Current session's best completed set exceeds all-time best for that exercise  
**Copy:** `"New PR — best set ever for this exercise"`  
**Action:** Dismiss only (no weight to apply)  
**Note:** Fires mid-session after a set is marked complete, not on open

### 6. Long Absence
**Trigger:** Exercise has not appeared in any `WorkoutLog` for 21+ days  
**Copy:** `"First time logging this in 4 weeks — consider 175 lb to ease back in"` (suggested weight = last weight × 0.9, rounded to nearest 5 lb)  
**Action:** Apply button

### 7. Plateau Warning
**Trigger:** Same weight AND best set reps haven't improved across 4+ consecutive sessions  
**Copy:** `"Same weight, same reps for 4 sessions — try a deload or swap to a variation"`  
**Action:** Dismiss only

### 8. Low Energy Modifier
**Trigger:** User logged a journal entry today with `energy ≤ 2`, AND the exercise is a compound lift (muscle groups include `chest`, `back`, `shoulders`, `quads`, or `hamstrings`)  
**Copy:** `"Energy logged as low today — no pressure to hit a new weight"`  
**Action:** Dismiss only  
**Note:** Reads from `journalEntries` in store, filtered to today's date

---

## Priority Order

When multiple conditions could theoretically apply, use this priority:

1. Personal Record (fires mid-session only, never on open)
2. Consecutive Streak
3. Increase Weight
4. Long Absence
5. Plateau Warning
6. Decrease Weight
7. Low Energy Modifier
8. No Suggestion (silent)

---

## Weight Increment Rules

All weights stored and computed in kg. UI displays in lb (existing app behaviour).

```ts
Upper body (chest, back, shoulders, biceps, triceps, forearms): ±2.5 kg (~5 lb)
Lower body (quads, hamstrings, glutes, calves): ±5 kg (~10 lb)
Other (core, full_body): ±5 kg (~10 lb)

Long absence: last_weight_kg × 0.9, rounded to nearest 2.5 kg
```

Increments apply symmetrically for increases and decreases.

**Best set tiebreaker:** If two sets share the highest `actual_reps`, use the one with higher `weight_kg`. If still tied, use the first set (lowest `set_number`).

---

## Dismissal & Repetition Suppression

### Signature
```ts
getSuggestionSignature(exerciseId, workoutLogs): string | null
// Returns: "<exerciseId>:<lastWeightKg>:<bestReps>:<consecutiveStreak>"
// Example: "lib-bench-barbell-flat:83.9:11:2"
// Returns null if no history
```

### Logic
1. On component mount: compute `currentSignature`
2. Read `localStorage["rivora-progression-dismissed"][exerciseId]`
3. `shouldShow = currentSignature !== dismissedSignature && suggestion !== null`
4. On dismiss: write `currentSignature` to localStorage for that `exerciseId`
5. Next session: if user logged a new workout → signature changes → suggestion reappears

### Edge Cases
- No history → `getProgressionSuggestion()` returns `null` → nothing shown
- Cardio/treadmill/bike exercise (`set_metric !== 'strength'`) → component not rendered
- Missing `actual_reps` or `weight_kg` → skip that set, use remaining sets
- Journal entry missing for today → Low Energy type does not fire

---

## File Structure

```
lib/
  progression-suggestions.ts       ← pure functions + types
hooks/
  useProgressionSuggestion.ts      ← React hook
components/
  workouts/
    ProgressionSuggestion.tsx      ← UI component
```

---

## Types

```ts
// In lib/progression-suggestions.ts

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
  suggestedWeight_kg?: number   // present for increase, streak, decrease, absence
}

export interface SuggestionInput {
  exerciseId: string
  exerciseName: string
  muscleGroups: MuscleGroup[]
  workoutLogs: WorkoutLog[]
  journalEntries?: JournalEntry[]   // for low_energy type
  completedSetsThisSession?: Array<{ actual_reps: number; weight_kg: number }>  // for PR type
}
```

---

## Hook Interface

```ts
useProgressionSuggestion(input: SuggestionInput): {
  suggestion: ProgressionSuggestion | null
  shouldShow: boolean
  dismiss: () => void
  apply: () => number | null   // returns weight_kg, caller prefills inputs
}
```

---

## UI Component

```tsx
<ProgressionSuggestion
  exerciseId={string}
  exerciseName={string}
  muscleGroups={MuscleGroup[]}
  workoutLogs={WorkoutLog[]}
  journalEntries={JournalEntry[]}
  completedSetsThisSession={...}   // optional, for PR detection
  onApply={(weight_kg: number) => void}
/>
```

**Visual spec:**
- Single text row below exercise header, above set inputs
- Separated from header by `border-t border-border/60 pt-2.5 mt-2.5`
- `text-xs text-emerald-400/60` (streak: `/85`)
- No background, no border radius, no icon
- Apply: `text-xs underline text-emerald-400/55` — inline, to the right of text
- Dismiss ✕: `text-xs text-muted-foreground/40` — rightmost
- Apply button absent for types: `pr`, `plateau`, `low_energy`

---

## Integration Point

In `ActiveWorkoutModal` (`workouts/page.tsx`, exercise loop ~line 2614):

```tsx
{exercise.exercise.set_metric === 'strength' && (
  <ProgressionSuggestion
    exerciseId={exercise.exercise.id}
    exerciseName={exercise.exercise.name}
    muscleGroups={exercise.exercise.muscle_groups}
    workoutLogs={workoutLogs}
    journalEntries={journalEntries}
    completedSetsThisSession={exercise.sets
      .filter(s => s.completed)
      .map(s => ({ actual_reps: s.actual_reps ?? 0, weight_kg: s.actual_weight_kg ?? 0 }))}
    onApply={(weight_kg) => applyWeightToAllSets(exerciseIndex, weight_kg)}
  />
)}
```

`applyWeightToAllSets(exerciseIndex, weight_kg)` updates the active session state to prefill weight for all sets in that exercise. User must still complete each set manually.

---

## What This Does NOT Do

- Does not auto-fill weights without user action
- Does not show suggestions for cardio exercises
- Does not suggest rest days or full workout changes
- Does not use external AI/LLM — all logic is deterministic and rule-based
- Does not modify `WorkoutLog` entries
