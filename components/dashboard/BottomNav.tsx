'use client'

import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Apple,
  Dumbbell,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard/dashboard', icon: LayoutDashboard },
  { label: 'Meals', href: '/dashboard/meals', icon: Apple },
  { label: 'Workouts', href: '/dashboard/workouts', icon: Dumbbell },
  { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
]

export function BottomNav({
  scrollContainerRef,
}: {
  scrollContainerRef: RefObject<HTMLElement | null>
}) {
  const pathname = usePathname()
  const [isHidden, setIsHidden] = useState(false)
  const lastScrollTopRef = useRef(0)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop
      const delta = currentScrollTop - lastScrollTopRef.current

      if (currentScrollTop <= 12) {
        setIsHidden(false)
      } else if (delta > 8 && currentScrollTop > 72) {
        setIsHidden(true)
      } else if (delta < -8) {
        setIsHidden(false)
      }

      lastScrollTopRef.current = currentScrollTop
    }

    lastScrollTopRef.current = container.scrollTop
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [scrollContainerRef])

  return (
    <motion.nav
      initial={false}
      animate={{
        y: isHidden ? 112 : 0,
        opacity: isHidden ? 0.92 : 1,
      }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto w-full max-w-md px-3 pb-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="pointer-events-auto rounded-[1.75rem] border border-white/10 bg-[rgba(10,13,14,0.9)] px-2 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="mb-1 flex justify-center">
            <span className="h-1 w-10 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center justify-around gap-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 transition-colors',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-zinc-500'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-emerald-300' : 'text-zinc-500')} />
              <span className={cn('text-[11px] font-medium leading-none', isActive ? 'text-white' : 'text-zinc-500')}>
                {label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 h-1 w-6 rounded-full bg-emerald-400" />
              )}
            </Link>
          )
        })}
          </div>
        </div>
      </div>
    </motion.nav>
  )
}
