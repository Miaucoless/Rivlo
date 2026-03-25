'use client'

import React from 'react'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, ChevronDown, ChevronUp, Circle, Copy, Dumbbell, Pencil, Play, PlayCircle, Plus, Search,
  SlidersHorizontal, Sparkles, Trash2, Trophy, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/useAppStore'
import { EXERCISE_LIBRARY, WORKOUTS } from '@/lib/mock-data'
import { EXERCISE_CLASSIFICATIONS } from '@/lib/exercise-classifications'
import type { Exercise, ExerciseLibraryItem, Gender, MuscleGroup, UserProfile, Workout, WorkoutExercise, WorkoutSet, WorkoutSplit } from '@/types'
import { formatVolumeValue, getTodayISO, getWeightUnitLabel, kgToLbs, lbsToKg } from '@/lib/utils'
import { createUserWorkoutTemplate, deleteUserWorkoutTemplate, fetchUserWorkoutTemplates, updateUserWorkoutTemplate } from '@/lib/workout-templates'
import { toast } from 'sonner'
import type { UnitSystem } from '@/types'

type Difficulty = Workout['difficulty']

interface EditableWorkoutExercise extends WorkoutExercise {
  instanceId: string
}

interface ActiveSet extends WorkoutSet {
  completed: boolean
  actual_reps?: number
  actual_weight?: number
  actual_speed_mph?: number
  actual_incline_pct?: number
  actual_machine_level?: number
  actual_resistance_level?: number
  actual_watts?: number
  actual_cadence_rpm?: number
}

interface ActiveExercise {
  exercise: WorkoutExercise['exercise']
  sets: ActiveSet[]
}

interface PersistedActiveWorkoutSession {
  workout: Workout
  exercises: ActiveExercise[]
  startedAt: string
}

const ACTIVE_WORKOUT_SESSION_KEY = 'rivlo-active-workout-session'

interface MetProfile {
  weightKg: number
  heightCm: number
  age: number
  gender: Gender
}

type ExerciseInputMode = 'strength' | 'treadmill' | 'run_walk' | 'bike' | 'rower' | 'level_cardio' | 'basic_cardio' | 'interval'

function isCardioExercise(exercise: WorkoutExercise['exercise']) {
  const name = exercise.name.toLowerCase()
  return (
    exercise.muscle_groups.includes('cardio') ||
    name.includes('run') ||
    name.includes('walk') ||
    name.includes('bike') ||
    name.includes('elliptical') ||
    name.includes('stair')
  )
}

function isTreadmillExercise(exercise: WorkoutExercise['exercise']) {
  return exercise.equipment.toLowerCase().includes('treadmill')
}

function isTreadmillRunExercise(exercise: WorkoutExercise['exercise']) {
  return isTreadmillExercise(exercise) && exercise.name.toLowerCase().includes('run')
}

function isIntervalExercise(exercise: WorkoutExercise['exercise']) {
  const name = exercise.name.toLowerCase()
  return (
    name.includes('sprint') ||
    name.includes('hiit') ||
    name.includes('interval') ||
    name.includes('tabata') ||
    name.includes('amrap') ||
    name.includes('emom')
  )
}

function isRunningIntervalExercise(exercise: WorkoutExercise['exercise']) {
  const name = exercise.name.toLowerCase()
  return isIntervalExercise(exercise) && (name.includes('run') || name.includes('sprint') || isTreadmillExercise(exercise))
}

function isAssistedPullExercise(exercise: WorkoutExercise['exercise']) {
  const name = exercise.name.toLowerCase()
  return name.includes('assisted pull-up') || name.includes('assisted chin-up')
}

function getDefaultTreadmillSpeedMph(exercise: WorkoutExercise['exercise']) {
  return isTreadmillRunExercise(exercise) ? 6 : 3.2
}

function getDefaultTreadmillInclinePct(exercise: WorkoutExercise['exercise']) {
  return isTreadmillRunExercise(exercise) ? 1 : 6
}

function getExerciseInputMode(exercise: WorkoutExercise['exercise']): ExerciseInputMode {
  const classification = EXERCISE_CLASSIFICATIONS[exercise.id]
  if (classification) {
    const eq = exercise.equipment.toLowerCase()
    switch (classification.primary_type) {
      case 'intervals': return 'interval'
      case 'distance': return 'run_walk'
      case 'time':
      case 'time_distance':
        if (eq.includes('treadmill')) return 'treadmill'
        if (eq.includes('bike') || eq.includes('cycling') || eq.includes('spin')) return 'bike'
        if (eq.includes('rowing') || eq.includes('ski erg') || eq.includes('ski')) return 'rower'
        if (eq.includes('stair') || eq.includes('elliptical') || eq.includes('versaclimber') || eq.includes('assault runner')) return 'level_cardio'
        return 'basic_cardio'
      default: return 'strength'
    }
  }

  // Fallback: name/equipment string detection for exercises not in the classification map
  const name = exercise.name.toLowerCase()
  const equipment = exercise.equipment.toLowerCase()
  if (isIntervalExercise(exercise)) return 'interval'
  if (isTreadmillExercise(exercise)) return 'treadmill'
  if (isCardioExercise(exercise) && (name.includes('run') || name.includes('walk'))) return 'run_walk'
  if (equipment.includes('bike') || equipment.includes('cycling')) return 'bike'
  if (equipment.includes('rowing') || equipment.includes('ski erg') || equipment.includes('ski')) return 'rower'
  if (equipment.includes('elliptical') || equipment.includes('stair') || equipment.includes('versaclimber') || name.includes('versa')) return 'level_cardio'
  if (isCardioExercise(exercise)) return 'basic_cardio'
  return 'strength'
}

function isUnilateralExercise(exercise: WorkoutExercise['exercise']): boolean {
  return EXERCISE_CLASSIFICATIONS[exercise.id]?.modifiers?.includes('unilateral') ?? false
}

function getDefaultSetMetrics(exercise: WorkoutExercise['exercise']) {
  const mode = getExerciseInputMode(exercise)
  switch (mode) {
    case 'treadmill':
      return {
        speed_mph: getDefaultTreadmillSpeedMph(exercise),
        incline_pct: getDefaultTreadmillInclinePct(exercise),
      }
    case 'run_walk':
      return {
        speed_mph: exercise.name.toLowerCase().includes('run') ? 6 : 3.2,
      }
    case 'bike':
      return {
        resistance_level: 5,
        watts: 100,
      }
    case 'rower':
      return {
        watts: 120,
        cadence_rpm: 24,
      }
    case 'level_cardio':
      return {
        machine_level: 5,
      }
    case 'basic_cardio':
      return {
        machine_level: 5,
      }
    case 'interval':
      return {
        reps: 6,
        interval_duration_sec: 20,
        rest_seconds: 40,
        ...(isRunningIntervalExercise(exercise) ? { speed_mph: 10 } : {}),
      }
    default:
      return {}
  }
}

function getExerciseCategory(item: ExerciseLibraryItem) {
  if (item.muscle_groups.includes('cardio')) return 'Cardio'
  if (item.muscle_groups.includes('shoulders') && !item.muscle_groups.includes('chest') && !item.muscle_groups.includes('triceps')) return 'Shoulder'
  if (item.muscle_groups.includes('chest') || item.muscle_groups.includes('shoulders') || item.muscle_groups.includes('triceps')) return 'Push'
  if (item.muscle_groups.includes('back') || item.muscle_groups.includes('biceps') || item.muscle_groups.includes('forearms')) return 'Pull'
  if (item.muscle_groups.includes('quads') || item.muscle_groups.includes('hamstrings') || item.muscle_groups.includes('glutes') || item.muscle_groups.includes('calves')) return 'Legs'
  if (item.muscle_groups.includes('core')) return 'Core'
  return 'Other'
}

const SPLIT_OPTIONS: Array<{ value: WorkoutSplit; label: string }> = [
  { value: 'ppl', label: 'Push / Pull / Legs' },
  { value: 'upper_lower', label: 'Upper / Lower' },
  { value: '3day_fullbody', label: '3-Day Full Body' },
  { value: '4day', label: '4-Day Split' },
  { value: '5day', label: '5-Day Split' },
  { value: '6day', label: '6-Day Split' },
  { value: 'cardio_focus', label: 'Cardio Focus' },
]

function normalizeExerciseText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreExerciseSuggestion(item: ExerciseLibraryItem, query: string) {
  const q = normalizeExerciseText(query)
  const name = normalizeExerciseText(item.name)
  const aliases = (item.aliases || []).map(normalizeExerciseText)

  let score = 0
  if (name === q) score += 220
  if (aliases.includes(q)) score += 170
  if (name.startsWith(q)) score += 120
  if (aliases.some((alias) => alias.startsWith(q))) score += 95
  if (name.includes(q)) score += 75
  if (aliases.some((alias) => alias.includes(q))) score += 60
  if (item.equipment.toLowerCase().includes(q)) score += 30
  return score
}

function createWorkoutExerciseFromLibrary(item: ExerciseLibraryItem): EditableWorkoutExercise {
  const exercise = {
    id: item.id,
    name: item.name,
    muscle_groups: item.muscle_groups,
    equipment: item.equipment,
    difficulty: item.difficulty,
    description: item.description,
    video_url: item.video_url,
    instructions: item.instructions,
  }
  return {
    instanceId: `we-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    sets: [
      {
        set_number: 1,
        reps: item.default_reps,
        weight_kg: 0,
        ...getDefaultSetMetrics(exercise),
        rest_seconds: item.default_rest_seconds,
      },
    ],
  }
}

function createCustomExercise(name: string): EditableWorkoutExercise {
  const cleanedName = name.trim()
  return {
    instanceId: `we-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise: {
      id: `custom-ex-${Date.now()}`,
      name: cleanedName,
      muscle_groups: ['full_body'],
      equipment: 'Custom',
      difficulty: 'beginner',
      description: 'Custom exercise created by the user.',
      instructions: ['Adjust the movement and notes to match what you did.'],
    },
    sets: [
      { set_number: 1, reps: 10, weight_kg: 0, rest_seconds: 60 },
    ],
  }
}

function createActiveExercisesFromWorkout(workout: Workout): ActiveExercise[] {
  return workout.exercises.map((exercise) => ({
    exercise: exercise.exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      completed: false,
      actual_reps: set.reps,
      actual_weight: set.weight_kg || 0,
      actual_speed_mph: set.speed_mph,
      actual_incline_pct: set.incline_pct,
      actual_machine_level: set.machine_level,
      actual_resistance_level: set.resistance_level,
      actual_watts: set.watts,
      actual_cadence_rpm: set.cadence_rpm,
    })),
  }))
}

function normalizeActiveExercisesForWorkout(exercises: ActiveExercise[]): WorkoutExercise[] {
  return exercises.map((exercise) => ({
    exercise: exercise.exercise,
    sets: exercise.sets.map((set, index) => ({
      set_number: index + 1,
      reps: Math.max(1, Number(set.actual_reps ?? set.reps) || 1),
      weight_kg: Math.max(0, Number(set.actual_weight ?? set.weight_kg ?? 0) || 0),
      speed_mph: set.actual_speed_mph,
      incline_pct: set.actual_incline_pct,
      machine_level: set.actual_machine_level,
      resistance_level: set.actual_resistance_level,
      watts: set.actual_watts,
      cadence_rpm: set.actual_cadence_rpm,
      rest_seconds: Math.max(0, Number(set.rest_seconds) || 0),
    })),
  }))
}

function formatNumericInput(value: number | undefined) {
  return value === undefined ? '' : String(value)
}

function formatWorkoutWeightInput(weightKg: number | undefined, unitSystem: UnitSystem) {
  if (weightKg === undefined) return ''
  if (unitSystem === 'metric') return formatNumericInput(weightKg)

  const weightLbs = kgToLbs(weightKg)
  const rounded = Number.isInteger(weightLbs) ? weightLbs.toFixed(0) : weightLbs.toFixed(1)
  return rounded
}

function parseWorkoutWeightInput(value: string, unitSystem: UnitSystem) {
  if (value === '') return 0
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return unitSystem === 'metric' ? numeric : lbsToKg(numeric)
}

function getMetProfile(user?: UserProfile | null): MetProfile {
  return {
    weightKg: user?.weight_kg || 75,
    heightCm: user?.height_cm || 175,
    age: user?.age || 30,
    gender: user?.gender || 'other',
  }
}

function calculateHarrisBenedictRmrKcalDay(profile: MetProfile) {
  const maleRmr = 66.473 + 5.0033 * profile.heightCm + 13.7516 * profile.weightKg - 6.755 * profile.age
  const femaleRmr = 655.0955 + 1.8496 * profile.heightCm + 9.5634 * profile.weightKg - 4.6756 * profile.age

  if (profile.gender === 'male') return maleRmr
  if (profile.gender === 'female') return femaleRmr
  return (maleRmr + femaleRmr) / 2
}

function calculatePredictedRmrMlKgMin(profile: MetProfile) {
  if (profile.weightKg <= 0) return 3.5
  const kcalPerMinute = calculateHarrisBenedictRmrKcalDay(profile) / 1440
  const litersPerMinute = kcalPerMinute / 5
  return (litersPerMinute / profile.weightKg) * 1000
}

function getCorrectedMet(metBase: number, profile: MetProfile) {
  const predictedRmrMlKgMin = calculatePredictedRmrMlKgMin(profile)
  if (!Number.isFinite(predictedRmrMlKgMin) || predictedRmrMlKgMin <= 0) return metBase
  return metBase * (3.5 / predictedRmrMlKgMin)
}

