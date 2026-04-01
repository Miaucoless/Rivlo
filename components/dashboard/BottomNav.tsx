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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const lastScrollTopRef = useRef(0)

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
        setIsHidden(false)
      } else if (delta > 10 && currentScrollTop > 64) {
        setIsHidden(true)
      } else if (delta < -8) {
        setIsHidden(false)
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
        y: isHidden || isMenuOpen ? 80 : 0,
        opacity: isHidden || isMenuOpen ? 0.98 : 1,
      }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="pointer-events-auto border-t border-white/10 bg-[rgba(7,10,12,0.94)] shadow-[0_-14px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[rgba(7,10,12,0.78)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  'relative flex min-w-0 flex-1 items-center justify-center rounded-xl py-2 transition-colors',
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
