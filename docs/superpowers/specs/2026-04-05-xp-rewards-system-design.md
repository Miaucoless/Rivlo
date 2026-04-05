# XP Rewards & Rank System — Design Spec
**Date:** 2026-04-05

---

## Overview

A progression system that rewards users with XP for every healthy action they take in Rivora. XP accumulates across 5 tiers with a prestige-level Transcendent tier. Rank badges appear next to usernames everywhere in the app, and the rarest players (Transcendent · 250) earn a permanent gold crown on their profile picture.

---

## Tier Structure

**Theme:** Aura — your aura evolves as you level up.

| Tier | XP per level | Levels | XP span | Total XP at tier end |
|---|---|---|---|---|
| Spark | 75 XP | 1–50 | 3,750 XP | 3,750 XP |
| Vitality | 150 XP | 1–50 | 7,500 XP | 11,250 XP |
| Radiance | 250 XP | 1–50 | 12,500 XP | 23,750 XP |
| Ascendant | 400 XP | 1–50 | 20,000 XP | 43,750 XP |
| Transcendent | 225 XP | 1–250 | 56,250 XP | 100,000 XP |

**Maximum level:** Transcendent · 250 (100,000 total XP).

The badge always shows the **within-tier level**, not the global level — e.g. `Radiance · 12`, `Transcendent · 78`.

At ~200 XP/day (engaged user), rough milestones:
- Hit Vitality: ~Week 3
- Hit Radiance: ~Month 2
- Hit Ascendant: ~Month 4
- Hit Transcendent: ~Month 7
- Transcendent · 250: ~Month 16

---

## XP Sources

Every tracked action in the app earns XP. Each source can only fire **once per day** per category unless noted.

| Action | XP | Notes |
|---|---|---|
| Complete a workout | +100 | On workout completion |
| Hit daily water goal | +30 | When `water_logs` for the day reaches `water_goal_ml` |
| Hit daily protein goal | +30 | When daily protein intake reaches `protein_target_g` |
| Log a meal | +10 | Max 3× per day (+30 max) |
| Write a journal entry | +25 | Once per day |
| Log a weight check-in | +20 | Once per day |
| Post to the social feed | +15 | Once per day |
| 7-day activity streak | +75 | Bonus on the 7th consecutive active day |
| Perfect day | +50 | Bonus when workout + water + protein all hit in one day |

**Max XP in a perfect day:** 100 + 30 + 30 + 30 + 25 + 20 + 15 + 50 = **300 XP** (plus 75 on streak days).

---

## Visual Identity

### Badge
A small pill badge used everywhere username appears.

```
[ icon ] Tier · Level
```

- **Icon:** unique SVG per tier (dashed circle → heart → sunburst → arrow → starburst)
- **Colors:** each tier has its own background, text, and border color
- **Spark:** `#111827` bg, `#9ca3af` text, `#374151` border
- **Vitality:** `#052e16` bg, `#6ee7b7` text, `#059669` border
- **Radiance:** `#1e1b4b` bg, `#a5b4fc` text, `#4338ca` border
- **Ascendant:** `#0c1a3a` bg, `#7dd3fc` text, `#0284c7` border
- **Transcendent:** `#150505` bg, `#fda4af` text, `#be123c` border + red glow

### Crown (Transcendent · 250 only)
A gold crown SVG positioned at the **top-right corner** of the user's avatar wherever it appears — feed posts, profile page, comments, anywhere. Awarded permanently via a one-time Crown Ceremony. Stored as a boolean flag `has_crown` in XP state.

---

## Badge Placement

- **Social feed posts** (`SocialPostCard`): badge appears inline after username
- **Profile page** (`/dashboard/profile`): badge shown below username, plus XP progress bar showing current level progress
- **Public profile** (`/dashboard/profile/[username]`): badge visible to other users
- **Social post detail dialog**: badge next to commenter username
- **Top bar / any avatar+username pairing**: badge follows

### XP Progress Bar Placement

The XP progress bar appears in **two places only**:

1. **Profile page** (`/dashboard/profile`) — permanently shown below the username/badge in the profile header. Shows current tier badge, level, XP progress bar, and XP to next level.
2. **Level-up bottom sheet** — contextual feedback immediately after any XP-earning action that causes a level-up. Shows XP gained and updated progress.

It does **not** appear on the dashboard as a persistent widget (can be added later).

---

## Celebration Moments

### 1. Regular Level-Up — Bottom Sheet
Triggered after any XP-earning action that pushes the user to a new level.

- Slides up from the bottom of the screen (Framer Motion)
- Shows: new level badge, XP gained, progress bar to next level
- Dismiss via swipe down or "Continue" button
- Does **not** appear if the level-up triggers a Tier Upgrade instead