function estimateActiveSetSeconds(args: { reps: number; exercise: WorkoutExercise['exercise'] }) {
  const exerciseName = args.exercise.name.toLowerCase()
  const isCardio = isCardioExercise(args.exercise)
  const isIsometric = exerciseName.includes('plank') || exerciseName.includes('hold')

  if (isCardio) {
    return Math.max(300, args.reps * 60)
  }

  if (isIsometric) {
    return Math.max(20, args.reps)
  }

  const perRepSeconds =
    exerciseName.includes('deadlift') || exerciseName.includes('squat') || exerciseName.includes('row')
      ? 4.8
      : 3.8

  return Math.max(18, args.reps * perRepSeconds + 12)
}

function estimateTreadmillMet(args: {
  exercise: WorkoutExercise['exercise']
  speedMph?: number
  inclinePct?: number
}) {
  const speedMph = Math.max(args.speedMph ?? getDefaultTreadmillSpeedMph(args.exercise), 0)
  const inclinePct = Math.max(args.inclinePct ?? getDefaultTreadmillInclinePct(args.exercise), 0)
  const speedMetersPerMinute = speedMph * 26.8
  const grade = inclinePct / 100

  const vo2 =
    isTreadmillRunExercise(args.exercise)
      ? 0.2 * speedMetersPerMinute + 0.9 * speedMetersPerMinute * grade + 3.5
      : 0.1 * speedMetersPerMinute + 1.8 * speedMetersPerMinute * grade + 3.5

  return Math.max(2.5, vo2 / 3.5)
}

function estimateRunWalkMet(args: {
  exercise: WorkoutExercise['exercise']
  speedMph?: number
}) {
  const speedMph = Math.max(args.speedMph ?? (args.exercise.name.toLowerCase().includes('run') ? 6 : 3.2), 0)
  const speedMetersPerMinute = speedMph * 26.8
  const vo2 =
    args.exercise.name.toLowerCase().includes('run')
      ? 0.2 * speedMetersPerMinute + 3.5
      : 0.1 * speedMetersPerMinute + 3.5

  return Math.max(2.2, vo2 / 3.5)
}

function estimateBikeMet(args: {
  metBase: number
  weightKg: number
  watts?: number
  resistanceLevel?: number
}) {
  if ((args.watts ?? 0) > 0 && args.weightKg > 0) {
    const vo2 = 7 + (10.8 * (args.watts || 0)) / args.weightKg
    return Math.max(3, vo2 / 3.5)
  }

  if ((args.resistanceLevel ?? 0) > 0) {
    return Math.max(3, args.metBase * (0.72 + Math.min(args.resistanceLevel || 0, 20) * 0.06))
  }

  return args.metBase
}

function estimateRowerMet(args: {
  metBase: number
  weightKg: number
  watts?: number
  cadenceRpm?: number
}) {
  if ((args.watts ?? 0) > 0 && args.weightKg > 0) {
    const vo2 = 7 + (1.8 * 6.12 * (args.watts || 0)) / args.weightKg
    return Math.max(3.5, vo2 / 3.5)
  }

  if ((args.cadenceRpm ?? 0) > 0) {
    return Math.max(3.5, args.metBase * (0.75 + Math.min(args.cadenceRpm || 0, 40) * 0.015))
  }

  return args.metBase
}

function estimateLevelBasedMet(args: {
  metBase: number
  level?: number
}) {
  if ((args.level ?? 0) <= 0) return args.metBase
  return Math.max(2.5, args.metBase * (0.7 + Math.min(args.level || 0, 20) * 0.05))
}

function estimateAdjustedMet(args: {
  metBase: number
  metType: ExerciseLibraryItem['met_type']
  actualWeight: number
  actualReps: number
  metProfile: MetProfile
  activeSeconds: number
}) {
  const correctedMetBase = getCorrectedMet(args.metBase, args.metProfile)
  const loadRatio = args.metProfile.weightKg > 0 ? args.actualWeight / args.metProfile.weightKg : 0
  const densityFactor = Math.min(1.35, Math.max(0.85, 40 / Math.max(args.activeSeconds, 20)))
  const repFactor = Math.min(1.15, Math.max(0.9, args.actualReps / 10))
  const loadFactor = Math.min(1.4, 0.9 + loadRatio * 0.3)

  if (args.metType === 'cardio') return Math.min(14, correctedMetBase * Math.max(0.95, densityFactor))
  if (args.metType === 'bodyweight_vigorous') return Math.min(11, correctedMetBase * Math.max(0.95, repFactor))
  if (args.metType === 'bodyweight_light') return Math.min(7.5, correctedMetBase * Math.max(0.95, repFactor))
  if (args.metType === 'squat_hinge') return Math.min(9.5, correctedMetBase * ((loadFactor + densityFactor) / 2))
  return Math.min(8.8, correctedMetBase * ((loadFactor + repFactor + densityFactor) / 3))
}

function estimateSetCalories(args: {
  metProfile: MetProfile
  reps: number
  weightKg: number
  speedMph?: number
  inclinePct?: number
  machineLevel?: number
  resistanceLevel?: number
  watts?: number
  cadenceRpm?: number
  restSeconds: number
  exercise: WorkoutExercise['exercise']
}) {
  const libraryMatch = EXERCISE_LIBRARY.find((item) => item.id === args.exercise.id)
  const inputMode = getExerciseInputMode(args.exercise)
  const libraryMetBase = libraryMatch?.met_base ?? 5
  const metBase =
    inputMode === 'treadmill'
      ? estimateTreadmillMet({
          exercise: args.exercise,
          speedMph: args.speedMph,
          inclinePct: args.inclinePct,
        })
      : inputMode === 'run_walk'
        ? estimateRunWalkMet({
            exercise: args.exercise,
            speedMph: args.speedMph,
          })
        : inputMode === 'bike'
          ? estimateBikeMet({
              metBase: libraryMetBase,
              weightKg: args.metProfile.weightKg,
              watts: args.watts,
              resistanceLevel: args.resistanceLevel,
            })
          : inputMode === 'rower'
            ? estimateRowerMet({
                metBase: libraryMetBase,
                weightKg: args.metProfile.weightKg,
                watts: args.watts,
                cadenceRpm: args.cadenceRpm,
              })
            : inputMode === 'level_cardio' || inputMode === 'basic_cardio'
              ? estimateLevelBasedMet({
                  metBase: libraryMetBase,
                  level: args.machineLevel,
                })
              : libraryMetBase
  const activeSeconds = estimateActiveSetSeconds({ reps: args.reps, exercise: args.exercise })
  const adjustedMet = estimateAdjustedMet({
    metBase,
    metType: libraryMatch?.met_type ?? 'resistance',
    actualWeight: Math.max(args.weightKg, 0),
    actualReps: Math.max(args.reps, 0),
    metProfile: args.metProfile,
    activeSeconds,
  })

  const activeCalories = adjustedMet * args.metProfile.weightKg * (activeSeconds / 3600)
  const restMetBase = (libraryMatch?.met_type ?? 'resistance') === 'cardio' ? 1.8 : 1.3
  const restCalories =
    getCorrectedMet(restMetBase, args.metProfile) * args.metProfile.weightKg * (Math.max(args.restSeconds, 0) / 3600)
  return Math.max(1, activeCalories + restCalories)
}

function summarizeExercises(exercises: WorkoutExercise[], metProfile: MetProfile) {
  let caloriesBurned = 0
  let totalVolumeKg = 0
  let totalDurationSeconds = 0

  exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const reps = Math.max(0, Number(set.reps) || 0)
      const weightKg = Math.max(0, Number(set.weight_kg) || 0)
      const restSeconds = Math.max(0, Number(set.rest_seconds) || 0)
      caloriesBurned += estimateSetCalories({
        metProfile,
        reps,
        weightKg,
        speedMph: set.speed_mph,
        inclinePct: set.incline_pct,
        machineLevel: set.machine_level,
        resistanceLevel: set.resistance_level,
        watts: set.watts,
        cadenceRpm: set.cadence_rpm,
        restSeconds,
        exercise: exercise.exercise,
      })
      totalVolumeKg += reps * weightKg
      totalDurationSeconds += estimateActiveSetSeconds({ reps, exercise: exercise.exercise }) + restSeconds
    })
  })

  return {
    caloriesBurned: Math.round(caloriesBurned),
    totalVolumeKg: Math.round(totalVolumeKg),
    durationMin: Math.max(5, Math.round(totalDurationSeconds / 60)),
  }
}

