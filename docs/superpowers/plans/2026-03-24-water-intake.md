# Water Intake Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated water intake tracking card to the dashboard that lets users log water via quick-add buttons or a custom modal, with a filling bottle visual that animates in real time.

**Architecture:** New `WaterEntry` type + `waterLogs` state in Zustand (mirroring the `mealEntries` pattern), two new cloud sync functions in `lib/cloud-sync.ts`, and two new React components (`WaterIntakeCard`, `WaterLogModal`). The dashboard top stat row is trimmed from 4 cards to 3 (Calories, Protein, Water) by removing the Weight and Workouts cards.

**Tech Stack:** TypeScript, Zustand (persist middleware), Framer Motion, Supabase, Next.js App Router, shadcn/ui Dialog + Input, Tailwind CSS, sonner (toast)

---

## File Map

| File | Change |
|------|--------|
| `types/index.ts` | Add `WaterEntry` interface; add `water_goal_ml` field to `UserProfile` |
| `lib/cloud-sync.ts` | Add `upsertWaterLog` and `deleteWaterLog` functions |
| `store/useAppStore.ts` | Add `waterLogs` state, `addWaterEntry`, `removeWaterEntry`, `getWaterTotal` |
| `components/dashboard/WaterIntakeCard.tsx` | **Create** — animated bottle card with quick-add buttons |
| `components/dashboard/WaterLogModal.tsx` | **Create** — custom amount input + today's log list with delete |
| `app/dashboard/dashboard/page.tsx` | Trim stat array to 2 cards, change grid, add `<WaterIntakeCard />` |

---

## Task 1: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `WaterEntry` to `types/index.ts`**

Find the `// ─── Nutrition` section and add after `SupplementEntry`:

```ts
// ─── Water ──────────────────────────────────────────────────────────────────────

export interface WaterEntry {
  id: string
  user_id: string
  date: string       // ISO YYYY-MM-DD
  amount_ml: number
  logged_at: string  // ISO timestamp
}
```

- [ ] **Step 2: Add `water_goal_ml` to `UserProfile`**

In `types/index.ts`, find the `UserProfile` interface and add after `fat_target_g`:

```ts
water_goal_ml: number
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/miaucoles/Downloads/Fitness/Fitness && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only about the store not yet implementing the new field (those get fixed in Task 3). No parse errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add WaterEntry type and water_goal_ml to UserProfile"
```

---

## Task 2: Cloud Sync Functions

**Files:**
- Modify: `lib/cloud-sync.ts`

- [ ] **Step 1: Add `upsertWaterLog` to `lib/cloud-sync.ts`**

Find `export async function upsertWeightEntry` and add the two new functions immediately before it:

```ts
export async function upsertWaterLog(userId: string, entry: WaterEntry) {
  const supabase = createClient()
  await supabase.from('water_logs').upsert({
    id: ensureUuid(entry.id),
    user_id: userId,
    date: entry.date,
    amount_ml: entry.amount_ml,
    logged_at: entry.logged_at,
  })
}

export async function deleteWaterLog(userId: string, entryId: string) {
  if (!isUuid(entryId)) return
  const supabase = createClient()
  await supabase.from('water_logs').delete().eq('user_id', userId).eq('id', entryId)
}
```

Also add `WaterEntry` to the import from `@/types` at the top of the file.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors from `lib/cloud-sync.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/cloud-sync.ts
git commit -m "feat: add upsertWaterLog and deleteWaterLog cloud sync functions"
```

---

## Task 3: Store

**Files:**
- Modify: `store/useAppStore.ts`

- [ ] **Step 1: Add `waterLogs` to the `AppStore` interface**

In `store/useAppStore.ts`, find the `interface AppStore` block. In the `// Data` section add:

```ts
waterLogs: Record<string, WaterEntry[]>
```

In the `// Actions` section add:

```ts
addWaterEntry: (entry: WaterEntry) => void
removeWaterEntry: (date: string, entryId: string) => void
getWaterTotal: (date: string) => number
```

