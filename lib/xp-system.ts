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
const TIER_START_XP: number[] = XP_TIERS.reduce<number[]>((acc, _tier, i) => {
  if (i === 0) {
    acc.push(0)
  } else {
    const prev = XP_TIERS[i - 1]
    acc.push(acc[i - 1] + prev.xpPerLevel * prev.levels)
  }
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

  // Unreachable, but TypeScript needs a return
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
  if (action === 'meal') {
    const isSameDay = dates.meal === today
    return { ...dates, meal: today, meal_count: isSameDay ? (dates.meal_count ?? 0) + 1 : 1 }
  }
  return { ...dates, [action]: today }
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
