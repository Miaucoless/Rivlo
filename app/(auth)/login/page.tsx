'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Apple,
  ArrowLeft,
  Clock3,
  Dumbbell,
  Eye,
  EyeOff,
  NotebookPen,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { signInWithEmail } from '@/lib/auth'
import { toast } from 'sonner'

const dailyFlowSteps = [
  {
    title: 'Today’s workout',
    detail: 'See the session that matters today and move straight into it.',
    time: '6:15 AM',
    icon: Dumbbell,
    accent: 'from-cyan-400/20 via-sky-400/10 to-transparent',
  },
  {
    title: 'Meals in one place',
    detail: 'Meals, saved options, and hydration stay tied to the same day.',
    time: '12:30 PM',
    icon: Apple,
    accent: 'from-lime-400/20 via-emerald-400/10 to-transparent',
  },
  {
    title: 'Weekly check-in closes the loop',
    detail: 'The app helps you adjust the week instead of just showing a pile of data.',
    time: '8:45 PM',
    icon: NotebookPen,
    accent: 'from-amber-400/20 via-orange-400/10 to-transparent',
  },
] as const

const VOLATILE_NAVIGATION_CACHE_NAMES = [
  'start-url',
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'next-static-js-assets',
  'static-js-assets',
  'next-data',
] as const

async function refreshClientNavigationState() {
  if (typeof window === 'undefined') return

  try {
    const isPreviewHost = window.location.hostname.endsWith('.vercel.app')

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map((registration) =>
          (isPreviewHost ? registration.unregister() : registration.update()).catch(() => undefined)
        )
      )
    }

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys()
      const volatileCaches = isPreviewHost
        ? cacheKeys
        : cacheKeys.filter((cacheName) =>
            VOLATILE_NAVIGATION_CACHE_NAMES.some((prefix) => cacheName === prefix || cacheName.includes(prefix))
          )

      await Promise.all(volatileCaches.map((cacheName) => window.caches.delete(cacheName)))
    }
  } catch (error) {
    console.warn('Unable to refresh cached navigation state before continuing.', error)
  }
}

export default function LoginPage() {
  const router = useRouter()
  const { loginDemo, setUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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
    void refreshClientNavigationState()
  }, [router])

  const navigateAfterLogin = async (destination: string) => {
    await refreshClientNavigationState()

    if (typeof window !== 'undefined') {
      window.location.replace(destination)
      return
    }

    router.replace(destination)
  }

  const handleDemoLogin = () => {
    loginDemo()
    toast.success('Welcome to the demo! 🎉')
    void navigateAfterLogin('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const response = await signInWithEmail(email, password)

      if (response.success && response.user) {
        setUser(response.user)
        toast.success('Welcome back! 👋')
        const initialDestination = response.user.onboarded ? '/dashboard' : '/onboarding'
        await navigateAfterLogin(initialDestination)
        return
      }

      toast.error(response.error || 'Failed to sign in')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#06100f] text-white lg:overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(45,212,191,0.12),_transparent_25%),linear-gradient(140deg,_#06100f_0%,_#0b1715_55%,_#060908_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:88px_88px] opacity-[0.06]" />
      <div className="pointer-events-none absolute inset-y-0 left-[46%] hidden w-[32rem] -translate-x-1/2 bg-[radial-gradient(circle,_rgba(16,185,129,0.16),_transparent_65%)] blur-3xl lg:block" />

      <div className="relative min-h-[100svh] lg:grid lg:h-[100svh] lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]">
        <main className="flex min-h-[100svh] items-center justify-center px-4 py-4 sm:px-6 sm:py-6 lg:h-[100svh] lg:px-8 lg:py-5 xl:px-10 xl:py-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[540px]"
          >
            <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,18,17,0.88)] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href="/" className="text-[1.55rem] font-black tracking-tight text-emerald-300 transition-colors hover:text-emerald-200 lg:hidden">
                    Rivora
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

                <div className="pt-1">
                  <Link
                    href="/reset-password"
                    className="text-sm font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    Forgot your password?
                  </Link>
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

        <aside className="relative hidden overflow-hidden lg:flex lg:h-[100svh]">
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex h-full w-full flex-col justify-center px-7 py-5 xl:px-8 xl:py-6"
          >
            <div className="relative space-y-6">
              <div className="pointer-events-none absolute inset-x-10 top-20 h-56 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative space-y-3">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                  Back to home
                </Link>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                    Rivora
                  </p>
                  <h1 className="mt-2.5 max-w-md text-[clamp(1.75rem,2.3vw,2.75rem)] font-black leading-[0.96] tracking-tight text-white">
                    Everything you need today, in one rhythm.
                  </h1>
                  <p className="mt-3 max-w-[32rem] text-[14px] leading-6 text-zinc-300">
                    Rivora keeps meals, workouts, hydration, and your weekly check-in in sync so getting back on track feels calm instead of chaotic.
                  </p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.85rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_36%)]" />
                <div className="pointer-events-none absolute left-[2.2rem] top-20 bottom-14 w-px bg-[linear-gradient(rgba(16,185,129,0),rgba(52,211,153,0.55),rgba(45,212,191,0.35),rgba(16,185,129,0))]" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200/80">
                        Your day, in sync
                      </p>
                      <p className="mt-1.5 text-[1.05rem] font-semibold text-white">
                        One calm flow from morning plan to evening reset.
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-emerald-100">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {dailyFlowSteps.map((step, index) => {
                      const Icon = step.icon
                      return (
                        <div key={step.title} className="relative pl-12">
                          <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1b18] text-emerald-200 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[rgba(5,12,12,0.72)]">
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${step.accent}`} />
                            <div className="relative flex items-start justify-between gap-4 px-4 py-4">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">{step.title}</p>
                                <p className="mt-1 text-[13px] leading-5 text-zinc-300">{step.detail}</p>
                              </div>
                              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                                <Clock3 className="h-3.5 w-3.5 text-emerald-300" />
                                {step.time}
                              </div>
                            </div>
                          </div>
                          {index === 1 && (
                            <div className="mt-3 ml-1 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-200">
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Breakfast logged</span>
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Water on track</span>
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">Saved meals ready</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4 rounded-[1.35rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-50">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 shrink-0 text-emerald-200" />
                      <p className="leading-5">
                        Everything stays in one daily rhythm once you’re in.
                      </p>
                    </div>
                    <div className="hidden items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-100/80 xl:inline-flex">
                      Calm
                      <span className="h-1 w-1 rounded-full bg-emerald-200/60" />
                      Clear
                      <span className="h-1 w-1 rounded-full bg-emerald-200/60" />
                      Consistent
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  )
}