Also add `WaterEntry` to the type imports from `@/types` at the top of the file.

- [ ] **Step 2: Add `waterLogs` to initial state**

Find the `create<AppStore>()(persist(` call and locate where `mealEntries` is initialised. Add alongside it:

```ts
waterLogs: {},
```

- [ ] **Step 3: Implement `addWaterEntry`**

Directly after the `removeMealEntry` implementation, add:

```ts
addWaterEntry: (entry) => {
  const normalized = { ...entry, id: ensureUuid(entry.id) }
  set((state) => ({
    waterLogs: {
      ...state.waterLogs,
      [entry.date]: [...(state.waterLogs[entry.date] || []), normalized],
    },
  }))
  const state = get()
  if (state.user && !state.isDemoMode) {
    void upsertWaterLog(state.user.id, normalized)
  }
},
```

- [ ] **Step 4: Implement `removeWaterEntry`**

Immediately after `addWaterEntry`:

```ts
removeWaterEntry: (date, entryId) => {
  set((state) => ({
    waterLogs: {
      ...state.waterLogs,
      [date]: (state.waterLogs[date] || []).filter((e) => e.id !== entryId),
    },
  }))
  const state = get()
  if (state.user && !state.isDemoMode) {
    void deleteWaterLog(state.user.id, entryId)
  }
},
```

- [ ] **Step 5: Implement `getWaterTotal`**

Near the `getDailyTotals` implementation (around line 1298), add:

```ts
getWaterTotal: (date) => {
  return (get().waterLogs[date] || []).reduce((sum, e) => sum + e.amount_ml, 0)
},
```

- [ ] **Step 6: Add imports for the new cloud sync functions**

In `store/useAppStore.ts`, find lines 38–56 (the destructured import from `@/lib/cloud-sync`). Add `upsertWaterLog` and `deleteWaterLog` to the list. The block currently ends with:

```ts
  upsertWorkoutLog,
} from '@/lib/cloud-sync'
```

Change it to:

```ts
  upsertWaterLog,
  deleteWaterLog,
  upsertWorkoutLog,
} from '@/lib/cloud-sync'
```

- [ ] **Step 7: Add `waterLogs` to the `partialize` block**

`partialize` (around line 1357) controls what gets written to `localStorage`. Without this, water data is lost on every page refresh until the cloud sync re-hydrates.

Find the `partialize` block and add `waterLogs` alongside `mealEntries`:

```ts
        mealEntries: state.mealEntries,
        waterLogs: state.waterLogs,   // ← add this line
```

> ⚠️ **Do NOT bump the store `version` number.** Adding a new key to `partialize` is backward-compatible — existing users simply won't have the key yet, which defaults safely to `{}`. Bumping the version triggers the store's `migrate: () => ({})` wipe, which would erase all existing user data (meals, workouts, weight history, etc.).

- [ ] **Step 8: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean compile.

- [ ] **Step 9: Commit**

```bash
git add store/useAppStore.ts
git commit -m "feat: add waterLogs state and water entry actions to store"
```

---

## Task 4: WaterLogModal Component

**Files:**
- Create: `components/dashboard/WaterLogModal.tsx`

- [ ] **Step 1: Create `WaterLogModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import type { WaterEntry } from '@/types'

interface WaterLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (entry: WaterEntry) => void
}

export function WaterLogModal({ open, onOpenChange, onAdd }: WaterLogModalProps) {
  const [amount, setAmount] = useState('')
  const { user, waterLogs, removeWaterEntry } = useAppStore()
  const today = getTodayISO()
  const todayEntries = waterLogs[today] || []

  const isValid = Number(amount) > 0 && !isNaN(Number(amount))

  const handleAdd = () => {
    if (!isValid || !user) return
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      user_id: user.id,
      date: today,
      amount_ml: Number(amount),
      logged_at: new Date().toISOString(),
    }
    onAdd(entry)
    setAmount('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Water</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 330"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <span className="flex items-center text-sm text-muted-foreground">mL</span>
          </div>
          <Button className="w-full" disabled={!isValid} onClick={handleAdd}>
            Add
          </Button>

          {/* Today's log */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Today's Log
            </p>
            {todayEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No entries yet today</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {[...todayEntries].reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(entry.logged_at), 'h:mm a')}
                    </span>
                    <span className="font-medium text-xs">+{entry.amount_ml} mL</span>
                    <button
                      onClick={() => removeWaterEntry(today, entry.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep WaterLogModal
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/WaterLogModal.tsx
git commit -m "feat: add WaterLogModal component"
```

