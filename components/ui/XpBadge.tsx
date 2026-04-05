'use client'

import { getXpInfo, TIER_STYLES } from '@/lib/xp-system'
import { cn } from '@/lib/utils'

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
