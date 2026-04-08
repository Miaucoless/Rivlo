# Follow Button, Edit & Add Meal, Workout UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted UX improvements: follow-button unfollow dropdown, Edit & Add for saved meals, workout session auto-resume on app reopen, rest timer only on the last completed set, drag-to-reorder exercises during active workout, and Bayesian Curl entries in the exercise library.

**Architecture:** All changes are localized to three files — `app/dashboard/workouts/page.tsx`, `app/dashboard/meals/page.tsx`, and `lib/content-library.ts` / `lib/exercise-classifications.ts`. No new files, no new dependencies (framer-motion and @radix-ui/react-dropdown-menu already installed).

**Tech Stack:** Next.js 14 App Router, React, Zustand, Tailwind CSS, framer-motion (Reorder API), Radix UI DropdownMenu, localStorage, TypeScript

---

## File Map

| File | What changes |
|------|-------------|
| `app/dashboard/profile/[username]/page.tsx` | Replace "Following" button with DropdownMenu at both callsites |
| `app/dashboard/feed/page.tsx` | Replace "Following" button with DropdownMenu in People tab |
| `app/dashboard/meals/page.tsx` | Add `addToTodayMeal` prop to `MealEditorModal`; add "Edit & Add" button; add state/handler |
| `app/dashboard/workouts/page.tsx` | Auto-resume on reopen; rest timer on last set only; drag reorder |
| `lib/content-library.ts` | Add two Bayesian Curl entries to `EXERCISE_LIBRARY` |
| `lib/exercise-classifications.ts` | Add two Bayesian Curl entries to `EXERCISE_CLASSIFICATIONS` |

---

## Task 1: Following → Unfollow Dropdown (profile page)

**Files:**
- Modify: `app/dashboard/profile/[username]/page.tsx:458-466` (header button)
- Modify: `app/dashboard/profile/[username]/page.tsx:482-488` (private-profile card button)

The profile page already imports `Button` from `@/components/ui/button`. Add imports for `DropdownMenu` components.

- [ ] **Step 1: Add DropdownMenu imports**

Open `app/dashboard/profile/[username]/page.tsx`. Find the existing imports block (near the top). Add:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

- [ ] **Step 2: Replace header "Following" button**

Find this block around line 457–467:

```tsx
{currentUserMatches ? null : (
  <Button onClick={handleFollow} className="rounded-full md:mt-2">
    {relationship?.status === 'accepted'
      ? 'Following'
      : relationship?.status === 'pending'
        ? 'Requested'
        : profileUser.profile_visibility === 'private'
          ? 'Request Follow'
          : 'Follow'}
  </Button>
)}
```

Replace with:

```tsx
{currentUserMatches ? null : (
  relationship?.status === 'accepted' ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full md:mt-2">
          Following
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => unfollowUser(profileUser.id)}
        >
          Unfollow
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button onClick={handleFollow} className="rounded-full md:mt-2">
      {relationship?.status === 'pending'
        ? 'Requested'
        : profileUser.profile_visibility === 'private'
          ? 'Request Follow'
          : 'Follow'}
    </Button>
  )
)}
```

- [ ] **Step 3: Replace private-profile card "Following"/"Request Follow" button**

Find this block around line 482–488:

```tsx
{currentUserMatches ? null : (
  <div className="mt-5 flex justify-center">
    <Button onClick={handleFollow} className="rounded-full">
      {relationship?.status === 'pending' ? 'Requested' : 'Request Follow'}
    </Button>
  </div>
)}
```

This block only renders when the profile is private AND the viewer can't see posts — so `relationship?.status` would be `null` or `pending` (never `accepted`, since accepted users can see posts). No dropdown needed here. Leave it unchanged.

- [ ] **Step 4: Verify visually**

