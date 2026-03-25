# Water Intake Feature — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

A water intake tracking widget on the main dashboard. Users can log how much water they've drunk throughout the day via quick-add buttons or a custom amount modal. The water level is visualised as an animated filling bottle that responds in real time to each log entry.

---

## Layout

The current 4-card stat row (Calories Today · Protein · Weight · Workouts) is replaced with a **3-column stat row**:

```
[ Calories Today ] [ Protein ] [ Water Intake ]
```

- The `Weight` and `Workouts` stat cards are **intentionally removed** per user request to keep the top section uncluttered and the water card visible above the fold without scrolling.
- On mobile (`grid-cols-2`): Calories and Protein occupy the first row; the Water card spans both columns (`col-span-2`) as a full-width third item.

---

## Data Model

### New type: `WaterEntry` (`types/index.ts`)

```ts
export interface WaterEntry {
  id: string
  user_id: string
  date: string       // ISO YYYY-MM-DD
  amount_ml: number
  logged_at: string  // ISO timestamp
}
```

### `UserProfile` addition

```ts
water_goal_ml: number  // default: Math.round(weight_kg * 35 / 50) * 50
```

Default formula: `Math.round((weight_kg ?? 70) * 35 / 50) * 50` — multiply body weight in kg by 35 mL, then round to the nearest 50 mL increment. Falls back to `70 kg` (producing `2,450 → 2,450 mL`) when `weight_kg` is absent (demo mode, incomplete onboarding). Minimum clamped to `500`, maximum to `10,000`. Editable in profile settings and inline on the water card.

**Required prerequisite:** Add `water_goal_ml: number` to the `UserProfile` interface in `types/index.ts` before wiring up the store or components.

---

## Store (`store/useAppStore.ts`)

### New state

```ts
waterLogs: Record<string, WaterEntry[]>  // keyed by ISO date YYYY-MM-DD
```

### New actions

| Action | Signature | Behaviour |
|---|---|---|
| `addWaterEntry` | `(entry: WaterEntry) => void` | Appends to `waterLogs[entry.date]`, upserts to cloud |
| `removeWaterEntry` | `(date: string, entryId: string) => void` | Removes by id, deletes from cloud |
| `updateWaterGoal` | `(ml: number) => void` | Calls the existing `updateProfile(({ water_goal_ml: ml })` action (which accepts `Partial<UserProfile>`) and persists to cloud. No new action needed — `updateProfile` already handles partial updates and cloud sync. This works only after `water_goal_ml` is added to `UserProfile` in `types/index.ts`. |

All mutations are **optimistic**: local state is updated immediately, then synced to the cloud in the background. On sync failure, log to console and show `toast.error` — local state is kept intact (matching existing meal entry behaviour).

### Selector

```ts
getWaterTotal(date: string): number
// Returns sum of amount_ml for all entries on that date. Returns 0 if no entries exist.
// Implemented as a method on the Zustand store slice (same pattern as getDailyTotals).
// Called as: const { getWaterTotal } = useAppStore()
// Pure derived value — no side effects, does not mutate state.
```

### Cloud sync

Two new functions added to **`lib/cloud-sync.ts`** (same file as all existing sync functions), mirroring the meal entry pattern:
- `upsertWaterLog(entry: WaterEntry): Promise<void>`
- `deleteWaterLog(entryId: string): Promise<void>`

### Auto-reset

No explicit reset needed. `waterLogs` is keyed by ISO date, so `waterLogs[getTodayISO()]` is naturally empty at the start of each new day.

---

## Components

### `components/dashboard/WaterIntakeCard.tsx`

The stat card rendered in the third column of the top row.

**Visual elements:**
- Mini tall bottle SVG with animated water fill
  - Fill height = `(todayTotal / water_goal_ml) * 100%`
  - Framer Motion `height` spring animation on each log
  - Subtle bubble details inside the water fill
- Below bottle: `1,500 / 2,500 mL` text
- Goal amount with pencil icon → inline `<Input>` → on blur/enter saves to `UserProfile.water_goal_ml`
- `+250 mL` and `+500 mL` buttons — tap instantly adds entry and triggers fill animation
- `+ Custom` button — opens `WaterLogModal`

**Celebration (100% reached):**
- Framer Motion wave burst: `scaleX` 1→1.4, opacity 1→0 on the wave element
- `toast.success("Hydration goal reached! 🎉")`
- Fires at most once per calendar day, persisting across navigation. Implemented by reading/writing a `rivlo-water-celebrated` key in `localStorage` that stores the ISO date of the last celebration. A `useEffect` watching `todayTotal` triggers the animation only when `todayTotal >= water_goal_ml` and `localStorage.getItem('rivlo-water-celebrated') !== getTodayISO()`, then writes `getTodayISO()` to that key. This survives component unmount/remount and resets naturally the following day.

### `components/dashboard/WaterLogModal.tsx`

Opened by the `+ Custom` button on the water card.

**Contents:**
- `<Dialog>` using existing `@/components/ui/dialog`
- Number input for mL amount (placeholder `e.g. 330`)
- "Add" confirm button — calls `addWaterEntry`, animates bottle fill, closes modal
- **Today's log list** — scrollable list of today's `WaterEntry` items:
  - Format: `"9:30 AM · +500 mL"`
  - Trash icon per row calls `removeWaterEntry`
  - Empty state: `"No entries yet today"`

---

## Dashboard Changes (`app/dashboard/dashboard/page.tsx`)

1. Remove `Weight` and `Workouts` objects from the stats array.
2. Change the grid from `grid-cols-2 lg:grid-cols-4` to `grid-cols-2 lg:grid-cols-3`.
3. Add `<WaterIntakeCard />` as the third item in the stats row (not inside the `.map()` — rendered separately as it has its own internal state).
4. Apply `col-span-2 lg:col-span-1` to `<WaterIntakeCard />` so it spans both columns on mobile (`grid-cols-2`) and sits in the single third column on larger screens (`lg:grid-cols-3`). The two mapped stat cards (Calories, Protein) require no `col-span` change — they default to `col-span-1` and each occupy one column at all breakpoints.

---

## Error Handling

- Goal edit input: clamp to range `[500, 10000]` mL; invalid values revert to the previous goal on blur.
- Quick-add buttons: no validation needed (fixed amounts).
- Custom modal input: disable "Add" button if value is empty, zero, or non-numeric.
- Cloud sync failures: follow existing pattern — log to console, show `toast.error`, keep local state intact.

---

## Out of Scope

- Hydration reminders / push notifications
- Drink type tracking (water vs coffee vs sports drink)
- 7-day sparkline history chart
- Workout-based hydration suggestions

These can be added in a future iteration once the core feature is live.
