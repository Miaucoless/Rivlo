# XP Rewards & Rank System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-tier Aura rank system (Spark → Vitality → Radiance → Ascendant → Transcendent) with XP earned from fitness actions, badge display everywhere usernames appear, and animated level-up celebrations.

**Architecture:** XP state lives in `user_app_state.xp` JSONB column (Supabase), synced via the existing `saveMetadataCloudState` cloud-sync flow. Pure XP math lives in `lib/xp-system.ts`. A `pendingLevelUpResult` field in the Zustand store drives celebration modals rendered by `LevelUpController` mounted in the dashboard layout.

**Tech Stack:** Next.js App Router, Zustand, Supabase, Framer Motion, Tailwind CSS, TypeScript

---

## File Map

**New files:**
- `supabase/migrations/20260405000006_xp_state.sql` — add `xp` column to `user_app_state`
- `lib/xp-system.ts` — all XP math (tiers, level lookup, gain computation, state transitions)
- `components/ui/XpBadge.tsx` — pill badge with SVG icon + "Tier · Level" text
- `components/ui/AvatarWithBadge.tsx` — avatar wrapper that overlays gold crown at Transcendent·250
- `components/xp/XpProgressBar.tsx` — XP progress bar for profile page
- `components/xp/LevelUpSheet.tsx` — slide-up bottom sheet for regular level-ups
- `components/xp/TierUpModal.tsx` — full-screen ceremony for tier upgrades
- `components/xp/CrownCeremony.tsx` — one-time Transcendent·250 crown ceremony
- `components/xp/LevelUpController.tsx` — renders whichever celebration is pending

**Modified files:**
- `types/index.ts` — add `XpState`, `XpAction`, `LevelUpResult`, `XpInfo` types
- `lib/cloud-sync.ts` — extend `MetadataAppState` + `saveMetadataCloudState` to include `xp`
- `store/useAppStore.ts` — add `xpState`, `pendingLevelUpResult`, `addXp`, `clearLevelUpResult`, `claimCrown` + wire XP into existing actions
- `app/dashboard/layout.tsx` — mount `LevelUpController`
- `app/dashboard/profile/page.tsx` — add `XpBadge` + `XpProgressBar` to profile header
- `components/feed/SocialPostCard.tsx` — add `XpBadge` next to username
- `app/dashboard/profile/[username]/page.tsx` — add `XpBadge` on public profile (if file exists; create minimal version if not)

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260405000006_xp_state.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260405000006_xp_state.sql
ALTER TABLE user_app_state
  ADD COLUMN IF NOT EXISTS xp JSONB NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Apply the migration**

Run this SQL in the Supabase SQL editor (Dashboard → SQL Editor → New query):

```sql
ALTER TABLE user_app_state
  ADD COLUMN IF NOT EXISTS xp JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Expected: `ALTER TABLE` with no error.

- [ ] **Step 3: Verify**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'user_app_state' AND column_name = 'xp';
```

Expected: one row returned with `data_type = 'jsonb'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260405000006_xp_state.sql
git commit -m "feat: add xp column to user_app_state"
```

---

## Task 2: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Append XP types to `types/index.ts`**

Add at the end of the file:

```ts
// ─── XP & Rank System ──────────────────────────────────────────────────────────

export type XpAction =
  | 'workout'
  | 'water'
  | 'protein'
  | 'meal'
  | 'journal'
  | 'weight'
  | 'post'
  | 'streak_bonus'
  | 'perfect_day'

export type LevelUpResult =
  | { kind: 'none' }
  | { kind: 'level-up'; tierName: string; level: number; xpGained: number }
  | { kind: 'tier-up'; newTierName: string; xpGained: number }
  | { kind: 'crown'; xpGained: number }

export interface XpLastActionDates {
  workout?: string
  water?: string
  protein?: string
  meal?: string
  meal_count?: number
  journal?: string
  weight?: string
  post?: string
  streak_bonus?: string
  perfect_day?: string
}

export interface XpState {
  total: number
  has_crown: boolean
  last_action_dates: XpLastActionDates
  streak_days: number
  last_active_date?: string
}

export interface XpInfo {
  tierIndex: number        // 0-4
  tierName: string
  level: number            // 1-based within tier
  maxLevelInTier: number
  xpIntoLevel: number      // XP accumulated in current level
  xpForLevel: number       // XP required for current level
  progressPct: number      // 0-100
  isMaxed: boolean         // true if Transcendent·250
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add XP system types"
```

---

## Task 3: `lib/xp-system.ts`

**Files:**
- Create: `lib/xp-system.ts`

- [ ] **Step 1: Write the XP system module**

