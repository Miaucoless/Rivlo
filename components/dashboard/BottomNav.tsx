'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Apple,
  Dumbbell,
  BarChart3,
  Calendar,
  BookOpen,
  Pill,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Home',       href: '/dashboard/dashboard',  icon: LayoutDashboard },
  { label: 'Meals',      href: '/dashboard/meals',       icon: Apple },
  { label: 'Workouts',   href: '/dashboard/workouts',    icon: Dumbbell },
  { label: 'Tracking',   href: '/dashboard/tracking',    icon: BarChart3 },
  { label: 'Calendar',   href: '/dashboard/calendar',    icon: Calendar },
  { label: 'Journal',    href: '/dashboard/journal',     icon: BookOpen },
  { label: 'Supps',      href: '/dashboard/supplements', icon: Pill },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-4 pt-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl min-w-[40px] transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5 transition-colors', isActive && 'text-foreground')} />
              <span className={cn('text-[10px] font-medium leading-none', isActive ? 'opacity-100' : 'opacity-70')}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
