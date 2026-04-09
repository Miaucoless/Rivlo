'use client'

import React from 'react'

import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowDown, Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomNav } from '@/components/dashboard/BottomNav'
import { TopBar } from '@/components/dashboard/TopBar'
import { ExposeStore } from '@/components/ExposeStore'
import { PwaRegistration } from '@/components/pwa/PwaRegistration'
import { LevelUpController } from '@/components/xp/LevelUpController'

import { useIsMobile } from '@/hooks/useIsMobile'
import { useAppStore } from '@/store/useAppStore'
import { useAuthInit } from '@/hooks/useAuthInit'
import { getCloudHydrationProfileForPath, getCloudHydrationScopesForPath } from '@/lib/cloud-sync'

const PULL_TO_REFRESH_THRESHOLD = 100

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, sidebarCollapsed, syncNow, flushPendingCloudWrites, user } = useAppStore()
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const { loading } = useAuthInit()
  const mainRef = useRef<HTMLElement>(null)
  const pullStartYRef = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)
  const pullActiveRef = useRef(false)
  const pullRefreshingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const routeScopes = useMemo(() => getCloudHydrationScopesForPath(pathname), [pathname])
  const routeProfile = useMemo(() => getCloudHydrationProfileForPath(pathname), [pathname])

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace('/login')
    } else if (user && !user.onboarded) {
      router.replace('/onboarding')
    }
  }, [isAuthenticated, loading, router, user])

  useEffect(() => {
    if (loading || !isAuthenticated) return

    let syncing = false
    let syncTimeoutId: ReturnType<typeof setTimeout> | null = null
    let initialSyncTimeoutId: ReturnType<typeof setTimeout> | null = null

    const triggerSync = async () => {
      if (syncing) return
      syncing = true
      // Safety net: if the request hangs, unblock future syncs after 30s
      syncTimeoutId = setTimeout(() => { syncing = false }, 30_000)
      try {
        await syncNow({ scopes: routeScopes, profile: routeProfile })
      } finally {
        if (syncTimeoutId) clearTimeout(syncTimeoutId)
        syncing = false
      }
    }

    const handleFocus = () => void triggerSync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void triggerSync()
    }
    const handleOnline = () => {
      void flushPendingCloudWrites()
      void triggerSync()
    }
    const handleOffline = () => {
      useAppStore.setState((state) => ({
        ...state,
        syncStatus: 'offline',
      }))
    }
    // pageshow fires when page is restored from bfcache (iOS PWA, back-forward nav)
    // visibilitychange alone doesn't fire in this case on iOS
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void triggerSync()
    }

    initialSyncTimeoutId = setTimeout(() => {
      void triggerSync()
    }, 350)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (initialSyncTimeoutId) clearTimeout(initialSyncTimeoutId)
      if (syncTimeoutId) clearTimeout(syncTimeoutId)
    }
  }, [flushPendingCloudWrites, isAuthenticated, loading, routeProfile, routeScopes, syncNow])

  useEffect(() => {
    if (!isMobile || loading || !isAuthenticated) return

    let cancelled = false

    const isAtTop = () => {
      const pageAtTop = typeof window !== 'undefined' ? window.scrollY <= 0 : false
      const containerAtTop = (mainRef.current?.scrollTop ?? 0) <= 0
      return pageAtTop || containerAtTop
    }

    const resetPullState = () => {
      pullStartYRef.current = null
      pullDistanceRef.current = 0
      pullActiveRef.current = false
      if (!cancelled) setPullDistance(0)
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (pullRefreshingRef.current || !isAtTop()) return

      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"], [data-no-pull-refresh="true"]')) {
        return
      }

      pullStartYRef.current = event.touches[0]?.clientY ?? null
      pullDistanceRef.current = 0
      pullActiveRef.current = true
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!pullActiveRef.current || pullStartYRef.current == null) return

      const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
      const deltaY = currentY - pullStartYRef.current

      if (deltaY <= 0) {
        if (pullDistanceRef.current !== 0) {
          pullDistanceRef.current = 0
          setPullDistance(0)
        }
        return
      }

      if (!isAtTop() && pullDistanceRef.current === 0) return

      const nextDistance = Math.min(130, deltaY * 0.32)
      pullDistanceRef.current = nextDistance
      setPullDistance(nextDistance)
    }

    const handleTouchEnd = () => {
      if (!pullActiveRef.current) return

      const shouldRefresh = pullDistanceRef.current >= PULL_TO_REFRESH_THRESHOLD && !pullRefreshingRef.current
      pullActiveRef.current = false
      pullStartYRef.current = null

      if (!shouldRefresh) {
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      pullRefreshingRef.current = true
      setIsPullRefreshing(true)
      setPullDistance(PULL_TO_REFRESH_THRESHOLD)

      // Fire sync in background — don't block the UI on it
      void syncNow({ force: true, scopes: routeScopes, profile: routeProfile })
      startTransition(() => {
        router.refresh()
      })
      pullRefreshingRef.current = false
      if (!cancelled) {
        setIsPullRefreshing(false)
        setPullDistance(0)
      }
      pullDistanceRef.current = 0
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', resetPullState, { passive: true })

    return () => {
      cancelled = true
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', resetPullState)
    }
  }, [isAuthenticated, isMobile, loading, routeProfile, routeScopes, router, syncNow])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || (user && !user.onboarded)) return null

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background md:h-screen md:min-h-0 md:overflow-hidden">
      {process.env.NODE_ENV === 'production' ? null : <ExposeStore />}
      <PwaRegistration />
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-transparent" />
      <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+3.85rem)] z-[55] -translate-x-1/2">
        <motion.div
          animate={{
            opacity: isPullRefreshing || pullDistance > 0 ? 1 : 0,
            y: isPullRefreshing ? 0 : Math.max(-16, 8 - pullDistance / 4),
            scale: isPullRefreshing ? 1 : Math.min(1, 0.7 + pullDistance / 150),
          }}
          transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur-sm"
        >
          {isPullRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
          ) : (
            <ArrowDown
              className="h-4 w-4 text-foreground/60 transition-transform duration-200"
              style={{ transform: pullDistance >= PULL_TO_REFRESH_THRESHOLD ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          )}
        </motion.div>
      </div>
      <Sidebar />

      {/* TopBar is OUTSIDE the animated motion.div so position:fixed works correctly.
          CSS transforms (used by framer-motion for marginLeft) create a new stacking
          context that breaks fixed positioning for children. */}
      <TopBar />

      <motion.div
        animate={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex min-w-0 flex-1 flex-col"
      >
        {/* Spacer matching the fixed TopBar height (3.5rem) + safe area inset */}
        <div style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }} className="flex-shrink-0" />

        <main ref={mainRef} className="flex-1 overflow-visible md:min-h-0 md:overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            className="mx-auto max-w-[1400px] p-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:p-6"
          >
            {children}
          </motion.div>
        </main>
      </motion.div>

      <BottomNav scrollContainerRef={mainRef} />
      <LevelUpController />
    </div>
  )
}