Start dev server (`npm run dev`), navigate to another user's profile, click Follow, then verify:
- Button shows "Following"
- Clicking "Following" opens a dropdown with "Unfollow" in red
- Clicking "Unfollow" immediately removes the follow relationship and button reverts to "Follow"

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/profile/\[username\]/page.tsx
git commit -m "feat: follow button dropdown with unfollow on profile page"
```

---

## Task 2: Following → Unfollow Dropdown (feed page)

**Files:**
- Modify: `app/dashboard/feed/page.tsx:811-824`

The feed page People tab already computes `isFollowing` and `isPending` per profile in the render loop.

- [ ] **Step 1: Add DropdownMenu imports to feed page**

Open `app/dashboard/feed/page.tsx`. Add to the imports block:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

- [ ] **Step 2: Replace "Following" button in People tab**

Find this block around line 810–825:

```tsx
<div className="flex-shrink-0">
  {isFollowing ? (
    <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
      Following
    </Button>
  ) : isPending ? (
    <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
      Requested
    </Button>
  ) : (
    <Button size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      {profile.profile_visibility === 'private' ? 'Request' : 'Follow'}
    </Button>
  )}
</div>
```

Replace with:

```tsx
<div className="flex-shrink-0">
  {isFollowing ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          Following
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => handleFollowAction(profile)}
        >
          Unfollow
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : isPending ? (
    <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
      Requested
    </Button>
  ) : (
    <Button size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      {profile.profile_visibility === 'private' ? 'Request' : 'Follow'}
    </Button>
  )}
</div>
```

- [ ] **Step 3: Verify**

Navigate to Feed → People tab. Find a user you follow. Confirm:
- Button shows "Following" (outline variant)
- Clicking opens dropdown with "Unfollow" in red
- Clicking "Unfollow" immediately unfollows, button reverts to "Follow"

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/feed/page.tsx
git commit -m "feat: follow button dropdown with unfollow on feed people tab"
```

---

## Task 3: Edit & Add for Saved Meals

**Files:**
- Modify: `app/dashboard/meals/page.tsx`

`MealEditorModal` (defined at line 1134) needs a new `addToTodayMeal` prop. The parent component (around line 4066) needs new state and a handler. The saved meal card (around line 4780) needs a new button.

- [ ] **Step 1: Add `addToTodayMeal` prop to `MealEditorModal`**

Find the `MealEditorModal` function signature and its props interface (lines 1134–1152):

```tsx
function MealEditorModal({
  open,
  onOpenChange,
  initialMealType,
  editingMeal,
  editingSavedMeal,
  onSave,
  onSaveTemplate,
  onOpenScanner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMealType: MealType | null
  editingMeal: MealLogEntry | null
  editingSavedMeal: SavedMealTemplate | null
  onSave: (data: Omit<MealLogEntry, 'id'>) => void
  onSaveTemplate: (meal: Omit<SavedMealTemplate, 'id' | 'updated_at'>, existingId?: string) => void
  onOpenScanner?: () => void
}) {
```

Replace with:

```tsx
function MealEditorModal({
  open,
  onOpenChange,
  initialMealType,
  editingMeal,
  editingSavedMeal,
  addToTodayMeal,
  onSave,
  onSaveTemplate,
  onOpenScanner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMealType: MealType | null
  editingMeal: MealLogEntry | null
  editingSavedMeal: SavedMealTemplate | null
  addToTodayMeal: SavedMealTemplate | null
  onSave: (data: Omit<MealLogEntry, 'id'>) => void
  onSaveTemplate: (meal: Omit<SavedMealTemplate, 'id' | 'updated_at'>, existingId?: string) => void
  onOpenScanner?: () => void
}) {
```

- [ ] **Step 2: Update `isMealTypeLocked` to account for `addToTodayMeal`**

Find line 1154:
```tsx
const isMealTypeLocked = initialMealType !== null && !editingMeal && !editingSavedMeal
```
Replace with:
```tsx
const isMealTypeLocked = initialMealType !== null && !editingMeal && !editingSavedMeal && !addToTodayMeal
```

- [ ] **Step 3: Seed initial state from `addToTodayMeal` on open**

Find the `useEffect` that seeds state when the modal opens (around line 1872, `}, [editingMeal, editingSavedMeal, initialMealType, open])`). Look for the block that handles `editingSavedMeal` — it starts around line 1709:

```tsx
if (editingSavedMeal) {
```

Add a parallel block immediately before it for `addToTodayMeal`:

```tsx
if (addToTodayMeal) {
  setMealType(addToTodayMeal.meal_type)
  setUsingList(true)
  setManualMealName(addToTodayMeal.name)
  setManualCalories(String(addToTodayMeal.macros.calories))
  setManualProtein(String(addToTodayMeal.macros.protein_g))
  setManualCarbs(String(addToTodayMeal.macros.carbs_g))
  setManualFat(String(addToTodayMeal.macros.fat_g))
  setManualItems(
    addToTodayMeal.items.map((item) => ({
      id: `ing-${Date.now()}-${Math.random()}`,
      name: item.matched_name,
      amount: item.amount ?? 1,
      unit: item.unit,
      macros: item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    }))
  )
  return
}
```

