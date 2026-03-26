'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, Sun, Moon, Search, ChevronRight, Sparkles, CheckCheck, Settings,
  Menu, X, LayoutDashboard, Apple, Dumbbell, BarChart3, Calendar, BookOpen, Pill, Zap, LogOut, Flame, RefreshCw,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/meals': 'Meal Planning',
  '/workouts': 'Workouts',
  '/tracking': 'Progress Tracking',
  '/calendar': 'Calendar',
  '/journal': 'Journal',
  '/supplements': 'Supplements',
  '/settings': 'Settings',
}

const SEARCH_ITEMS = [
  { href: '/dashboard/dashboard', title: 'Dashboard', description: 'See your daily overview, streaks, and progress snapshot.', keywords: ['home', 'overview', 'summary', 'stats'] },
  { href: '/dashboard/meals', title: 'Meal Planning', description: 'Log meals, search foods, and manage saved meal templates.', keywords: ['food', 'nutrition', 'calories', 'macros'] },
  { href: '/dashboard/workouts', title: 'Workouts', description: 'Search exercises, run sessions, and manage custom routines.', keywords: ['training', 'exercise', 'lift', 'gym'] },
  { href: '/dashboard/tracking', title: 'Progress Tracking', description: 'Track body metrics, habits, and long-term trends.', keywords: ['progress', 'metrics', 'body', 'check-in'] },
  { href: '/dashboard/calendar', title: 'Calendar', description: 'Review upcoming plans and your workout and meal activity by date.', keywords: ['schedule', 'planner', 'dates', 'timeline'] },
  { href: '/dashboard/journal', title: 'Journal', description: 'Write reflections and search past entries by mood or topic.', keywords: ['notes', 'mindset', 'mood', 'reflection'] },
  { href: '/dashboard/supplements', title: 'Supplements', description: 'Track vitamins, herbals, medications, and reminder schedules in one place.', keywords: ['vitamins', 'medicine', 'herbal', 'pills'] },
  { href: '/dashboard/settings', title: 'Settings', description: 'Update profile details, preferences, and reminder settings.', keywords: ['preferences', 'account', 'profile', 'notifications'] },
] as const

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const {
    user,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    isDemoMode,
    streak,
    logout,
    syncNow,
  } = useAppStore()
  const [isPending, startTransition] = useTransition()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleMobileNavClose = () => setIsMobileNavOpen(false)

  const handleMobileNavNavigate = (href: string) => {
    handleMobileNavClose()
    startTransition(() => router.push(href))
  }

  const handleMobileLogout = async () => {
    handleMobileNavClose()
    if (!isDemoMode) {
      const { signOut } = await import('@/lib/auth')
      await signOut()
    }
    logout()
    router.push('/')
  }

  const title = PAGE_TITLES[pathname] || 'Dashboard'
  const today = formatDate(new Date(), 'EEEE, MMMM d')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    if (!isSearchOpen) return

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 20)

    return () => window.clearTimeout(timer)
  }, [isSearchOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()

    if (!query) return SEARCH_ITEMS

    return SEARCH_ITEMS.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.keywords.join(' ')}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [deferredSearchQuery])

  const unreadCount = notifications.filter((item) => !item.read).length

  const openRoute = (href: string) => {
    setIsSearchOpen(false)
    setIsNotificationsOpen(false)
    setSearchQuery('')
    startTransition(() => router.push(href))
  }

  const markAllAsRead = () => {
    markAllNotificationsRead()
  }

  const openNotifications = (open: boolean) => {
    setIsNotificationsOpen(open)
    if (open) {
      markAllNotificationsRead()
    }
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-14 flex items-center justify-between px-4 md:px-6">
        {/* Left — hamburger (mobile) + title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
            className="text-muted-foreground md:hidden"
            onClick={() => setIsMobileNavOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sync now"
            className="text-muted-foreground"
            disabled={isSyncing || isDemoMode}
            onClick={async () => {
              if (isDemoMode) return
              setIsSyncing(true)
              try {
                await syncNow()
                toast.success('Synced latest data.')
              } catch {
                toast.error('Sync failed. Please try again.')
              } finally {
                setIsSyncing(false)
              }
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            className="text-muted-foreground"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            className="text-muted-foreground relative"
            onClick={() => openNotifications(true)}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </Button>

          {user && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white ml-1">
              {user.name.charAt(0)}
            </div>
          )}
        </div>
        </div>
      </header>

      <Dialog open={isSearchOpen} onOpenChange={(open) => {
        setIsSearchOpen(open)
        if (!open) setSearchQuery('')
      }}>
        <DialogContent className="max-w-2xl flex flex-col overflow-hidden border-border/60 bg-card/95 p-0 backdrop-blur sm:max-h-[80vh] max-h-[85dvh]">
          <DialogHeader className="border-b border-border/60 px-5 py-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-emerald-400" />
              Search the dashboard
            </DialogTitle>
            <DialogDescription>
              Jump between pages, or press Ctrl/Cmd + K any time to reopen this search.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search pages, tools, and shortcuts"
                className="h-11 rounded-xl border-border/70 bg-background pl-10"
              />
            </div>

            <div className="mt-4 space-y-2">
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => openRoute(item.href)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-left transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
                  <p className="font-medium">No matches yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try searching for meals, workouts, settings, or journal.</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                Quick tip: search works across the app sections you already have.
              </span>
              <span>{isPending ? 'Opening...' : `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}`}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNotificationsOpen} onOpenChange={openNotifications}>
        <DialogContent className="max-w-lg border-border/60 bg-card/95 p-0 backdrop-blur">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-base">Notifications</DialogTitle>
                <DialogDescription>
                  Quick reminders and app prompts from around your dashboard.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 rounded-lg"
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
            {notifications.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                whileHover={{ y: -1 }}
                onClick={() => {
                  markNotificationRead(item.id)
                  if (item.action_url) openRoute(item.action_url)
                }}
                className="w-full rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        item.type === 'success'
                          ? 'bg-emerald-400'
                          : item.type === 'warning'
                            ? 'bg-amber-400'
                            : item.type === 'error'
                              ? 'bg-rose-400'
                              : 'bg-sky-400'
                      }`} />
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                  </div>
                  {!item.read && <span className="mt-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">New</span>}
                </div>
                {item.action_url && (
                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                    Open {PAGE_TITLES[item.action_url] || 'page'}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile nav drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleMobileNavClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border" style={{ marginTop: 'env(safe-area-inset-top)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-bold">Rivora</span>
              </div>
              <button
                onClick={handleMobileNavClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {[
                { label: 'Dashboard',  href: '/dashboard/dashboard',   icon: LayoutDashboard },
                { label: 'Meals',      href: '/dashboard/meals',        icon: Apple },
                { label: 'Workouts',   href: '/dashboard/workouts',     icon: Dumbbell },
                { label: 'Tracking',   href: '/dashboard/tracking',     icon: BarChart3 },
                { label: 'Calendar',   href: '/dashboard/calendar',     icon: Calendar },
                { label: 'Journal',    href: '/dashboard/journal',      icon: BookOpen },
                { label: 'Supplements',href: '/dashboard/supplements',  icon: Pill },
                { label: 'Settings',   href: '/dashboard/settings',     icon: Settings },
              ].map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <button
                    key={href}
                    onClick={() => handleMobileNavNavigate(href)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {label}
                  </button>
                )
              })}
            </nav>

            {/* Bottom — streak + user + logout */}
            <div className="px-3 py-4 border-t border-border space-y-2">
              {streak > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400">{streak} day streak</p>
                    <p className="text-xs text-muted-foreground">Keep it going!</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between px-1">
                {user && (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                      {isDemoMode && <span className="text-xs text-amber-400">Demo Mode</span>}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleMobileLogout}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
