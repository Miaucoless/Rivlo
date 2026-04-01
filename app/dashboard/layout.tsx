'use client'

import React from 'react'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomNav } from '@/components/dashboard/BottomNav'
import { TopBar } from '@/components/dashboard/TopBar'
import { ExposeStore } from '@/components/ExposeStore'

import { useIsMobile } from '@/hooks/useIsMobile'
import { useAppStore } from '@/store/useAppStore'
import { useAuthInit } from '@/hooks/useAuthInit'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, sidebarCollapsed, syncNow, flushPendingCloudWrites, user } = useAppStore()
  const isMobile = useIsMobile()
  const router = useRouter()
  const { loading } = useAuthInit()
  const mainRef = useRef<HTMLElement>(null)

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

    const triggerSync = async () => {
      if (syncing) return
      syncing = true
      // Safety net: if the request hangs, unblock future syncs after 30s
      syncTimeoutId = setTimeout(() => { syncing = false }, 30_000)
      try {
        await syncNow()
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

    void triggerSync()
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
      if (syncTimeoutId) clearTimeout(syncTimeoutId)
    }
  }, [flushPendingCloudWrites, isAuthenticated, loading, syncNow])

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
    <div className="relative flex min-h-screen overflow-hidden bg-background md:h-screen md:min-h-0">
      {process.env.NODE_ENV === 'production' ? null : <ExposeStore />}
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-transparent" />
      <Sidebar />

      {/* TopBar is OUTSIDE the animated motion.div so position:fixed works correctly.
          CSS transforms (used by framer-motion for marginLeft) create a new stacking
          context that breaks fixed positioning for children. */}
      <TopBar />

      <motion.div
        animate={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex min-w-0 flex-1 flex-col md:min-h-0"
      >
        {/* Spacer matching the fixed TopBar height (3.5rem) + safe area inset */}
        <div style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }} className="flex-shrink-0" />

        <main ref={mainRef} className="flex-1 overflow-y-auto md:min-h-0">
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
    </div>
  )
}
