# Workout Timer Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent timer panel to `ActiveWorkoutModal` — a sticky left strip on desktop (≥640px) and a collapsible bottom bar on mobile (<640px).

**Architecture:** Two new components receive already-computed values (`liveDurationSeconds`, `restRemainingSeconds`, `progress`) from `ActiveWorkoutModal`. The modal layout restructures from a single scrollable column to a flex row — strip on the left, scrollable content on the right. The mobile bar uses `absolute` positioning within a `relative` flex wrapper so it overlays the content without affecting layout flow.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui Dialog

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `components/workout/WorkoutTimerStrip.tsx` | Desktop left strip — stateless, SVG rings, duration + rest + skip |
| Create | `components/workout/WorkoutTimerBar.tsx` | Mobile bottom bar — owns `collapsed` state, auto-expands on rest |
| Modify | `app/dashboard/workouts/page.tsx` | Wire both components; restructure `DialogContent` layout |

---

### Task 1: Create `WorkoutTimerStrip`

**Files:**
- Create: `components/workout/WorkoutTimerStrip.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client'

interface WorkoutTimerStripProps {
  durationSeconds: number
  restSeconds: number
  progress: number       // 0–100
  onSkipRest: () => void
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const CIRCUMFERENCE = 2 * Math.PI * 24 // ≈ 150.796

export function WorkoutTimerStrip({ durationSeconds, restSeconds, progress, onSkipRest }: WorkoutTimerStripProps) {
  const restActive = restSeconds > 0
  const durationOffset = CIRCUMFERENCE * (1 - progress / 100)
  // Rest ring: half-filled when active (decorative), empty when idle
  const restOffset = restActive ? CIRCUMFERENCE * 0.5 : CIRCUMFERENCE

  return (
    <div className="hidden w-24 flex-shrink-0 flex-col items-center gap-4 self-start border-r border-border/40 bg-[#0b1a15] px-2 py-4 sm:flex sticky top-0">
      <p className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Workout</p>

      {/* Duration ring */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative flex h-[60px] w-[60px] items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-border/40" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke="currentColor" strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={durationOffset}
              strokeLinecap="round"
              className="text-emerald-500 transition-all duration-1000"
            />
          </svg>
          <span className="absolute font-mono text-[11px] font-bold text-emerald-400">
            {formatTime(durationSeconds)}
          </span>
        </div>
        <p className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Duration</p>
      </div>

      <div className="h-px w-14 bg-border/40" />

      {/* Rest ring */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative flex h-[60px] w-[60px] items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-border/40" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke="currentColor" strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={restOffset}
              strokeLinecap="round"
              className={restActive ? 'text-amber-400 transition-all duration-1000' : 'text-border/20'}
            />
          </svg>
          <span className={`absolute font-mono text-[11px] font-bold ${restActive ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {restActive ? formatTime(restSeconds) : '—'}
          </span>
        </div>
        <p className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Rest</p>
      </div>

      {restActive && (
        <button
          type="button"
          onClick={onSkipRest}
          className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
        </button>
      )}

      <div className="flex-1" />

      <p className="px-1 text-center text-[9px] text-muted-foreground/70">
        {progress}%<br />done
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to `WorkoutTimerStrip.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/workout/WorkoutTimerStrip.tsx
git commit -m "feat: add WorkoutTimerStrip desktop timer component"
```

---

### Task 2: Create `WorkoutTimerBar`

**Files:**
- Create: `components/workout/WorkoutTimerBar.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface WorkoutTimerBarProps {
  durationSeconds: number
  restSeconds: number
  onSkipRest: () => void
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function WorkoutTimerBar({ durationSeconds, restSeconds, onSkipRest }: WorkoutTimerBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const prevRestRef = useRef(0)
  const restActive = restSeconds > 0

  // Auto-expand whenever rest timer starts (restSeconds transitions from 0 → >0)
  useEffect(() => {
    if (prevRestRef.current === 0 && restSeconds > 0) {
      setCollapsed(false)
    }
    prevRestRef.current = restSeconds
  }, [restSeconds])

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`absolute bottom-2.5 right-2.5 z-50 flex items-center gap-1.5 rounded-full border bg-[#0b1a15] px-2.5 py-1.5 sm:hidden ${
          restActive ? 'border-amber-400/40' : 'border-border/40'
        }`}
      >
        <span className="font-mono text-xs font-bold text-emerald-400">{formatTime(durationSeconds)}</span>
        {restActive && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="font-mono text-xs font-bold text-amber-400">{formatTime(restSeconds)}</span>
          </>
        )}
        <span className="ml-0.5 text-[10px] text-muted-foreground">↑</span>
      </button>
    )
  }

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-[#0b1a15] px-3 py-2 sm:hidden ${
        restActive ? 'border-t border-amber-400/30' : 'border-t border-border/40'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className="text-center">
          <p className="font-mono text-base font-bold leading-none text-emerald-400">{formatTime(durationSeconds)}</p>
          <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-muted-foreground">Duration</p>
        </div>
        <div className="h-7 w-px bg-border/40" />
        <div className="text-center">
          <p className={`font-mono text-base font-bold leading-none ${restActive ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {restActive ? formatTime(restSeconds) : '—'}
          </p>
          <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-muted-foreground">Rest</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {restActive && (
          <button
            type="button"
            onClick={onSkipRest}
            className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg border border-border/50 bg-muted/20 px-1.5 py-1 text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground"
        >
          ↓
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to `WorkoutTimerBar.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/workout/WorkoutTimerBar.tsx
git commit -m "feat: add WorkoutTimerBar mobile timer component"
```

---

### Task 3: Wire both components into `ActiveWorkoutModal`

**Files:**
- Modify: `app/dashboard/workouts/page.tsx`

This task restructures the `ActiveWorkoutModal` return JSX. Eight focused edits, in order.

- [ ] **Step 1: Add imports**

Find the import block at the top of `app/dashboard/workouts/page.tsx` (around line 12 where `ShareModal` is imported). Add after the existing local component imports:

```ts
import { WorkoutTimerBar } from '@/components/workout/WorkoutTimerBar'
import { WorkoutTimerStrip } from '@/components/workout/WorkoutTimerStrip'
```

- [ ] **Step 2: Change `DialogContent` — remove scroll/padding, add flex column**

Old:
```tsx
    <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-x-hidden overflow-y-auto p-3 sm:p-6">
```

New:
```tsx
    <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0">
```

- [ ] **Step 3: Add padding back to `DialogHeader`**

Old:
```tsx
      <DialogHeader>
        <DialogTitle>{workout.name}</DialogTitle>
      </DialogHeader>
```

New:
```tsx
      <DialogHeader className="flex-shrink-0 px-3 pb-0 pt-3 sm:px-6 sm:pt-6">
        <DialogTitle>{workout.name}</DialogTitle>
      </DialogHeader>
```

- [ ] **Step 4: Open the two-column flex wrapper and right-column scroll container**

Old:
```tsx
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
```

New:
```tsx
      <div className="relative flex min-h-0 flex-1">
        <WorkoutTimerStrip
          durationSeconds={liveDurationSeconds}
          restSeconds={restRemainingSeconds}
          progress={progress}
          onSkipRest={() => setRestEndsAtMs(null)}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="space-y-5 pb-16 sm:pb-0">
            <div className="grid grid-cols-2 gap-2">
```

- [ ] **Step 5: Hide the Live timer and Rest stat cards on sm+**

Old:
```tsx
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{formatElapsedSeconds(liveDurationSeconds)}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live timer</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{restRemainingSeconds > 0 ? formatElapsedSeconds(restRemainingSeconds) : '—'}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rest</p>
          </div>
```

New:
```tsx
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
            <p className="font-data text-2xl font-semibold">{formatElapsedSeconds(liveDurationSeconds)}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live timer</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
            <p className="font-data text-2xl font-semibold">{restRemainingSeconds > 0 ? formatElapsedSeconds(restRemainingSeconds) : '—'}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rest</p>
          </div>
```

- [ ] **Step 6: Hide the session timing panel on sm+**

Old:
```tsx
        {startedAt && (
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
```

New:
```tsx
        {startedAt && (
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
```

- [ ] **Step 7: Close the new wrappers and insert `WorkoutTimerBar`**

The existing closing section (after the Complete Workout button and before `ExercisePreviewDialog`):

Old:
```tsx
        </div>
      </div>
      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </DialogContent>
```

New:
```tsx
        </div>
          </div>
        </div>
        <WorkoutTimerBar
          durationSeconds={liveDurationSeconds}
          restSeconds={restRemainingSeconds}
          onSkipRest={() => setRestEndsAtMs(null)}
        />
      </div>
      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </DialogContent>
```

- [ ] **Step 8: Type-check the whole file**

Run: `npx tsc --noEmit`
Expected: no TypeScript errors

- [ ] **Step 9: Visual check — desktop layout**

1. `npm run dev`
2. Open `http://localhost:3000/dashboard/workouts` and start any workout
3. At ≥ 640px: left strip visible (96px wide, dark bg, emerald duration timer)
4. Scroll the exercise list — strip stays fixed, right column scrolls
5. Live timer and Rest stat cards are gone from the top grid; only Progress % and Est. kcal remain
6. Session timing panel is hidden

- [ ] **Step 10: Visual check — mobile layout**

1. DevTools → mobile viewport (e.g. iPhone 14, 390px)
2. All 4 stat cards visible (Progress, Est. kcal, Live timer, Rest)
3. Session timing panel visible
4. Left strip hidden
5. Bottom bar visible showing duration (rest shows "—")
6. Tap ↓ — bar collapses to pill in bottom-right
7. Tap pill — bar expands again
8. Complete a set that triggers a rest timer — bar auto-expands, rest shows in amber, border turns amber

- [ ] **Step 11: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "feat: wire WorkoutTimerStrip and WorkoutTimerBar into ActiveWorkoutModal"
```

---

## Self-review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Desktop 96px sticky left strip | Task 1 |
| Duration ring (emerald) + elapsed time | Task 1 |
| Rest ring (amber when active, muted when idle) + countdown | Task 1 |
| Skip button when rest active | Task 1 |
| Progress % at bottom of strip | Task 1 |
| Strip hidden on mobile (`hidden sm:flex`) | Task 1, Task 3 step 4 |
| Mobile collapsible bottom bar | Task 2 |
| Collapsed pill anchored bottom-right | Task 2 |
| Pill border amber when rest active | Task 2 |
| Auto-expand when `restSeconds` transitions 0 → >0 | Task 2 |
| Exercise list gets `pb-16` when bar expanded | Task 3 step 4 (`pb-16 sm:pb-0`) |
| Live timer + Rest stat cards hidden on sm+ | Task 3 step 5 |
| Session timing panel hidden on sm+ | Task 3 step 6 |
| No new store state — all values from existing computed vars | Task 3 steps 4, 7 |

All spec requirements covered. ✓

### Placeholder scan

No TBDs, no incomplete sections, all code blocks complete. ✓

### Type consistency

- `formatTime` is duplicated in Task 1 and Task 2 — intentional, each file is self-contained
- `WorkoutTimerStripProps` defined in Task 1, used in Task 3 step 4 — props match ✓
- `WorkoutTimerBarProps` defined in Task 2, used in Task 3 step 7 — props match ✓
- `CIRCUMFERENCE` defined and used only in Task 1 ✓
- `prevRestRef`, `collapsed`, `restActive` defined and used only in Task 2 ✓