Also add `addToTodayMeal` to the dependency array of this effect:
```tsx
}, [editingMeal, editingSavedMeal, addToTodayMeal, initialMealType, open])
```

- [ ] **Step 4: Route submit to `onSave` instead of `onSaveTemplate` when in addToTodayMeal mode**

Find the `editingSavedMeal` branch in the submit handler (around line 2107):

```tsx
if (editingSavedMeal) {
  // ... calls onSaveTemplate
  onOpenChange(false)
  return
}
```

Add a new branch immediately before it:

```tsx
if (addToTodayMeal) {
  onSave({
    meal_type: mealType,
    name: finalName,
    macros: finalMacros,
    time: format(new Date(), 'h:mm a'),
    recipe: null,
    meal_items: manualItems.map((item) => ({
      name: item.name,
      macros: {
        calories: item.macros.calories,
        protein_g: item.macros.protein_g ?? 0,
        carbs_g: item.macros.carbs_g ?? 0,
        fat_g: item.macros.fat_g ?? 0,
      },
      amount: item.amount,
      unit: item.unit,
    })),
    entry_source: 'saved',
    saved_meal_template_id: addToTodayMeal.id,
  })
  onOpenChange(false)
  return
}
```

- [ ] **Step 5: Update dialog title and hide "Add to Saved Meals" toggle**

Find the dialog title around line 2311:
```tsx
{editingSavedMeal ? 'Edit saved meal' : editingMeal ? 'Edit meal entry' : 'Add meal entry'}
```
Replace with:
```tsx
{addToTodayMeal ? 'Customize & Add' : editingSavedMeal ? 'Edit saved meal' : editingMeal ? 'Edit meal entry' : 'Add meal entry'}
```

Find the "Add to Saved Meals" toggle (around line 2966, `{!editingSavedMeal && (`). Update the condition to also hide in addToTodayMeal mode:

```tsx
{!editingSavedMeal && !addToTodayMeal && (
```

- [ ] **Step 6: Add parent state and handler**

Find the state declarations around line 4069:
```tsx
const [editSavedMealOpen, setEditSavedMealOpen] = useState(false)
```

Add a new state variable below it:
```tsx
const [addToTodayMealOpen, setAddToTodayMealOpen] = useState(false)
const [addToTodayMealSource, setAddToTodayMealSource] = useState<SavedMealTemplate | null>(null)
```

- [ ] **Step 7: Add "Edit & Add" button to the saved meal card**

Find the saved meal card action row around line 4780:
```tsx
<Button variant="brand" size="sm" className="gap-1.5 text-xs h-8 shrink-0" onClick={() => handleAddSavedMealToToday(meal)}>
  <Plus className="w-3 h-3" />
  Add
</Button>
```

After this button, add:
```tsx
<Button
  variant="outline"
  size="sm"
  className="text-xs h-8 shrink-0"
  onClick={() => {
    setAddToTodayMealSource({ ...meal, meal_type: savedMealTargets[meal.id] ?? meal.meal_type })
    setAddToTodayMealOpen(true)
  }}
>
  Edit & Add
</Button>
```

- [ ] **Step 8: Wire up the second MealEditorModal instance**

Find the `<MealEditorModal>` callsite around line 5731:
```tsx
<MealEditorModal
  open={editorOpen}
  onOpenChange={setEditorOpen}
  initialMealType={editorMealType}
  editingMeal={editingMeal}
  editingSavedMeal={null}
  onSave={handleSaveMeal}
  onSaveTemplate={handleSaveTemplate}
  onOpenScanner={...}
/>
```

Add `addToTodayMeal={null}` to this existing modal:
```tsx
<MealEditorModal
  open={editorOpen}
  onOpenChange={setEditorOpen}
  initialMealType={editorMealType}
  editingMeal={editingMeal}
  editingSavedMeal={null}
  addToTodayMeal={null}
  onSave={handleSaveMeal}
  onSaveTemplate={handleSaveTemplate}
  onOpenScanner={() => {
    setEditorOpen(false)
    openScanner('today', editingMeal?.meal_type ?? editorMealType ?? getSuggestedMealType())
  }}
/>
```