```ts
// lib/xp-system.ts
import type { XpAction, XpInfo, XpLastActionDates, XpState, LevelUpResult } from '@/types'

// ─── Tier definitions ──────────────────────────────────────────────────────────

export const XP_TIERS = [
  { name: 'Spark',        xpPerLevel: 75,  levels: 50  },
  { name: 'Vitality',     xpPerLevel: 150, levels: 50  },
  { name: 'Radiance',     xpPerLevel: 250, levels: 50  },
  { name: 'Ascendant',    xpPerLevel: 400, levels: 50  },
  { name: 'Transcendent', xpPerLevel: 225, levels: 250 },
] as const

// XP at the START of each tier (cumulative)
const TIER_START_XP = XP_TIERS.reduce<number[]>((acc, tier, i) => {
  const prev = acc[i - 1] ?? 0
  const prevTierTotal = i === 0 ? 0 : XP_TIERS[i - 1].xpPerLevel * XP_TIERS[i - 1].levels
  acc.push(prev + prevTierTotal)
  return acc
}, [])

export const MAX_XP = TIER_START_XP[4] + XP_TIERS[4].xpPerLevel * XP_TIERS[4].levels

// ─── XP per action ────────────────────────────────────────────────────────────

const XP_AMOUNTS: Record<XpAction, number> = {
  workout:      100,
  water:         30,
  protein:       30,
  meal:          10,
  journal:       25,
  weight:        20,
  post:          15,
  streak_bonus:  75,
  perfect_day:   50,
}

// ─── Core math ────────────────────────────────────────────────────────────────

export function getXpInfo(totalXp: number): XpInfo {
  const clamped = Math.max(0, Math.min(totalXp, MAX_XP))

  for (let i = 0; i < XP_TIERS.length; i++) {
    const tier = XP_TIERS[i]
    const tierStart = TIER_START_XP[i]
    const tierEnd = tierStart + tier.xpPerLevel * tier.levels

    if (clamped < tierEnd || i === XP_TIERS.length - 1) {
      const xpIntoTier = clamped - tierStart
      const level = Math.min(Math.floor(xpIntoTier / tier.xpPerLevel) + 1, tier.levels)
      const xpIntoLevel = xpIntoTier - (level - 1) * tier.xpPerLevel
      const isMaxed = clamped >= MAX_XP

      return {
        tierIndex: i,
        tierName: tier.name,
        level,
        maxLevelInTier: tier.levels,
        xpIntoLevel: isMaxed ? tier.xpPerLevel : xpIntoLevel,
        xpForLevel: tier.xpPerLevel,
        progressPct: isMaxed ? 100 : Math.round((xpIntoLevel / tier.xpPerLevel) * 100),
        isMaxed,
      }
    }
  }

  // Unreachable but TypeScript needs a return
  return { tierIndex: 0, tierName: 'Spark', level: 1, maxLevelInTier: 50, xpIntoLevel: 0, xpForLevel: 75, progressPct: 0, isMaxed: false }
}

// ─── Once-per-day enforcement ─────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function computeXpGain(action: XpAction, state: XpState): number {
  const today = todayISO()
  const d = state.last_action_dates

  switch (action) {
    case 'workout':
      return d.workout === today ? 0 : XP_AMOUNTS.workout
    case 'water':
      return d.water === today ? 0 : XP_AMOUNTS.water
    case 'protein':
      return d.protein === today ? 0 : XP_AMOUNTS.protein
    case 'meal':
      if (d.meal === today && (d.meal_count ?? 0) >= 3) return 0
      return XP_AMOUNTS.meal
    case 'journal':
      return d.journal === today ? 0 : XP_AMOUNTS.journal
    case 'weight':
      return d.weight === today ? 0 : XP_AMOUNTS.weight
    case 'post':
      return d.post === today ? 0 : XP_AMOUNTS.post
    case 'streak_bonus':
      return d.streak_bonus === today ? 0 : XP_AMOUNTS.streak_bonus
    case 'perfect_day':
      return d.perfect_day === today ? 0 : XP_AMOUNTS.perfect_day
  }
}

function nextActionDates(action: XpAction, dates: XpLastActionDates): XpLastActionDates {
  const today = todayISO()
  switch (action) {
    case 'meal': {
      const isSameDay = dates.meal === today
      return { ...dates, meal: today, meal_count: isSameDay ? (dates.meal_count ?? 0) + 1 : 1 }
    }
    default:
      return { ...dates, [action]: today }
  }
}

// ─── State transition ─────────────────────────────────────────────────────────

export function applyXp(
  gain: number,
  action: XpAction,
  state: XpState,
): { newState: XpState; result: LevelUpResult } {
  if (gain === 0) return { newState: state, result: { kind: 'none' } }

  const before = getXpInfo(state.total)
  const newTotal = Math.min(state.total + gain, MAX_XP)
  const after = getXpInfo(newTotal)

  const newState: XpState = {
    ...state,
    total: newTotal,
    last_action_dates: nextActionDates(action, state.last_action_dates),
  }

  // Crown: just hit max
  if (after.isMaxed && !state.has_crown) {
    return { newState, result: { kind: 'crown', xpGained: gain } }
  }

  // Tier-up
  if (after.tierIndex > before.tierIndex) {
    return { newState, result: { kind: 'tier-up', newTierName: after.tierName, xpGained: gain } }
  }

  // Level-up (same tier)
  if (after.level > before.level) {
    return { newState, result: { kind: 'level-up', tierName: after.tierName, level: after.level, xpGained: gain } }
  }

  return { newState, result: { kind: 'none' } }
}

// ─── Tier visual config ───────────────────────────────────────────────────────

export type TierStyle = {
  bg: string
  text: string
  border: string
  glow?: string
  iconColor: string
}

export const TIER_STYLES: Record<string, TierStyle> = {
  Spark: {
    bg: '#111827', text: '#9ca3af', border: '#374151', iconColor: '#4b5563',
  },
  Vitality: {
    bg: '#052e16', text: '#6ee7b7', border: '#059669', iconColor: '#10b981',
  },
  Radiance: {
    bg: '#1e1b4b', text: '#a5b4fc', border: '#4338ca', iconColor: '#818cf8',
  },
  Ascendant: {
    bg: '#0c1a3a', text: '#7dd3fc', border: '#0284c7', iconColor: '#38bdf8',
  },
  Transcendent: {
    bg: '#150505', text: '#fda4af', border: '#be123c', iconColor: '#f43f5e',
    glow: '0 0 10px rgba(225,29,72,0.35)',
  },
}
```

