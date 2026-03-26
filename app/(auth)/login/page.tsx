'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Apple,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  LayoutDashboard,
  LineChart,
  NotebookPen,
  Pill,
  ShieldCheck,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { signInWithEmail } from '@/lib/auth'
import { toast } from 'sonner'

const productSections = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    detail: 'See your main overview with progress, streaks, and the day’s key fitness data.',
    accent: 'from-emerald-400/20 via-teal-400/10 to-transparent',
    eyebrow: 'Overview',
    highlights: ['Progress snapshot', 'Daily totals', 'Streak visibility'],
    previewIcon: TrendingUp,
    previewStats: [
      { label: 'Focus', value: 'Today' },
      { label: 'View', value: 'Overview' },
    ],
    previewRows: [
      { title: 'Daily totals', meta: 'Meals, workouts, hydration' },
      { title: 'Progress cards', meta: 'Trends and recent activity' },
      { title: 'Consistency streak', meta: 'Visible from your overview' },
    ],
  },
  {
    label: 'Meals',
    icon: Apple,
    detail: 'Plan meals, browse recipes, and work from a grocery list in one place.',
    accent: 'from-lime-400/20 via-emerald-400/10 to-transparent',
    eyebrow: 'Nutrition',
    highlights: ['Meal planning', 'Recipes', 'Grocery list'],
    previewIcon: Apple,
    previewStats: [
      { label: 'Tabs', value: 'Today' },
      { label: 'Tools', value: 'Plan' },
    ],
    previewRows: [
      { title: 'Today’s meals', meta: 'Track intake and saved items' },
      { title: 'Recipe library', meta: 'Browse and add recipes' },
      { title: 'Grocery list', meta: 'Generated from planned meals' },
    ],
  },
  {
    label: 'Workouts',
    icon: Dumbbell,
    detail: 'Follow workout plans, log sessions, and move through your active training flow.',
    accent: 'from-cyan-400/20 via-sky-400/10 to-transparent',
    eyebrow: 'Training',
    highlights: ['Workout plans', 'Session logging', 'Active flow'],
    previewIcon: Dumbbell,
    previewStats: [
      { label: 'Mode', value: 'Active' },
      { label: 'Library', value: 'Saved' },
    ],
    previewRows: [
      { title: 'Premade workouts', meta: 'Browse by split and difficulty' },
      { title: 'Active session flow', meta: 'Move through your workout log' },
      { title: 'Saved workouts', meta: 'Keep reusable training templates' },
    ],
  },
  {
    label: 'Tracking',
    icon: LineChart,
    detail: 'Review weight, nutrition, and workout trends with progress-focused charts.',
    accent: 'from-blue-400/20 via-indigo-400/10 to-transparent',
    eyebrow: 'Progress',
    highlights: ['Weight trends', 'Nutrition history', 'Workout charts'],
    previewIcon: BarChart3,
    previewStats: [
      { label: 'Charts', value: 'Weight' },
      { label: 'History', value: 'Nutrition' },
    ],
    previewRows: [
      { title: 'Weight trends', meta: 'Track change over time' },
      { title: 'Calorie and protein history', meta: 'Built from logged meals' },
      { title: 'Workout performance', meta: 'Reflects logged sessions and PRs' },
    ],
  },
  {
    label: 'Journal',
    icon: NotebookPen,
    detail: 'Capture daily notes, prompts, and check-ins for your routine.',
    accent: 'from-amber-400/20 via-orange-400/10 to-transparent',
    eyebrow: 'Reflection',
    highlights: ['Daily notes', 'Prompts', 'Check-ins'],
    previewIcon: BookOpen,
    previewStats: [
      { label: 'Format', value: 'Daily' },
      { label: 'Flow', value: 'Prompts' },
    ],
    previewRows: [
      { title: 'Daily entries', meta: 'Write notes tied to your routine' },
      { title: 'Prompt-based reflection', meta: 'Structured check-in support' },
      { title: 'Check-in history', meta: 'Keep your entries organized' },
    ],
  },
  {
    label: 'Calendar',
    icon: CalendarDays,
    detail: 'View workouts, meals, and check-ins together on a shared calendar.',
    accent: 'from-fuchsia-400/20 via-pink-400/10 to-transparent',
    eyebrow: 'Schedule',
    highlights: ['Unified calendar', 'Meals and workouts', 'Check-in view'],
    previewIcon: CalendarDays,
    previewStats: [
      { label: 'Layout', value: 'Monthly' },
      { label: 'Events', value: 'Unified' },
    ],
    previewRows: [
      { title: 'Calendar view', meta: 'See activity across the month' },
      { title: 'Meals and workouts', meta: 'Displayed in one timeline' },
      { title: 'Check-ins and reminders', meta: 'Visible alongside scheduled items' },
    ],
  },
  {
    label: 'Supplements',
    icon: Pill,
    detail: 'Manage supplement entries alongside the rest of your health routine.',
    accent: 'from-violet-400/20 via-indigo-400/10 to-transparent',
    eyebrow: 'Routine',
    highlights: ['Supplement log', 'Daily tracking', 'Organized entries'],
    previewIcon: Pill,
    previewStats: [
      { label: 'Status', value: 'Daily' },
      { label: 'Reminders', value: 'Optional' },
    ],
    previewRows: [
      { title: 'Supplement entries', meta: 'Track name, amount, and frequency' },
      { title: 'Taken today', meta: 'Mark items as completed' },
      { title: 'Reminder settings', meta: 'Enable or mute per item' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    detail: 'Adjust profile, goals, and account preferences from your settings area.',
    accent: 'from-zinc-300/20 via-zinc-400/10 to-transparent',
    eyebrow: 'Account',
    highlights: ['Profile settings', 'Goals', 'Preferences'],
    previewIcon: ShieldCheck,
    previewStats: [
      { label: 'Profile', value: 'Editable' },
      { label: 'Goals', value: 'Personal' },
    ],
    previewRows: [
      { title: 'Account preferences', meta: 'Manage personal app settings' },
      { title: 'Goal configuration', meta: 'Adjust targets and preferences' },
      { title: 'Profile details', meta: 'Keep your setup current' },
    ],
  },
] as const

export default function LoginPage() {
  const router = useRouter()
  const { loginDemo, setUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<(typeof productSections)[number]['label'] | null>(null)
  const activeSectionData = productSections.find((section) => section.label === activeSection) ?? null
  const isFeatureExpanded = activeSection !== null
  const expandedCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.documentElement.style.height = 'auto'
    document.documentElement.style.pointerEvents = 'auto'
    document.body.style.overflowY = 'auto'
    document.body.style.height = 'auto'
    document.body.style.pointerEvents = 'auto'

    return () => {
      document.documentElement.style.overflowY = ''
      document.documentElement.style.height = ''
      document.documentElement.style.pointerEvents = ''
      document.body.style.overflowY = ''
      document.body.style.height = ''
      document.body.style.pointerEvents = ''
    }
  }, [])

  useEffect(() => {
    if (!activeSection || !expandedCardRef.current) return

    requestAnimationFrame(() => {
      expandedCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [activeSection])

  const handleDemoLogin = () => {
    loginDemo()
    toast.success('Welcome to the demo! 🎉')
    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    const response = await signInWithEmail(email, password)

    if (response.success && response.user) {
      setUser(response.user)
      toast.success('Welcome back! 👋')
      router.push(response.user.onboarded ? '/dashboard' : '/onboarding')
    } else {
      toast.error(response.error || 'Failed to sign in')
    }

    setLoading(false)
  }

  return (
    <div
      className="relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#06100f] text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(45,212,191,0.12),_transparent_25%),linear-gradient(140deg,_#06100f_0%,_#0b1715_55%,_#060908_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:88px_88px] opacity-[0.06]" />

      <div className={`relative lg:grid lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] ${isFeatureExpanded ? 'min-h-[100svh] items-start' : 'min-h-[100svh]'}`}>
        <main className={`flex items-center justify-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10 ${isFeatureExpanded ? 'lg:sticky lg:top-0 lg:h-[100svh]' : 'min-h-[100svh]'}`}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[560px]"
          >
            <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,18,17,0.88)] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href="/" className="text-[1.55rem] font-black tracking-tight text-emerald-300 transition-colors hover:text-emerald-200 lg:hidden">
                    Rivlo
                  </Link>
                  <p className="hidden text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500 lg:block">
                    Sign in
                  </p>
                  <h2 className="mt-2 text-[1.85rem] font-black leading-[1.02] tracking-tight text-white sm:text-[2.15rem]">
                    Welcome back
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                    Access your dashboard, meals, workouts, tracking, journal, calendar, supplements, and settings from one place.
                  </p>
                </div>

                <Link
                  href="/"
                  className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white lg:inline-flex"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </Link>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[3.25rem] rounded-2xl border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-zinc-600 focus:border-emerald-400/40"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400"
                  >
                    Password
                  </Label>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[3.25rem] rounded-2xl border-white/10 bg-white/[0.04] px-4 pr-12 text-white placeholder:text-zinc-600 focus:border-emerald-400/40"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 pt-1 sm:grid-cols-[minmax(0,1fr)_176px]">
                  <Button
                    type="submit"
                    variant="brand"
                    size="lg"
                    className="h-[3.25rem] rounded-2xl text-base font-semibold shadow-[0_18px_36px_rgba(16,185,129,0.16)]"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="h-[3.25rem] rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-400/20 hover:text-white"
                  >
                    Explore demo
                  </button>
                </div>
              </form>

              <div className="mt-5 border-t border-white/8 pt-4 text-sm">
                <p className="text-zinc-400">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="font-semibold text-emerald-300 transition-colors hover:text-emerald-200">
                    Create one
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </main>

        <aside className={`hidden border-l border-white/8 lg:flex ${isFeatureExpanded ? 'lg:min-h-[100svh]' : 'h-full'}`}>
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className={`flex w-full flex-col justify-between px-8 py-8 xl:px-10 xl:py-10 ${isFeatureExpanded ? '' : 'h-full'}`}
          >
            <div className="space-y-8">
              <div className="space-y-4">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                  Back to home
                </Link>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                    Rivlo
                  </p>
                  <h1 className="mt-3 max-w-sm text-[clamp(1.9rem,2.4vw,2.9rem)] font-black leading-[1] tracking-tight text-white">
                    A calmer way back into your routine.
                  </h1>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Included areas
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {productSections.map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.label
                    return (
                      <button
                        key={section.label}
                        type="button"
                        onClick={() => setActiveSection((current) => (current === section.label ? null : section.label))}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                          isActive
                            ? 'border-emerald-400/30 bg-emerald-400/10 shadow-[0_12px_30px_rgba(16,185,129,0.08)]'
                            : 'border-white/8 bg-black/20 hover:border-white/15 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          isActive ? 'bg-emerald-400/16 text-emerald-100' : 'bg-emerald-400/10 text-emerald-200'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-zinc-200">{section.label}</span>
                      </button>
                    )
                  })}
                </div>

                {activeSectionData && (
                  <motion.div
                    key={activeSection}
                    ref={expandedCardRef}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="relative mt-4 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[rgba(3,10,10,0.72)] p-5"
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeSectionData.accent}`} />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:52px_52px] opacity-40" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/85">
                            {activeSectionData.eyebrow}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">{activeSectionData.label}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                          <activeSectionData.previewIcon className="h-5 w-5" />
                        </div>
                      </div>

                      <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300">
                        {activeSectionData.detail}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeSectionData.highlights.map((highlight) => (
                          <div
                            key={highlight}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                            {highlight}
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Preview</p>
                            <p className="mt-1 text-sm font-medium text-white">{activeSectionData.label} workspace</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="grid grid-cols-2 gap-3">
                            {activeSectionData.previewStats.map((stat) => (
                              <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{stat.label}</p>
                                <p className="mt-2 text-sm font-semibold text-white">{stat.value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2">
                            {activeSectionData.previewRows.map((row, index) => (
                              <div
                                key={row.title}
                                className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3"
                              >
                                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-400/12 text-[11px] font-semibold text-emerald-200">
                                  0{index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white">{row.title}</p>
                                  <p className="mt-1 text-xs leading-5 text-zinc-400">{row.meta}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  )
}
