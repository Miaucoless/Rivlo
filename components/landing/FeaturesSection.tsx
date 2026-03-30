'use client'

import { useRef } from 'react'
import { motion, useMotionTemplate, useScroll, useTransform } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

type FeatureTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'teal' | 'violet'

type Feature = {
  id: string
  eyebrow: string
  title: string
  summary: string
  detail: string
  capabilities: string[]
  proof: string
  tone: FeatureTone
}

const features: Feature[] = [
  {
    id: 'training',
    eyebrow: 'Train with structure',
    title: 'Adaptive training that feels coached, not cobbled together',
    summary:
      'Rivora turns your goal into a repeatable lifting system with planned days, clear progression, and less second-guessing.',
    detail:
      'Build push-pull-legs, upper-lower, or custom splits, then keep momentum with exercise logging, rest timing, and progression that updates as your numbers move.',
    capabilities: ['Goal-based split setup', 'Lift logging with history', 'Progressive overload flow', 'Start-from-dashboard workout launch'],
    proof: 'Built for people who want a real training loop, not a notes app with reps.',
    tone: 'emerald',
  },
  {
    id: 'nutrition',
    eyebrow: 'Eat with precision',
    title: 'Macros, calories, and food logging in one fast daily workflow',
    summary:
      'Rivora keeps nutrition tight without slowing you down, so hitting protein and calorie targets becomes routine.',
    detail:
      'Search foods quickly, log meals, monitor macro progress, and keep your day accurate with a system designed to be checked often and updated fast.',
    capabilities: ['Food search and meal logging', 'Daily macro target tracking', 'Calorie progress feedback', 'Meal-by-meal visibility'],
    proof: 'The focus is speed and clarity, because consistency breaks when logging feels annoying.',
    tone: 'amber',
  },
  {
    id: 'planning',
    eyebrow: 'Plan the week once',
    title: 'Meal prep and grocery planning that remove daily friction',
    summary:
      'Rivora connects meal planning to execution so your weekly plan becomes groceries, meals, and less chaos.',
    detail:
      'Map out a realistic week, organize meals ahead of time, and turn that plan into a practical grocery list instead of rebuilding your diet from scratch every day.',
    capabilities: ['Weekly meal planning', 'Recipe-driven structure', 'Auto-built grocery lists', 'Easier adherence during busy weeks'],
    proof: 'This is where discipline gets easier: fewer decisions, fewer misses, better follow-through.',
    tone: 'sky',
  },
  {
    id: 'tracking',
    eyebrow: 'See what is changing',
    title: 'Progress tracking that shows trend, not just noise',
    summary:
      'Weight, body composition, and historical patterns live in one place, so progress actually tells a story.',
    detail:
      'Rivora turns scattered check-ins into readable trend lines, helping you spot plateaus, confirm momentum, and make better calls before frustration sets in.',
    capabilities: ['Weight and body metrics', 'Trend visualization', 'Goal direction context', 'Long-view performance feedback'],
    proof: 'You can feel off-track for a week and still be moving exactly the right direction.',
    tone: 'rose',
  },
  {
    id: 'coordination',
    eyebrow: 'Run one connected system',
    title: 'A dashboard, calendar, reminders, and journal that work together',
    summary:
      'Rivora is strongest when the pieces talk to each other, giving you one command center for training, nutrition, and follow-through.',
    detail:
      'Use the dashboard for today, the calendar for the week, reminders for accountability, and journaling to capture how the process actually feels while you are in it.',
    capabilities: ['Unified calendar view', 'Streaks and reminders', 'Daily journal and reflections', 'One place to review the whole system'],
    proof: 'The product is not eight disconnected widgets. It is one behavior loop.',
    tone: 'teal',
  },
  {
    id: 'intelligence',
    eyebrow: 'Get smarter recommendations',
    title: 'Personalized targets and guidance grounded in your actual data',
    summary:
      'Rivora uses your stats, goals, and activity context to give the app a personal baseline instead of a generic one.',
    detail:
      'From calorie and macro setup to ongoing adjustments, the platform is designed to keep recommendations tied to what you are trying to change and how your body responds.',
    capabilities: ['BMR and TDEE calculations', 'Goal-aware macro setup', 'Recommendation layer for adjustments', 'Data-informed accountability'],
    proof: 'The point is not more information. The point is better next decisions.',
    tone: 'violet',
  },
]

