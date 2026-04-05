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
  size?: number
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