---

## Task 5: WaterIntakeCard Component

**Files:**
- Create: `components/dashboard/WaterIntakeCard.tsx`

- [ ] **Step 1: Create `WaterIntakeCard.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import { getTodayISO } from '@/lib/utils'
import { WaterLogModal } from './WaterLogModal'
import { toast } from 'sonner'
import type { WaterEntry } from '@/types'

function WaterBottle({ fillPct }: { fillPct: number }) {
  const clampedPct = Math.min(fillPct, 100)
  return (
    <div className="relative flex-shrink-0">
      {/* Cap */}
      <div className="w-5 h-2.5 bg-muted rounded-t-sm mx-auto" />
      {/* Neck */}
      <div className="w-6 h-3 bg-background border border-border mx-auto" />
      {/* Body */}
      <div className="relative w-9 h-[72px] rounded-lg border border-border overflow-hidden bg-background">
        <motion.div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-sky-600 to-sky-400"
          animate={{ height: `${clampedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          {/* Wave */}
          <div className="absolute -top-1.5 -left-1 w-[calc(100%+8px)] h-3 bg-sky-400 rounded-full opacity-80" />
          {/* Bubbles */}
          <div className="absolute left-2 bottom-[20%] w-1 h-1 rounded-full bg-white/25" />
          <div className="absolute left-4 bottom-[40%] w-0.5 h-0.5 rounded-full bg-white/20" />
        </motion.div>
      </div>
    </div>
  )
}

