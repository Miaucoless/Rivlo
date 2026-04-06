'use client'

import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import { XpBadge } from '@/components/ui/XpBadge'

interface XpProgressBarProps {
  totalXp: number
  showBadge?: boolean
}

export function XpProgressBar({ totalXp, showBadge = true }: XpProgressBarProps) {
  const info = getXpInfo(totalXp)
  const style = TIER_STYLES[info.tierName]
  const xpToNext = info.xpForLevel - info.xpIntoLevel

  return (
    <div className="rounded-xl p-3" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      {showBadge && (
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
      )}

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
          {xpToNext} XP to {info.tierName} · {info.level + 1 <= info.maxLevelInTier ? info.level + 1 : 'next tier'}
        </p>
      )}
    </div>
  )
}