const toneClasses: Record<FeatureTone, { tint: string; text: string; border: string }> = {
  emerald: { tint: 'bg-emerald-500/12', text: 'text-emerald-300', border: 'border-emerald-400/20' },
  amber: { tint: 'bg-amber-500/12', text: 'text-amber-300', border: 'border-amber-400/20' },
  sky: { tint: 'bg-sky-500/12', text: 'text-sky-300', border: 'border-sky-400/20' },
  rose: { tint: 'bg-rose-500/12', text: 'text-rose-300', border: 'border-rose-400/20' },
  teal: { tint: 'bg-teal-500/12', text: 'text-teal-300', border: 'border-teal-400/20' },
  violet: { tint: 'bg-violet-500/12', text: 'text-violet-300', border: 'border-violet-400/20' },
}

function FeaturePreview({ feature }: { feature: Feature }) {
  if (feature.id === 'training') return <TrainingPreview />
  if (feature.id === 'nutrition') return <NutritionPreview />
  if (feature.id === 'planning') return <PlanningPreview />
  if (feature.id === 'tracking') return <TrackingPreview />
  if (feature.id === 'coordination') return <CoordinationPreview />
  return <IntelligencePreview />
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
      className="overflow-hidden rounded-[1.6rem] border border-white/14 bg-[linear-gradient(180deg,rgba(38,38,43,0.98),rgba(22,22,26,0.98))] shadow-[0_28px_70px_-40px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center gap-2 border-b border-white/12 bg-white/[0.02] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="ml-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] text-zinc-400">
          Rivora system preview
        </div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </motion.div>
  )
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.18)' }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-white/12 bg-white/[0.05] p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{subtext}</p>
    </motion.div>
  )
}

