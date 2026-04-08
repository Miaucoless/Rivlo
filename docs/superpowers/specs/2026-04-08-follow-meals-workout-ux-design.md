# Design Spec: Follow Button, Edit & Add Meal, Workout UX Improvements

**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

Six improvements across social, meals, and active workout UX:

1. Follow button shows "Following" everywhere and reveals an Unfollow dropdown on click
2. Saved meals get an "Edit & Add" button that lets the user customize a copy before adding to today
3. Active workout persists and auto-resumes after app close/reopen
4. Rest timer only appears on the most recent completed set
5. Exercises can be drag-reordered during an active workout
6. Bayesian Curls (single arm + both arms) added to the exercise library

---

## Feature 1: Following → Dropdown with Unfollow

### Files
- `app/dashboard/profile/[username]/page.tsx`
- `app/dashboard/feed/page.tsx`

### Behavior
When `relationship?.status === 'accepted'`, the "Following" button becomes a `DropdownMenu` trigger. The button appearance is unchanged — same label, same variant. Clicking it opens a menu with one item: **"Unfollow"** in destructive color. Selecting it calls `unfollowUser(userId)` immediately.

The `pending`/Requested state is unchanged — clicking still cancels the request directly (no dropdown needed).

### Implementation notes
- `@radix-ui/react-dropdown-menu` is already installed
- Profile page has two "Following" button locations: the header and the private-profile card body. Both need the dropdown.
- Feed page: the People tab renders follow buttons inline per-profile. The same `DropdownMenu` pattern applies.
- No new component needed — inline `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` at each callsite.

---

## Feature 2: Edit & Add for Saved Meals

### Files
- `app/dashboard/meals/page.tsx`

### UI change
On each saved meal card in the Saved Meals tab, add an **"Edit & Add"** button (outline variant, `size="sm"`, `h-8`) next to the existing "Add" button. The existing "Add" button is unchanged — still instant, no modal.

### MealEditorModal changes
Add a new optional prop:
```ts
addToTodayMeal: SavedMealTemplate | null
```

When `addToTodayMeal` is set:
- Modal title → "Customize & Add"
- On open: deep-copy `addToTodayMeal.items` into `manualItems` state (same structure already used for manual meal logging). Pre-fill meal type from `savedMealTargets[meal.id] ?? meal.meal_type`.
- On submit: call `addMealEntry()` with the edited items and recalculated macros. Do NOT call `onSaveTemplate`. The original `SavedMealTemplate` is never written to.
- Hide the "Add to Saved Meals" toggle (not relevant when adding a copy).
- Macros recalculate live as the user edits ingredients, same as existing manual mode.

### State
Add to the parent component:
```ts
const [addToTodayMeal, setAddToTodayMeal] = useState<SavedMealTemplate | null>(null)
```

"Edit & Add" onClick: `setAddToTodayMeal(meal)` + open the modal.
On modal close/submit: `setAddToTodayMeal(null)`.

---

## Feature 3: Workout Persists After App Close

### File
- `app/dashboard/workouts/page.tsx`

### Problem
`runningWorkout` is plain `useState` — it clears when the app closes. `activeWorkoutSession` is written to `localStorage` on every change, so the data survives. But the auto-resume effect requires `?resume=1` in the URL, which is not present after a fresh app open.

### Fix
In the localStorage hydration effect (the `useEffect` that reads `ACTIVE_WORKOUT_SESSION_KEY` on mount), after successfully parsing a valid session, also call:
```ts
setRunningWorkout(parsed.workout)
```

This makes the workout resume immediately on app open — the full workout tracker is shown, not the "paused" banner. No query param needed.

### Edge case
If the user is actively looking at a different part of the app and opens the workouts tab, they'll land directly in the tracker. This is acceptable and matches the existing behavior when `?resume=1` is present.

---

## Feature 4: Rest Timer Only on Most Recent Completed Set

### File
- `app/dashboard/workouts/page.tsx`

### Problem
Every completed set renders a rest timer row (idle "Start rest timer" button), creating visual noise when multiple sets are done.