- [ ] **Step 2: Verify the math manually**

Open a Node REPL (`node`) and run:

```js
// Quick sanity check — paste these lines
const { getXpInfo, MAX_XP } = require('./lib/xp-system')
console.log(getXpInfo(0))        // { tierName: 'Spark', level: 1, ... }
console.log(getXpInfo(3750))     // { tierName: 'Vitality', level: 1, ... }
console.log(getXpInfo(11250))    // { tierName: 'Radiance', level: 1, ... }
console.log(getXpInfo(MAX_XP))   // { tierName: 'Transcendent', level: 250, isMaxed: true }
```

Expected: each returns the correct tier boundary.

- [ ] **Step 3: Commit**

```bash
git add lib/xp-system.ts
git commit -m "feat: add xp-system core math"
```

---

## Task 4: Extend Cloud Sync for XP

**Files:**
- Modify: `lib/cloud-sync.ts`

- [ ] **Step 1: Add `xp` to the `MetadataAppState` type (around line 65)**

Find:
```ts
type MetadataAppState = {
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
}
```

Replace with:
```ts
type MetadataAppState = {
  savedMeals: SavedMealTemplate[]
  supplements: SupplementEntry[]
  calendarReminders: CalendarReminder[]
  socialPosts: SocialPost[]
  socialFollows: SocialFollowRelationship[]
  socialSavedPostIds: string[]
  socialLikedPostIds: string[]
  socialPostComments: Record<string, SocialPostComment[]>
  xp: import('@/types').XpState
}
```

- [ ] **Step 2: Add `xp` to `EMPTY_METADATA_APP_STATE` (around line 76)**

Find:
```ts
const EMPTY_METADATA_APP_STATE: MetadataAppState = {
  savedMeals: [],
  supplements: [],
  calendarReminders: [],
  socialPosts: [],
  socialFollows: [],
  socialSavedPostIds: [],
  socialLikedPostIds: [],
  socialPostComments: {},
}
```

Replace with:
```ts
const EMPTY_XP_STATE: import('@/types').XpState = {
  total: 0,
  has_crown: false,
  last_action_dates: {},
  streak_days: 0,
}

const EMPTY_METADATA_APP_STATE: MetadataAppState = {
  savedMeals: [],
  supplements: [],
  calendarReminders: [],
  socialPosts: [],
  socialFollows: [],
  socialSavedPostIds: [],
  socialLikedPostIds: [],
  socialPostComments: {},
  xp: EMPTY_XP_STATE,
}
```

- [ ] **Step 3: Read `xp` in `fetchMetadataAppState` (around line 160)**

In `fetchMetadataAppState`, find the return object inside the successful data block and add `xp`:

```ts
// After reading social_post_comments, add:
xp: (data as any).xp && typeof (data as any).xp === 'object'
  ? (data as any).xp as import('@/types').XpState
  : authFallback.xp,
```

Also update `fetchAuthMetadataAppState` to return `xp: EMPTY_XP_STATE` (add `xp: EMPTY_XP_STATE` to the returned object and to the `appState` parsing block).

- [ ] **Step 4: Write `xp` in `saveMetadataCloudState` (around line 222)**

Find the `nextState` construction in `saveMetadataCloudState`:
```ts
const nextState: MetadataAppState = {
  savedMeals: state.savedMeals ?? existingState.savedMeals,
  // ...
  socialPostComments: state.socialPostComments ?? existingState.socialPostComments,
}
```

Add at the end of the object:
```ts
  xp: state.xp ?? existingState.xp,
```

Find the `.upsert({` call and add `xp: nextState.xp` to the upsert payload.

- [ ] **Step 5: Commit**

```bash
git add lib/cloud-sync.ts
git commit -m "feat: extend cloud sync to persist xp state"
```

---

## Task 5: Add XP State to the Zustand Store

**Files:**
- Modify: `store/useAppStore.ts`

- [ ] **Step 1: Add imports**

At the top of `useAppStore.ts`, add to the existing type imports:
```ts
import type { XpState, XpAction, LevelUpResult } from '@/types'
import { computeXpGain, applyXp, getXpInfo } from '@/lib/xp-system'
```

