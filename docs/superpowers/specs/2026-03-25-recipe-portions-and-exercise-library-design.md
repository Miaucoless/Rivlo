# Recipe portions + exercise library expansions (Design)

Date: 2026-03-25

## Goals

- Let users log **partial recipes** (by servings fraction *or* by units/pieces like “2 egg bites”).
- Expand the exercise library so:
  - **RDL** is selectable as **barbell**, **dumbbells**, or **bodyweight**
  - Add **kettlebell** exercises
  - Add **Pilates/Yoga** options

Non-goals (for this iteration):
- Automatic recalculation of historical meal logs if a recipe definition changes later.
- A full exercise taxonomy overhaul (we’ll follow existing patterns).

## Current system (relevant)

- Meals are logged as `MealLogEntry` (see `lib/mock-data.ts`) and persisted to Supabase `meal_entries` via `lib/cloud-sync.ts`.
- Recipes are `Recipe` (see `types/index.ts`) and used in `app/dashboard/meals/page.tsx` when adding a recipe to today.
- Exercises come from `EXERCISE_LIBRARY` in `lib/mock-data.ts` and are classified in `lib/exercise-classifications.ts` for input mode behavior in `app/dashboard/workouts/page.tsx`.

## Design A — Partial recipe logging (servings + units)

### Data model changes

#### `Recipe` (optional yield unit)

Add optional fields:

- `yield_quantity?: number` (e.g. `12`)
- `yield_unit?: string` (e.g. `"bites"`, `"cookies"`, `"pieces"`)

Intent:
- `recipe.servings` remains “how many servings the full recipe makes”
- `yield_*` is for tangible “units/pieces” users think in day-to-day

#### `MealLogEntry` (recipe amount)

Add optional:

```ts
recipe_amount?:
  | { kind: 'servings'; servings: number }
  | { kind: 'units'; units: number }
```

Notes:
- Present only when `recipe` is non-null.
- Stored in Supabase `meal_entries.notes` JSON (the app already stores per-entry metadata there).

### Macro scaling rules

When logging a recipe:

- If `recipe_amount.kind === 'servings'`
  - multiplier = `recipe_amount.servings`
- If `recipe_amount.kind === 'units'`
  - multiplier = `recipe_amount.units / recipe.yield_quantity`
  - If `yield_quantity` is missing/invalid, fallback to servings mode (UI prevents units mode).

Logged macros are computed at log-time:

- `logged.calories = round(recipe.macros.calories * multiplier)`
- `logged.protein_g/carbs_g/fat_g = round1(recipe.macros.* * multiplier)` (follow existing rounding conventions)

Rationale:
- Offline-friendly (no re-computation needed).
- Stable historical logs even if recipe changes later.

### UI changes

In `AddToTodayButton` (and recipe logging flows in the meals page):

- Add a small “Amount” control:
  - Mode toggle: **Servings** | **Units**
  - Numeric input/stepper
  - Units mode only enabled if recipe has `yield_quantity` and `yield_unit`
- Helper text: “Yield: 12 bites” when yield info exists.

Defaults:
- If recipe has yield info: default to Units
- Otherwise: default to Servings with value 1

## Design B — Exercise library expansions

### RDL variants

Add distinct exercise library entries (instead of overloading one):

- `Romanian Deadlift (Barbell)` equipment: `Barbell`
- `Romanian Deadlift (Dumbbells)` equipment: `Dumbbells`
- `Romanian Deadlift (Bodyweight)` equipment: `Bodyweight`

Classification:
- All: `primary_type: 'strength'`

Expected behavior:
- Barbell/dumbbell variants use weight input.
- Bodyweight variant allows reps-only (weight optional/blank).

### Kettlebell additions

Add key kettlebell exercises to `EXERCISE_LIBRARY`:

- Strength-leaning:
  - `Kettlebell Press`
  - `Kettlebell Row`
  - `Turkish Get-Up`
  - `Goblet Squat (Kettlebell)`
- Conditioning-leaning:
  - `Kettlebell Swing`
  - `Kettlebell Clean`
  - `Kettlebell Snatch`

Classification and logging mode:
- Support **both** strength (sets/reps/optional weight) **and** intervals (rounds + work/rest).
- Recommendation: default kettlebell swings/clean/snatch to strength mode, but allow switching per exercise to intervals in the workout logger UI (reusing existing interval support).

### Pilates/Yoga additions

Add time-based entries:

- `Yoga (Vinyasa)`
- `Yoga (Hatha)`
- `Yoga (Yin)`
- `Pilates (Mat)`
- `Pilates (Reformer)` (optional, can ship later)

Classification:
- `primary_type: 'time'`

Equipment strings:
- Yoga/Pilates Mat: `Mat` or `Bodyweight + Mat`
- Reformer: `Reformer`

## Edge cases & safeguards

- Units mode should never produce multiplier \(<= 0\). If `units` is 0, block submit.
- If `yield_quantity` exists but is `<= 0`, treat as missing (disable units mode).
- Keep existing recipe logging behavior as fallback (1 serving, no yield).

## Success criteria

- Logging a recipe allows entering **0.5 servings** or **2 bites** (when yield configured), and macros reflect the scaled amount.
- Users can find and log:
  - RDL (barbell/dumbbell/bodyweight)
  - Kettlebell movements
  - Pilates/Yoga sessions with duration

