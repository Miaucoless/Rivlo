# Recipe portions + exercise library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log partial recipe amounts (servings or units) and expand the exercise library with RDL variants, kettlebell exercises (strength + interval variants), and Pilates/Yoga time-based logging.

**Architecture:** Keep meal logs offline-friendly by computing scaled macros at log-time and persisting the chosen amount as metadata in `meal_entries.notes`. Add new exercises as additional `EXERCISE_LIBRARY` items and extend workout input UI with a minimal `time_only` mode for Yoga/Pilates.

**Tech Stack:** Next.js (App Router), Zustand store, Supabase (RLS tables), TypeScript.

---

## File structure / units

**Modify**
- `types/index.ts`: extend `Recipe` and meal logging types with yield + amount.
- `lib/mock-data.ts`: add recipe yield fields where relevant; add new `EXERCISE_LIBRARY` items.
- `app/dashboard/meals/page.tsx`: add recipe amount controls + scaling in recipe add flows.
- `lib/cloud-sync.ts`: persist/restore `recipe_amount` through `meal_entries.notes`.
- `lib/exercise-classifications.ts`: add classifications for new exercise IDs; add Yoga/Pilates as `time`.
- `app/dashboard/workouts/page.tsx`: add `time_only` input mode and map Yoga/Pilates to it.

**Optional**
- `supabase/schema.sql`: no DB schema changes needed for meal portions (stored in notes), but ensure migrations are documented.

## Task 1: Types for recipe yield + meal recipe amount

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/mock-data.ts` (MealLogEntry interface aligns with app usage)

- [ ] **Step 1: Update `Recipe` type**
  - Add optional `yield_quantity?: number`, `yield_unit?: string`.

- [ ] **Step 2: Update meal log type**
  - Add optional `recipe_amount` union:
    - `{ kind: 'servings'; servings: number }`
    - `{ kind: 'units'; units: number }`

- [ ] **Step 3: Sanity check build**
  - Run: `npm run lint`
  - Expected: no TS errors for new fields.

## Task 2: Persist + hydrate `recipe_amount` via Supabase `meal_entries.notes`

**Files:**
- Modify: `lib/cloud-sync.ts`

- [ ] **Step 1: Extend `mealToRow` notes payload**
  - Include `recipe_amount` (and recipe yield if needed is already inside `recipe` object stored in notes).

- [ ] **Step 2: Extend `mealFromRow`**
  - Parse and attach `recipe_amount` onto `MealLogEntry`.

- [ ] **Step 3: Manual verification**
  - Log a recipe with servings < 1 and confirm after refresh it rehydrates with same amount selection.

## Task 3: Meals UI — log partial recipes (servings + units)

**Files:**
- Modify: `app/dashboard/meals/page.tsx`

- [ ] **Step 1: Add scaling helper**
  - Implement a helper to compute multiplier and scaled macros from:
    - recipe macros
    - recipe yield fields (optional)
    - selected amount mode/value

- [ ] **Step 2: Update `AddToTodayButton`**
  - Add amount UI:
    - mode toggle (Servings / Units (if enabled))
    - numeric input
  - On Add:
    - compute scaled macros
    - set `recipe_amount`
    - keep `recipe` attached

- [ ] **Step 3: Update MealEditorModal recipe flow**
  - When `source === 'recipe'`:
    - show the same amount UI
    - auto-fill macros with scaled values (disable manual editing for recipe source)
    - persist `recipe_amount` on save

- [ ] **Step 4: Manual QA**
  - Pick a recipe with yield (e.g. egg bites)
  - Log “2 bites” → calories should be ~2/12 of recipe calories
  - Log “0.5 servings” → calories should halve

## Task 4: Exercise library expansions (RDL variants + KB + Yoga/Pilates)

**Files:**
- Modify: `lib/mock-data.ts`
- Modify: `lib/exercise-classifications.ts`

- [ ] **Step 1: Add RDL variants to `EXERCISE_LIBRARY`**
  - New ids like:
    - `lib-rdl-barbell`, `lib-rdl-dumbbells`, `lib-rdl-bodyweight`

- [ ] **Step 2: Add kettlebell exercises**
  - Strength variants (primary_type strength)
  - Interval variants as separate exercises (e.g. `Kettlebell Swing (Intervals)` with primary_type intervals)

- [ ] **Step 3: Add Yoga/Pilates exercises**
  - ids like `lib-yoga-vinyasa`, `lib-pilates-mat`, etc.
  - classification primary_type `time`

- [ ] **Step 4: Sanity check search**
  - Confirm workout exercise search finds “RDL”, “kettlebell”, “yoga”, “pilates”.

## Task 5: Workouts UI — add `time_only` input mode (Yoga/Pilates)

**Files:**
- Modify: `app/dashboard/workouts/page.tsx`

- [ ] **Step 1: Add `time_only` to `ExerciseInputMode`**
  - Render columns: Set | Minutes | Rest Sec
  - Input minutes uses `set.reps` (consistent with current cardio duration storage).

- [ ] **Step 2: Map Yoga/Pilates to `time_only`**
  - In `getExerciseInputMode`, for those IDs return `time_only` instead of `basic_cardio`.

- [ ] **Step 3: Defaults**
  - `getDefaultSetMetrics` for `time_only` returns `{ reps: 30, rest_seconds: 0 }`

- [ ] **Step 4: Manual QA**
  - Add “Yoga (Vinyasa)” to a workout session
  - Ensure it asks for minutes, not weight/level.

## Task 6: Verification + cleanup

**Files:**
- Modify: touched files above only

- [ ] **Step 1: Lint**
  - Run: `npm run lint`

- [ ] **Step 2: Quick manual smoke**
  - Add partial recipe to today
  - Add yoga/pilates to workout
  - Add KB swing interval variant and confirm interval UI appears