### 2. Tier Upgrade — Full-Screen Ceremony
Triggered when crossing from one tier to the next (4 times total: Spark→Vitality, Vitality→Radiance, Radiance→Ascendant, Ascendant→Transcendent).

- Full-screen overlay with radial gradient matching the new tier's color
- Floating particle animation
- Pulsing ring around new tier icon
- Animated badge transition: old badge crossed out → new badge appears
- "Let's Go" CTA to dismiss

### 3. Crown Ceremony — Transcendent · 250
One-time event when the user hits Transcendent · 250.

- Full-screen deep red glow
- Crown SVG animates down onto the user's avatar (CSS keyframe)
- "Claim Your Crown" CTA sets `has_crown: true` in XP state
- After claiming, the crown immediately appears on their avatar everywhere in the app

---

## Data Model

XP state lives in the existing `user_app_state` table under a new `xp` JSONB field. No new tables needed.

```ts
interface XpState {
  total: number           // cumulative XP ever earned
  has_crown: boolean      // true once Transcendent·250 ceremony is claimed
  last_action_dates: {    // ISO date strings, for once-per-day enforcement
    workout?: string
    water?: string
    protein?: string
    meal?: string         // also stores count: meal_count_today
    meal_count?: number
    journal?: string
    weight?: string
    post?: string
    streak_bonus?: string
    perfect_day?: string
  }
  streak_days: number     // consecutive active days
  last_active_date?: string
}
```

Supabase migration: `ALTER TABLE user_app_state ADD COLUMN IF NOT EXISTS xp JSONB NOT NULL DEFAULT '{}'::jsonb;`

Tier and within-tier level are **always computed** from `total` XP — never stored. This means no drift and easy to rebalance.

---

## Core Logic — `lib/xp-system.ts`

```ts
// Tier definitions (in order)
const TIERS = [
  { name: 'Spark',        xpPerLevel: 75,  levels: 50  },
  { name: 'Vitality',     xpPerLevel: 150, levels: 50  },
  { name: 'Radiance',     xpPerLevel: 250, levels: 50  },
  { name: 'Ascendant',    xpPerLevel: 400, levels: 50  },
  { name: 'Transcendent', xpPerLevel: 225, levels: 250 },
]

// From total XP → { tier, level, xpIntoLevel, xpForLevel, isMaxed }
export function getXpInfo(totalXp: number): XpInfo

// From action type + current XpState → XP to award (0 if already done today)
export function computeXpGain(action: XpAction, state: XpState): number

// Apply XP gain → new XpState + LevelUpResult (none | level-up | tier-up | crown)
export function applyXp(gain: number, state: XpState): { newState: XpState, result: LevelUpResult }
```

---

## Component Map

| Component | Purpose |
|---|---|
| `lib/xp-system.ts` | All XP math — tier lookup, gain computation, state transitions |
| `components/ui/XpBadge.tsx` | Pill badge with SVG icon, tier colors, "Tier · Level" text |
| `components/ui/AvatarWithBadge.tsx` | Wraps any avatar image, overlays crown if `has_crown` |
| `components/xp/LevelUpSheet.tsx` | Bottom sheet for regular level-ups (Framer Motion slide-up) |
| `components/xp/TierUpModal.tsx` | Full-screen tier upgrade ceremony |
| `components/xp/CrownCeremony.tsx` | One-time Transcendent·250 crown ceremony |
| `components/xp/XpProgressBar.tsx` | Progress bar shown on profile page |

---

## Integration Points

Each XP trigger is wired into the existing Zustand `addXp(action: XpAction)` store action, which:
1. Computes the gain (enforcing once-per-day rules)
2. Applies XP to state
3. Syncs to Supabase via existing cloud-sync flow
4. Returns a `LevelUpResult` that triggers the appropriate celebration modal

| Where in the app | Action | XP event |
|---|---|---|
| Workout completion | User finishes a workout | `'workout'` |
| Water intake card | Daily `water_goal_ml` reached | `'water'` |
| Meals page | Any meal logged | `'meal'` |
| Meals page | `protein_target_g` reached | `'protein'` |
| Journal page | Journal entry saved | `'journal'` |
| Tracking page | Weight entry logged | `'weight'` |
| Social feed composer | Post published | `'post'` |
| Daily active check | On app open, evaluate streak | `'streak'` / `'perfect_day'` |

---

## Out of Scope (v1)

- XP leaderboard / rankings between users
- XP history log screen
- Badges for specific achievements (e.g. "First 100kg lift")
- XP decay for inactivity
- Admin XP adjustment tools
