'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Apple,
  Dumbbell,
  BarChart3,
  Calendar,
  BookOpen,
  Settings,
  Zap,
  ChevronLeft,
  LogOut,
  Flame,
  Trophy,
  Pill,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Meals', href: '/meals', icon: Apple },
  { label: 'Workouts', href: '/workouts', icon: Dumbbell },
  { label: 'Tracking', href: '/tracking', icon: BarChart3 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Journal', href: '/journal', icon: BookOpen },
  { label: 'Supplements', href: '/supplements', icon: Pill },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, sidebarCollapsed, toggleSidebar, logout, streak, isDemoMode } = useAppStore()

  const handleLogout = async () => {
    // If not in demo mode, sign out from Supabase
    if (!isDemoMode) {
      const { signOut } = await import('@/lib/auth')
      await signOut()
    }
    logout()
    toast.success('Logged out successfully')
    router.push('/')
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
      className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col bg-card border-r border-border overflow-hidden"
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-border flex-shrink-0',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-lg font-bold overflow-hidden whitespace-nowrap"
              >
                Rivlo
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                sidebarCollapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0 w-[18px] h-[18px]" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                  transition={{ duration: 0.2 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        {/* Streak badge */}
        {streak > 0 && (
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-1 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-400">{streak} day streak</p>
                  <p className="text-xs text-muted-foreground">Keep it going! 🔥</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-muted-foreground hover:bg-accent hover:text-foreground',
            sidebarCollapsed ? 'justify-center' : '',
            pathname === '/settings' ? 'bg-primary/10 text-primary' : ''
          )}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* User + Logout */}
        <div className={cn(
          'flex items-center gap-2 px-2 py-2',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!sidebarCollapsed && user && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{user.name}</p>
                {isDemoMode && (
                  <span className="text-xs text-amber-400">Demo Mode</span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-full flex justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </motion.aside>
  )
}
