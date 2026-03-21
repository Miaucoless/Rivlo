'use client'

import { usePathname } from 'next/navigation'
import { Bell, Sun, Moon, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/meals': 'Meal Planning',
  '/workouts': 'Workouts',
  '/tracking': 'Progress Tracking',
  '/calendar': 'Calendar',
  '/journal': 'Journal',
  '/settings': 'Settings',
}

export function TopBar() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { user } = useAppStore()

  const title = PAGE_TITLES[pathname] || 'Dashboard'
  const today = formatDate(new Date(), 'EEEE, MMMM d')

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left — title */}
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{today}</p>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <Button variant="ghost" size="icon-sm" aria-label="Search" className="text-muted-foreground">
          <Search className="w-4 h-4" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="text-muted-foreground relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </Button>

        {/* Avatar */}
        {user && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white ml-1">
            {user.name.charAt(0)}
          </div>
        )}
      </div>
    </header>
  )
}
