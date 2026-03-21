'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { buildUserProfile } from '@/lib/utils'
import type { Gender, ActivityLevel, FitnessGoal, WorkoutSplit } from '@/types'
import { toast } from 'sonner'

const TOTAL_STEPS = 5

interface FormData {
  height_cm: number
  weight_kg: number
  age: number
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: WorkoutSplit
}

const initialForm: FormData = {
  height_cm: 175,
  weight_kg: 75,
  age: 25,
  gender: 'male',
  activity_level: 'moderately_active',
  fitness_goal: 'fat_loss',
  workout_split: 'ppl',
}

type ChoiceCard = {
  value: string
  label: string
  description: string
  emoji: string
}

function ChoiceGrid<T extends string>({
  value,
  onChange,
  choices,
}: {
  value: T
  onChange: (v: T) => void
  choices: Array<{ value: T; label: string; description: string; emoji: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={`group relative rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${
            value === c.value
              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
              : 'border-white/10 bg-zinc-900/60 hover:border-white/20'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xl">{c.emoji}</span>
            {value === c.value && (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <p className={`font-semibold text-sm mb-0.5 ${value === c.value ? 'text-emerald-400' : 'text-white'}`}>
            {c.label}
          </p>
          <p className="text-xs text-zinc-500 leading-tight">{c.description}</p>
        </button>
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, updateProfile } = useAppStore()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleComplete = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))

    if (user) {
      const profile = buildUserProfile({
        name: user.name,
        email: user.email,
        ...form,
      })
      updateProfile({
        ...profile,
        onboarded: true,
      })
    }

    toast.success('Profile set up! Your personalized plan is ready. 🎉')
    router.push('/dashboard')
    setLoading(false)
  }

  const steps = [
    {
      title: 'Your body stats',
      subtitle: "We'll use this to calculate your exact calorie and macro targets.",
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Height (cm)</Label>
              <Input
                type="number"
                value={form.height_cm}
                onChange={(e) => update('height_cm', Number(e.target.value))}
                className="bg-zinc-900 border-white/10 text-white"
                min={140} max={230}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Weight (kg)</Label>
              <Input
                type="number"
                value={form.weight_kg}
                onChange={(e) => update('weight_kg', Number(e.target.value))}
                className="bg-zinc-900 border-white/10 text-white"
                min={40} max={200}
                step={0.5}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Age</Label>
            <Input
              type="number"
              value={form.age}
              onChange={(e) => update('age', Number(e.target.value))}
              className="bg-zinc-900 border-white/10 text-white"
              min={16} max={100}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Gender</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update('gender', g)}
                  className={`py-2.5 rounded-lg border text-sm capitalize transition-all duration-200 ${
                    form.gender === g
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Activity level',
      subtitle: 'How active are you on a typical week?',
      content: (
        <ChoiceGrid
          value={form.activity_level}
          onChange={(v) => update('activity_level', v)}
          choices={[
            { value: 'sedentary', label: 'Sedentary', description: 'Desk job, little exercise', emoji: '💺' },
            { value: 'lightly_active', label: 'Lightly Active', description: '1–3 workouts/week', emoji: '🚶' },
            { value: 'moderately_active', label: 'Moderately Active', description: '3–5 workouts/week', emoji: '🏃' },
            { value: 'very_active', label: 'Very Active', description: '6–7 hard workouts/week', emoji: '⚡' },
            { value: 'extra_active', label: 'Athlete', description: '2x/day or physical job', emoji: '🏆' },
          ] as Array<{ value: ActivityLevel; label: string; description: string; emoji: string }>}
        />
      ),
    },
    {
      title: 'Your primary goal',
      subtitle: "This shapes your calorie target and program design.",
      content: (
        <ChoiceGrid
          value={form.fitness_goal}
          onChange={(v) => update('fitness_goal', v)}
          choices={[
            { value: 'fat_loss', label: 'Fat Loss', description: 'Lose fat while preserving muscle', emoji: '🔥' },
            { value: 'muscle_gain', label: 'Muscle Gain', description: 'Lean bulk for maximum gains', emoji: '💪' },
            { value: 'maintenance', label: 'Maintenance', description: 'Maintain weight & improve fitness', emoji: '⚖️' },
            { value: 'athletic_performance', label: 'Performance', description: 'Optimize for sport & strength', emoji: '🎯' },
          ] as Array<{ value: FitnessGoal; label: string; description: string; emoji: string }>}
        />
      ),
    },
    {
      title: 'Workout preference',
      subtitle: 'Choose a training split that fits your schedule.',
      content: (
        <ChoiceGrid
          value={form.workout_split}
          onChange={(v) => update('workout_split', v)}
          choices={[
            { value: 'ppl', label: 'Push/Pull/Legs', description: '6-day split, optimal gains', emoji: '🔄' },
            { value: 'upper_lower', label: 'Upper/Lower', description: '4-day split, balanced', emoji: '⬆️' },
            { value: '3day_fullbody', label: '3-Day Full Body', description: 'Best for beginners', emoji: '🏋️' },
            { value: '4day', label: '4-Day Bro Split', description: 'Classic bodybuilding split', emoji: '💥' },
            { value: 'cardio_focus', label: 'Cardio Focus', description: 'Running, cycling, HIIT', emoji: '🏃' },
            { value: '5day', label: '5-Day Split', description: 'Advanced hypertrophy', emoji: '📈' },
          ] as Array<{ value: WorkoutSplit; label: string; description: string; emoji: string }>}
        />
      ),
    },
    {
      title: 'Your personalized plan',
      subtitle: 'Based on your profile, here are your targets:',
      content: (() => {
        const { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, calculateMacros } = require('@/lib/utils')
        const bmr = Math.round(calculateBMR(form.weight_kg, form.height_cm, form.age, form.gender))
        const tdee = calculateTDEE(bmr, form.activity_level)
        const calories = calculateCalorieTarget(tdee, form.fitness_goal)
        const protein = calculateProteinTarget(form.weight_kg, form.fitness_goal)
        const macros = calculateMacros(calories, protein, form.fitness_goal)

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Daily Calories', value: calories.toLocaleString(), unit: 'kcal', color: 'text-emerald-400' },
                { label: 'Protein', value: protein, unit: 'g/day', color: 'text-blue-400' },
                { label: 'Carbs', value: macros.carbs_g, unit: 'g/day', color: 'text-amber-400' },
                { label: 'Fats', value: macros.fat_g, unit: 'g/day', color: 'text-rose-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-zinc-600">{stat.unit}</p>
                </div>
              ))}
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-400 mb-1">BMR / TDEE</p>
              <p className="text-sm text-zinc-300">
                Base metabolic rate: <span className="text-white font-semibold">{bmr} kcal</span>
                {' · '}
                Total daily expenditure: <span className="text-white font-semibold">{tdee} kcal</span>
              </p>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              These targets are calculated using the Mifflin-St Jeor equation and adjusted for your goal. You can adjust them anytime in settings.
            </p>
          </div>
        )
      })(),
    },
  ]

  const currentStep = steps[step - 1]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-white">Grays</span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i < step ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            />
          ))}
          <span className="text-xs text-zinc-500 ml-2 whitespace-nowrap">{step}/{TOTAL_STEPS}</span>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">{currentStep.title}</h2>
              <p className="text-zinc-400 text-sm">{currentStep.subtitle}</p>
            </div>

            {currentStep.content}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <Button
            variant="ghost"
            className="text-zinc-400 hover:text-white"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              variant="brand"
              onClick={() => setStep((s) => s + 1)}
              className="gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="brand"
              onClick={handleComplete}
              disabled={loading}
              className="gap-2"
            >
              {loading ? 'Setting up...' : 'Start Training'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
