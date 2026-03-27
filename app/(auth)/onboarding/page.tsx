'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { updateProfile as persistProfile } from '@/lib/auth'
import { buildUserProfile, formatGoalWeightChangeForInput, formatHeightForInput, formatWeightForInput, getHeightUnitLabel, getWeightUnitLabel, parseHeightInput, parseWeightInput } from '@/lib/utils'
import type { Gender, ActivityLevel, FitnessGoal, PreferredWorkoutTime, UnitSystem, WorkoutSplit } from '@/types'
import { toast } from 'sonner'

const TOTAL_STEPS = 6

interface FormData {
  height_input: string
  weight_input: string
  age: number
  unit_system: UnitSystem
  gender: Gender
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
  workout_split: WorkoutSplit
  goal_target_change_input: string
  goal_timeframe_weeks_input: string
  preferred_workout_time: PreferredWorkoutTime
  preferred_foods_input: string
  avoided_foods_input: string
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
  const { user, updateProfile, isDemoMode } = useAppStore()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(() => {
    const unitSystem = user?.unit_system || 'imperial'
    return {
      height_input: formatHeightForInput(user?.height_cm || 175, unitSystem),
      weight_input: formatWeightForInput(user?.weight_kg || 75, unitSystem),
      age: user?.age || 25,
      unit_system: unitSystem,
      gender: user?.gender || 'male',
      activity_level: user?.activity_level || 'moderately_active',
      fitness_goal: user?.fitness_goal || 'fat_loss',
      workout_split: user?.workout_split || 'ppl',
      goal_target_change_input: formatGoalWeightChangeForInput(user?.goal_target_change_kg, unitSystem),
      goal_timeframe_weeks_input: user?.goal_timeframe_weeks ? String(user.goal_timeframe_weeks) : '12',
      preferred_workout_time: user?.preferred_workout_time || 'evening',
      preferred_foods_input: user?.preferred_foods?.join(', ') || '',
      avoided_foods_input: user?.avoided_foods?.join(', ') || '',
    }
  })
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (user?.onboarded) {
      router.replace('/dashboard')
    }
  }, [router, user?.onboarded])

  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.documentElement.style.height = 'auto'
    document.body.style.overflowY = 'auto'
    document.body.style.height = 'auto'
    document.body.style.pointerEvents = 'auto'

    return () => {
      document.documentElement.style.overflowY = ''
      document.documentElement.style.height = ''
      document.body.style.overflowY = ''
      document.body.style.height = ''
      document.body.style.pointerEvents = ''
    }
  }, [])

  const handleUnitSystemChange = (unitSystem: UnitSystem) => {
    const currentHeightCm = parseHeightInput(form.height_input, form.unit_system) ?? user?.height_cm ?? 175
    const currentWeightKg = parseWeightInput(form.weight_input, form.unit_system) ?? user?.weight_kg ?? 75
    setForm((prev) => ({
      ...prev,
      unit_system: unitSystem,
      height_input: formatHeightForInput(currentHeightCm, unitSystem),
      weight_input: formatWeightForInput(currentWeightKg, unitSystem),
    }))
  }

  const handleComplete = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))

    if (user) {
      const height_cm = parseHeightInput(form.height_input, form.unit_system)
      const weight_kg = parseWeightInput(form.weight_input, form.unit_system)

      if (!height_cm || !weight_kg) {
        toast.error('Enter a valid height and weight before continuing.')
        setLoading(false)
        return
      }

      const profile = buildUserProfile({
        name: user.name,
        email: user.email,
        height_cm,
        weight_kg,
        age: form.age,
        unit_system: form.unit_system,
        gender: form.gender,
        activity_level: form.activity_level,
        fitness_goal: form.fitness_goal,
        workout_split: form.workout_split,
        goal_target_change_kg: parseWeightInput(form.goal_target_change_input, form.unit_system) ?? undefined,
        goal_timeframe_weeks: Number(form.goal_timeframe_weeks_input) || undefined,
        preferred_workout_time: form.preferred_workout_time,
        preferred_foods: form.preferred_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
        avoided_foods: form.avoided_foods_input.split(',').map((item) => item.trim()).filter(Boolean),
      })

      if (isDemoMode) {
        updateProfile({
          ...profile,
          onboarded: true,
        })
      } else {
        const response = await persistProfile(user.id, {
          ...profile,
          onboarded: true,
        })

        if (!response.success || !response.user) {
          toast.error(response.error || 'Failed to save your profile.')
          setLoading(false)
          return
        }

        updateProfile(response.user)
      }
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
          <div className="space-y-2">
            <Label className="text-zinc-300">Preferred Units</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'imperial', label: 'US / Imperial', hint: 'ft, in, lbs' },
                { value: 'metric', label: 'Metric', hint: 'cm, kg' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUnitSystemChange(option.value as UnitSystem)}
                  className={`rounded-lg border px-3 py-3 text-left transition-all ${
                    form.unit_system === option.value
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-zinc-500">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Height ({getHeightUnitLabel(form.unit_system)})</Label>
              <Input
                type="text"
                value={form.height_input}
                onChange={(e) => update('height_input', e.target.value)}
                placeholder={form.unit_system === 'imperial' ? `5'9` : '175'}
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Weight ({getWeightUnitLabel(form.unit_system)})</Label>
              <Input
                type="number"
                value={form.weight_input}
                onChange={(e) => update('weight_input', e.target.value)}
                className="bg-zinc-900 border-white/10 text-white"
                step={form.unit_system === 'metric' ? 0.1 : 1}
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
      title: 'Lifestyle preferences',
      subtitle: 'Tell us how you want this plan to fit your life.',
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-zinc-300">Preferred workout time</Label>
            <ChoiceGrid
              value={form.preferred_workout_time}
              onChange={(v) => update('preferred_workout_time', v)}
              choices={[
                { value: 'early_morning', label: 'Early Morning', description: 'Before the day starts', emoji: '🌅' },
                { value: 'morning', label: 'Morning', description: 'Best before lunch', emoji: '☀️' },
                { value: 'afternoon', label: 'Afternoon', description: 'Midday sessions', emoji: '🕑' },
                { value: 'evening', label: 'Evening', description: 'After work or school', emoji: '🌆' },
                { value: 'late_night', label: 'Late Night', description: 'Night owl training', emoji: '🌙' },
                { value: 'flexible', label: 'Flexible', description: 'Any time works', emoji: '🔄' },
              ] as Array<{ value: PreferredWorkoutTime; label: string; description: string; emoji: string }>}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">
                {form.fitness_goal === 'muscle_gain' ? `How much do you want to gain? (${getWeightUnitLabel(form.unit_system)})` : `How much do you want to lose? (${getWeightUnitLabel(form.unit_system)})`}
              </Label>
              <Input
                type="number"
                value={form.goal_target_change_input}
                onChange={(e) => update('goal_target_change_input', e.target.value)}
                placeholder={form.unit_system === 'metric' ? '6' : '12'}
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Timeframe (weeks)</Label>
              <Input
                type="number"
                value={form.goal_timeframe_weeks_input}
                onChange={(e) => update('goal_timeframe_weeks_input', e.target.value)}
                className="bg-zinc-900 border-white/10 text-white"
                min={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Foods you want more of</Label>
            <Input
              type="text"
              value={form.preferred_foods_input}
              onChange={(e) => update('preferred_foods_input', e.target.value)}
              placeholder="e.g. chicken, eggs, fruit, rice"
              className="bg-zinc-900 border-white/10 text-white"
            />
            <p className="text-xs text-zinc-500">Use commas to separate foods.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Foods you want to avoid</Label>
            <Input
              type="text"
              value={form.avoided_foods_input}
              onChange={(e) => update('avoided_foods_input', e.target.value)}
              placeholder="e.g. seafood, mushrooms, peanuts"
              className="bg-zinc-900 border-white/10 text-white"
            />
            <p className="text-xs text-zinc-500">Use commas to separate foods.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Your personalized plan',
      subtitle: 'Based on your profile, here are your targets:',
      content: (() => {
        const { calculateBMR, calculateTDEE, calculateDetailedCalorieTarget, calculateProteinTarget, calculateMacros } = require('@/lib/utils')
        const height_cm = parseHeightInput(form.height_input, form.unit_system) ?? 175
        const weight_kg = parseWeightInput(form.weight_input, form.unit_system) ?? 75
        const bmr = Math.round(calculateBMR(weight_kg, height_cm, form.age, form.gender))
        const tdee = calculateTDEE(bmr, form.activity_level)
        const goal_target_change_kg = parseWeightInput(form.goal_target_change_input, form.unit_system) ?? undefined
          const calories = calculateDetailedCalorieTarget({
          tdee,
          goal: form.fitness_goal,
          goal_target_change_kg,
          goal_timeframe_weeks: Number(form.goal_timeframe_weeks_input) || undefined,
        })
        const protein = calculateProteinTarget(weight_kg, form.fitness_goal)
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
              {goal_target_change_kg && (
                <p className="mt-2 text-sm text-zinc-300">
                  Goal pace: <span className="text-white font-semibold">
                    {form.fitness_goal === 'muscle_gain' ? 'gain' : 'lose'} {form.goal_target_change_input} {getWeightUnitLabel(form.unit_system)}
                  </span>{' '}
                  in <span className="text-white font-semibold">{form.goal_timeframe_weeks_input} weeks</span>
                </p>
              )}
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
    <div
      className="min-h-[100dvh] overflow-y-auto bg-[#0a0a0a] px-6 py-8"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
    >
      <div className="mx-auto w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-white">Rivora</span>
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
