'use client'

import { motion } from 'framer-motion'
import {
  Dumbbell,
  Apple,
  BarChart3,
  Calendar,
  BookOpen,
  Target,
  Zap,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'

const features = [
  {
    icon: Dumbbell,
    color: 'emerald',
    title: 'Smart Workout Generator',
    description:
      'Auto-generates personalized PPL, Upper/Lower, or full-body splits based on your goals, with progressive overload built in.',
    tags: ['PPL splits', 'Video guides', 'Progress tracking'],
  },
  {
    icon: Apple,
    color: 'blue',
    title: 'Precision Nutrition Tracking',
    description:
      'Log meals in seconds with our food database. Full macro breakdown — calories, protein, carbs, fats, fiber — tracked daily.',
    tags: ['Macro calculator', 'Meal library', 'Daily targets'],
  },
  {
    icon: ShoppingCart,
    color: 'amber',
    title: 'Meal Prep & Grocery Lists',
    description:
      'Build 7-day meal plans with real recipes, auto-aggregate a grocery list with quantities and estimated prices.',
    tags: ['Weekly plans', 'Auto grocery list', 'Swap meals'],
  },
  {
    icon: TrendingUp,
    color: 'rose',
    title: 'Weight & Body Tracking',
    description:
      'Visualize your progress with beautiful charts. Track weight, body fat, and muscle mass over time with trend projections.',
    tags: ['Progress graphs', 'Trend lines', 'Body composition'],
  },
  {
    icon: BarChart3,
    color: 'purple',
    title: 'Personalization Engine',
    description:
      'Calculates your BMR, TDEE, and optimal macro split based on your body stats, activity level, and fitness goals.',
    tags: ['BMR calculator', 'TDEE formula', 'Custom macros'],
  },
  {
    icon: Calendar,
    color: 'teal',
    title: 'Unified Calendar',
    description:
      'See all workouts, meals, and checkpoints on one calendar. Drag to reschedule. Click any day for a full breakdown.',
    tags: ['Drag & drop', 'Daily view', 'Schedule overview'],
  },
  {
    icon: BookOpen,
    color: 'indigo',
    title: 'Interactive Journal',
    description:
      'Daily journaling with mood tracking, energy levels, and smart prompts to keep you reflective and accountable.',
    tags: ['Mood tracker', 'Energy levels', 'Smart prompts'],
  },
  {
    icon: Zap,
    color: 'orange',
    title: 'Streak & Consistency Tracking',
    description:
      "Monitor your habits with daily streaks, weekly completion rates, and insight reports that show what's working.",
    tags: ['Daily streaks', 'Insights', 'Goal milestones'],
  },
  {
    icon: Target,
    color: 'cyan',
    title: 'AI Recommendations',
    description:
      'Logic-based recommendations that analyze your data and suggest improvements to your nutrition and training.',
    tags: ['Weekly analysis', 'Nutrition tips', 'Training advice'],
  },
]

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', ring: 'ring-teal-500/20' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', ring: 'ring-indigo-500/20' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'ring-cyan-500/20' },
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6 relative">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-emerald-400 text-sm font-semibold tracking-widest uppercase">
            Everything you need
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            The complete fitness operating system
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Every feature you need to optimize your body, all connected — from meal planning to workout logging to progress analytics.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => {
            const Icon = feature.icon
            const colors = colorMap[feature.color]
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group relative bg-zinc-900/60 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all duration-300 hover:shadow-xl hover:shadow-black/30"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center mb-4 ring-1 ${colors.ring}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>

                {/* Content */}
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">{feature.description}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Hover glow */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                  style={{ boxShadow: `inset 0 0 40px rgba(16, 185, 129, 0.03)` }} />
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