Also add `saveXpCloudState` to the cloud-sync imports (we'll add this function in Task 4 — just reference it here):
```ts
import { saveXpCloudState } from '@/lib/cloud-sync'
```

Actually, `saveMetadataCloudState` already handles XP after Task 4. We'll call it with `{ xp: newXpState }`.

- [ ] **Step 2: Add XP fields to `AppStore` interface**

In the `AppStore` interface, add after the social fields:

```ts
  // XP & Rank
  xpState: XpState
  pendingLevelUpResult: LevelUpResult | null
  addXp: (action: XpAction, extraContext?: { waterTotal?: number; waterGoal?: number; proteinTotal?: number; proteinGoal?: number }) => void
  clearLevelUpResult: () => void
  claimCrown: () => void
```

- [ ] **Step 3: Add initial state**

In the Zustand `create` call, find where initial state fields are set and add:

```ts
xpState: { total: 0, has_crown: false, last_action_dates: {}, streak_days: 0 },
pendingLevelUpResult: null,
```

- [ ] **Step 4: Add `addXp` action implementation**

After the `createSocialPost` action, add:

```ts
addXp: (action, extraContext) => {
  const state = get()
  const currentXpState = state.xpState

  const gain = computeXpGain(action, currentXpState)
  if (gain === 0) return

  const { newState, result } = applyXp(gain, action, currentXpState)

  // Check perfect day bonus: workout + water + protein all hit today
  const today = new Date().toISOString().slice(0, 10)
  const updatedDates = newState.last_action_dates
  const allHitToday =
    updatedDates.workout === today &&
    updatedDates.water === today &&
    updatedDates.protein === today &&
    updatedDates.perfect_day !== today

  let finalState = newState
  let finalResult = result

  if (allHitToday) {
    const bonusGain = computeXpGain('perfect_day', newState)
    if (bonusGain > 0) {
      const bonusApplied = applyXp(bonusGain, 'perfect_day', newState)
      finalState = bonusApplied.newState
      // Only override result if bonus caused a level/tier-up
      if (bonusApplied.result.kind !== 'none') finalResult = bonusApplied.result
    }
  }

  // Check 7-day streak bonus
  if (state.streak > 0 && state.streak % 7 === 0 && updatedDates.streak_bonus !== today) {
    const streakGain = computeXpGain('streak_bonus', finalState)
    if (streakGain > 0) {
      const streakApplied = applyXp(streakGain, 'streak_bonus', finalState)
      finalState = streakApplied.newState
      if (streakApplied.result.kind !== 'none') finalResult = streakApplied.result
    }
  }

  set({
    xpState: finalState,
    pendingLevelUpResult: finalResult.kind !== 'none' ? finalResult : state.pendingLevelUpResult,
  })

  // Sync to cloud
  const user = get().user
  const isDemoMode = get().isDemoMode
  if (user && !isDemoMode) {
    enqueueCloudWrite(set, async () => {
      await saveMetadataCloudState(user.id, { xp: finalState })
    })
  }
},

clearLevelUpResult: () => set({ pendingLevelUpResult: null }),

claimCrown: () => {
  const state = get()
  const newXpState = { ...state.xpState, has_crown: true }
  set({ xpState: newXpState, pendingLevelUpResult: null })

  const user = state.user
  if (user && !state.isDemoMode) {
    enqueueCloudWrite(set, async () => {
      await saveMetadataCloudState(user.id, { xp: newXpState })
    })
  }
},
```

- [ ] **Step 5: Hydrate XP from cloud in `hydrateFromCloud`**

Find the `hydrateFromCloud` action. Inside it, where `metadataState` is read from `fetchCloudState`, add:

```ts
xpState: metadataState.xp ?? { total: 0, has_crown: false, last_action_dates: {}, streak_days: 0 },
```

- [ ] **Step 6: Commit**

```bash
git add store/useAppStore.ts
git commit -m "feat: add xp state and addXp action to store"
```

---

## Task 6: Wire XP Into Existing Store Actions

**Files:**
- Modify: `store/useAppStore.ts`

- [ ] **Step 1: Wire `logWorkout` (~line 2385)**

Find the `logWorkout` action. After `set(...)`, before the cloud write, add:

```ts
get().addXp('workout')
```

Full updated action:
```ts
logWorkout: (log) => {
  const normalizedLog = { ...log, id: ensureUuid(log.id) }
  set((state) => withRefreshedNotifications(state, {
    workoutLogs: [normalizedLog, ...state.workoutLogs],
    streak: state.streak + (state.workoutLogs.some((workout) => workout.date === getTodayISO()) ? 0 : 1),
  }))

  get().addXp('workout')

  const state = get()
  if (state.user && !state.isDemoMode) {
    enqueueCloudWrite(set, async () => {
      await upsertWorkoutLog(state.user.id, normalizedLog)
    })
  }
},
```

- [ ] **Step 2: Wire `addJournalEntry` (~line 1714)**

After `set(...)` in `addJournalEntry`, add:

```ts
get().addXp('journal')
```

- [ ] **Step 3: Wire `addWeightEntry` (~line 1687)**

After `set(...)` in `addWeightEntry`, add:

```ts
get().addXp('weight')
```

- [ ] **Step 4: Wire `addMealEntry` for meal + protein XP (~line 1759)**

After `set(...)` in `addMealEntry`, add:

```ts
// Meal XP (up to 3x per day)
get().addXp('meal')

// Protein goal XP: check if today's protein now meets the target
const afterState = get()
const today = getTodayISO()
const todayMeals = afterState.mealEntries[today] ?? []
const totalProtein = todayMeals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0)
const proteinGoal = afterState.user?.protein_target_g ?? 0
if (proteinGoal > 0 && totalProtein >= proteinGoal) {
  get().addXp('protein')
}
```

- [ ] **Step 5: Wire `addWaterEntry` for water goal XP (~line 1813)**

After `set(...)` in `addWaterEntry`, add:

```ts
// Water goal XP: check if today's total now meets the goal
const afterWaterState = get()
const waterTotal = afterWaterState.getWaterTotal(entry.date)
const waterGoal = afterWaterState.user?.water_goal_ml ?? 0
if (waterGoal > 0 && waterTotal >= waterGoal) {
  get().addXp('water')
}
```

- [ ] **Step 6: Wire `createSocialPost` (~line 2490)**

After `set(...)` in `createSocialPost`, add:

```ts
get().addXp('post')
```

- [ ] **Step 7: Commit**

```bash
git add store/useAppStore.ts
git commit -m "feat: wire xp into workout, journal, weight, meal, water, and post actions"
```

---

## Task 7: `XpBadge` Component

**Files:**
- Create: `components/ui/XpBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ui/XpBadge.tsx
'use client'

import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import { cn } from '@/lib/utils'

// SVG icons per tier — unique shape for each
function TierIcon({ tierName, color, size }: { tierName: string; color: string; size: number }) {
  const s = size
  switch (tierName) {
    case 'Spark':
      return (
        <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>
      )
    case 'Vitality':
      return (
        <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
          <path d="M6.5 11C6.5 11 1 7.5 1 4.5A3 3 0 0 1 6.5 3.5 3 3 0 0 1 12 4.5C12 7.5 6.5 11 6.5 11Z" fill="none" stroke={color} strokeWidth="1" />
        </svg>
      )
    case 'Radiance':
      return (
        <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="2" fill="none" stroke={color} strokeWidth="0.9" />
          <line x1="6.5" y1="1" x2="6.5" y2="3" stroke={color} strokeWidth="1.1" />
          <line x1="6.5" y1="10" x2="6.5" y2="12" stroke={color} strokeWidth="1.1" />
          <line x1="1" y1="6.5" x2="3" y2="6.5" stroke={color} strokeWidth="1.1" />
          <line x1="10" y1="6.5" x2="12" y2="6.5" stroke={color} strokeWidth="1.1" />
          <line x1="2.5" y1="2.5" x2="3.9" y2="3.9" stroke={color} strokeWidth="0.9" />
          <line x1="9.1" y1="9.1" x2="10.5" y2="10.5" stroke={color} strokeWidth="0.9" />
          <line x1="10.5" y1="2.5" x2="9.1" y2="3.9" stroke={color} strokeWidth="0.9" />
          <line x1="3.9" y1="9.1" x2="2.5" y2="10.5" stroke={color} strokeWidth="0.9" />
        </svg>
      )
    case 'Ascendant':
      return (
        <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
          <polygon points="6.5,1 10,9 6.5,7.5 3,9" fill="none" stroke={color} strokeWidth="0.9" />
        </svg>
      )
    case 'Transcendent':
      return (
        <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1L7.5 5.5L12 6.5L7.5 7.5L6.5 12L5.5 7.5L1 6.5L5.5 5.5Z" fill="none" stroke={color} strokeWidth="0.9" />
          <circle cx="6.5" cy="6.5" r="1.2" fill={color} />
        </svg>
      )
    default:
      return null
  }
}

interface XpBadgeProps {
  totalXp: number
  size?: 'sm' | 'md'
  className?: string
}

export function XpBadge({ totalXp, size = 'sm', className }: XpBadgeProps) {
  const info = getXpInfo(totalXp)
  const style = TIER_STYLES[info.tierName]
  const iconSize = size === 'sm' ? 11 : 14
  const fontSize = size === 'sm' ? '11px' : '13px'

  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full font-bold tracking-wide', className)}
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        boxShadow: style.glow,
        padding: size === 'sm' ? '2px 8px 2px 5px' : '3px 10px 3px 6px',
        fontSize,
        whiteSpace: 'nowrap',
      }}
    >
      <TierIcon tierName={info.tierName} color={style.iconColor} size={iconSize} />
      {info.tierName} · {info.level}
    </span>
  )
}
```

- [ ] **Step 2: Verify it renders**

Temporarily import `XpBadge` into any dashboard page and render `<XpBadge totalXp={0} />` and `<XpBadge totalXp={5000} />`. Confirm both render with correct tier names and no TS errors. Remove the temporary render.

- [ ] **Step 3: Commit**

```bash
git add components/ui/XpBadge.tsx
git commit -m "feat: add XpBadge component"
```

---

## Task 8: `AvatarWithBadge` Component (Crown Overlay)

**Files:**
- Create: `components/ui/AvatarWithBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ui/AvatarWithBadge.tsx
'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

function CrownSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 28 22" fill="none">
      <path
        d="M2 18L4 8L9 13L14 2L19 13L24 8L26 18Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="2" y="18" width="24" height="4" rx="1" fill="#d97706" />
      <circle cx="14" cy="3" r="2" fill="#fef08a" />
      <circle cx="4.5" cy="8.5" r="1.5" fill="#fef08a" />
      <circle cx="23.5" cy="8.5" r="1.5" fill="#fef08a" />
    </svg>
  )
}

interface AvatarWithBadgeProps {
  src?: string | null
  name: string
  size?: number          // px, default 40
  hasCrown?: boolean
  className?: string
}

export function AvatarWithBadge({ src, name, size = 40, hasCrown = false, className }: AvatarWithBadgeProps) {
  const initials = name.slice(0, 2).toUpperCase()
  const crownSize = Math.round(size * 0.55)

  return (
    <span className={cn('relative inline-block flex-shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 font-bold text-slate-300"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        >
          {initials}
        </span>
      )}
      {hasCrown && (
        <span
          className="pointer-events-none absolute"
          style={{
            top: -Math.round(crownSize * 0.55),
            right: -Math.round(crownSize * 0.2),
            filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.7))',
          }}
        >
          <CrownSvg size={crownSize} />
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/AvatarWithBadge.tsx
git commit -m "feat: add AvatarWithBadge component with crown overlay"
```

---

## Task 9: `XpProgressBar` Component

**Files:**
- Create: `components/xp/XpProgressBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/xp/XpProgressBar.tsx
'use client'

import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import { XpBadge } from '@/components/ui/XpBadge'

interface XpProgressBarProps {
  totalXp: number
}

export function XpProgressBar({ totalXp }: XpProgressBarProps) {
  const info = getXpInfo(totalXp)
  const style = TIER_STYLES[info.tierName]
  const xpToNext = info.xpForLevel - info.xpIntoLevel

  return (
    <div className="rounded-xl p-3" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      <div className="mb-2 flex items-center justify-between">
        <XpBadge totalXp={totalXp} size="sm" />
        {info.isMaxed ? (
          <span className="text-xs font-semibold" style={{ color: style.text }}>MAX</span>
        ) : (
          <span className="text-xs" style={{ color: '#4b5563' }}>
            {info.xpIntoLevel} / {info.xpForLevel} XP
          </span>
        )}
      </div>

      {/* Track */}
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#1e293b' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${info.progressPct}%`,
            background: `linear-gradient(90deg, ${style.border}, ${style.text})`,
            boxShadow: style.glow,
          }}
        />
      </div>

      {!info.isMaxed && (
        <p className="mt-1.5 text-xs" style={{ color: '#4b5563' }}>
          {xpToNext} XP to {info.tierName} · {info.level + 1 <= info.maxLevelInTier ? info.level + 1 : `next tier`}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/xp/XpProgressBar.tsx
git commit -m "feat: add XpProgressBar component"
```

---

## Task 10: `LevelUpSheet` — Regular Level-Up Bottom Sheet

**Files:**
- Create: `components/xp/LevelUpSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/xp/LevelUpSheet.tsx
'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XpBadge } from '@/components/ui/XpBadge'
import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import type { LevelUpResult } from '@/types'

interface LevelUpSheetProps {
  result: Extract<LevelUpResult, { kind: 'level-up' }>
  totalXp: number
  onDismiss: () => void
}

export function LevelUpSheet({ result, totalXp, onDismiss }: LevelUpSheetProps) {
  const info = getXpInfo(totalXp)
  const style = TIER_STYLES[result.tierName]

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" />

        <motion.div
          className="relative z-10 w-full max-w-md rounded-t-2xl px-5 pb-8 pt-4"
          style={{ background: '#0f172a', borderTop: `1px solid ${style.border}` }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pill */}
          <div className="mx-auto mb-4 h-1 w-9 rounded-full" style={{ background: '#374151' }} />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-white">Level Up! ✦</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {result.tierName} · {result.level - 1} → {result.tierName} · {result.level}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>+{result.xpGained} XP</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs" style={{ color: '#6b7280' }}>
              <span>{result.tierName} · {result.level}</span>
              <span>{info.xpIntoLevel} / {info.xpForLevel} XP</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#1e293b' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${style.border}, ${style.text})` }}
                initial={{ width: 0 }}
                animate={{ width: `${info.progressPct}%` }}
                transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          <button
            className="mt-5 w-full rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: '#1e293b', color: '#e5e7eb' }}
            onClick={onDismiss}
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/xp/LevelUpSheet.tsx
git commit -m "feat: add LevelUpSheet component"
```

---

## Task 11: `TierUpModal` — Full-Screen Tier Upgrade Ceremony

**Files:**
- Create: `components/xp/TierUpModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/xp/TierUpModal.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TIER_STYLES, XP_TIERS, getXpInfo } from '@/lib/xp-system'
import { XpBadge } from '@/components/ui/XpBadge'
import type { LevelUpResult } from '@/types'

// Floating particle component
function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{ width: 4, height: 4, ...style }}
      animate={{ y: [0, -24, 0], opacity: [0.7, 0.2, 0.7], rotate: [0, 180, 360] }}
      transition={{ duration: 2.5 + Math.random() * 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

const PARTICLE_POSITIONS = [
  { left: '15%', top: '20%', background: '#818cf8' },
  { left: '80%', top: '30%', background: '#34d399', width: 3, height: 3 },
  { left: '25%', top: '70%', background: '#f0abfc' },
  { left: '70%', top: '65%', background: '#818cf8', width: 3, height: 3 },
  { left: '50%', top: '15%', background: '#fbbf24', width: 3, height: 3 },
  { left: '40%', top: '80%', background: '#34d399' },
  { left: '88%', top: '55%', background: '#f43f5e', width: 3, height: 3 },
  { left: '10%', top: '50%', background: '#fbbf24' },
]

interface TierUpModalProps {
  result: Extract<LevelUpResult, { kind: 'tier-up' }>
  totalXp: number
  onDismiss: () => void
}

export function TierUpModal({ result, totalXp, onDismiss }: TierUpModalProps) {
  const style = TIER_STYLES[result.newTierName]
  const tierIndex = XP_TIERS.findIndex((t) => t.name === result.newTierName)
  const prevTierName = tierIndex > 0 ? XP_TIERS[tierIndex - 1].name : ''

  // XP as if we're at the start of the new tier
  const newTierStartXp = totalXp

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Full-screen backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, ${style.bg}dd 0%, #0a0f1a 70%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {PARTICLE_POSITIONS.map((pos, i) => (
            <Particle key={i} style={pos} />
          ))}
        </div>

        {/* Modal content */}
        <motion.div
          className="relative z-10 flex flex-col items-center text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Pulsing ring + icon */}
          <motion.div
            className="mb-5 flex items-center justify-center rounded-full"
            style={{
              width: 100, height: 100,
              border: `2px solid ${style.border}44`,
            }}
            animate={{ boxShadow: [`0 0 0 0 ${style.border}44`, `0 0 0 16px transparent`] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 80, height: 80, background: style.bg, border: `1px solid ${style.border}` }}
            >
              <XpBadge totalXp={newTierStartXp} size="md" />
            </div>
          </motion.div>

          <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: style.text }}>
            Tier Unlocked
          </p>
          <h2 className="mb-2 text-2xl font-extrabold text-white">You've reached {result.newTierName}</h2>
          <p className="mb-5 max-w-xs text-sm leading-relaxed" style={{ color: '#6b7280' }}>
            Your aura is evolving. Keep pushing your limits.
          </p>

          {/* Badge transition */}
          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs line-through" style={{ color: '#4b5563' }}>{prevTierName} · 50</span>
            <span style={{ color: style.border }}>→</span>
            <XpBadge totalXp={newTierStartXp} size="sm" />
          </div>

          <motion.button
            className="rounded-xl px-8 py-3 text-sm font-bold"
            style={{ background: style.border, color: '#fff' }}
            whileTap={{ scale: 0.97 }}
            onClick={onDismiss}
          >
            Let's Go
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/xp/TierUpModal.tsx
git commit -m "feat: add TierUpModal full-screen ceremony"
```

---

## Task 12: `CrownCeremony` — Transcendent·250 One-Time Event

**Files:**
- Create: `components/xp/CrownCeremony.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/xp/CrownCeremony.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { LevelUpResult } from '@/types'
import { useAppStore } from '@/store/useAppStore'

