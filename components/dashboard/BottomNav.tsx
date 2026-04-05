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
  Compass,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard/dashboard', icon: LayoutDashboard },
  { label: 'Meals', href: '/dashboard/meals', icon: Apple },
  { label: 'Workouts', href: '/dashboard/workouts', icon: Dumbbell },
  { label: 'Feed', href: '/dashboard/feed', icon: Compass },
  { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
]

const NAV_HIDE_DISTANCE = 120
const NAV_HIDE_OFFSET = 88
const NAV_FLOAT_OFFSET = 10

export function BottomNav({
  scrollContainerRef,
}: {
  scrollContainerRef: RefObject<HTMLElement | null>
}) {
  const pathname = usePathname()
  const [hideProgress, setHideProgress] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const lastScrollTopRef = useRef(0)
  const hideProgressRef = useRef(0)

  useEffect(() => {
    const container = scrollContainerRef.current
    const docScroller = document.scrollingElement

    const getScrollTop = () => {
      const containerCanScroll = container && container.scrollHeight > container.clientHeight + 24
      if (containerCanScroll) return container.scrollTop
      return docScroller?.scrollTop ?? window.scrollY ?? 0
    }

    const handleScroll = () => {
      const currentScrollTop = getScrollTop()
      const delta = currentScrollTop - lastScrollTopRef.current

      if (currentScrollTop <= 8) {
        hideProgressRef.current = 0
        setHideProgress(0)
      } else if (Math.abs(delta) >= 1) {
        const nextProgress = Math.min(1, Math.max(0, hideProgressRef.current + (delta / NAV_HIDE_DISTANCE)))
        hideProgressRef.current = nextProgress
        setHideProgress((previous) => (Math.abs(previous - nextProgress) > 0.01 ? nextProgress : previous))
      }

      lastScrollTopRef.current = currentScrollTop
    }

    lastScrollTopRef.current = getScrollTop()
    container?.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [scrollContainerRef])

  useEffect(() => {
    hideProgressRef.current = 0
    setHideProgress(0)
    lastScrollTopRef.current = 0
  }, [pathname])

  useEffect(() => {
    const handleMenuToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>
      setIsMenuOpen(Boolean(customEvent.detail?.open))
    }

    window.addEventListener('rivora-mobile-nav-toggle', handleMenuToggle as EventListener)

    return () => {
      window.removeEventListener('rivora-mobile-nav-toggle', handleMenuToggle as EventListener)
    }
  }, [])

  return (
    <motion.nav
      initial={false}
      animate={{
        y: isMenuOpen ? NAV_HIDE_OFFSET : hideProgress * NAV_HIDE_OFFSET,
        opacity: isMenuOpen ? 0.98 : 1 - (hideProgress * 0.02),
      }}
      transition={{ duration: 0.12, ease: 'linear' }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-[rgba(6,8,10,0.98)]"
        style={{ height: `calc(env(safe-area-inset-bottom) + ${NAV_FLOAT_OFFSET}px)` }}
      />
      <div
        className="pointer-events-auto border-t border-white/10 bg-[rgba(7,10,12,0.94)] shadow-[0_-14px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[rgba(7,10,12,0.78)]"
        style={{
          marginBottom: `${NAV_FLOAT_OFFSET}px`,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  'relative flex min-w-0 flex-1 items-center justify-center rounded-xl py-2.5 transition-colors',
                  isActive ? 'text-white' : 'text-zinc-500'
                )}
              >
                <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-white' : 'text-zinc-500')} strokeWidth={isActive ? 2.35 : 2} />
                <span className="sr-only">{label}</span>
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-white" />
                )}
              </Link>
            )
          })}
          </div>
      </div>
    </motion.nav>
  )
}