### Fix
Within each exercise's set render loop, compute the index of the **last completed set**:
```ts
const lastCompletedIndex = exercise.sets.reduce(
  (last, set, i) => (set.completed ? i : last),
  -1
)
```

Only render the rest timer row (active countdown or idle "Start rest timer" button) when `setIndex === lastCompletedIndex`. All other completed sets render nothing below them.

This applies to both render paths:
- The active workout tracker (the modal/overlay with `exercises` state)
- The manual "log a workout" panel with `manualExercises` state

---

## Feature 5: Drag to Reorder Exercises During Active Workout

### File
- `app/dashboard/workouts/page.tsx`

### Dependency
`framer-motion` is already installed. Use `Reorder.Group` / `Reorder.Item` from `framer-motion/components/reorder`.

### Scope
Active workout tracker only (the overlay/modal driven by `exercises` state). Not the edit-logged-workout view.

### Implementation
Replace the exercise list `<div className="space-y-4">` wrapper with `<Reorder.Group axis="y" values={exercises} onReorder={setExercises}>`. Each exercise card `<div>` becomes `<Reorder.Item value={exercise} key={...}>`.

Add a drag handle (≡ `GripVertical` icon from lucide) to each exercise card header. Use `useDragControls()` from framer-motion: attach `dragControls.start(e)` on `onPointerDown` of the handle so only the handle initiates drag (not the whole card, which would conflict with inputs).

On reorder, `setExercises(newOrder)` — the `activeWorkoutSession` effect already persists this to localStorage on every state change, so reorder is automatically durable.

### Mobile
`Reorder.Item` uses pointer events which work on touch. Hold-and-drag activates naturally. No additional touch handling needed.

---

## Feature 6: Bayesian Curls in Exercise Library

### File
- `lib/content-library.ts`
- `lib/exercise-classifications.ts` (if it exists and covers unilateral flags)

### Entries to add to `EXERCISE_LIBRARY`

**Bayesian Curl (Both Arms)**
```ts
{
  id: 'lib-bayesian-curl-bilateral',
  name: 'Bayesian Curl',
  aliases: ['bayesian curl', 'cable bayesian curl', 'behind body curl'],
  muscle_groups: ['biceps'],
  equipment: 'Cable Machine',
  difficulty: 'intermediate',
  description: 'Cable curl with the pulley anchored behind the body, maximizing long-head bicep stretch under load.',
  instructions: [
    'Set cable pulley to low position behind you',
    'Step forward to create tension at full arm extension',
    'Curl without moving the elbow forward',
    'Squeeze hard at the top, slow eccentric',
  ],
  default_sets: 3,
  default_reps: 12,
  default_rest_seconds: 75,
  met_base: 4.0,
  met_type: 'resistance',
  primary_type: 'strength',
}
```

**Bayesian Curl (Single Arm)**
```ts
{
  id: 'lib-bayesian-curl-unilateral',
  name: 'Single-Arm Bayesian Curl',
  aliases: ['single arm bayesian curl', 'unilateral bayesian curl', 'one arm bayesian curl'],
  muscle_groups: ['biceps'],
  equipment: 'Cable Machine',
  difficulty: 'intermediate',
  description: 'Unilateral cable curl with pulley behind the body for maximum long-head stretch and independent arm loading.',
  instructions: [
    'Set cable pulley to low position behind you',
    'Stagger stance, grip D-handle',
    'Keep elbow stationary, curl to shoulder',
    'Control the eccentric for full stretch',
  ],
  default_sets: 3,
  default_reps: 12,
  default_rest_seconds: 75,
  met_base: 4.0,
  met_type: 'resistance',
  primary_type: 'strength',
}
```

Add `'lib-bayesian-curl-unilateral'` to `EXERCISE_CLASSIFICATIONS` with `modifiers: ['unilateral']` so the progression system and unilateral detection work correctly.

---

## Out of Scope
- No changes to the Requested/Pending follow state behavior
- No changes to the "Edit template" pencil button on saved meal cards (still edits the original)
- Drag reorder is not added to the workout builder or logged workout editor