interface CrownCeremonyProps {
  result: Extract<LevelUpResult, { kind: 'crown' }>
}

export function CrownCeremony({ result }: CrownCeremonyProps) {
  const claimCrown = useAppStore((s) => s.claimCrown)
  const user = useAppStore((s) => s.user)
  const initials = (user?.name ?? 'U').slice(0, 2).toUpperCase()

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Deep red glow backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, #1f050544 0%, #0a0a0a 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />

        {/* Ambient red pulse */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 20 }}
        >
          {/* Avatar with animated crown drop */}
          <div className="relative mb-5">
            <div
              className="flex items-center justify-center rounded-full text-2xl font-extrabold"
              style={{
                width: 80, height: 80,
                background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                border: '2px solid #be123c',
                color: '#fda4af',
              }}
            >
              {initials}
            </div>
            <motion.div
              className="absolute"
              style={{ top: -28, right: -10 }}
              initial={{ y: -40, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: -8 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
            >
              <svg
                width="32" height="25" viewBox="0 0 28 22" fill="none"
                style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.9))' }}
              >
                <path d="M2 18L4 8L9 13L14 2L19 13L24 8L26 18Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />
                <rect x="2" y="18" width="24" height="4" rx="1" fill="#d97706" />
                <circle cx="14" cy="3" r="2" fill="#fef08a" />
                <circle cx="4.5" cy="8.5" r="1.5" fill="#fef08a" />
                <circle cx="23.5" cy="8.5" r="1.5" fill="#fef08a" />
              </svg>
            </motion.div>
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>
            Maximum Achieved
          </p>
          <h2 className="mb-2 text-2xl font-extrabold text-white">You are Transcendent</h2>
          <p className="mb-4 max-w-xs text-sm leading-relaxed" style={{ color: '#9f1239' }}>
            Transcendent · 250. You've earned the crown. It now appears on your profile — forever.
          </p>

          {/* Badge */}
          <div
            className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
            style={{
              background: '#150505', color: '#fda4af',
              border: '1px solid #f43f5e',
              boxShadow: '0 0 16px rgba(244,63,94,0.4)',
            }}
          >
            Transcendent · 250
          </div>

          <motion.button
            className="rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #be123c, #9f1239)',
              boxShadow: '0 4px 20px rgba(190,18,60,0.4)',
            }}
            whileTap={{ scale: 0.97 }}
            onClick={claimCrown}
          >
            Claim Your Crown 👑
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/xp/CrownCeremony.tsx
git commit -m "feat: add CrownCeremony component"
```

---

## Task 13: `LevelUpController` — Celebration Orchestrator

**Files:**
- Create: `components/xp/LevelUpController.tsx`
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Create the controller**

```tsx
// components/xp/LevelUpController.tsx
'use client'