Then add a second `MealEditorModal` instance for the "Edit & Add" flow, immediately after the first:
```tsx
<MealEditorModal
  open={addToTodayMealOpen}
  onOpenChange={(open) => {
    setAddToTodayMealOpen(open)
    if (!open) setAddToTodayMealSource(null)
  }}
  initialMealType={addToTodayMealSource?.meal_type ?? null}
  editingMeal={null}
  editingSavedMeal={null}
  addToTodayMeal={addToTodayMealSource}
  onSave={handleSaveMeal}
  onSaveTemplate={handleSaveTemplate}
/>
```

- [ ] **Step 9: Verify**

1. Go to Meals → Saved Meals tab.
2. Click the instant **Add** button — meal goes straight to Today's Meals, no modal.
3. Click **Edit & Add** — modal opens titled "Customize & Add" with all ingredients pre-filled.
4. Remove an ingredient, change an amount, click save.
5. Go to Today's Meals — meal appears with your edits.
6. Go back to Saved Meals — original saved meal is unchanged.

- [ ] **Step 10: Commit**

```bash
git add app/dashboard/meals/page.tsx
git commit -m "feat: Edit & Add button for saved meals with non-destructive copy"
```

---

## Task 4: Workout Auto-Resumes After App Close

**Files:**
- Modify: `app/dashboard/workouts/page.tsx:3503-3515`

The localStorage hydration effect reads the session back successfully, but doesn't call `setRunningWorkout`, so the user sees the "paused" banner instead of the live tracker.

- [ ] **Step 1: Update the hydration effect**

Find this effect (lines 3503–3515):

```tsx
useEffect(() => {
  if (typeof window === 'undefined') return

  try {
    const rawSession = window.localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY)
    if (!rawSession) return
    const parsed = JSON.parse(rawSession) as PersistedActiveWorkoutSession
    if (!parsed?.workout || !Array.isArray(parsed.exercises)) return
    setActiveWorkoutSession(parsed)
  } catch {
    window.localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY)
  }
}, [])
```

Replace with:

```tsx
useEffect(() => {
  if (typeof window === 'undefined') return

  try {
    const rawSession = window.localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY)
    if (!rawSession) return
    const parsed = JSON.parse(rawSession) as PersistedActiveWorkoutSession
    if (!parsed?.workout || !Array.isArray(parsed.exercises)) return
    setActiveWorkoutSession(parsed)
    setRunningWorkout(parsed.workout)
  } catch {
    window.localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY)
  }
}, [])
```

- [ ] **Step 2: Verify**

