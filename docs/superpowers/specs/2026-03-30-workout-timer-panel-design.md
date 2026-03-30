# Workout Timer Panel — Design Spec
_Date: 2026-03-30_

## Overview

Add a persistent timer panel to the active workout modal so the workout duration and rest countdown are always visible while the user logs sets. On desktop/tablet the panel is a fixed left strip; on mobile it is a collapsible bottom bar.

---

## Layout

### Desktop / Tablet (≥ 640px)

The `ActiveWorkoutModal` content area changes from a single full-width column to a two-column flex layout:

```
┌─────────────┬──────────────────────────────────┐
│  Timer      │  Exercise list (scrollable)       │
│  Strip      │                                   │
│  96px wide  │  Bench Press                      │
│  sticky     │    Set 1 ✓  Set 2  Set 3          │
│             │  Overhead Press                   │
│  42:17      │    Set 1  Set 2                   │
│  Duration   │  …                                │
│  ──────     │                                   │
│  1:03       │                                   │
│  Rest       │                                   │
│  [Skip]     │                                   │
│             │                                   │
│  68% done   │                                   │
└─────────────┴──────────────────────────────────┘
```

- Strip is `position: sticky; top: 0; align-self: flex-start` so it stays in view as the right column scrolls.
- Width: `96px`, full modal height.
- Background: `bg-[#0b1a15]`, right border `border-r border-border/40`.
- Contents (top → bottom):
  - Small "WORKOUT" label
  - Duration ring (SVG circle progress) + `42:17` in emerald
  - Divider
  - Rest ring (SVG circle progress, amber when active, muted when idle) + countdown
  - "Skip" button — visible only when rest is active
  - Spacer
  - Progress percentage (e.g. "68% done") at the bottom

The existing stats grid row (the four cards including "Live timer" and "Rest") is **hidden on ≥ sm** since the strip replaces it. It remains visible on mobile.

### Mobile (< 640px)

A pinned bottom bar inside the modal, collapsed/expanded via local state.

**Expanded state** (default, and forced when rest timer starts):

```
┌─────────────────────────────────────────┐
│  42:17       |  1:03          [Skip] [↓]│
│  Duration       Rest                    │
└─────────────────────────────────────────┘
```

- `position: absolute; bottom: 0; left: 0; right: 0`
- Height ~52px, `bg-[#0b1a15]`, `border-t border-border/40`
- When rest is active the top border switches to `border-amber-400/30`
- ↓ button collapses to pill

**Collapsed state:**

- A small pill anchored `bottom: 10px; right: 10px`
- Shows live timer values at a glance: `42:17 · 1:03 ↑` (rest hidden when 0)
- Tap anywhere on pill to re-expand
- Pill border: `border-border/40` normally, `border-amber-400/40` when rest is active

**Auto-expand rule:** whenever `restEndsAtMs` transitions from `null` to a value (i.e. a rest timer starts), force `bottomBarCollapsed = false`.

The exercise list gets `pb-16` (bottom padding) when the bar is expanded so content is not obscured, `pb-2` when collapsed.

---

## Component Design

### New component: `WorkoutTimerStrip`

**File:** `components/workout/WorkoutTimerStrip.tsx`

**Props:**
```ts
interface WorkoutTimerStripProps {
  durationSeconds: number        // elapsed workout time
  restSeconds: number            // 0 when no rest active
  progress: number               // 0–100
  onSkipRest: () => void
}
```

Renders the desktop left strip only. Stateless — all values driven by the parent.

### New component: `WorkoutTimerBar`

**File:** `components/workout/WorkoutTimerBar.tsx`

**Props:**
```ts
interface WorkoutTimerBarProps {
  durationSeconds: number
  restSeconds: number
  onSkipRest: () => void
}
```

Renders the mobile bottom bar. Owns `collapsed` boolean state internally. Exposes no additional callbacks — collapse/expand is self-contained. The parent passes `restSeconds` and the bar watches for transitions from 0 → >0 via `useEffect` to auto-expand.

### Changes to `ActiveWorkoutModal`

1. Wrap the modal body in a `flex` row on `sm+`:
   - Left: `<WorkoutTimerStrip>` (hidden on mobile via `hidden sm:flex`)
   - Right: existing exercise list content (takes remaining width)
2. Add `<WorkoutTimerBar>` at the bottom on mobile (visible via `sm:hidden`, `position: absolute`)
3. Hide the existing four-card stats grid on `sm+` (`sm:hidden`) since the strip replaces "Live timer" and "Rest" cards. Keep the Progress % and Est. kcal cards or move them into the strip.

---

## State & Data Flow

No new state is introduced in the store. `ActiveWorkoutModal` already computes:
- `liveDurationSeconds` — passed as `durationSeconds`
- `restRemainingSeconds` — passed as `restSeconds`
- `progress` — passed to strip
- `setRestEndsAtMs(null)` — passed as `onSkipRest`

Both new components are purely presentational.

---

## Edge Cases

| Situation | Behaviour |
|---|---|
| Rest timer reaches 0 | Rest ring/value returns to idle state; bar stays expanded until user collapses |
| Workout has no rest configured | Rest section shows `—`; no Skip button |
| Very long exercise list | Right column scrolls independently; strip stays in place |
| Modal opened on a small tablet in landscape | `sm` breakpoint (640px) triggers strip layout; bar hidden |
| User collapses bar then completes a set with rest | Bar auto-expands |

---

## Out of Scope

- Draggable/repositionable panel
- Sound/haptic on rest timer end (separate feature)
- Changes to how rest duration is configured per set