import { useAppStore } from '@/store/useAppStore'
import { LevelUpSheet } from './LevelUpSheet'
import { TierUpModal } from './TierUpModal'
import { CrownCeremony } from './CrownCeremony'

export function LevelUpController() {
  const pendingLevelUpResult = useAppStore((s) => s.pendingLevelUpResult)
  const clearLevelUpResult = useAppStore((s) => s.clearLevelUpResult)
  const xpState = useAppStore((s) => s.xpState)

  if (!pendingLevelUpResult || pendingLevelUpResult.kind === 'none') return null

  if (pendingLevelUpResult.kind === 'crown') {
    return <CrownCeremony result={pendingLevelUpResult} />
  }

  if (pendingLevelUpResult.kind === 'tier-up') {
    return (
      <TierUpModal
        result={pendingLevelUpResult}
        totalXp={xpState.total}
        onDismiss={clearLevelUpResult}
      />
    )
  }

  if (pendingLevelUpResult.kind === 'level-up') {
    return (
      <LevelUpSheet
        result={pendingLevelUpResult}
        totalXp={xpState.total}
        onDismiss={clearLevelUpResult}
      />
    )
  }

  return null
}
```

- [ ] **Step 2: Mount in dashboard layout**

In `app/dashboard/layout.tsx`, add the import at the top:

```ts
import { LevelUpController } from '@/components/xp/LevelUpController'
```

Inside the return, add `<LevelUpController />` just before the closing `</div>` of the outermost wrapper (after `<BottomNav />`):

```tsx
      <BottomNav scrollContainerRef={mainRef} />
      <LevelUpController />
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add components/xp/LevelUpController.tsx app/dashboard/layout.tsx
git commit -m "feat: add LevelUpController and mount in dashboard layout"
```

---

## Task 14: Profile Page — Badge + Progress Bar

**Files:**
- Modify: `app/dashboard/profile/page.tsx`

- [ ] **Step 1: Add imports**

Near the top of `app/dashboard/profile/page.tsx`, add:

```ts
import { XpBadge } from '@/components/ui/XpBadge'
import { AvatarWithBadge } from '@/components/ui/AvatarWithBadge'
import { XpProgressBar } from '@/components/xp/XpProgressBar'
```

Add to the store selectors at the top of `ProfilePage()`:

```ts
const xpState = useAppStore((state) => state.xpState)
```

- [ ] **Step 2: Replace the avatar render**

Find where the profile avatar `<img>` or avatar element is rendered in the profile header. Replace it with:

```tsx
<AvatarWithBadge
  src={user?.avatar_url}
  name={user?.name ?? 'U'}
  size={72}
  hasCrown={xpState.has_crown}