1. Start a workout, complete one set.
2. Hard-refresh the page (Cmd+Shift+R / Ctrl+Shift+R) or close and reopen the tab.
3. The workout tracker should open immediately showing the in-progress workout with your completed set intact.
4. Click Discard and verify it clears correctly.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "feat: auto-resume active workout after app close or page refresh"
```

---

## Task 5: Rest Timer Only on Last Completed Set

**Files:**
- Modify: `app/dashboard/workouts/page.tsx` — two render paths

There are two exercise list render paths:
1. **Active workout tracker** — `exercises` state, render loop starting at line ~2789
2. **Manual log workout** — `manualExercises` state, render loop starting at line ~4821

### Path A: Active workout tracker

- [ ] **Step 1: Compute `lastCompletedSetIndex` in the exercise render loop**

Find line ~2790:
```tsx
{exercises.map((exercise, exerciseIndex) => {
  const inputMode = getExerciseInputMode(exercise.exercise)
  const prevData = ...
  return <div key={...} className="rounded-2xl border ...">
```

Add `lastCompletedSetIndex` right after `prevData`:

```tsx
const lastCompletedSetIndex = exercise.sets.reduce(
  (last, set, i) => (set.completed ? i : last),
  -1
)
```

- [ ] **Step 2: Wrap the rest-timer row with the index guard**

In the active tracker's set render loop, find the block that renders after a completed set (around line 2996 in the strength branch — search for `restEndsAtMs`). It looks like:

```tsx
{set.completed && (
  <div className={cn('px-4 py-3 border-t border-border/40', ...)}>
    {restRemainingSeconds > 0 ? (
      // active rest timer
    ) : (
      // "Start rest timer" button
    )}
  </div>
)}
```

**Note:** In the active tracker this rest-timer row is inside the outer set loop that uses `exercises` state. It only exists in the `strength` branch (other input modes don't have one). It uses `restEndsAtMs` / `restRemainingSeconds`.

Change the outer condition from:
```tsx
{set.completed && (
```
to:
```tsx
{set.completed && setIndex === lastCompletedSetIndex && (
```

### Path B: Manual log workout

- [ ] **Step 3: Compute `lastCompletedSetIndex` in the manual exercise render loop**

Find line ~4821 (the `manualExercises.map` loop). Inside the per-exercise render, add after the `inputMode` declaration:

```tsx
const lastCompletedSetIndex = exercise.sets.reduce(
  (last, set, i) => (set.completed ? i : last),
  -1
)
```

- [ ] **Step 4: Apply the guard in the manual strength set render**

Find the rest-timer row in the manual tracker (around line 4903):
```tsx
{set.completed && (
  <div className={cn('px-4 py-2 border-t border-border/20 flex items-center gap-3', ...)}>
```

Change to:
```tsx
{set.completed && setIndex === lastCompletedSetIndex && (
  <div className={cn('px-4 py-2 border-t border-border/20 flex items-center gap-3', ...)}>
```

- [ ] **Step 5: Verify**

1. Start a workout with a strength exercise.
2. Complete Set 1 — "Start rest timer" appears.
3. Complete Set 2 — "Start rest timer" disappears from Set 1, appears only under Set 2.
4. Start the rest timer on Set 2 — countdown shows only under Set 2.
5. Uncheck Set 2 — Set 1 gets the rest timer back (it's now the last completed).

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "fix: show rest timer only on most recent completed set"
```

---

## Task 6: Drag to Reorder Exercises During Active Workout

**Files:**
- Modify: `app/dashboard/workouts/page.tsx`

`framer-motion` is already in `package.json`. We use `Reorder.Group` and `Reorder.Item` from framer-motion with `useDragControls` so only the grip handle initiates drag (prevents conflicts with inputs).

- [ ] **Step 1: Add framer-motion Reorder imports**

Find the framer-motion import in `app/dashboard/workouts/page.tsx` (search for `framer-motion`). It probably looks like:
```tsx
import { motion, AnimatePresence } from 'framer-motion'
```
Add `Reorder` and `useDragControls` to it (note: `useDragControls` is used per-item, so it's called inside the map — see Step 3):
```tsx
import { motion, AnimatePresence, Reorder } from 'framer-motion'
```

Also add `GripVertical` to the lucide-react imports:
```tsx
import { ..., GripVertical } from 'lucide-react'
```

- [ ] **Step 2: Replace the exercise list wrapper with `Reorder.Group`**

In the active workout tracker, find the exercise list wrapper (line ~2789):
```tsx
<div className="space-y-4">
  {exercises.map((exercise, exerciseIndex) => {
```

Replace with:
```tsx
<Reorder.Group
  axis="y"
  values={exercises}
  onReorder={setExercises}
  className="space-y-4 list-none p-0 m-0"
>
  {exercises.map((exercise, exerciseIndex) => {
```

And close it with `</Reorder.Group>` where the old `</div>` was (after `})}` at line ~3032).

- [ ] **Step 3: Wrap each exercise card in `Reorder.Item` with drag controls**

`useDragControls` must be called per-item. Since it's inside a `.map()`, extract the per-exercise render into an inline component or use a trick: define a small wrapper component at the top of the file (above the main page component, around line ~1200).

Add this component near other helper components (e.g. after `TodayWorkoutBanner` around line 1250):

```tsx
function DraggableExerciseCard({
  exercise,
  children,
}: {
  exercise: ActiveExercise
  children: (dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void }) => React.ReactNode
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={exercise} dragListener={false} dragControls={controls}>
      {children({ onPointerDown: (e) => controls.start(e) })}
    </Reorder.Item>
  )
}
```

Import `useDragControls` at the top:
```tsx
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
```

- [ ] **Step 4: Use `DraggableExerciseCard` in the exercise map**

Replace this (line ~2793):
```tsx
return <div key={`${exercise.exercise.id}-${exerciseIndex}`} className="rounded-2xl border border-border/60 bg-card p-4">
```

With:
```tsx
return (
  <DraggableExerciseCard key={`${exercise.exercise.id}-${exerciseIndex}`} exercise={exercise}>
    {({ onPointerDown }) => (
      <div className="rounded-2xl border border-border/60 bg-card p-4">
```

And close it appropriately at the end of the per-exercise `return` block (before the `})}` that ends `exercises.map`):
```tsx
      </div>
    )}
  </DraggableExerciseCard>
)
```

- [ ] **Step 5: Add drag handle to the exercise card header**

Inside the exercise card header (the `<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">` at line ~2794), add a grip handle as the first child:

```tsx
<div className="mb-3 flex items-start gap-2 sm:gap-3">
  <button
    type="button"
    onPointerDown={onPointerDown}
    className="mt-0.5 cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground/60 active:cursor-grabbing"
    aria-label="Drag to reorder"
  >
    <GripVertical className="h-4 w-4" />
  </button>
  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    {/* existing header content */}
  </div>
</div>
```

Close the added wrapper div before the `</div>` that ends the header.

- [ ] **Step 6: Verify**

1. Start a workout with 3+ exercises.
2. On desktop: press and hold the grip (≡) icon on any exercise, drag it to a new position.
3. On mobile (or using touch emulation): touch-hold the grip and drag.
4. Release — the exercise is in the new position.
5. Pause the workout and resume — order is preserved (it's persisted to localStorage via `activeWorkoutSession`).

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "feat: drag to reorder exercises during active workout"
```

---

## Task 7: Add Bayesian Curls to Exercise Library

**Files:**
- Modify: `lib/content-library.ts` — after `lib-cross-body-hammer-curl` entry (line 5089)
- Modify: `lib/exercise-classifications.ts` — after `lib-cross-body-hammer-curl` entry (line 116)

- [ ] **Step 1: Add entries to `EXERCISE_LIBRARY`**

Open `lib/content-library.ts`. Find the end of the `lib-cross-body-hammer-curl` entry (around line 5089):
```ts
    met_base: 4.3,
    met_type: 'resistance',
  },
  {
    id: 'lib-cable-overhead-tricep-extension',
```

Insert two new entries between them:

```ts
    met_base: 4.3,
    met_type: 'resistance',
  },
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
  },
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
  },
  {
    id: 'lib-cable-overhead-tricep-extension',
```

- [ ] **Step 2: Add entries to `EXERCISE_CLASSIFICATIONS`**

Open `lib/exercise-classifications.ts`. Find line 116:
```ts
  'lib-cross-body-hammer-curl':    { primary_type: 'strength', modifiers: ['unilateral', 'alternating'] },
```

Add two new lines immediately after it:
```ts
  'lib-bayesian-curl-bilateral':   { primary_type: 'strength' },
  'lib-bayesian-curl-unilateral':  { primary_type: 'strength', modifiers: ['unilateral'] },
```

- [ ] **Step 3: Verify**

1. Go to the workout builder or the exercise search in an active workout.
2. Type "bayesian" — both "Bayesian Curl" and "Single-Arm Bayesian Curl" should appear.
3. Add "Bayesian Curl" to a workout — it should show the Cable Machine equipment label and default 3×12.

- [ ] **Step 4: Commit**

```bash
git add lib/content-library.ts lib/exercise-classifications.ts
git commit -m "feat: add Bayesian Curl (bilateral and single-arm) to exercise library"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Feature 1 (Follow dropdown): Tasks 1 & 2 cover both locations (profile + feed)
- ✅ Feature 2 (Edit & Add meal): Task 3 covers the full flow
- ✅ Feature 3 (Workout persists): Task 4
- ✅ Feature 4 (Rest timer on last set): Task 5, both render paths
- ✅ Feature 5 (Drag reorder): Task 6
- ✅ Feature 6 (Bayesian Curls): Task 7

**Placeholder scan:** None found — all steps have complete code.

**Type consistency:**
- `addToTodayMeal: SavedMealTemplate | null` used consistently in Task 3 steps 1–8
- `ActiveExercise` used as the `Reorder.Item` value type — matches the existing `exercises: ActiveExercise[]` state type
- `DraggableExerciseCard` receives `exercise: ActiveExercise` — consistent with the map's typed value
- `lastCompletedSetIndex` is `number` (`-1` when none) — guards correctly with `setIndex === lastCompletedSetIndex`