export function WaterIntakeCard() {
  const { user, getWaterTotal, addWaterEntry, updateProfile } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const today = getTodayISO()

  const waterGoal = user
    ? (user.water_goal_ml ?? Math.round(((user.weight_kg ?? 70) * 35) / 50) * 50)
    : 2450
  const todayTotal = getWaterTotal(today)
  const fillPct = waterGoal > 0 ? (todayTotal / waterGoal) * 100 : 0

  // Celebration effect — must be before any early return (Rules of Hooks)
  useEffect(() => {
    if (!user || todayTotal < waterGoal || waterGoal <= 0) return
    const celebratedDate = localStorage.getItem('rivora-water-celebrated')
    if (celebratedDate !== today) {
      localStorage.setItem('rivora-water-celebrated', today)
      toast.success('Hydration goal reached! 🎉')
    }
  }, [todayTotal, waterGoal, today, user])

  if (!user) return null

  const handleQuickAdd = (amount: number) => {
    if (!user) return
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      user_id: user.id,
      date: today,
      amount_ml: amount,
      logged_at: new Date().toISOString(),
    }
    addWaterEntry(entry)
  }

  const handleGoalSave = () => {
    const val = Number(goalInput)
    if (!isNaN(val) && val >= 500 && val <= 10000) {
      updateProfile({ water_goal_ml: val })
    }
    setEditingGoal(false)
    setGoalInput('')
  }

  return (
    <>
      <Card className="hover-lift col-span-2 lg:col-span-1">
        <CardContent className="p-3 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">Water</p>
            {/* Goal edit */}
            <div className="flex items-center gap-1">
              {editingGoal ? (
                <>
                  <Input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={handleGoalSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleGoalSave()}
                    className="w-20 h-6 text-xs px-1.5"
                    autoFocus
                  />
                  <button onClick={handleGoalSave} className="text-muted-foreground hover:text-foreground">
                    <Check className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setGoalInput(String(waterGoal)); setEditingGoal(true) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{waterGoal} mL</span>
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bottle + stats */}
          <div className="flex items-center gap-3 mb-3">
            <WaterBottle fillPct={fillPct} />
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-sky-400">
                {todayTotal.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                of {waterGoal.toLocaleString()} mL
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(fillPct)}% · {Math.max(0, waterGoal - todayTotal).toLocaleString()} mL left
              </p>
            </div>
          </div>

          {/* Quick-add buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => handleQuickAdd(250)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              +250
            </button>
            <button
              onClick={() => handleQuickAdd(500)}
              className="flex-1 text-xs py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              +500
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex-1 text-xs py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
            >
              + Custom
            </button>
          </div>
        </CardContent>
      </Card>

      <WaterLogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={(entry) => { addWaterEntry(entry); setModalOpen(false) }}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep WaterIntakeCard
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/WaterIntakeCard.tsx
git commit -m "feat: add WaterIntakeCard component with animated bottle fill"
```

---

## Task 6: Wire into Dashboard

**Files:**
- Modify: `app/dashboard/dashboard/page.tsx`

- [ ] **Step 1: Add import at the top of `page.tsx`**

Find the existing component imports and add:

```tsx
import { WaterIntakeCard } from '@/components/dashboard/WaterIntakeCard'
```

- [ ] **Step 2: Remove Weight and Workouts from the stats array**

Find the stats array (around line 287) that contains `'Calories Today'`, `'Protein'`, `'Weight'`, `'Workouts'`. Remove the two objects with `label: 'Weight'` and `label: 'Workouts'`.

- [ ] **Step 3: Update the grid class and add WaterIntakeCard**

Find:
```tsx
className="grid grid-cols-2 lg:grid-cols-4 gap-4"
```

Change to:
```tsx
className="grid grid-cols-2 lg:grid-cols-3 gap-4"
```

Then find the closing `</motion.div>` of the stats grid (after the `.map()` closes) and add `<WaterIntakeCard />` as the last child inside it, before the closing tag:

```tsx
        <WaterIntakeCard />
      </motion.div>
```

- [ ] **Step 4: Verify the page compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean compile.

- [ ] **Step 5: Smoke test in the browser**

```bash
npm run dev
```

Open http://localhost:3000/dashboard/dashboard. Verify:
- Three cards visible at top: Calories Today, Protein, Water
- Bottle renders with correct fill level (0% if no entries, or demo data level)
- `+250` and `+500` buttons increment the total and animate the bottle
- `+ Custom` opens the modal with a number input
- Modal log list shows entries with delete icons
- Goal pencil icon opens inline edit

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/dashboard/page.tsx
git commit -m "feat: integrate WaterIntakeCard into dashboard, replace weight/workouts stats"
```

---

## Task 7: Seed `water_goal_ml` for Existing Users

**Files:**
- Modify: `lib/mock-data.ts`

- [ ] **Step 1: Add `water_goal_ml` to the demo user**

In `lib/mock-data.ts`, find `DEMO_USER` and add the field:

```ts
water_goal_ml: 2450,
```

(This is `Math.round(70 * 35 / 50) * 50` for the demo user's approximate weight.)

- [ ] **Step 2: Handle missing field for real users in the store**

The `water_goal_ml` field may be absent on existing persisted `UserProfile` objects. The `WaterIntakeCard` already handles this with the `user.water_goal_ml ?? Math.round(...)` fallback, so no migration is needed. Verify the fallback works by temporarily commenting out the mock-data field and checking the card still renders — then restore it.

- [ ] **Step 3: Verify compile and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add lib/mock-data.ts
git commit -m "feat: add water_goal_ml to demo user profile"
```

---

## Done

After Task 7 all code is merged. The feature is complete when:
- Water card visible above fold on dashboard
- Bottle fill animates on quick-add and custom log
- Today's log deletable in the modal
- Goal editable inline on the card
- 100% reached → toast fires once per day
- Data persists in Zustand (resets each day automatically)
- Cloud sync runs in background for authenticated non-demo users