/>
```

- [ ] **Step 3: Add badge + progress bar below username**

Find where the username and name are displayed in the profile header. Below the username line, add:

```tsx
<div className="mt-2 flex flex-col gap-2">
  <XpBadge totalXp={xpState.total} size="sm" />
  <XpProgressBar totalXp={xpState.total} />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/profile/page.tsx
git commit -m "feat: show xp badge and progress bar on profile page"
```

---

## Task 15: Social Feed — Badge Next to Username

**Files:**
- Modify: `components/feed/SocialPostCard.tsx`

- [ ] **Step 1: Add imports**

```ts
import { XpBadge } from '@/components/ui/XpBadge'
import { AvatarWithBadge } from '@/components/ui/AvatarWithBadge'
```

- [ ] **Step 2: Update avatar + username render**

In `SocialPostCard`, find where the post author's avatar and username are rendered (look for `post.user.avatar_url` or `post.user.username`). Replace the avatar `<img>` with `<AvatarWithBadge>` and add `<XpBadge>` after the username:

```tsx
<AvatarWithBadge
  src={post.user.avatar_url}
  name={post.user.name ?? post.user.username ?? 'U'}
  size={32}
  hasCrown={post.user.has_crown ?? false}
/>
<div className="flex flex-col">
  <div className="flex items-center gap-1.5">
    <span className="text-sm font-semibold text-white">{post.user.name}</span>
    {post.user.xp_total != null && (
      <XpBadge totalXp={post.user.xp_total} size="sm" />
    )}
  </div>
  <span className="text-xs text-muted-foreground">@{post.user.username}</span>
