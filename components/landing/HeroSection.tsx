'use client'

import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Play, TrendingUp, Flame, Dumbbell, Apple } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'

// Animated counter
function AnimatedNumber({ to, duration = 1.5 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return controls.stop
  }, [to, duration])
  return <span>{value.toLocaleString()}</span>
}

// Mock dashboard card
function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      className="relative w-full max-w-xl mx-auto"
    >
      {/* Glow backdrop */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-emerald-500/20 rounded-3xl blur-2xl" />

      {/* Main card */}
      <div className="relative bg-zinc-900/90 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-zinc-900/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-zinc-800 rounded-md px-3 py-1 text-xs text-zinc-500 text-center">
              grays.fit/dashboard
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Welcome row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Good morning</p>
              <h3 className="text-white font-semibold">Alex Morgan</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium">
              <Flame className="w-3.5 h-3.5" />
              12 day streak
            </div>
          </div>

          {/* Calorie ring + stats */}
          <div className="grid grid-cols-3 gap-3">
            {/* Calorie progress */}
            <div className="col-span-1 bg-zinc-800/50 rounded-xl p-3 flex flex-col items-center justify-center">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#27272a" strokeWidth="6" />
                  <motion.circle
                    cx="32" cy="32" r="26"
                    fill="none"
                    stroke="url(#cal-gradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.46) }}
                    transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
                  />
                  <defs>
                    <linearGradient id="cal-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-white">46%</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Calories</p>
              <p className="text-xs text-emerald-400 font-medium">1,113 / 2,437</p>
            </div>

            {/* Macros */}
            <div className="col-span-2 bg-zinc-800/50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-400">Today's Macros</p>
              {[
                { label: 'Protein', value: 119, total: 180, color: '#10b981', pct: 66 },
                { label: 'Carbs', value: 101, total: 218, color: '#3b82f6', pct: 46 },
                { label: 'Fat', value: 21, total: 81, color: '#f59e0b', pct: 26 },
              ].map((macro) => (
                <div key={macro.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">{macro.label}</span>
                    <span className="text-zinc-300">{macro.value}g</span>
                  </div>
                  <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: macro.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${macro.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's workout */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Push Day A</p>
                  <p className="text-xs text-zinc-500">5 exercises · 65 min</p>
                </div>
              </div>
              <button className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-600 transition-colors">
                Start
              </button>
            </div>
          </div>

          {/* Weight mini-chart */}
          <div className="bg-zinc-800/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-zinc-300">Weight Trend</span>
              </div>
              <span className="text-xs text-emerald-400 font-medium">-5.0 kg</span>
            </div>
            <svg viewBox="0 0 200 40" className="w-full h-8">
              <motion.polyline
                points="0,32 25,28 50,30 75,24 100,20 125,22 150,16 175,12 200,8"
                fill="none"
                stroke="url(#line-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
              <defs>
                <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="absolute -left-4 top-1/3 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Apple className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Meal Logged</p>
            <p className="text-xs text-zinc-500">548 kcal</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="absolute -right-4 bottom-1/4 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Goal Progress</p>
            <p className="text-xs text-zinc-500">On track 🎯</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function HeroSection() {
  const { loginDemo } = useAppStore()
  const router = useRouter()

  const handleDemo = () => {
    loginDemo()
    router.push('/dashboard')
  }

  const stats = [
    { value: 50000, suffix: '+', label: 'Active users' },
    { value: 2.3, suffix: 'M', label: 'Meals tracked', isDecimal: true },
    { value: 98, suffix: '%', label: 'Goal completion rate' },
  ]

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 px-6 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-teal-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left side — copy */}
          <div className="space-y-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-4 py-1.5 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now in open beta — free to start
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-2"
            >
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight">
                Optimize Your Body.{' '}
                <span className="gradient-text">Automate</span>{' '}
                Your Fitness.
              </h1>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-zinc-400 leading-relaxed max-w-lg"
            >
              Personalized workout plans, precision nutrition tracking, and AI-powered insights — all in one beautifully designed platform. Built for people who take their results seriously.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              <Link href="/signup">
                <Button variant="brand" size="lg" className="gap-2 text-base px-8">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base border-white/20 text-white bg-white/5 hover:bg-white/10"
                onClick={handleDemo}
              >
                <Play className="w-4 h-4 fill-current" />
                View Live Demo
              </Button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="pt-2 flex items-center gap-6"
            >
              <div className="flex -space-x-2">
                {['bg-rose-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-400', 'bg-purple-400'].map((color, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${color} border-2 border-[#0a0a0a] flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {['A', 'J', 'S', 'M', 'R'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-400">
                <span className="text-white font-semibold">50,000+</span> athletes achieving their goals
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10"
            >
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-white">
                    {stat.isDecimal ? (
                      <span>{stat.value}{stat.suffix}</span>
                    ) : (
                      <>
                        <AnimatedNumber to={stat.value} />
                        <span>{stat.suffix}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right side — dashboard preview */}
          <div className="relative hidden lg:block">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