function SavedWorkoutCard({
  workout,
  onStart,
  onEdit,
  onDelete,
}: {
  workout: Workout
  onStart: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onDelete?: (workout: Workout) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const handleDeleteClick = () => setShowConfirm(true)
  const handleConfirm = () => {
    setShowConfirm(false)
    onDelete && onDelete(workout)
  }
  const handleCancel = () => setShowConfirm(false)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{workout.source || 'premade'}</Badge>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{workout.day_label}</span>
          </div>
          <p className="text-lg font-semibold">{workout.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{workout.description}</p>
        </div>
        <Badge variant="outline" className="capitalize">{workout.difficulty}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="font-data text-lg font-semibold">{workout.exercises.length}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Exercises</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="font-data text-lg font-semibold">~{workout.estimated_duration_min}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Minutes</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="font-data text-lg font-semibold">{workout.muscle_groups.length}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Focus</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {workout.exercises.slice(0, 3).map((exercise, index) => (
          <span key={`${workout.id}-${exercise.exercise.id}-${index}`} className="rounded-full border border-border/50 px-2.5 py-1 text-[10px] text-muted-foreground">
            {exercise.exercise.name}
          </span>
        ))}
        {workout.exercises.length > 3 && (
          <span className="rounded-full border border-border/50 px-2.5 py-1 text-[10px] text-muted-foreground">
            +{workout.exercises.length - 3} more
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="brand" className="flex-1 gap-2" onClick={() => onStart(workout)}>
          <Play className="h-4 w-4 fill-current" />
          Start Workout
        </Button>
        <Button variant="outline" size="icon" onClick={() => onEdit(workout)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(workout)}>
            <Trash2 className="h-4 w-4" />

                {/* Confirmation Dialog */}
                {showConfirm && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-xl flex flex-col items-center">
                      <p className="mb-4 text-sm font-semibold">Are you sure you want to delete this saved workout?</p>
                      <div className="flex gap-3">
                        <Button variant="destructive" onClick={handleConfirm}>Delete</Button>
                        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
          </Button>
        )}
      </div>
    </div>
  )
}

function WorkoutBuilderModal({
  open,
  onOpenChange,
  workout,
  defaultSplit,
  unitSystem,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: Workout | null
  defaultSplit: WorkoutSplit
  unitSystem: UnitSystem
  onSave: (workout: Workout) => void
}) {
  const [name, setName] = useState('')
  const [dayLabel, setDayLabel] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [splitType, setSplitType] = useState<WorkoutSplit>(defaultSplit)
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [exercises, setExercises] = useState<EditableWorkoutExercise[]>([])
  const [apiSuggestions, setApiSuggestions] = useState<ExerciseLibraryItem[]>([])
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)

  useEffect(() => {
    if (!open) return
    if (workout) {
      setName(workout.name)
      setDayLabel(workout.day_label)
      setDifficulty(workout.difficulty)
      setSplitType(workout.split_type)
      setExercises(workout.exercises.map((exercise, index) => ({ ...exercise, instanceId: `existing-${index}-${Date.now()}` })))
      setExerciseQuery('')
      return
    }

    setName('')
    setDayLabel('')
    setDifficulty('intermediate')
    setSplitType(defaultSplit)
    setExercises([])
    setExerciseQuery('')
  }, [defaultSplit, open, workout])

  const filteredSuggestions = useMemo(() => {
    const query = exerciseQuery.trim()
    if (query.length < 2) return []
    return [...EXERCISE_LIBRARY]
      .filter((item) => {
        const values = [item.name, item.equipment, ...(item.aliases || []), ...item.muscle_groups]
        return values.some((value) => normalizeExerciseText(value).includes(normalizeExerciseText(query)))
      })
      .sort((left, right) => scoreExerciseSuggestion(right, query) - scoreExerciseSuggestion(left, query))
      .slice(0, 8)
  }, [exerciseQuery])

  useEffect(() => {
    const query = exerciseQuery.trim()
    if (query.length < 2) { setApiSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/exercises?name=${encodeURIComponent(query)}`)
        if (res.ok) {
          const all: ExerciseLibraryItem[] = await res.json()
          const localNames = new Set(EXERCISE_LIBRARY.map((i) => i.name.toLowerCase()))
          setApiSuggestions(all.filter((i) => !localNames.has(i.name.toLowerCase())))
        }
      } catch { setApiSuggestions([]) }
    }, 400)
    return () => clearTimeout(timer)
  }, [exerciseQuery])

  const addExerciseFromLibrary = (item: ExerciseLibraryItem) => {
    setExercises((current) => [...current, createWorkoutExerciseFromLibrary(item)])
    setExerciseQuery('')
  }

  const addCustomExerciseToWorkout = () => {
    const trimmed = exerciseQuery.trim()
    if (!trimmed) {
      toast.error('Type an exercise name first.')
      return
    }
    setExercises((current) => [...current, createCustomExercise(trimmed)])
    setExerciseQuery('')
  }

  const updateSetField = (instanceId: string, setIndex: number, field: keyof WorkoutSet, value: number) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.instanceId === instanceId
          ? {
              ...exercise,
              sets: exercise.sets.map((set, index) => index === setIndex ? { ...set, [field]: value } : set),
            }
          : exercise
      )
    )
  }

  const addSetToExercise = (instanceId: string) => {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.instanceId !== instanceId) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: exercise.sets.length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: lastSet?.weight_kg ?? 0,
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              interval_duration_sec: lastSet?.interval_duration_sec,
              rest_seconds: lastSet?.rest_seconds ?? 60,
            },
          ],
        }
      })
    )
  }

  const moveExercise = (instanceId: string, direction: 'up' | 'down') => {
    setExercises((current) => {
      const currentIndex = current.findIndex((exercise) => exercise.instanceId === instanceId)
      if (currentIndex === -1) return current

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= current.length) return current

      const reordered = [...current]
      const [movedExercise] = reordered.splice(currentIndex, 1)
      reordered.splice(nextIndex, 0, movedExercise)
      return reordered
    })
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Add a workout name first.')
      return
    }

    if (exercises.length === 0) {
      toast.error('Add at least one exercise.')
      return
    }

    const normalizedExercises: WorkoutExercise[] = exercises.map((exercise) => ({
      exercise: exercise.exercise,
      sets: exercise.sets.map((set, index) => ({
        set_number: index + 1,
        reps: Math.max(1, Number(set.reps) || 1),
        weight_kg: Math.max(0, Number(set.weight_kg) || 0),
        speed_mph: set.speed_mph !== undefined ? Math.max(0, Number(set.speed_mph) || 0) : undefined,
        incline_pct: set.incline_pct !== undefined ? Math.max(0, Number(set.incline_pct) || 0) : undefined,
        machine_level: set.machine_level !== undefined ? Math.max(0, Number(set.machine_level) || 0) : undefined,
        resistance_level: set.resistance_level !== undefined ? Math.max(0, Number(set.resistance_level) || 0) : undefined,
        watts: set.watts !== undefined ? Math.max(0, Number(set.watts) || 0) : undefined,
        cadence_rpm: set.cadence_rpm !== undefined ? Math.max(0, Number(set.cadence_rpm) || 0) : undefined,
        rest_seconds: Math.max(0, Number(set.rest_seconds) || 0),
      })),
    }))

    const muscleGroups = Array.from(new Set(normalizedExercises.flatMap((exercise) => exercise.exercise.muscle_groups)))
    const summary = summarizeExercises(normalizedExercises, getMetProfile())

    onSave({
      id: workout?.source === 'custom' ? workout.id : `cw-${Date.now()}`,
      name: name.trim(),
      day_label: dayLabel.trim() || 'Custom Session',
      description: 'Saved workout created by the user.',
      exercises: normalizedExercises,
      estimated_duration_min: summary.durationMin,
      difficulty,
      split_type: splitType,
      muscle_groups: (muscleGroups.length > 0 ? muscleGroups : ['full_body']) as MuscleGroup[],
      source: 'custom',
      updated_at: new Date().toISOString(),
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{workout ? 'Edit saved workout' : 'Build workout'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Workout name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper Body Builder" />
            </div>
            <div className="space-y-1.5">
              <Label>Day label</Label>
              <Input value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="Push B" />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Split type</Label>
              <Select value={splitType} onValueChange={(value) => setSplitType(value as WorkoutSplit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPLIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Search exercises</p>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={exerciseQuery} onChange={(e) => setExerciseQuery(e.target.value)} placeholder="Search exercise variations" className="pl-9 pr-8" />
                  {exerciseQuery && (
                    <button type="button" onClick={() => setExerciseQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {exerciseQuery.trim().length >= 2 && (filteredSuggestions.length > 0 || apiSuggestions.length > 0) && (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-background">
                    {filteredSuggestions.map((item) => (
                      <button key={item.id} type="button" onClick={() => addExerciseFromLibrary(item)} className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/20">

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.equipment}</p>
                        </div>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} × {item.default_reps}</span>
                      </button>
                    ))}
                    {apiSuggestions.length > 0 && (
                      <>
                        {filteredSuggestions.length > 0 && <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50 bg-muted/20">More exercises</div>}
                        {apiSuggestions.map((item) => (
                          <button key={item.id} type="button" onClick={() => addExerciseFromLibrary(item)} className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/20">
    
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.equipment}</p>
                            </div>
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} × {item.default_reps}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={addCustomExerciseToWorkout}>Add Custom</Button>
            </div>
          </div>

          <div className="space-y-3">
            {exercises.map((exercise, exerciseIndex) => {
              const inputMode = getExerciseInputMode(exercise.exercise)

              return <div key={exercise.instanceId} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{exercise.exercise.name}</p>
                    <p className="text-xs text-muted-foreground">{exercise.exercise.equipment}</p>
                    <button
                      type="button"
                      onClick={() => setPreviewExercise(exercise.exercise)}
                      className="mt-1 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                    >
                      <PlayCircle className="h-3 w-3" />
                      How to do this
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(exercise.instanceId, 'up')}
                      disabled={exerciseIndex === 0}
                      aria-label="Move exercise up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(exercise.instanceId, 'down')}
                      disabled={exerciseIndex === exercises.length - 1}
                      aria-label="Move exercise down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive" onClick={() => setExercises((current) => current.filter((item) => item.instanceId !== exercise.instanceId))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {inputMode === 'interval' ? (
                    <div className={`grid ${isRunningIntervalExercise(exercise.exercise) ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[80px_1fr_1fr_1fr_auto]'} gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground`}>
                      <span>Round</span>
                      <span>Intervals</span>
                      <span>Work (sec)</span>
                      <span>Rest (sec)</span>
                      {isRunningIntervalExercise(exercise.exercise) && <span>Speed MPH</span>}
                      <span />
                    </div>
                  ) : inputMode === 'treadmill' ? (
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Minutes</span>
                      <span>Speed MPH</span>
                      <span>Incline %</span>
                      <span>Rest Sec</span>
                      <span />
                    </div>
                  ) : inputMode === 'run_walk' ? (
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Minutes</span>
                      <span>Speed MPH</span>
                      <span>Rest Sec</span>
                      <span />
                    </div>
                  ) : inputMode === 'bike' || inputMode === 'rower' ? (
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Minutes</span>
                      <span>Watts</span>
                      <span>Rest Sec</span>
                      <span />
                    </div>
                  ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Minutes</span>
                      <span>Level</span>
                      <span>Rest Sec</span>
                      <span />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Reps / Min</span>
                      <span>Weight ({getWeightUnitLabel(unitSystem)})</span>
                      <span>Rest Sec</span>
                    </div>
                  )}
                  {exercise.sets.map((set, setIndex) => (
                    inputMode === 'interval' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className={`grid ${isRunningIntervalExercise(exercise.exercise) ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[80px_1fr_1fr_1fr_auto]'} gap-2`}>
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Rnd {set.set_number}</div>
                        <Input
                          type="number"
                          min={1}
                          value={formatNumericInput(set.reps)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 1 : Math.max(1, Number(e.target.value)))}
                          placeholder="# intervals"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={set.interval_duration_sec ?? ''}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'interval_duration_sec', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="e.g. 20"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={formatNumericInput(set.rest_seconds)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="e.g. 40"
                        />
                        {isRunningIntervalExercise(exercise.exercise) && (
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={set.speed_mph ?? ''}
                            onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))}
                            placeholder="e.g. 10"
                          />
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((s, i) => ({ ...s, set_number: i + 1 })) } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'treadmill' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">
                          Set {set.set_number}
                        </div>
                        <Input
                          type="number"
                          value={formatNumericInput(set.reps)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Minutes"
                        />
                        <Input
                          type="number"
                          value={formatNumericInput(set.speed_mph)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Speed MPH"
                        />
                        <Input
                          type="number"
                          value={formatNumericInput(set.incline_pct)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'incline_pct', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Incline %"
                        />
                        <Input
                          type="number"
                          value={formatNumericInput(set.rest_seconds)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Rest sec"
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((nextSet, index) => ({ ...nextSet, set_number: index + 1 })) || item.sets } : item))} disabled={exercise.sets.length <= 1}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : inputMode === 'run_walk' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((nextSet, index) => ({ ...nextSet, set_number: index + 1 })) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'bike' || inputMode === 'rower' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'watts', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Watts" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((nextSet, index) => ({ ...nextSet, set_number: index + 1 })) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'machine_level', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Level" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((nextSet, index) => ({ ...nextSet, set_number: index + 1 })) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">
                          Set {set.set_number}
                        </div>
                        <Input
                          type="number"
                          value={formatNumericInput(set.reps)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Reps / min"
                        />
                        <Input
                          type="number"
                          value={formatWorkoutWeightInput(set.weight_kg, unitSystem)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'weight_kg', parseWorkoutWeightInput(e.target.value, unitSystem))}
                          placeholder={isAssistedPullExercise(exercise.exercise) ? `Assistance (${getWeightUnitLabel(unitSystem)})` : `Weight (${getWeightUnitLabel(unitSystem)})`}
                        />
                        <Input
                          type="number"
                          value={formatNumericInput(set.rest_seconds)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Rest sec"
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex).map((nextSet, index) => ({ ...nextSet, set_number: index + 1 })) || item.sets } : item))} disabled={exercise.sets.length <= 1}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  ))}
                </div>

                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => addSetToExercise(exercise.instanceId)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {inputMode === 'interval' ? 'Add round' : 'Add set'}
                </Button>
              </div>
            })}
          </div>

          <Button onClick={handleSave} className="w-full" variant="brand">
            Save Workout
          </Button>
        </div>
      </DialogContent>
      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </Dialog>
  )
}