</div>
```

- [ ] **Step 3: Update `SocialPostUser` type in `types/index.ts`**

Find the `SocialPostUser` interface and add optional XP fields:

```ts
export interface SocialPostUser {
  // ... existing fields ...
  xp_total?: number
  has_crown?: boolean
}
```

- [ ] **Step 4: Populate XP fields when creating posts**

In `store/useAppStore.ts`, find `createSocialPost` (~line 2490). When building the `fallbackUser` object, add:

```ts
xp_total: state.xpState.total,
has_crown: state.xpState.has_crown,
```

- [ ] **Step 5: Commit**

```bash
git add components/feed/SocialPostCard.tsx types/index.ts store/useAppStore.ts
git commit -m "feat: show xp badge next to username in social feed"
```

---

## Task 16: Public Profile Page Badge

**Files:**
- Modify: `app/dashboard/profile/[username]/page.tsx` (create file if it doesn't exist)

- [ ] **Step 1: Check if the file exists**

```bash
ls app/dashboard/profile/
```

If `[username]/page.tsx` exists, open it. If not, skip this task (out of scope for v1 — the public profile page will be added separately).

- [ ] **Step 2: If it exists — add XpBadge to the profile header**

Find where the viewed user's avatar and name are rendered. Add:

```tsx
import { XpBadge } from '@/components/ui/XpBadge'
import { AvatarWithBadge } from '@/components/ui/AvatarWithBadge'
```

Then replace the avatar with `<AvatarWithBadge>` and add `<XpBadge totalXp={profileUser.xp_total ?? 0} />` below the username. The `xp_total` field will need to be fetched from `profiles` or `user_app_state` depending on how the public profile is loaded.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/profile/
git commit -m "feat: show xp badge on public profile page"
```

---

## Self-Review Checklist

- [x] **Supabase migration** — Task 1
- [x] **XpState persisted to cloud** — Tasks 4 + 5
- [x] **XP earned from workout** — Task 6 Step 1
- [x] **XP earned from water goal** — Task 6 Step 5
- [x] **XP earned from protein goal** — Task 6 Step 4
- [x] **XP earned from meal logging (3x/day max)** — Task 6 Step 4
- [x] **XP earned from journal** — Task 6 Step 2
- [x] **XP earned from weight log** — Task 6 Step 3
- [x] **XP earned from social post** — Task 6 Step 6
- [x] **Streak bonus (7-day)** — Task 5 Step 4
- [x] **Perfect day bonus** — Task 5 Step 4
- [x] **Once-per-day enforcement** — `lib/xp-system.ts` `computeXpGain`
- [x] **XpBadge component** — Task 7
- [x] **AvatarWithBadge + crown** — Task 8
- [x] **XpProgressBar** — Task 9
- [x] **LevelUpSheet (regular level-up)** — Task 10
- [x] **TierUpModal (tier upgrade)** — Task 11
- [x] **CrownCeremony (Transcendent·250)** — Task 12
- [x] **LevelUpController mounted in layout** — Task 13
- [x] **Profile page: badge + progress bar** — Task 14
- [x] **Feed: badge next to username** — Task 15
- [x] **Public profile: badge** — Task 16
- [x] **Hydrate XP from cloud on login** — Task 5 Step 5
- [x] **Crown claimed via `claimCrown` action** — Task 5 Step 4 + Task 12