function TrainingPreview() {
  return (
    <Frame>
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/12 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/80">Today&apos;s session</p>
              <h4 className="mt-1 text-lg font-semibold text-white">Push Day A</h4>
              <p className="mt-1 text-sm text-zinc-300">A clear training plan with progression baked in.</p>
            </div>
            <div className="rounded-xl bg-black/30 px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-400">Estimated</p>
              <p className="text-sm font-semibold text-white">65 min</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Incline Press', '4 x 8', '+5 lb from last week'],
            ['Cable Fly', '3 x 12', 'Controlled tempo'],
            ['Shoulder Press', '3 x 10', 'Top set matched'],
            ['Tricep Rope', '3 x 15', 'Finish strong'],
          ].map(([name, sets, note], index) => (
            <motion.div
              key={name}
              initial={{ opacity: 0.5, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.05 * index }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-white/12 bg-white/[0.06] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{name}</p>
                <span className="text-xs text-emerald-300">{sets}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

function NutritionPreview() {
  return (
    <Frame>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
          <StatCard label="Calories" value="2,186" subtext="251 remaining for the day" />

          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Macro targets</p>
            <div className="mt-4 space-y-4">
              {[
                ['Protein', '156g / 180g', '87%', 'bg-emerald-400'],
                ['Carbs', '181g / 220g', '82%', 'bg-sky-400'],
                ['Fat', '58g / 72g', '80%', 'bg-amber-400'],
              ].map(([label, value, width, color]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-200">{label}</span>
                    <span className="text-white">{value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-800">
                    <motion.div
                      className={`h-2 rounded-full ${color}`}
                      initial={{ width: 0 }}
                      whileInView={{ width }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-white">Latest meal entries</p>
            <span className="text-xs text-zinc-400">Logged in under 2 min</span>
          </div>
          <div className="mt-3 space-y-3">
            {[
              ['Chicken rice bowl', '48g protein', '624 kcal'],
              ['Greek yogurt + berries', '24g protein', '280 kcal'],
              ['Steak wrap', '39g protein', '517 kcal'],
            ].map(([meal, protein, calories], index) => (
              <motion.div
                key={meal}
                initial={{ opacity: 0.5, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.06 * index }}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 py-3"
              >
                <div>
                  <p className="text-sm text-white">{meal}</p>
                  <p className="text-xs text-zinc-400">{protein}</p>
                </div>
                <span className="text-xs font-medium text-amber-300">{calories}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function PlanningPreview() {
  return (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Week plan</p>
          <div className="mt-4 space-y-3">
            {[
              ['Mon', 'High-protein burrito bowl', 'Prep batch'],
              ['Tue', 'Turkey chili + rice', 'Lunch and dinner'],
              ['Wed', 'Greek chicken wraps', 'Quick assembly'],
              ['Thu', 'Salmon potato plate', 'Fresh cook'],
            ].map(([day, meal, note], index) => (
              <motion.div
                key={day}
                initial={{ opacity: 0.45, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 * index }}
                className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/12 text-sm font-semibold text-sky-300">
                  {day}
                </div>
                <div>
                  <p className="text-sm text-white">{meal}</p>
                  <p className="text-xs text-zinc-400">{note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Grocery list</p>
          <div className="mt-4 space-y-3">
            {[
              ['Chicken breast', '2.5 lb'],
              ['Greek yogurt', '4 cups'],
              ['Jasmine rice', '10 servings'],
              ['Bell peppers', '6'],
              ['Ground turkey', '2 lb'],
            ].map(([item, qty]) => (
              <motion.div
                key={item}
                whileHover={{ x: 4, borderColor: 'rgba(255,255,255,0.2)' }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between rounded-xl border border-white/12 bg-black/10 px-3 py-2.5"
              >
                <span className="text-sm text-zinc-200">{item}</span>
                <span className="text-xs text-sky-300">{qty}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function TrackingPreview() {
  return (
    <Frame>
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Trend view</p>
              <p className="mt-2 text-2xl font-semibold text-white">-5.4 lb in 8 weeks</p>
              <p className="mt-1 text-sm text-zinc-300">Enough signal to stay calm and keep executing.</p>
            </div>
            <div className="rounded-xl bg-rose-400/14 px-3 py-2 text-right">
              <p className="text-[11px] text-zinc-400">Body fat</p>
              <p className="text-sm font-semibold text-rose-300">18.7%</p>
            </div>
          </div>

          <svg viewBox="0 0 320 96" className="mt-5 h-28 w-full">
            <defs>
              <linearGradient id="rivora-tracking-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#fb7185" stopOpacity="1" />
              </linearGradient>
            </defs>
            <motion.path
              d="M8 18 C 34 22, 46 26, 70 31 S 108 40, 132 45 S 176 53, 196 59 S 238 67, 258 72 S 292 78, 312 84"
              fill="none"
              stroke="url(#rivora-tracking-line)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.4 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          </svg>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Average weekly change" value="-0.67 lb" subtext="Pace is steady and realistic." />
          <StatCard label="Check-ins logged" value="41" subtext="Enough history to trust the trend." />
          <StatCard label="Momentum status" value="On track" subtext="Stay consistent and keep the plan." />
        </div>
      </div>
    </Frame>
  )
}

function CoordinationPreview() {
  return (
    <Frame>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Streak', '12 days', 'text-amber-300'],
            ['Calendar', 'Week synced', 'text-teal-300'],
            ['Journal', '3 entries', 'text-sky-300'],
            ['Reminders', '2 active', 'text-emerald-300'],
          ].map(([label, value, textClass]) => {
            return (
              <motion.div
                key={label as string}
                initial={{ opacity: 0.45, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35 }}
                whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.18)' }}
                className="rounded-2xl border border-white/12 bg-white/[0.06] p-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label as string}</p>
                <p className={`mt-4 text-base font-semibold ${textClass as string}`}>{value as string}</p>
              </motion.div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-white">Today in Rivora</p>
            <span className="text-xs text-zinc-400">One dashboard, one rhythm</span>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['Morning weigh-in logged', '7:12 AM'],
              ['Lunch meal added', '12:41 PM'],
              ['Push Day A started', '6:05 PM'],
              ['Evening journal prompt ready', '9:00 PM'],
            ].map(([item, time], index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0.45, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 * index }}
                className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-3"
              >
                <span className="text-sm text-zinc-200">{item}</span>
                <span className="text-xs text-zinc-400">{time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function IntelligencePreview() {
  return (
    <Frame>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Starting point</p>
            <div className="mt-4 space-y-3">
              {[
                ['BMR', '1,842 kcal'],
                ['TDEE', '2,646 kcal'],
                ['Goal pace', '-0.75 lb / week'],
              ].map(([label, value]) => (
                <motion.div
                  key={label}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-3"
                >
                  <span className="text-sm text-zinc-200">{label}</span>
                  <span className="text-sm font-semibold text-violet-300">{value}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Recommended targets</p>
            <div className="mt-4 space-y-4">
              {[
                ['Calories', '2,200 daily', '94%'],
                ['Protein', '180g', '81%'],
                ['Carbs', '220g', '76%'],
                ['Fat', '70g', '58%'],
              ].map(([label, value, width]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-200">{label}</span>
                    <span className="text-white">{value}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
                    <motion.div
                      className="h-1.5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300"
                      initial={{ width: 0 }}
                      whileInView={{ width }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/12 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80">Adjustment logic</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Weight trend has slowed for 12 days while adherence stayed high. Rivora would flag this as a smart time to review calories or activity rather than guessing.
          </p>
        </div>
      </div>
    </Frame>
  )
}

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const rowRef = useRef<HTMLElement | null>(null)
  const tone = toneClasses[feature.tone]
  const { scrollYProgress } = useScroll({
    target: rowRef,
    offset: ['start 95%', 'end 5%'],
  })
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.24, 0.5, 0.76, 0.88, 1],
    [0.38, 0.62, 0.96, 1, 0.96, 0.62, 0.38]
  )
  const blur = useTransform(
    scrollYProgress,
    [0, 0.14, 0.24, 0.5, 0.76, 0.86, 1],
    [7, 4, 0, 0, 0, 4, 7]
  )
  const scale = useTransform(
    scrollYProgress,
    [0, 0.18, 0.3, 0.5, 0.7, 0.82, 1],
    [0.975, 0.988, 1, 1, 1, 0.988, 0.975]
  )
  const filter = useMotionTemplate`blur(${blur}px)`

  return (
    <motion.article
      ref={rowRef}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      style={{ opacity, scale, filter }}
      className="py-8 md:py-10"
    >
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-4">
          <motion.span
            whileHover={{ x: 4 }}
            transition={{ duration: 0.18 }}
            className={`inline-flex rounded-full border bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] ${tone.border} ${tone.text}`}
          >
            {feature.eyebrow}
          </motion.span>

          <div>
            <h3 className="max-w-xl text-2xl font-semibold leading-tight text-white transition-colors duration-200 md:text-[2rem]">
              {feature.title}
            </h3>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-zinc-300">{feature.summary}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">{feature.detail}</p>
          </div>

          <motion.div
            whileHover={{ x: 6, borderColor: 'rgba(255,255,255,0.18)' }}
            transition={{ duration: 0.2 }}
            className="max-w-xl rounded-2xl border border-white/12 bg-white/[0.06] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Why It Feels Different
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{feature.proof}</p>
          </motion.div>

          <motion.div
            whileHover={{ x: 6, borderColor: 'rgba(255,255,255,0.18)' }}
            transition={{ duration: 0.2 }}
            className="max-w-xl rounded-2xl border border-white/12 bg-white/[0.06] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Core Capabilities
            </p>
            <div className="mt-4 grid gap-3">
              {feature.capabilities.map((item) => (
                <motion.div
                  key={item}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span className="text-sm leading-6 text-zinc-300">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="min-w-0 lg:pt-1">
          <FeaturePreview feature={feature} />
        </div>
      </div>
    </motion.article>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden px-6 py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%)]" />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mx-auto mb-10 max-w-4xl text-center"
        >
          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
            The Rivora System
          </span>
          <h2 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
            Scroll through the parts that make Rivora feel dialed in
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-zinc-400">
            Everything sits inside one contained showcase: structured training, faster nutrition, weekly planning, honest progress tracking, and the accountability tools that keep the whole system moving.
          </p>
        </motion.div>

        <div className="space-y-1">
          {features.map((feature, index) => (
            <FeatureRow key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