function ActiveWorkoutModal({
  workout,
  metProfile,
  unitSystem,
  workoutLogs,
  initialExercises,
  onClose,
  onPause,
  onSessionChange,
  onComplete,
}: {
  workout: Workout
  metProfile: MetProfile
  unitSystem: UnitSystem
  workoutLogs: import('@/types').WorkoutLog[]
  initialExercises?: ActiveExercise[]
  onClose: () => void
  onPause: () => void
  onSessionChange: (exercises: ActiveExercise[]) => void
  onComplete: (payload: { exercises: ActiveExercise[]; caloriesBurned: number; totalVolumeKg: number; durationMin: number }, options?: { saveAsTemplate?: boolean }) => void
}) {
  // Build a lookup of most recent performance per exercise id
  const lastPerformance = useMemo(() => {
    const map: Record<string, { date: string; sets: Array<{ actual_reps: number; weight_kg: number }> }> = {}
    const sorted = [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date))
    for (const log of sorted) {
      for (const ex of log.exercises) {
        if (!map[ex.exercise_id] && log.workout_id !== workout.id) {
          map[ex.exercise_id] = { date: log.date, sets: ex.sets }
        }
        // Also match by name for exercises that have varying IDs
        if (!map[`name:${ex.exercise_name}`]) {
          map[`name:${ex.exercise_name}`] = { date: log.date, sets: ex.sets }
        }
      }
    }
    return map
  }, [workoutLogs, workout.id])
  const [exercises, setExercises] = useState<ActiveExercise[]>(
    initialExercises && initialExercises.length > 0
      ? initialExercises
      : createActiveExercisesFromWorkout(workout)
  )
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)
  const [apiLiveSuggestions, setApiLiveSuggestions] = useState<ExerciseLibraryItem[]>([])
  const [timeUnits, setTimeUnits] = useState<Record<string, 'sec' | 'min'>>({})
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)

  const getTimeUnit = (key: string, defaultUnit: 'sec' | 'min') => timeUnits[key] ?? defaultUnit
  const toggleTimeUnit = (key: string, defaultUnit: 'sec' | 'min') =>
    setTimeUnits((prev) => ({ ...prev, [key]: (prev[key] ?? defaultUnit) === 'sec' ? 'min' : 'sec' }))

  // Cardio duration stored as minutes in actual_reps
  const displayCardio = (valueMin: number | undefined, unit: 'sec' | 'min') => {
    if (valueMin === undefined || valueMin === 0) return ''
    return unit === 'sec' ? String(Math.round(valueMin * 60)) : String(valueMin)
  }
  const parseCardio = (input: string, unit: 'sec' | 'min') => {
    const v = parseFloat(input) || 0
    return unit === 'sec' ? Math.round((v / 60) * 100) / 100 : v
  }

  // Interval work duration stored in seconds in interval_duration_sec
  const displayWork = (valueSec: number | undefined, unit: 'sec' | 'min') => {
    if (valueSec === undefined || valueSec === 0) return ''
    return unit === 'min' ? String(Math.round((valueSec / 60) * 100) / 100) : String(valueSec)
  }
  const parseWork = (input: string, unit: 'sec' | 'min') => {
    const v = parseFloat(input) || 0
    return unit === 'min' ? Math.round(v * 60) : v
  }

  // Rest stored in seconds
  const displayRest = (valueSec: number, unit: 'sec' | 'min') =>
    unit === 'min' ? String(Math.round((valueSec / 60) * 100) / 100) : String(valueSec)
  const parseRest = (input: string, unit: 'sec' | 'min') => {
    const v = parseFloat(input) || 0
    return unit === 'min' ? Math.round(v * 60) : v
  }

  useEffect(() => {
    if (initialExercises && initialExercises.length > 0) {
      setExercises(initialExercises)
      return
    }
    setExercises(createActiveExercisesFromWorkout(workout))
  }, [initialExercises, workout])

  useEffect(() => {
    onSessionChange(exercises)
  }, [exercises, onSessionChange])

  const completedSets = exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length
  const totalSets = exercises.flatMap((exercise) => exercise.sets).length
  const progress = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
  const liveSuggestions = useMemo(() => {
    const query = exerciseSearch.trim()
    if (query.length < 1) return []
    return [...EXERCISE_LIBRARY]
      .filter((item) => {
        const values = [item.name, item.equipment, ...(item.aliases || []), ...item.muscle_groups]
        return values.some((value) => normalizeExerciseText(value).includes(normalizeExerciseText(query)))
      })
      .sort((left, right) => scoreExerciseSuggestion(right, query) - scoreExerciseSuggestion(left, query))
      .slice(0, 8)
  }, [exerciseSearch])

  useEffect(() => {
    const query = exerciseSearch.trim()
    if (query.length < 1) { setApiLiveSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/exercises?name=${encodeURIComponent(query)}`)
        if (res.ok) {
          const all: ExerciseLibraryItem[] = await res.json()
          const localNames = new Set(EXERCISE_LIBRARY.map((i) => i.name.toLowerCase()))
          setApiLiveSuggestions(all.filter((i) => !localNames.has(i.name.toLowerCase())))
        }
      } catch { setApiLiveSuggestions([]) }
    }, 400)
    return () => clearTimeout(timer)
  }, [exerciseSearch])

  const summary = summarizeExercises(
    exercises.map((exercise) => ({
      exercise: exercise.exercise,
      sets: exercise.sets.map((set, index) => ({
        set_number: index + 1,
        reps: set.actual_reps ?? set.reps,
        weight_kg: set.actual_weight ?? set.weight_kg ?? 0,
        speed_mph: set.actual_speed_mph,
        incline_pct: set.actual_incline_pct,
        machine_level: set.actual_machine_level,
        resistance_level: set.actual_resistance_level,
        watts: set.actual_watts,
        cadence_rpm: set.actual_cadence_rpm,
        rest_seconds: set.rest_seconds,
      })),
    })),
    metProfile
  )

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'actual_reps' | 'actual_weight' | 'actual_speed_mph' | 'actual_incline_pct' | 'actual_machine_level' | 'actual_resistance_level' | 'actual_watts' | 'actual_cadence_rpm',
    value: number | undefined
  ) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex === setIndex ? { ...set, [field]: value } : set),
            }
          : exercise
      )
    )
  }

  const addSetToExercise = (exerciseIndex: number) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: exercise.sets.length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: lastSet?.weight_kg ?? 0,
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              machine_level: lastSet?.machine_level,
              resistance_level: lastSet?.resistance_level,
              watts: lastSet?.watts,
              cadence_rpm: lastSet?.cadence_rpm,
              rest_seconds: lastSet?.rest_seconds ?? 60,
              completed: false,
              actual_reps: lastSet?.actual_reps ?? lastSet?.reps ?? 10,
              actual_weight: lastSet?.actual_weight ?? lastSet?.weight_kg ?? 0,
              actual_speed_mph: lastSet?.actual_speed_mph ?? lastSet?.speed_mph,
              actual_incline_pct: lastSet?.actual_incline_pct ?? lastSet?.incline_pct,
              actual_machine_level: lastSet?.actual_machine_level ?? lastSet?.machine_level,
              actual_resistance_level: lastSet?.actual_resistance_level ?? lastSet?.resistance_level,
              actual_watts: lastSet?.actual_watts ?? lastSet?.watts,
              actual_cadence_rpm: lastSet?.actual_cadence_rpm ?? lastSet?.cadence_rpm,
            },
          ],
        }
      })
    )
  }

  const moveExercise = (exerciseIndex: number, direction: 'up' | 'down') => {
    setExercises((current) => {
      const targetIndex = direction === 'up' ? exerciseIndex - 1 : exerciseIndex + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const reordered = [...current]
      const [movedExercise] = reordered.splice(exerciseIndex, 1)
      reordered.splice(targetIndex, 0, movedExercise)
      return reordered
    })
  }

  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex || exercise.sets.length <= 1) return exercise
        return {
          ...exercise,
          sets: exercise.sets
            .filter((_, currentSetIndex) => currentSetIndex !== setIndex)
            .map((set, index) => ({ ...set, set_number: index + 1 })),
        }
      })
    )
  }

  const removeExerciseFromLiveWorkout = (exerciseIndex: number) => {
    setExercises((current) => current.filter((_, currentIndex) => currentIndex !== exerciseIndex))
  }

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex === setIndex ? { ...set, completed: !set.completed } : set),
            }
          : exercise
      )
    )
  }

  const addExerciseToLiveWorkout = (item: ExerciseLibraryItem) => {
    const created = createWorkoutExerciseFromLibrary(item)
    setExercises((current) => [
      ...current,
      {
        exercise: created.exercise,
        sets: created.sets.map((set) => ({
          ...set,
          completed: false,
          actual_reps: set.reps,
          actual_weight: set.weight_kg || 0,
          actual_speed_mph: set.speed_mph,
          actual_incline_pct: set.incline_pct,
          actual_machine_level: set.machine_level,
          actual_resistance_level: set.resistance_level,
          actual_watts: set.watts,
          actual_cadence_rpm: set.cadence_rpm,
        })),
      },
    ])
    setExerciseSearch('')
    toast.success(`${item.name} added to this workout.`)
  }

  const addCustomExerciseToLiveWorkout = () => {
    const trimmed = exerciseSearch.trim()
    if (!trimmed) return
    const created = createCustomExercise(trimmed)
    setExercises((current) => [
      ...current,
      {
        exercise: created.exercise,
        sets: created.sets.map((set) => ({
          ...set,
          completed: false,
          actual_reps: set.reps,
          actual_weight: set.weight_kg || 0,
          actual_speed_mph: set.speed_mph,
          actual_incline_pct: set.incline_pct,
          actual_machine_level: set.machine_level,
          actual_resistance_level: set.resistance_level,
          actual_watts: set.watts,
          actual_cadence_rpm: set.cadence_rpm,
        })),
      },
    ])
    setExerciseSearch('')
    toast.success('Custom exercise added to this workout.')
  }

  const setAllSetsCompletion = (completed: boolean) => {
    setExercises((current) =>
      current.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set, completed })),
      }))
    )
  }

  // Map an exercise to an API Ninjas activity string
  function getApiActivity(ex: ActiveExercise['exercise']): string {
    const name = ex.name.toLowerCase()
    const mg = ex.muscle_groups
    if (mg.includes('cardio')) {
      if (name.includes('run')) return 'running'
      if (name.includes('walk')) return 'walking'
      if (name.includes('bike') || name.includes('cycl')) return 'stationary bike'
      if (name.includes('row')) return 'rowing machine'
      if (name.includes('elliptical')) return 'elliptical trainer'
      if (name.includes('stair')) return 'stair treadmill machine'
      if (name.includes('jump rope')) return 'jump rope'
      if (name.includes('swim')) return 'swimming laps'
      return 'aerobics'
    }
    return 'weight training'
  }

  const handleCompleteWorkout = async (options?: { saveAsTemplate?: boolean }) => {
    if (exercises.length === 0) {
      toast.error('Add at least one exercise before completing this workout.')
      return
    }

    setIsCompleting(true)
    const metCalories = summary.caloriesBurned
    const durationMin = summary.durationMin || workout.estimated_duration_min
    const weightKg = metProfile.weightKg

    try {
      // Group exercises by activity type and accumulate duration
      const activityMap: Record<string, number> = {}
      for (const ex of exercises) {
        const activity = getApiActivity(ex.exercise)
        const exDurationMin = ex.sets.reduce((s, set) => {
          const isCardio = ex.exercise.muscle_groups.includes('cardio')
          return s + (isCardio ? (set.actual_reps || set.reps || 0) : (set.rest_seconds || 60) / 60 + 0.5)
        }, 0)
        activityMap[activity] = (activityMap[activity] || 0) + exDurationMin
      }

      let apiTotal = 0
      await Promise.all(
        Object.entries(activityMap).map(async ([activity, dur]) => {
          const mins = Math.max(1, Math.round(dur))
          const res = await fetch(
            `/api/calories-burned?activity=${encodeURIComponent(activity)}&weight_kg=${weightKg.toFixed(1)}&duration_min=${mins}`
          )
          const data = await res.json()
          if (data?.total_calories) apiTotal += data.total_calories
        })
      )

      // If API returned something meaningful, blend: 70% API + 30% MET
      const finalCalories = apiTotal > 0
        ? Math.round(apiTotal * 0.7 + metCalories * 0.3)
        : metCalories

      onComplete({ exercises, caloriesBurned: finalCalories, totalVolumeKg: summary.totalVolumeKg, durationMin }, options)
    } catch {
      onComplete({ exercises, caloriesBurned: metCalories, totalVolumeKg: summary.totalVolumeKg, durationMin }, options)
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{workout.name}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{progress}%</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Progress</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{summary.caloriesBurned}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. kcal</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{summary.durationMin}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. min</p>
          </div>
        </div>

        <Progress value={progress} indicatorClassName="bg-emerald-500" className="h-1.5" />

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAllSetsCompletion(true)}>
            Select All Complete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAllSetsCompletion(false)}>
            Reset All
          </Button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Add another exercise</p>
              <p className="text-xs text-muted-foreground">Search and drop a movement into this live workout.</p>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search exercise variations" className="pl-9 pr-8" />
                {exerciseSearch && (
                  <button type="button" onClick={() => setExerciseSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {exerciseSearch.trim().length >= 1 && (liveSuggestions.length > 0 || apiLiveSuggestions.length > 0) && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-background">
                  {liveSuggestions.map((item) => (
                    <button key={item.id} type="button" onClick={() => addExerciseToLiveWorkout(item)} className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/20">
                      {item.gif_url && <img src={item.gif_url} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.equipment}</p>
                      </div>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} × {item.default_reps}</span>
                    </button>
                  ))}
                  {apiLiveSuggestions.length > 0 && (
                    <>
                      {liveSuggestions.length > 0 && <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50 bg-muted/20">More exercises</div>}
                      {apiLiveSuggestions.map((item) => (
                        <button key={item.id} type="button" onClick={() => addExerciseToLiveWorkout(item)} className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/20">
  
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.equipment}</p>
                          </div>
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} × {item.default_reps}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <Button type="button" variant="outline" onClick={addCustomExerciseToLiveWorkout}>
              Add Custom
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {exercises.map((exercise, exerciseIndex) => {
            const inputMode = getExerciseInputMode(exercise.exercise)
            const prevData = lastPerformance[exercise.exercise.id] || lastPerformance[`name:${exercise.exercise.name}`]
            return <div key={`${exercise.exercise.id}-${exerciseIndex}`} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{exercise.exercise.name}</p>
                  <p className="text-xs text-muted-foreground">{exercise.exercise.equipment}</p>
                  <button
                    type="button"
                    onClick={() => setPreviewExercise(exercise.exercise)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                  >
                    <PlayCircle className="h-3 w-3" />
                    How to do this
                  </button>
                  {prevData && prevData.sets.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground/70 truncate">
                      Last:{' '}
                      {prevData.sets.map((s, si) => {
                        const w = s.weight_kg > 0
                          ? ` @ ${unitSystem === 'imperial' ? Math.round(s.weight_kg * 2.205) : s.weight_kg}${unitSystem === 'imperial' ? 'lb' : 'kg'}`
                          : ''
                        return `${s.actual_reps}${w}${si < prevData.sets.length - 1 ? ' · ' : ''}`
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveExercise(exerciseIndex, 'up')}
                    disabled={exerciseIndex === 0}
                    aria-label="Move exercise up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveExercise(exerciseIndex, 'down')}
                    disabled={exerciseIndex === exercises.length - 1}
                    aria-label="Move exercise down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Badge variant="outline" className="capitalize shrink-0">{exercise.exercise.difficulty}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive/70 hover:text-destructive"
                    onClick={() => removeExerciseFromLiveWorkout(exerciseIndex)}
                    aria-label="Delete exercise from this workout"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {inputMode === 'treadmill' ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Set</span>
                    <span>Speed MPH</span>
                    <span>Incline %</span>
                    <span>Minutes</span>
                    <span>Done</span>
                  </div>
                ) : inputMode === 'run_walk' ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Set</span>
                    <span>Speed MPH</span>
                    <span>Minutes</span>
                    <span>Done</span>
                  </div>
                ) : inputMode === 'bike' || inputMode === 'rower' ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Set</span>
                    <span>Watts</span>
                    <span>Minutes</span>
                    <span>Done</span>
                  </div>
                ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Set</span>
                    <span>Level</span>
                    <span>Minutes</span>
                    <span>Done</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Set</span>
                    <span>Weight ({getWeightUnitLabel(unitSystem)})</span>
                    <span>{isCardioExercise(exercise.exercise) ? 'Minutes' : isUnilateralExercise(exercise.exercise) ? 'Reps/Side' : 'Reps'}</span>
                    <span>Done</span>
                  </div>
                )}
                {exercise.sets.map((set, setIndex) => (
                  inputMode === 'treadmill' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center rounded-xl border px-3 py-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{set.set_number}</span>
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_speed_mph)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_speed_mph', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={set.completed}
                        placeholder="Speed MPH"
                      />
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_incline_pct)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_incline_pct', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={set.completed}
                        placeholder="Incline %"
                      />
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_reps)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={set.completed}
                        placeholder="Minutes"
                      />
                      <button type="button" onClick={() => toggleSet(exerciseIndex, setIndex)}>
                        {set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : inputMode === 'run_walk' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center rounded-xl border px-3 py-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{set.set_number}</span>
                      <Input type="number" value={formatNumericInput(set.actual_speed_mph)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_speed_mph', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Speed MPH" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Minutes" />
                      <button type="button" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : inputMode === 'bike' || inputMode === 'rower' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center rounded-xl border px-3 py-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{set.set_number}</span>
                      <Input type="number" value={formatNumericInput(set.actual_watts)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_watts', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Watts" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Minutes" />
                      <button type="button" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center rounded-xl border px-3 py-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{set.set_number}</span>
                      <Input type="number" value={formatNumericInput(set.actual_machine_level)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_machine_level', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Level" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={set.completed} placeholder="Minutes" />
                      <button type="button" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center rounded-xl border px-3 py-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{set.set_number}</span>
                      <Input
                        type="number"
                        value={formatWorkoutWeightInput(set.actual_weight, unitSystem)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_weight', e.target.value === '' ? undefined : parseWorkoutWeightInput(e.target.value, unitSystem))}
                        disabled={set.completed}
                        placeholder={isCardioExercise(exercise.exercise)
                          ? `Incline / load (${getWeightUnitLabel(unitSystem)})`
                          : isAssistedPullExercise(exercise.exercise)
                            ? `Assistance (${getWeightUnitLabel(unitSystem)})`
                            : `Weight (${getWeightUnitLabel(unitSystem)})`}
                      />
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_reps)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={set.completed}
                        placeholder={isCardioExercise(exercise.exercise) ? 'Minutes' : isUnilateralExercise(exercise.exercise) ? 'Reps/side' : 'Reps'}
                      />
                      <button type="button" onClick={() => toggleSet(exerciseIndex, setIndex)}>
                        {set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                ))}
              </div>

              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => addSetToExercise(exerciseIndex)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add set
              </Button>
            </div>
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1 min-w-[80px]" onClick={onPause}>Pause</Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => handleCompleteWorkout({ saveAsTemplate: true })}
            disabled={isCompleting}
          >
            {isCompleting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving…</> : <><Copy className="h-4 w-4" /> Complete & Save Routine</>}
          </Button>
          <Button
            variant="brand"
            className="flex-1 gap-2"
            onClick={() => handleCompleteWorkout()}
            disabled={isCompleting}
          >
            {isCompleting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving…</> : <><Trophy className="h-4 w-4" /> Complete Workout</>}
          </Button>
        </div>
      </div>
      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </DialogContent>
  )
}

interface YouTubeVideo {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  viewCount: string
  durationSec: number
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
}

function ExercisePreviewDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!exercise) { setVideos([]); setActiveId(null); return }
    setLoading(true)
    setActiveId(null)
    fetch(`/api/youtube?q=${encodeURIComponent(exercise.name)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: YouTubeVideo[]) => { setVideos(data); if (data.length > 0) setActiveId(data[0].id) })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [exercise])

  if (!exercise) return null

  return (
    <Dialog open={!!exercise} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{exercise.name}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && activeId && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                key={activeId}
                src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>

            {videos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveId(v.id)}
                    className={`flex-shrink-0 w-28 rounded-lg overflow-hidden border-2 text-left transition-colors ${activeId === v.id ? 'border-primary' : 'border-transparent hover:border-border'}`}
                  >
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full aspect-video object-cover" />
                    <div className="px-1.5 py-1">
                      <p className="text-[10px] text-muted-foreground truncate">{v.viewCount}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDuration(v.durationSec)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No short videos found.</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function WorkoutsPage() {
  const searchParams = useSearchParams()
  const {
    workoutLogs,
    logWorkout,
    updateWorkoutLog,
    removeWorkoutLog,
    user,
    isDemoMode,
    customWorkouts,
    addCustomWorkout,
    updateCustomWorkout,
    removeCustomWorkout,
  } = useAppStore()

  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
  const [tab, setTab] = useState<'log' | 'saved'>('log')
  const [runningWorkout, setRunningWorkout] = useState<Workout | null>(null)
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<PersistedActiveWorkoutSession | null>(null)
  const [didAutoResumeFromQuery, setDidAutoResumeFromQuery] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [editingLoggedWorkoutId, setEditingLoggedWorkoutId] = useState<string | null>(null)
  const [remoteCustomWorkouts, setRemoteCustomWorkouts] = useState<Workout[]>([])
  const [savedWorkoutsLoading, setSavedWorkoutsLoading] = useState(false)

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [premadeSearch, setPremadeSearch] = useState('')
  const [premadeSplit, setPremadeSplit] = useState<WorkoutSplit | 'all'>('all')
  const [premadeDifficulty, setPremadeDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [premadeMuscle, setPremadeMuscle] = useState<MuscleGroup | 'all'>('all')
  const [premadeFilterOpen, setPremadeFilterOpen] = useState(false)

  const [savedWorkoutSearch, setSavedWorkoutSearch] = useState('')
  const [savedWorkoutMuscle, setSavedWorkoutMuscle] = useState<MuscleGroup | 'all'>('all')
  const [savedWorkoutSplit, setSavedWorkoutSplit] = useState<WorkoutSplit | 'all'>('all')
  const [savedWorkoutFilterOpen, setSavedWorkoutFilterOpen] = useState(false)

  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [exerciseEquipmentFilter, setExerciseEquipmentFilter] = useState<string>('all')
  const [exerciseFilterOpen, setExerciseFilterOpen] = useState(false)

  const [manualSearch, setManualSearch] = useState('')
  const [manualAction, setManualAction] = useState<'log' | 'save'>('log')
  const [manualWorkoutName, setManualWorkoutName] = useState('')
  const [manualExercises, setManualExercises] = useState<EditableWorkoutExercise[]>([])
  const [pendingExercise, setPendingExercise] = useState<EditableWorkoutExercise | null>(null)
  const [manualSuggestionIndex, setManualSuggestionIndex] = useState(0)
  const unitSystem = user?.unit_system || 'imperial'
  const weightUnitLabel = getWeightUnitLabel(unitSystem)
  const accountCustomWorkouts = useMemo(() => {
    if (isDemoMode) return customWorkouts

    const merged = [...remoteCustomWorkouts, ...customWorkouts]
    const seen = new Set<string>()
    return merged.filter((workout) => {
      if (seen.has(workout.id)) return false
      seen.add(workout.id)
      return true
    })
  }, [isDemoMode, remoteCustomWorkouts, customWorkouts])
  const shouldResumeFromQuery = searchParams.get('resume') === '1'

  const workoutLibrary = useMemo(() => [...accountCustomWorkouts, ...WORKOUTS.map((workout) => ({ ...workout, source: 'premade' as const }))], [accountCustomWorkouts])

  const filteredPremadeWorkouts = useMemo(() => {
    return WORKOUTS.filter((w) => {
      if (premadeSplit !== 'all' && w.split_type !== premadeSplit) return false
      if (premadeDifficulty !== 'all' && w.difficulty !== premadeDifficulty) return false
      if (premadeMuscle !== 'all' && !w.muscle_groups.includes(premadeMuscle)) return false
      if (premadeSearch.trim()) {
        const q = premadeSearch.toLowerCase()
        if (!w.name.toLowerCase().includes(q) && !w.description.toLowerCase().includes(q) && !w.day_label.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [premadeSearch, premadeSplit, premadeDifficulty, premadeMuscle])

  const filteredSavedWorkouts = useMemo(() => {
    return accountCustomWorkouts.filter((w) => {
      if (savedWorkoutSplit !== 'all' && w.split_type !== savedWorkoutSplit) return false
      if (savedWorkoutMuscle !== 'all' && !w.muscle_groups.includes(savedWorkoutMuscle)) return false
      if (savedWorkoutSearch.trim()) {
        const q = savedWorkoutSearch.toLowerCase()
        if (!w.name.toLowerCase().includes(q) && !w.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [accountCustomWorkouts, savedWorkoutSearch, savedWorkoutSplit, savedWorkoutMuscle])

  const totalCaloriesBurned = workoutLogs.reduce((sum, log) => sum + (log.calories_burned_kcal || 0), 0)
  const todayLoggedWorkouts = workoutLogs.filter((log) => log.date === getTodayISO())

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const rawSession = window.localStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY)
      if (!rawSession) return
      const parsed = JSON.parse(rawSession) as PersistedActiveWorkoutSession
      if (!parsed?.workout || !Array.isArray(parsed.exercises)) return
      setActiveWorkoutSession(parsed)
    } catch {
      window.localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!activeWorkoutSession) {
      window.localStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_WORKOUT_SESSION_KEY, JSON.stringify(activeWorkoutSession))
  }, [activeWorkoutSession])

  useEffect(() => {
    if (!shouldResumeFromQuery || didAutoResumeFromQuery || runningWorkout) return
    if (!activeWorkoutSession) return

    setRunningWorkout(activeWorkoutSession.workout)
    setDidAutoResumeFromQuery(true)
  }, [activeWorkoutSession, didAutoResumeFromQuery, runningWorkout, shouldResumeFromQuery])

  const startWorkout = (workout: Workout) => {
    const session: PersistedActiveWorkoutSession = {
      workout,
      exercises: createActiveExercisesFromWorkout(workout),
      startedAt: new Date().toISOString(),
    }

    setActiveWorkoutSession(session)
    setRunningWorkout(workout)
  }

  const pauseRunningWorkout = () => {
    if (runningWorkout) {
      toast.success('Workout paused. You can continue anytime.')
    }
    setRunningWorkout(null)
  }

  const resumeWorkout = () => {
    if (!activeWorkoutSession) return
    setRunningWorkout(activeWorkoutSession.workout)
  }

  const discardActiveWorkoutSession = () => {
    setRunningWorkout(null)
    setActiveWorkoutSession(null)
    toast.success('Paused workout cleared.')
  }

  const handleActiveSessionExercisesChange = useCallback((exercises: ActiveExercise[]) => {
    setActiveWorkoutSession((current) => {
      if (!current || !runningWorkout || current.workout.id !== runningWorkout.id) return current
      return { ...current, exercises }
    })
  }, [runningWorkout])

  useEffect(() => {
    if (!user || isDemoMode) {
      setRemoteCustomWorkouts([])
      return
    }

    let active = true
    setSavedWorkoutsLoading(true)

    fetchUserWorkoutTemplates(user.id).then((response) => {
      if (!active) return

      if (!response.success || !response.workouts) {
        toast.error(response.error || 'Failed to load your saved workouts.')
        setSavedWorkoutsLoading(false)
        return
      }

      setRemoteCustomWorkouts(response.workouts)
      setSavedWorkoutsLoading(false)
    })

    return () => {
      active = false
    }
  }, [user, isDemoMode])

  const manualSuggestions = useMemo(() => {
    const query = manualSearch.trim()
    const hasFilter = exerciseMuscleFilter !== 'all' || exerciseEquipmentFilter !== 'all'
    if (query.length < 1 && !hasFilter) return []

    return [...EXERCISE_LIBRARY]
      .filter((item) => {
        if (exerciseMuscleFilter !== 'all' && !item.muscle_groups.includes(exerciseMuscleFilter)) return false
        if (exerciseEquipmentFilter !== 'all' && !item.equipment.toLowerCase().includes(exerciseEquipmentFilter.toLowerCase())) return false
        if (query.length < 1) return true
        const values = [item.name, item.equipment, ...(item.aliases || []), ...item.muscle_groups]
        return values.some((value) => normalizeExerciseText(value).includes(normalizeExerciseText(query)))
      })
      .sort((left, right) => query ? scoreExerciseSuggestion(right, query) - scoreExerciseSuggestion(left, query) : left.name.localeCompare(right.name))
      .slice(0, hasFilter && !query ? 40 : 10)
  }, [manualSearch, exerciseMuscleFilter, exerciseEquipmentFilter])

  const groupedManualSuggestions = useMemo(() => {
    return manualSuggestions.reduce<Record<string, ExerciseLibraryItem[]>>((acc, item) => {
      const category = getExerciseCategory(item)
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {})
  }, [manualSuggestions])

  useEffect(() => {
    setManualSuggestionIndex(0)
  }, [manualSearch, exerciseMuscleFilter, exerciseEquipmentFilter])

  const [apiManualSuggestions, setApiManualSuggestions] = useState<ExerciseLibraryItem[]>([])

  useEffect(() => {
    const query = manualSearch.trim()
    if (query.length < 2) { setApiManualSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/exercises?name=${encodeURIComponent(query)}`)
        if (res.ok) {
          const all: ExerciseLibraryItem[] = await res.json()
          const localNames = new Set(EXERCISE_LIBRARY.map((i) => i.name.toLowerCase()))
          setApiManualSuggestions(all.filter((i) => !localNames.has(i.name.toLowerCase())))
        }
      } catch { setApiManualSuggestions([]) }
    }, 400)
    return () => clearTimeout(timer)
  }, [manualSearch])

  const manualSummary = useMemo(
    () =>
      summarizeExercises(
        manualExercises.map((exercise) => ({
          exercise: exercise.exercise,
          sets: exercise.sets,
        })),
        getMetProfile(user)
      ),
    [manualExercises, user]
  )

  const addManualExerciseFromLibrary = (item: ExerciseLibraryItem) => {
    setPendingExercise(createWorkoutExerciseFromLibrary(item))
    setManualSearch('')
  }

  const addCustomManualExercise = () => {
    const trimmed = manualSearch.trim()
    if (!trimmed) {
      toast.error('Type an exercise first.')
      return
    }
    setPendingExercise(createCustomExercise(trimmed))
    setManualSearch('')
  }

  const updatePendingSetField = (setIndex: number, field: keyof WorkoutSet, value: number) => {
    setPendingExercise((current) => {
      if (!current) return current
      return {
        ...current,
        sets: current.sets.map((set, index) => index === setIndex ? { ...set, [field]: value } : set),
      }
    })
  }

  const addSetToPendingExercise = () => {
    setPendingExercise((current) => {
      if (!current) return current
      const lastSet = current.sets[current.sets.length - 1]
      return {
        ...current,
        sets: [
          ...current.sets,
          {
            set_number: current.sets.length + 1,
            reps: lastSet?.reps ?? 10,
            weight_kg: lastSet?.weight_kg ?? 0,
            speed_mph: lastSet?.speed_mph,
            incline_pct: lastSet?.incline_pct,
            machine_level: lastSet?.machine_level,
            resistance_level: lastSet?.resistance_level,
            watts: lastSet?.watts,
            cadence_rpm: lastSet?.cadence_rpm,
            rest_seconds: lastSet?.rest_seconds ?? 60,
          },
        ],
      }
    })
  }

  const removeSetFromPendingExercise = (setIndex: number) => {
    setPendingExercise((current) => {
      if (!current || current.sets.length <= 1) return current
      return {
        ...current,
        sets: current.sets.filter((_, index) => index !== setIndex).map((set, index) => ({ ...set, set_number: index + 1 })),
      }
    })
  }

  const confirmPendingExercise = () => {
    if (!pendingExercise) return
    setManualExercises((current) => [...current, pendingExercise])
    setPendingExercise(null)
    toast.success(`${pendingExercise.exercise.name} added to today's workout.`)
  }

  const handleManualSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (manualSuggestions.length === 0) {
      if (event.key === 'Enter' && manualSearch.trim().length > 0) {
        event.preventDefault()
        addCustomManualExercise()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setManualSuggestionIndex((current) => (current + 1) % manualSuggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setManualSuggestionIndex((current) => (current - 1 + manualSuggestions.length) % manualSuggestions.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selectedSuggestion = manualSuggestions[manualSuggestionIndex]
      if (selectedSuggestion) {
        addManualExerciseFromLibrary(selectedSuggestion)
      } else {
        addCustomManualExercise()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setManualSearch('')
      setManualSuggestionIndex(0)
    }
  }

  const updateManualSetField = (instanceId: string, setIndex: number, field: keyof WorkoutSet, value: number) => {
    setManualExercises((current) =>
      current.map((exercise) =>
        exercise.instanceId === instanceId
          ? {
              ...exercise,
              sets: exercise.sets.map((set, index) => index === setIndex ? { ...set, [field]: value } : set),
            }
          : exercise
      )
    )
  }

  const addSetToManualExercise = (instanceId: string) => {
    setManualExercises((current) =>
      current.map((exercise) => {
        if (exercise.instanceId !== instanceId) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: exercise.sets.length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: lastSet?.weight_kg ?? 0,
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              machine_level: lastSet?.machine_level,
              resistance_level: lastSet?.resistance_level,
              watts: lastSet?.watts,
              cadence_rpm: lastSet?.cadence_rpm,
              rest_seconds: lastSet?.rest_seconds ?? 60,
            },
          ],
        }
      })
    )
  }

  const removeSetFromManualExercise = (instanceId: string, setIndex: number) => {
    setManualExercises((current) =>
      current.map((exercise) => {
        if (exercise.instanceId !== instanceId) return exercise
        if (exercise.sets.length <= 1) return exercise
        return {
          ...exercise,
          sets: exercise.sets.filter((_, index) => index !== setIndex).map((set, index) => ({ ...set, set_number: index + 1 })),
        }
      })
    )
  }

  const buildWorkoutFromManual = () => {
    const normalizedExercises: WorkoutExercise[] = manualExercises.map((exercise) => ({
      exercise: exercise.exercise,
      sets: exercise.sets.map((set, index) => ({
        set_number: index + 1,
        reps: Math.max(1, Number(set.reps) || 1),
        weight_kg: Math.max(0, Number(set.weight_kg) || 0),
        speed_mph: set.speed_mph !== undefined ? Math.max(0, Number(set.speed_mph) || 0) : undefined,
        incline_pct: set.incline_pct !== undefined ? Math.max(0, Number(set.incline_pct) || 0) : undefined,
        machine_level: set.machine_level !== undefined ? Math.max(0, Number(set.machine_level) || 0) : undefined,
        resistance_level: set.resistance_level !== undefined ? Math.max(0, Number(set.resistance_level) || 0) : undefined,
        watts: set.watts !== undefined ? Math.max(0, Number(set.watts) || 0) : undefined,
        cadence_rpm: set.cadence_rpm !== undefined ? Math.max(0, Number(set.cadence_rpm) || 0) : undefined,
        rest_seconds: Math.max(0, Number(set.rest_seconds) || 0),
      })),
    }))

    const workoutName =
      manualAction === 'save'
        ? manualWorkoutName.trim()
        : normalizedExercises.length === 1
          ? normalizedExercises[0].exercise.name
          : 'Custom Logged Workout'
    const muscleGroups = Array.from(new Set(normalizedExercises.flatMap((exercise) => exercise.exercise.muscle_groups)))

    return {
      id: `manual-${Date.now()}`,
      name: workoutName,
      day_label: 'Logged Today',
      description: 'Workout manually logged from the workout page.',
      exercises: normalizedExercises,
      estimated_duration_min: manualSummary.durationMin,
      difficulty: 'intermediate' as Difficulty,
      split_type: user?.workout_split || 'ppl',
      muscle_groups: (muscleGroups.length > 0 ? muscleGroups : ['full_body']) as MuscleGroup[],
      source: 'custom' as const,
      updated_at: new Date().toISOString(),
    }
  }

  const handleLogManualWorkout = () => {
    if (!user) return
    if (manualExercises.length === 0) {
      toast.error('Add at least one exercise first.')
      return
    }

    if (manualAction === 'save' && !manualWorkoutName.trim()) {
      toast.error('Name the workout before saving it.')
      return
    }

    const workout = buildWorkoutFromManual()

    const logPayload = {
      id: `wl-${Date.now()}`,
      user_id: user.id,
      workout_id: workout.id,
      workout,
      date: getTodayISO(),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_min: manualSummary.durationMin,
      calories_burned_kcal: manualSummary.caloriesBurned,
      total_volume_kg: manualSummary.totalVolumeKg,
      exercises: workout.exercises.map((exercise) => ({
        exercise_id: exercise.exercise.id,
        exercise_name: exercise.exercise.name,
        sets: exercise.sets.map((set) => ({
          set_number: set.set_number,
          target_reps: set.reps,
          actual_reps: set.reps,
          weight_kg: set.weight_kg || 0,
          speed_mph: set.speed_mph,
          incline_pct: set.incline_pct,
          machine_level: set.machine_level,
          resistance_level: set.resistance_level,
          watts: set.watts,
          cadence_rpm: set.cadence_rpm,
        })),
      })),
      rating: 4 as 4,
    }

    if (editingLoggedWorkoutId) {
      updateWorkoutLog(editingLoggedWorkoutId, logPayload)
    } else {
      logWorkout(logPayload)
    }

    const finalizeManualSave = async () => {
      if (manualAction !== 'save') {
        toast.success(`Workout ${editingLoggedWorkoutId ? 'updated' : 'logged'}. Estimated burn: ${manualSummary.caloriesBurned} kcal.`)
        return
      }

      const savedWorkout = { ...workout, id: `cw-${Date.now()}` }

      if (isDemoMode) {
        addCustomWorkout(savedWorkout)
      } else {
        const response = await createUserWorkoutTemplate(user.id, savedWorkout)
        if (!response.success || !response.workout) {
          toast.error(response.error || 'Workout was logged, but saving the template failed.')
          return
        }
        setRemoteCustomWorkouts((current) => [response.workout as Workout, ...current])
      }

      toast.success(`Workout saved and ${editingLoggedWorkoutId ? 'updated' : 'logged'}. Estimated burn: ${manualSummary.caloriesBurned} kcal.`)
      setTab('saved')
    }

    finalizeManualSave().finally(() => {
      setManualSearch('')
      setManualAction('log')
      setManualWorkoutName('')
      setManualExercises([])
      setEditingLoggedWorkoutId(null)
    })
  }

  const loadLoggedWorkoutForEdit = (logId: string) => {
    const target = workoutLogs.find((log) => log.id === logId)
    if (!target) return

    setEditingLoggedWorkoutId(logId)
    setManualAction('log')
    setManualWorkoutName(target.workout.name)
    setManualExercises(
      target.workout.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        instanceId: `logged-${exercise.exercise.id}-${exerciseIndex}-${Date.now()}`,
      }))
    )
    setPendingExercise(null)
    setManualSearch('')
    setTab('log')
    toast.success('Loaded workout into logger for editing.')
  }

  const handleSaveWorkout = async (workout: Workout) => {
    if (!user) return

    if (isDemoMode) {
      if (editingWorkout?.source === 'custom' && accountCustomWorkouts.some((item) => item.id === workout.id)) {
        updateCustomWorkout(workout.id, workout)
        toast.success('Saved workout updated.')
        return
      }

      addCustomWorkout({
        ...workout,
        id: editingWorkout?.source === 'premade' ? `cw-${Date.now()}` : workout.id,
        source: 'custom',
        updated_at: new Date().toISOString(),
      })
      toast.success(editingWorkout?.source === 'premade' ? 'Premade workout copied to your saved workouts.' : 'Workout saved.')
      return
    }

    if (editingWorkout?.source === 'custom' && accountCustomWorkouts.some((item) => item.id === workout.id)) {
      const response = await updateUserWorkoutTemplate(user.id, workout.id, workout)
      if (!response.success || !response.workout) {
        toast.error(response.error || 'Failed to update saved workout.')
        return
      }
      setRemoteCustomWorkouts((current) => current.map((item) => item.id === workout.id ? response.workout as Workout : item))
      toast.success('Saved workout updated.')
      return
    }

    const response = await createUserWorkoutTemplate(user.id, {
      ...workout,
      id: editingWorkout?.source === 'premade' ? `cw-${Date.now()}` : workout.id,
      source: 'custom',
      updated_at: new Date().toISOString(),
    })
    if (!response.success || !response.workout) {
      toast.error(response.error || 'Failed to save workout.')
      return
    }
    setRemoteCustomWorkouts((current) => [response.workout as Workout, ...current])
    toast.success(editingWorkout?.source === 'premade' ? 'Premade workout copied to your saved workouts.' : 'Workout saved.')
  }

  const handleDeleteWorkout = async (workout: Workout) => {
    if (workout.source !== 'custom') return

    if (isDemoMode) {
      removeCustomWorkout(workout.id)
      toast.success('Saved workout removed.')
      return
    }

    if (!user) return

    const response = await deleteUserWorkoutTemplate(user.id, workout.id)
    if (!response.success) {
      toast.error(response.error || 'Failed to remove saved workout.')
      return
    }

    setRemoteCustomWorkouts((current) => current.filter((item) => item.id !== workout.id))
    toast.success('Saved workout removed.')
  }

  if (!user) return null

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-3xl font-bold tracking-tight">Workouts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Log what you did today, then save it as a workout if you want to reuse it later.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => { setEditingWorkout(null); setBuilderOpen(true) }}>
            <Sparkles className="h-4 w-4" />
            Build Workout
          </Button>
        </div>

          {activeWorkoutSession && !runningWorkout && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Workout paused</p>
                <p className="text-xs text-emerald-200/80">{activeWorkoutSession.workout.name} is ready to continue.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={discardActiveWorkoutSession}>Discard</Button>
                <Button type="button" size="sm" variant="brand" onClick={resumeWorkout}>Continue Workout</Button>
              </div>
            </div>
          )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
            <p className="font-data text-xl sm:text-2xl font-semibold">{todayLoggedWorkouts.reduce((sum, log) => sum + (log.calories_burned_kcal || 0), 0)}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Today's kcal burned</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
            <p className="font-data text-xl sm:text-2xl font-semibold">{todayLoggedWorkouts.length}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Workouts today</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
            <p className="font-data text-xl sm:text-2xl font-semibold">{accountCustomWorkouts.length}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Saved workouts</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
            <p className="font-data text-xl sm:text-2xl font-semibold">{totalCaloriesBurned}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total kcal logged</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'log' | 'saved')}>
        <div className="border-b border-border/60">
          <TabsList className="inline-flex h-auto items-center gap-0 bg-transparent p-0">
            <TabsTrigger value="log" className="relative rounded-none border-0 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
              Log Workout
            </TabsTrigger>
            <TabsTrigger value="saved" className="relative rounded-none border-0 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
              Saved Workouts
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="log" className="mt-6 space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Search an exercise</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Exercise search</Label>

                  {/* Filter dropdown + search row */}
                  <div className="flex gap-2">
                    {/* Filters button */}
                    <div className="relative">
                      <button
                        onClick={() => setExerciseFilterOpen((o) => !o)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${exerciseMuscleFilter !== 'all' || exerciseEquipmentFilter !== 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filters
                        {(exerciseMuscleFilter !== 'all' || exerciseEquipmentFilter !== 'all') && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {(exerciseMuscleFilter !== 'all' ? 1 : 0) + (exerciseEquipmentFilter !== 'all' ? 1 : 0)}
                          </span>
                        )}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${exerciseFilterOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {exerciseFilterOpen && (
                        <>
                          {/* backdrop */}
                          <div className="fixed inset-0 z-10" onClick={() => setExerciseFilterOpen(false)} />
                          {/* panel */}
                          <div className="absolute left-0 top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 shadow-lg">
                            <div className="space-y-4">
                              <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Muscle group</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {([['all', 'All'], ['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'], ['calves', 'Calves'], ['core', 'Core'], ['full_body', 'Full body'], ['cardio', 'Cardio']] as const).map(([val, label]) => (
                                    <button
                                      key={val}
                                      onClick={() => setExerciseMuscleFilter(val)}
                                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${exerciseMuscleFilter === val ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Equipment</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {([['all', 'Any'], ['barbell', 'Barbell'], ['dumbbell', 'Dumbbell'], ['bodyweight', 'Bodyweight'], ['cable', 'Cable'], ['machine', 'Machine'], ['kettlebell', 'Kettlebell'], ['resistance band', 'Bands'], ['treadmill', 'Treadmill']] as const).map(([val, label]) => (
                                    <button
                                      key={val}
                                      onClick={() => setExerciseEquipmentFilter(val)}
                                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${exerciseEquipmentFilter === val ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {(exerciseMuscleFilter !== 'all' || exerciseEquipmentFilter !== 'all') && (
                                <button
                                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                  onClick={() => { setExerciseMuscleFilter('all'); setExerciseEquipmentFilter('all') }}
                                >
                                  Clear all filters
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      onKeyDown={handleManualSearchKeyDown}
                      placeholder="Search all exercises…"
                      className="pl-9"
                    />
                    {manualSearch && (
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setManualSearch('')}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  </div>{/* end flex gap-2 */}
                  {manualSearch.trim().length === 0 && exerciseMuscleFilter === 'all' && exerciseEquipmentFilter === 'all' && (
                    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
                      {workoutLogs.length > 0 ? (
                        <>
                          <div className="bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Recent Workouts</p>
                            <p className="text-[10px] text-muted-foreground">{workoutLogs.length} logged</p>
                          </div>
                          {workoutLogs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((log) => {
                            const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0)
                            const isLogToday = log.date === getTodayISO()
                            const isExpanded = expandedLogId === log.id
                            return (
                              <div key={log.id} className="border-b border-border/30 last:border-b-0">
                                {/* Header row */}
                                <div className="flex items-center gap-2 px-4 py-3">
                                  {/* Left: info — clickable to expand */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                  >
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate">{log.workout.name}</p>
                                      {isLogToday && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-wide">Today</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {log.exercises.length} exercise{log.exercises.length !== 1 ? 's' : ''} · {totalSets} sets{log.duration_min ? ` · ${log.duration_min} min` : ''}
                                    </p>
                                  </button>

                                  {/* Right: Start Again + chevron */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="brand"
                                      className="gap-1.5 h-7 px-3 text-xs"
                                      onClick={() => startWorkout(log.workout)}
                                    >
                                      <Play className="w-3 h-3" />
                                      Start Again
                                    </Button>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                      className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3 bg-muted/5">
                                        {/* Stats row */}
                                        <div className="grid grid-cols-2 gap-2">
                                          {[
                                            { label: 'Duration', value: log.duration_min ? `${log.duration_min}m` : '—' },
                                            { label: 'Calories', value: log.calories_burned_kcal ? `${log.calories_burned_kcal} kcal` : '—' },
                                          ].map(({ label, value }) => (
                                            <div key={label} className="rounded-lg bg-muted/30 border border-border/40 px-2.5 py-2 text-center">
                                              <p className="font-data text-xs font-semibold tabular-nums">{value}</p>
                                              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Exercises */}
                                        <div className="space-y-2">
                                          {log.exercises.map((exercise, exIdx) => {
                                            return (
                                              <div key={`${log.id}-${exercise.exercise_id}-${exIdx}`} className="rounded-xl border border-border/50 overflow-hidden">
                                                {/* Exercise name bar */}
                                                <div className="px-3 py-2 bg-muted/20 border-b border-border/40">
                                                  <p className="text-xs font-semibold">{exercise.exercise_name}</p>
                                                </div>
                                                {/* Sets table */}
                                                <div className="px-3 py-2">
                                                  <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                                                    <span>Set</span>
                                                    <span className="text-center">Reps</span>
                                                    <span className="text-right">Weight</span>
                                                  </div>
                                                  <div className="space-y-1">
                                                    {exercise.sets.map((set) => {
                                                      const displayWeight = (set.weight_kg || 0) > 0
                                                        ? unitSystem === 'imperial'
                                                          ? `${Math.round((set.weight_kg || 0) * 2.205)}lb`
                                                          : `${set.weight_kg}kg`
                                                        : null
                                                      return (
                                                        <div
                                                          key={set.set_number}
                                                          className="grid grid-cols-3 items-center text-xs rounded-lg px-2 py-1.5 bg-background/60"
                                                        >
                                                          <span className="text-muted-foreground font-medium">{set.set_number}</span>
                                                          <span className="text-center font-data font-semibold tabular-nums">
                                                            {set.actual_reps ?? set.target_reps}
                                                          </span>
                                                          <span className="text-right font-data tabular-nums text-muted-foreground">
                                                            {displayWeight ?? <span className="opacity-40">BW</span>}
                                                          </span>
                                                        </div>
                                                      )
                                                    })}
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5"
                                            onClick={() => loadLoggedWorkoutForEdit(log.id)}
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                            Edit Log
                                          </Button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </>
                      ) : (
                        <>
                          <div className="bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Suggested Workouts</p>
                            <p className="text-[10px] text-muted-foreground">No history yet</p>
                          </div>
                          {WORKOUTS.slice(0, 5).map((w) => (
                            <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/10 transition-colors">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{w.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''} · {w.estimated_duration_min} min · <span className="capitalize">{w.difficulty}</span>
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                                {w.muscle_groups.slice(0, 2).map((g) => (
                                  <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{g.replace('_', ' ')}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  {(manualSearch.trim().length >= 1 || exerciseMuscleFilter !== 'all' || exerciseEquipmentFilter !== 'all') && (
                    <div className="max-h-80 overflow-y-auto rounded-2xl border border-border/60 bg-background">
                      {manualSuggestions.length > 0 ? (
                        <>
                          {Object.entries(groupedManualSuggestions).map(([category, items]) => (
                            <div key={category} className="border-b border-border/40 last:border-b-0">
                              <div className="bg-muted/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                {category}
                              </div>
                              {items.map((item) => {
                                const globalIndex = manualSuggestions.findIndex((suggestion) => suggestion.id === item.id)
                                const isActive = globalIndex === manualSuggestionIndex

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => addManualExerciseFromLibrary(item)}
                                    onMouseEnter={() => setManualSuggestionIndex(globalIndex)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-muted/30' : 'hover:bg-muted/20'}`}
                                  >
  
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{item.name}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{item.equipment}</p>
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {item.muscle_groups.map((group) => (
                                          <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                            {group.replace('_', ' ')}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} x {item.default_reps}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                          {apiManualSuggestions.length > 0 && (
                            <div className="border-t border-border/40">
                              <div className="bg-muted/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">More exercises</div>
                              {apiManualSuggestions.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => addManualExerciseFromLibrary(item)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                                >

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{item.equipment}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {item.muscle_groups.map((group) => (
                                        <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                          {group.replace('_', ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} x {item.default_reps}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : apiManualSuggestions.length > 0 ? (
                        <div>
                          <div className="bg-muted/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Results</div>
                          {apiManualSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => addManualExerciseFromLibrary(item)}
                              className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/20"
                            >
                              {item.gif_url && <img src={item.gif_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.equipment}</p>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {item.muscle_groups.map((group) => (
                                    <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                      {group.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <span className="flex-shrink-0 text-[10px] text-muted-foreground">{item.default_sets} x {item.default_reps}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-muted-foreground">No exercises match your filters</p>
                          {manualSearch.trim() && (
                            <Button variant="outline" size="sm" className="mt-3" onClick={addCustomManualExercise}>
                              Add &quot;{manualSearch}&quot; as custom exercise
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {pendingExercise && (
                  <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Adjust before adding</p>
                        <p className="mt-1 text-sm">{pendingExercise.exercise.name}</p>
                        <p className="text-xs text-muted-foreground">{pendingExercise.exercise.equipment}</p>
                        <button
                          type="button"
                          onClick={() => setPreviewExercise(pendingExercise.exercise)}
                          className="mt-1 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                        >
                          <PlayCircle className="h-3 w-3" />
                          How to do this
                        </button>
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => setPendingExercise(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {(() => {
                      const pendingMode = getExerciseInputMode(pendingExercise.exercise)
                      return (
                      <div className="space-y-2">
                      {pendingMode === 'interval' ? (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Round</span>
                          <span>Intervals</span>
                          <span>Work (sec)</span>
                          <span>Rest (sec)</span>
                          <span />
                        </div>
                      ) : pendingMode === 'treadmill' ? (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Set</span>
                          <span>Minutes</span>
                          <span>Speed MPH</span>
                          <span>Incline %</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      ) : pendingMode === 'run_walk' ? (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Set</span>
                          <span>Minutes</span>
                          <span>Speed MPH</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      ) : pendingMode === 'bike' || pendingMode === 'rower' ? (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Set</span>
                          <span>Minutes</span>
                          <span>Watts</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      ) : pendingMode === 'level_cardio' || pendingMode === 'basic_cardio' ? (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Set</span>
                          <span>Minutes</span>
                          <span>Level</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      ) : (
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>Set</span>
                          <span>{isUnilateralExercise(pendingExercise.exercise) ? 'Reps/Side' : 'Reps'}</span>
                          <span>{isAssistedPullExercise(pendingExercise.exercise) ? `Assistance (${weightUnitLabel})` : `Weight (${weightUnitLabel})`}</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      )}
                      {pendingExercise.sets.map((set, setIndex) => (
                        pendingMode === 'interval' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Rnd {set.set_number}</div>
                            <Input type="number" min={1} value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 1 : Math.max(1, Number(e.target.value)))} placeholder="# intervals" />
                            <Input type="number" min={1} value={formatNumericInput(set.interval_duration_sec)} onChange={(e) => updatePendingSetField(setIndex, 'interval_duration_sec', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Work sec" />
                            <Input type="number" min={0} value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'treadmill' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updatePendingSetField(setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                            <Input type="number" value={formatNumericInput(set.incline_pct)} onChange={(e) => updatePendingSetField(setIndex, 'incline_pct', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Incline %" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'run_walk' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updatePendingSetField(setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'bike' || pendingMode === 'rower' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updatePendingSetField(setIndex, 'watts', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Watts" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'level_cardio' || pendingMode === 'basic_cardio' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updatePendingSetField(setIndex, 'machine_level', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Level" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">Set {set.set_number}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder={isUnilateralExercise(pendingExercise.exercise) ? 'Reps/side' : 'Reps'} />
                            <Input type="number" value={formatWorkoutWeightInput(set.weight_kg, unitSystem)} onChange={(e) => updatePendingSetField(setIndex, 'weight_kg', parseWorkoutWeightInput(e.target.value, unitSystem))} placeholder={isAssistedPullExercise(pendingExercise.exercise) ? `Assistance (${weightUnitLabel})` : `Weight (${weightUnitLabel})`} />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        )
                      ))}
                    </div>
                  )
                })()}

                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addSetToPendingExercise}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {getExerciseInputMode(pendingExercise.exercise) === 'interval' ? 'Add round' : 'Add set'}
                      </Button>
                      <Button type="button" size="sm" variant="brand" onClick={confirmPendingExercise}>
                        Add exercise
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {['bench', 'run', 'walk', 'deadlift', 'squat', 'curl'].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setManualSearch(example)}
                      className="rounded-full border border-border/60 bg-muted/10 px-3 py-1.5 text-xs capitalize text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                <p className="text-sm font-semibold">Today&apos;s workout summary</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
                    <p className="font-data text-lg font-semibold">{manualSummary.caloriesBurned}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Estimated calories</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
                    <p className="font-data text-lg font-semibold">{manualSummary.durationMin}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Estimated minutes</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualAction('log')}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${manualAction === 'log' ? 'border-foreground bg-foreground text-background' : 'border-border/60 bg-background text-foreground'}`}
                  >
                    Log Workout
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualAction('save')}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${manualAction === 'save' ? 'border-foreground bg-foreground text-background' : 'border-border/60 bg-background text-foreground'}`}
                  >
                    Save Workout
                  </button>
                </div>

                {manualAction === 'save' && (
                  <div className="mt-4 space-y-1.5">
                    <Label>Saved workout name</Label>
                    <Input value={manualWorkoutName} onChange={(e) => setManualWorkoutName(e.target.value)} placeholder="e.g. Upper body pump" />
                  </div>
                )}

              <Button variant="brand" className="mt-4 w-full" onClick={handleLogManualWorkout}>
                  {editingLoggedWorkoutId ? 'Update Logged Workout' : manualAction === 'save' ? 'Save Workout' : 'Log Workout'}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Exercises added</p>
                <p className="text-xs text-muted-foreground">Enter sets, reps, weight, and rest for everything you did.</p>
              </div>
              <Badge variant="outline" className="mt-0.5">{manualExercises.length} exercises</Badge>
            </div>

            {manualExercises.length > 0 ? (
              <div className="space-y-3">
                {manualExercises.map((exercise) => {
                  const exerciseSummary = summarizeExercises([{ exercise: exercise.exercise, sets: exercise.sets }], getMetProfile(user))
                  const cardioExercise = isCardioExercise(exercise.exercise)
                  const inputMode = getExerciseInputMode(exercise.exercise)

                  return (
                    <div key={exercise.instanceId} className="rounded-2xl border border-border/60 bg-card p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{exercise.exercise.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{exercise.exercise.equipment}</p>
                          <button
                            type="button"
                            onClick={() => setPreviewExercise(exercise.exercise)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                          >
                            <PlayCircle className="h-3 w-3" />
                            How to do this
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{exercise.exercise.difficulty}</Badge>
                          <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive" onClick={() => setManualExercises((current) => current.filter((item) => item.instanceId !== exercise.instanceId))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mb-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                          <p className="font-data text-sm font-semibold">{exerciseSummary.caloriesBurned}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. kcal</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                          <p className="font-data text-sm font-semibold">{exercise.sets.length}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sets</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                          <p className="font-data text-sm font-semibold">{exerciseSummary.durationMin}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. min</p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-border/50">
                        {inputMode === 'treadmill' ? (
                          <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Set</span>
                            <span>Minutes</span>
                            <span>Speed MPH</span>
                            <span>Incline %</span>
                            <span>Rest sec</span>
                            <span className="text-right">Action</span>
                          </div>
                        ) : inputMode === 'run_walk' ? (
                          <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Set</span>
                            <span>Minutes</span>
                            <span>Speed MPH</span>
                            <span>Rest sec</span>
                            <span className="text-right">Action</span>
                          </div>
                        ) : inputMode === 'bike' || inputMode === 'rower' ? (
                          <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Set</span>
                            <span>Minutes</span>
                            <span>Watts</span>
                            <span>Rest sec</span>
                            <span className="text-right">Action</span>
                          </div>
                        ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                          <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Set</span>
                            <span>Minutes</span>
                            <span>Level</span>
                            <span>Rest sec</span>
                            <span className="text-right">Action</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-5 gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Set</span>
                            <span>{cardioExercise ? 'Minutes' : 'Reps'}</span>
                            <span>{cardioExercise
                              ? `Incline / Load (${weightUnitLabel})`
                              : isAssistedPullExercise(exercise.exercise)
                                ? `Assistance (${weightUnitLabel})`
                                : `Weight (${weightUnitLabel})`}</span>
                            <span>Rest sec</span>
                            <span className="text-right">Action</span>
                          </div>
                        )}
                        {exercise.sets.map((set, setIndex) => (
                          inputMode === 'treadmill' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{set.set_number}</span>
                              <Input
                                type="number"
                                value={set.reps}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))}
                                className="h-8 text-xs"
                                placeholder="Minutes"
                              />
                              <Input
                                type="number"
                                value={formatNumericInput(set.speed_mph)}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'speed_mph', Number(e.target.value))}
                                className="h-8 text-xs"
                                placeholder="Speed MPH"
                              />
                              <Input
                                type="number"
                                value={formatNumericInput(set.incline_pct)}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'incline_pct', Number(e.target.value))}
                                className="h-8 text-xs"
                                placeholder="Incline %"
                              />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end">
                                <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : inputMode === 'run_walk' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{set.set_number}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'speed_mph', Number(e.target.value))} className="h-8 text-xs" placeholder="Speed MPH" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : inputMode === 'bike' || inputMode === 'rower' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{set.set_number}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'watts', Number(e.target.value))} className="h-8 text-xs" placeholder="Watts" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{set.set_number}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'machine_level', Number(e.target.value))} className="h-8 text-xs" placeholder="Level" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-5 gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{set.set_number}</span>
                              <Input
                                type="number"
                                value={set.reps}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))}
                                className="h-8 text-xs"
                                placeholder={cardioExercise ? 'Minutes' : 'Reps'}
                              />
                              <Input
                                type="number"
                                value={formatWorkoutWeightInput(set.weight_kg, unitSystem)}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'weight_kg', parseWorkoutWeightInput(e.target.value, unitSystem))}
                                className="h-8 text-xs"
                                placeholder={cardioExercise
                                  ? `Incline / resistance (${weightUnitLabel})`
                                  : isAssistedPullExercise(exercise.exercise)
                                    ? `Assistance (${weightUnitLabel})`
                                    : `Weight (${weightUnitLabel})`}
                              />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end">
                                <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        ))}
                      </div>

                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => addSetToManualExercise(exercise.instanceId)}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add set
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-14 text-center">
                <p className="text-sm font-medium text-muted-foreground">No exercises added yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Search for a movement above and add what you did today.</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Today&apos;s logged workouts</p>
                <p className="text-xs text-muted-foreground">Re-open a logged workout to tweak it, or remove it if entered by mistake.</p>
              </div>
              <Badge variant="outline" className="mt-0.5">{todayLoggedWorkouts.length} today</Badge>
            </div>

            {todayLoggedWorkouts.length > 0 ? (
              <div className="space-y-3">
                {todayLoggedWorkouts.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{log.workout.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.exercises.length} exercises · {log.duration_min || 0} min · {log.calories_burned_kcal || 0} kcal
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => loadLoggedWorkoutForEdit(log.id)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => removeWorkoutLog(log.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">No workouts logged yet today</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">Saved and premade workouts</p>
              <p className="mt-1 text-sm text-muted-foreground">Start a workout you already know, or edit it before you run it.</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => { setEditingWorkout(null); setBuilderOpen(true) }}>
              <Plus className="h-4 w-4" />
              Create Saved Workout
            </Button>
          </div>

          {accountCustomWorkouts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Your saved workouts</p>
                  <p className="text-xs text-muted-foreground">Built by you or saved from the Log Workout tab.</p>
                </div>
              </div>

              {/* Search + filter row */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search saved workouts…"
                      value={savedWorkoutSearch}
                      onChange={(e) => setSavedWorkoutSearch(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {savedWorkoutSearch && (
                      <button type="button" onClick={() => setSavedWorkoutSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSavedWorkoutFilterOpen(o => !o)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      savedWorkoutFilterOpen || savedWorkoutMuscle !== 'all' || savedWorkoutSplit !== 'all'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {(savedWorkoutMuscle !== 'all' || savedWorkoutSplit !== 'all') && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {(savedWorkoutMuscle !== 'all' ? 1 : 0) + (savedWorkoutSplit !== 'all' ? 1 : 0)}
                      </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${savedWorkoutFilterOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {savedWorkoutFilterOpen && (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Muscle group</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core', 'cardio', 'full_body'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setSavedWorkoutMuscle(m)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              savedWorkoutMuscle === m
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                          >
                            {m === 'all' ? 'All' : m === 'full_body' ? 'Full Body' : m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Split type</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', 'ppl', 'upper_lower', '3day_fullbody', '4day', '5day', '6day', 'cardio_focus'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setSavedWorkoutSplit(s)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              savedWorkoutSplit === s
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                          >
                            {s === 'all' ? 'All' : SPLIT_OPTIONS.find(o => o.value === s)?.label ?? s}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(savedWorkoutMuscle !== 'all' || savedWorkoutSplit !== 'all') && (
                      <button
                        onClick={() => { setSavedWorkoutMuscle('all'); setSavedWorkoutSplit('all') }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>

              {filteredSavedWorkouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No workouts match the current filters.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSavedWorkouts.map((workout) => (
                    <SavedWorkoutCard key={workout.id} workout={workout} onStart={startWorkout} onEdit={(item) => { setEditingWorkout(item); setBuilderOpen(true) }} onDelete={handleDeleteWorkout} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!savedWorkoutsLoading && accountCustomWorkouts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">No saved workouts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">This is where account-specific workout plans will appear.</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Premade workouts</p>
              <p className="text-xs text-muted-foreground">Use these as-is or tweak one into your own saved workout.</p>
            </div>

            {/* Search + filters */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search premade workouts…"
                    className="pl-9 pr-8"
                    value={premadeSearch}
                    onChange={(e) => setPremadeSearch(e.target.value)}
                  />
                  {premadeSearch && (
                    <button type="button" onClick={() => setPremadeSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {premadeSearch && (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setPremadeSearch('')}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filters dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setPremadeFilterOpen((o) => !o)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${premadeSplit !== 'all' || premadeDifficulty !== 'all' || premadeMuscle !== 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {(premadeSplit !== 'all' || premadeDifficulty !== 'all' || premadeMuscle !== 'all') && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {(premadeSplit !== 'all' ? 1 : 0) + (premadeDifficulty !== 'all' ? 1 : 0) + (premadeMuscle !== 'all' ? 1 : 0)}
                      </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${premadeFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {premadeFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPremadeFilterOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 shadow-lg">
                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Split type</p>
                            <div className="flex flex-wrap gap-1.5">
                              {([['all', 'All'], ['ppl', 'PPL'], ['upper_lower', 'Upper/Lower'], ['3day_fullbody', 'Full Body'], ['4day', '4-Day'], ['5day', 'Bro Split'], ['6day', '6-Day'], ['cardio_focus', 'Cardio']] as const).map(([val, label]) => (
                                <button key={val} onClick={() => setPremadeSplit(val)} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${premadeSplit === val ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>{label}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((d) => (
                                <button key={d} onClick={() => setPremadeDifficulty(d)} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${premadeDifficulty === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>{d === 'all' ? 'Any level' : d.charAt(0).toUpperCase() + d.slice(1)}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Muscle group</p>
                            <div className="flex flex-wrap gap-1.5">
                              {([['all', 'Any'], ['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'], ['core', 'Core'], ['full_body', 'Full body'], ['cardio', 'Cardio']] as const).map(([val, label]) => (
                                <button key={val} onClick={() => setPremadeMuscle(val)} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${premadeMuscle === val ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>{label}</button>
                              ))}
                            </div>
                          </div>
                          {(premadeSplit !== 'all' || premadeDifficulty !== 'all' || premadeMuscle !== 'all') && (
                            <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => { setPremadeSplit('all'); setPremadeDifficulty('all'); setPremadeMuscle('all') }}>Clear all filters</button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(premadeSplit !== 'all' || premadeDifficulty !== 'all' || premadeMuscle !== 'all' || premadeSearch) && (
                <button
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => { setPremadeSearch(''); setPremadeSplit('all'); setPremadeDifficulty('all'); setPremadeMuscle('all') }}
                >
                  Clear filters · {filteredPremadeWorkouts.length} result{filteredPremadeWorkouts.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {filteredPremadeWorkouts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">No workouts match your filters</p>
                <button className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => { setPremadeSearch(''); setPremadeSplit('all'); setPremadeDifficulty('all'); setPremadeMuscle('all') }}>Clear filters</button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPremadeWorkouts.map((workout) => (
                  <SavedWorkoutCard key={workout.id} workout={{ ...workout, source: 'premade' }} onStart={startWorkout} onEdit={(item) => { setEditingWorkout(item); setBuilderOpen(true) }} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

        <WorkoutBuilderModal
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          workout={editingWorkout}
          defaultSplit={user.workout_split}
          unitSystem={unitSystem}
          onSave={handleSaveWorkout}
        />

      <Dialog open={!!runningWorkout} onOpenChange={(open) => { if (!open) pauseRunningWorkout() }}>
        {runningWorkout && (
          <ActiveWorkoutModal
            workout={runningWorkout}
            metProfile={getMetProfile(user)}
            unitSystem={unitSystem}
            workoutLogs={workoutLogs}
            initialExercises={activeWorkoutSession?.workout.id === runningWorkout.id ? activeWorkoutSession.exercises : undefined}
            onClose={pauseRunningWorkout}
            onPause={pauseRunningWorkout}
            onSessionChange={handleActiveSessionExercisesChange}
            onComplete={async ({ exercises, caloriesBurned, totalVolumeKg, durationMin }, options) => {
              const performedExercises = normalizeActiveExercisesForWorkout(exercises)
              const performedMuscleGroups = Array.from(new Set(performedExercises.flatMap((exercise) => exercise.exercise.muscle_groups)))

              const performedWorkout: Workout = {
                ...runningWorkout,
                exercises: performedExercises,
                estimated_duration_min: durationMin,
                muscle_groups: (performedMuscleGroups.length > 0 ? performedMuscleGroups : runningWorkout.muscle_groups) as Workout['muscle_groups'],
                updated_at: new Date().toISOString(),
              }

              logWorkout({
                id: `wl-${Date.now()}`,
                user_id: user.id,
                workout_id: runningWorkout.id,
                workout: performedWorkout,
                date: getTodayISO(),
                started_at: activeWorkoutSession?.startedAt ?? new Date().toISOString(),
                completed_at: new Date().toISOString(),
                duration_min: durationMin,
                calories_burned_kcal: caloriesBurned,
                total_volume_kg: totalVolumeKg,
                exercises: exercises.map((exercise) => ({
                  exercise_id: exercise.exercise.id,
                  exercise_name: exercise.exercise.name,
                  sets: exercise.sets.map((set) => ({
                    set_number: set.set_number,
                    target_reps: set.reps,
                    actual_reps: set.actual_reps ?? set.reps,
                    weight_kg: set.actual_weight ?? set.weight_kg ?? 0,
                    speed_mph: set.actual_speed_mph,
                    incline_pct: set.actual_incline_pct,
                    machine_level: set.actual_machine_level,
                    resistance_level: set.actual_resistance_level,
                    watts: set.actual_watts,
                    cadence_rpm: set.actual_cadence_rpm,
                  })),
                })),
                rating: 4,
              })

              if (options?.saveAsTemplate) {
                const savedRoutine: Workout = {
                  ...performedWorkout,
                  id: `cw-${Date.now()}`,
                  name: `${runningWorkout.name} (${getTodayISO()})`,
                  day_label: `Logged ${getTodayISO()}`,
                  description: 'Saved from a completed workout session.',
                  source: 'custom',
                  updated_at: new Date().toISOString(),
                }

                if (isDemoMode) {
                  addCustomWorkout(savedRoutine)
                  toast.success(`Workout logged and routine saved (${savedRoutine.name}).`)
                } else {
                  const response = await createUserWorkoutTemplate(user.id, savedRoutine)
                  if (!response.success || !response.workout) {
                    toast.error(response.error || 'Workout logged, but saving routine failed.')
                    setActiveWorkoutSession(null)
                    setRunningWorkout(null)
                    return
                  }

                  setRemoteCustomWorkouts((current) => [response.workout as Workout, ...current])
                  toast.success(`Workout logged and routine saved (${response.workout.name}).`)
                }
              } else {
                toast.success(`Workout logged. Estimated burn: ${caloriesBurned} kcal.`)
              }

              setActiveWorkoutSession(null)
              setRunningWorkout(null)
            }}
          />
        )}
      </Dialog>

      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </div>
  )
}
