'use client'

import React from 'react'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, CheckCircle, ChevronDown, ChevronUp, Circle, Copy, Dumbbell, Eye, Loader2, Pencil, Play, PlayCircle, Plus, Search,
  SlidersHorizontal, Sparkles, Trash2, Trophy, X, MessageSquareText, Zap,
} from 'lucide-react'
import { WorkoutTimerBar } from '@/components/workout/WorkoutTimerBar'
import { WorkoutTimerStrip } from '@/components/workout/WorkoutTimerStrip'
import { ProgressionSuggestion } from '@/components/workout/ProgressionSuggestion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/useAppStore'
import { EXERCISE_LIBRARY, WORKOUTS } from '@/lib/content-library'
import { EXERCISE_CLASSIFICATIONS } from '@/lib/exercise-classifications'
import { buildSocialDraftFromWorkout } from '@/lib/social-feed'
import type { Exercise, ExerciseLibraryItem, ExerciseSetMetric, Gender, JournalEntry, MuscleGroup, SplitDayType, SplitSchedule, UserProfile, WeekDay, Workout, WorkoutExercise, WorkoutLog, WorkoutSet, WorkoutSplit } from '@/types'
import { cn, formatVolumeValue, getTodayISO, getWeightUnitLabel, kgToLbs, lbsToKg } from '@/lib/utils'
import { buildDefaultSchedule, getTodayWeekDay, getWorkoutsForDayType, SPLIT_DAY_LABELS, SPLIT_DAY_OPTIONS, WEEK_DAYS, WEEK_DAY_LABELS } from '@/lib/split-schedule'
import { createUserWorkoutTemplate, fetchUserWorkoutTemplates, updateUserWorkoutTemplate } from '@/lib/workout-templates'
import { toast } from 'sonner'
import type { UnitSystem } from '@/types'

const ShareModal = dynamic(
  () => import('@/components/sharing/ShareModal').then((mod) => mod.ShareModal),
  { ssr: false }
)

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
  startedAt: string | null
}

interface LoggedWorkoutEditSession {
  log: WorkoutLog
  exercises: ActiveExercise[]
}

const ACTIVE_WORKOUT_SESSION_KEY = 'rivora-active-workout-session'

interface MetProfile {
  weightKg: number
  heightCm: number
  age: number
  gender: Gender
}

type ExerciseInputMode = 'strength' | 'treadmill' | 'run_walk' | 'bike' | 'rower' | 'level_cardio' | 'basic_cardio' | 'interval' | 'time_only'

const SET_METRIC_OPTIONS: Array<{ value: ExerciseSetMetric; label: string }> = [
  { value: 'reps', label: 'Reps' },
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'intervals', label: 'Intervals' },
]

function formatWorkoutTime(iso?: string) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function applyWorkoutDateToTimestamp(date: string, sourceIso?: string, fallback?: Date) {
  const sourceDate = sourceIso ? new Date(sourceIso) : fallback
  if (!sourceDate || Number.isNaN(sourceDate.getTime())) return new Date(`${date}T12:00:00`).toISOString()

  const normalized = new Date(`${date}T12:00:00`)
  normalized.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds(),
  )

  return normalized.toISOString()
}

function formatWorkoutDuration(startedAt?: string, completedAt?: string, durationMin?: number) {
  if (typeof durationMin === 'number' && durationMin > 0) {
    const hours = Math.floor(durationMin / 60)
    const minutes = durationMin % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes} min`
  }

  if (!startedAt || !completedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '—'

  const diffMin = Math.round((end - start) / 60000)
  const hours = Math.floor(diffMin / 60)
  const minutes = diffMin % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes} min`
}

function formatAverageWorkoutTime(durationMin?: number) {
  if (typeof durationMin !== 'number' || durationMin <= 0) return '—'

  const rounded = Math.round(durationMin)
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes} min`
}

function formatElapsedSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

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
  if (exercise.set_metric === 'intervals') return 'interval'

  const classification = EXERCISE_CLASSIFICATIONS[exercise.id]
  if (classification) {
    const eq = exercise.equipment.toLowerCase()
    switch (classification.primary_type) {
      case 'intervals': return 'interval'
      case 'distance': return 'run_walk'
      case 'time':
      case 'time_distance':
        if (exercise.id.startsWith('lib-yoga-') || exercise.id.startsWith('lib-pilates-')) return 'time_only'
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

function inferExerciseSetMetric(exercise: WorkoutExercise['exercise']): ExerciseSetMetric {
  const name = exercise.name.toLowerCase()

  if (exercise.set_metric) return exercise.set_metric
  if (isIntervalExercise(exercise)) return 'intervals'
  if (name.includes('plank') || name.includes('wall sit') || name.includes('hold')) return 'seconds'
  if (isCardioExercise(exercise)) return 'minutes'
  return 'reps'
}

function getExerciseSetMetric(exercise: WorkoutExercise['exercise']): ExerciseSetMetric {
  return exercise.set_metric ?? inferExerciseSetMetric(exercise)
}

function getSetMetricLabel(exercise: WorkoutExercise['exercise']) {
  const metric = getExerciseSetMetric(exercise)
  if (metric === 'seconds') return 'Seconds'
  if (metric === 'minutes') return 'Minutes'
  if (metric === 'intervals') return 'Intervals'
  return isUnilateralExercise(exercise) ? 'Reps/Side' : 'Reps'
}

function getSetMetricPlaceholder(exercise: WorkoutExercise['exercise']) {
  const metric = getExerciseSetMetric(exercise)
  if (metric === 'seconds') return 'Seconds'
  if (metric === 'minutes') return 'Minutes'
  if (metric === 'intervals') return '# intervals'
  return isUnilateralExercise(exercise) ? 'Reps/side' : 'Reps'
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
    case 'time_only':
      return {
        reps: 30,
        rest_seconds: 0,
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
  { value: 'custom', label: 'Custom' },
]

const ACFT_GUIDE_EMAIL = 'lspetrera1213@email.campbell.edu'

const ACFT_KEY_INSTRUCTIONS = [
  {
    title: 'Plank Progression',
    lines: [
      'Weeks 1-2: 3x20-30 sec plank',
      'Weeks 3-4: 3x35-45 sec plank + side planks',
      'Weeks 5-6: 3x45-60 sec plank + shoulder taps',
      'Weeks 7-8: 60-75 sec planks + weighted plank',
      'Weeks 9-10: 1-2 max holds aiming 2:30+',
    ],
  },
  {
    title: 'Push-Ups',
    lines: [
      '5-7 sets stopping 1-2 reps before failure',
      'Progress weekly by increasing total reps',
    ],
  },
  {
    title: 'Deadlift Progression',
    lines: [
      '4 sets increasing weight each set',
      'Goal: reach 140 lbs by Week 9',
    ],
  },
  {
    title: 'Running Types',
    lines: [
      'Intervals: 1 min fast / 1 min walk x6-10',
      'Tempo: steady uncomfortable pace for distance',
    ],
  },
]

function parseAcftWorkoutPosition(workout: Workout) {
  const match = workout.id.match(/^acft-elite-w(\d{2})-d(\d)$/)
  if (!match) return null

  return {
    week: Number(match[1]),
    day: Number(match[2]),
    order: (Number(match[1]) - 1) * 5 + Number(match[2]),
  }
}

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
    set_metric: item.set_metric,
  }
  return {
    instanceId: `we-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    sets: [
      {
        set_number: 1,
        set_type: 'standard',
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
      set_metric: 'reps',
    },
    sets: [
      { set_number: 1, set_type: 'standard', reps: 10, weight_kg: 0, rest_seconds: 60 },
    ],
  }
}

function getSetDisplayName(set: Pick<WorkoutSet, 'set_number' | 'set_type' | 'drop_from_set_number' | 'drop_set_index'>) {
  if (set.set_type === 'drop') {
    return `Drop Set ${set.drop_set_index ?? 1}`
  }
  return `Set ${set.set_number}`
}

function getShortSetDisplayName(set: Pick<WorkoutSet, 'set_number' | 'set_type' | 'drop_from_set_number' | 'drop_set_index'>) {
  if (set.set_type === 'drop') {
    return `Drop ${set.drop_set_index ?? 1}`
  }
  return String(set.set_number)
}

function getDropSetWeight(weightKg?: number) {
  if (!weightKg || weightKg <= 0) return 0
  return Math.max(0, Math.round(weightKg * 0.8 * 10) / 10)
}

function getNextStandardSetNumber(sets: Array<Pick<WorkoutSet, 'set_type'>>) {
  return sets.filter((set) => set.set_type !== 'drop').length + 1
}

function getDropSetSourceNumber(sets: Array<Pick<WorkoutSet, 'set_number' | 'set_type' | 'drop_from_set_number'>>) {
  const lastSet = sets[sets.length - 1]
  if (!lastSet) return 1
  if (lastSet.set_type === 'drop') {
    return lastSet.drop_from_set_number ?? lastSet.set_number
  }
  return lastSet.set_number
}

function normalizeSetNumbers<T extends Pick<WorkoutSet, 'set_number' | 'set_type' | 'drop_from_set_number' | 'drop_set_index'>>(sets: T[]): T[] {
  let standardSetNumber = 0
  const dropCounts = new Map<number, number>()

  return sets.map((set) => {
    if (set.set_type === 'drop') {
      const sourceSetNumber = (set.drop_from_set_number ?? standardSetNumber) || 1
      const nextDropIndex = (dropCounts.get(sourceSetNumber) ?? 0) + 1
      dropCounts.set(sourceSetNumber, nextDropIndex)
      return {
        ...set,
        set_number: sourceSetNumber,
        drop_from_set_number: sourceSetNumber,
        drop_set_index: nextDropIndex,
      }
    }

    standardSetNumber += 1
    return {
      ...set,
      set_number: standardSetNumber,
      set_type: set.set_type || 'standard',
      drop_from_set_number: undefined,
      drop_set_index: undefined,
    }
  })
}

function isDropSet(set: Pick<WorkoutSet, 'set_type'>) {
  return set.set_type === 'drop'
}

function getDropSetRowClass(baseClassName: string, set: Pick<WorkoutSet, 'set_type'>) {
  return cn(
    baseClassName,
    isDropSet(set) && 'ml-5 w-[calc(100%-1.25rem)] border-dashed border-primary/30 bg-primary/[0.05]'
  )
}

function getDropSetLabelClass(set: Pick<WorkoutSet, 'set_type'>) {
  return cn(
    'text-muted-foreground',
    isDropSet(set) && 'text-primary'
  )
}

function createActiveExercisesFromWorkout(workout: Workout): ActiveExercise[] {
  return workout.exercises.map((exercise) => ({
    exercise: exercise.exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      set_type: set.set_type || 'standard',
      completed: false,
      actual_reps: set.reps,
      actual_weight: workout.source === 'premade' ? undefined : (set.weight_kg || 0),
      actual_speed_mph: set.speed_mph,
      actual_incline_pct: set.incline_pct,
      actual_machine_level: set.machine_level,
      actual_resistance_level: set.resistance_level,
      actual_watts: set.watts,
      actual_cadence_rpm: set.cadence_rpm,
    })),
  }))
}

function createActiveExercisesFromWorkoutLog(log: WorkoutLog): ActiveExercise[] {
  const templateByKey = new Map<string, WorkoutExercise>()

  log.workout.exercises.forEach((exercise) => {
    templateByKey.set(`id:${exercise.exercise.id}`, exercise)
    templateByKey.set(`name:${exercise.exercise.name.toLowerCase()}`, exercise)
  })

  return log.exercises.map((loggedExercise) => {
    const templateExercise =
      templateByKey.get(`id:${loggedExercise.exercise_id}`) ??
      templateByKey.get(`name:${loggedExercise.exercise_name.toLowerCase()}`)

    const exercise =
      templateExercise?.exercise ??
      EXERCISE_LIBRARY.find((item) => item.id === loggedExercise.exercise_id) ??
      EXERCISE_LIBRARY.find((item) => item.name.toLowerCase() === loggedExercise.exercise_name.toLowerCase()) ??
      createCustomExercise(loggedExercise.exercise_name).exercise

    return {
      exercise: {
        ...exercise,
        set_metric: exercise.set_metric ?? templateExercise?.exercise.set_metric ?? inferExerciseSetMetric(exercise),
      },
      sets: normalizeSetNumbers(
        loggedExercise.sets.map((set, setIndex) => {
          const templateSet =
            templateExercise?.sets.find((candidate) =>
              candidate.set_number === set.set_number &&
              (candidate.set_type ?? 'standard') === (set.set_type ?? 'standard') &&
              (candidate.drop_set_index ?? 0) === (set.drop_set_index ?? 0)
            ) ??
            templateExercise?.sets[setIndex]

          return {
            set_number: set.set_number,
            set_type: set.set_type ?? templateSet?.set_type ?? 'standard',
            drop_from_set_number:
              set.drop_from_set_number ??
              templateSet?.drop_from_set_number ??
              ((set.set_type ?? templateSet?.set_type) === 'drop' ? set.set_number : undefined),
            drop_set_index: set.drop_set_index ?? templateSet?.drop_set_index,
            reps: Math.max(0, set.target_reps ?? templateSet?.reps ?? 0),
            weight_kg: Math.max(0, Number(templateSet?.weight_kg ?? set.weight_kg ?? 0)),
            incline_pct: templateSet?.incline_pct ?? set.incline_pct,
            speed_mph: templateSet?.speed_mph ?? set.speed_mph,
            machine_level: templateSet?.machine_level ?? set.machine_level,
            resistance_level: templateSet?.resistance_level ?? set.resistance_level,
            watts: templateSet?.watts ?? set.watts,
            cadence_rpm: templateSet?.cadence_rpm ?? set.cadence_rpm,
            rest_seconds: Math.max(0, Number(templateSet?.rest_seconds ?? 60)),
            completed: true,
            actual_reps: Math.max(0, set.actual_reps ?? set.target_reps ?? templateSet?.reps ?? 0),
            actual_weight: Math.max(0, Number(set.weight_kg ?? templateSet?.weight_kg ?? 0)),
            actual_speed_mph: set.speed_mph ?? templateSet?.speed_mph,
            actual_incline_pct: set.incline_pct ?? templateSet?.incline_pct,
            actual_machine_level: set.machine_level ?? templateSet?.machine_level,
            actual_resistance_level: set.resistance_level ?? templateSet?.resistance_level,
            actual_watts: set.watts ?? templateSet?.watts,
            actual_cadence_rpm: set.cadence_rpm ?? templateSet?.cadence_rpm,
          }
        })
      ),
    }
  })
}

function normalizeActiveExercisesForWorkout(exercises: ActiveExercise[]): WorkoutExercise[] {
  return exercises.map((exercise) => ({
    exercise: exercise.exercise,
    sets: normalizeSetNumbers(exercise.sets).map((set) => ({
      set_number: set.set_number,
      set_type: set.set_type || 'standard',
      drop_from_set_number: set.drop_from_set_number,
      drop_set_index: set.drop_set_index,
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
  const roundedToTenth = Math.round(weightLbs * 10) / 10
  if (Math.abs(roundedToTenth - Math.round(roundedToTenth)) < 0.001) {
    return String(Math.round(roundedToTenth))
  }
  return String(roundedToTenth)
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

function estimateActiveSetSeconds(args: { set: WorkoutSet; exercise: WorkoutExercise['exercise'] }) {
  const exerciseName = args.exercise.name.toLowerCase()
  const isCardio = isCardioExercise(args.exercise)
  const isIsometric = exerciseName.includes('plank') || exerciseName.includes('hold')
  const metric = getExerciseSetMetric(args.exercise)
  const reps = Math.max(0, Number(args.set.reps) || 0)

  if (metric === 'intervals') {
    const workSeconds = Math.max(0, Number(args.set.interval_duration_sec) || 0)
    return Math.max(20, reps * Math.max(workSeconds, 1))
  }

  if (metric === 'minutes') {
    return Math.max(30, reps * 60)
  }

  if (metric === 'seconds') {
    return Math.max(1, reps)
  }

  if (isCardio) {
    return Math.max(300, reps * 60)
  }

  if (isIsometric) {
    return Math.max(20, reps)
  }

  const perRepSeconds =
    exerciseName.includes('deadlift') || exerciseName.includes('squat') || exerciseName.includes('row')
      ? 4.8
      : 3.8

  return Math.max(18, reps * perRepSeconds + 12)
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
  const densityFactor = Math.min(1.2, Math.max(0.9, 36 / Math.max(args.activeSeconds, 20)))
  const repFactor = Math.min(1.15, Math.max(0.92, args.actualReps / 10))
  const loadFactor = Math.min(1.9, 1.0 + loadRatio * 0.35)

  if (args.metType === 'cardio') return Math.min(14, correctedMetBase * Math.max(0.95, densityFactor))
  if (args.metType === 'bodyweight_vigorous') return Math.min(11, correctedMetBase * Math.max(0.95, repFactor))
  if (args.metType === 'bodyweight_light') return Math.min(7.5, correctedMetBase * Math.max(0.95, repFactor))
  if (args.metType === 'squat_hinge') return Math.min(14, correctedMetBase * ((loadFactor + densityFactor) / 2))
  return Math.min(12, correctedMetBase * ((loadFactor + repFactor + densityFactor) / 3))
}

function estimateSetCalories(args: {
  metProfile: MetProfile
  reps: number
  intervalDurationSec?: number
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
  const activeSeconds = estimateActiveSetSeconds({
    set: {
      set_number: 1,
      reps: args.reps,
      rest_seconds: args.restSeconds,
      interval_duration_sec: args.intervalDurationSec,
    },
    exercise: args.exercise,
  })
  const adjustedMet = estimateAdjustedMet({
    metBase,
    metType: libraryMatch?.met_type ?? 'resistance',
    actualWeight: Math.max(args.weightKg, 0),
    actualReps: Math.max(args.reps, 0),
    metProfile: args.metProfile,
    activeSeconds,
  })

  const activeCalories = adjustedMet * args.metProfile.weightKg * (activeSeconds / 3600)
  const restMetBase = (libraryMatch?.met_type ?? 'resistance') === 'cardio' ? 1.5 : 1.05
  const restCalories =
    getCorrectedMet(restMetBase, args.metProfile) * args.metProfile.weightKg * (Math.max(args.restSeconds, 0) / 3600)
  return Math.max(0, activeCalories + restCalories)
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
        intervalDurationSec: set.interval_duration_sec,
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
      totalDurationSeconds += estimateActiveSetSeconds({ set, exercise: exercise.exercise }) + restSeconds
    })
  })

  return {
    caloriesBurned: Math.round(caloriesBurned),
    totalVolumeKg: Math.round(totalVolumeKg),
    durationMin: Math.max(5, Math.round(totalDurationSeconds / 60)),
  }
}

function buildEditableExercisesFromLog(log: WorkoutLog): EditableWorkoutExercise[] {
  return createActiveExercisesFromWorkoutLog(log).map((exercise, exerciseIndex) => ({
    exercise: exercise.exercise,
    sets: exercise.sets.map((set) => ({
      set_number: set.set_number,
      set_type: set.set_type,
      drop_from_set_number: set.drop_from_set_number,
      drop_set_index: set.drop_set_index,
      reps: set.actual_reps ?? set.reps ?? 0,
      weight_kg: set.actual_weight ?? set.weight_kg ?? 0,
      incline_pct: set.actual_incline_pct ?? set.incline_pct,
      speed_mph: set.actual_speed_mph ?? set.speed_mph,
      machine_level: set.actual_machine_level ?? set.machine_level,
      resistance_level: set.actual_resistance_level ?? set.resistance_level,
      watts: set.actual_watts ?? set.watts,
      cadence_rpm: set.actual_cadence_rpm ?? set.cadence_rpm,
      rest_seconds: set.rest_seconds,
    })),
    instanceId: `logged-${exercise.exercise.id}-${exerciseIndex}-${Date.now()}`,
  }))
}

function SavedWorkoutCard({
  workout,
  averageDurationMin,
  onStart,
  onPreview,
  onEdit,
  onPublish,
  onDelete,
}: {
  workout: Workout
  averageDurationMin?: number
  onStart: (workout: Workout) => void
  onPreview: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onPublish?: (workout: Workout) => void
  onDelete?: (workout: Workout) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const handleDeleteClick = () => setShowConfirm(true)
  const handleConfirm = () => {
    setShowConfirm(false)
    onDelete && onDelete(workout)
  }
  const handleCancel = () => setShowConfirm(false)
  const normalizedDayLabel = workout.day_label?.trim() ?? ''
  const showDayLabel = normalizedDayLabel.length > 0 && normalizedDayLabel.toLowerCase() !== 'custom session'

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showDayLabel ? (
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{normalizedDayLabel}</p>
          ) : null}
          <p className="text-lg font-semibold">{workout.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{workout.difficulty}</Badge>
          <Button variant="outline" size="icon" onClick={() => onEdit(workout)} title="Edit workout">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="font-data text-lg font-semibold">{workout.exercises.length}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Exercises</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <p className="font-data text-lg font-semibold">{formatAverageWorkoutTime(averageDurationMin)}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Time</p>
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

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] gap-2">
        <Button variant="brand" className="h-10 min-w-0 gap-1.5 px-4" onClick={() => onStart(workout)}>
          <Play className="h-4 w-4 fill-current" />
          Start
        </Button>
        {onPublish ? (
          <Button variant="outline" className="h-10 px-3 sm:px-4" onClick={() => onPublish(workout)}>
            Post
          </Button>
        ) : null}
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onPreview(workout)} title="Preview workout">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setShowShare(true)} title="Send workout in messages">
          <MessageSquareText className="h-4 w-4" />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive/70 hover:text-destructive" onClick={handleDeleteClick}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/45 p-4">
          <div className="flex w-full max-w-xs flex-col items-center rounded-xl border border-border bg-card p-6 text-center shadow-xl">
            <p className="mb-4 text-sm font-semibold">Are you sure you want to delete this saved workout?</p>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={handleConfirm}>Delete</Button>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        open={showShare}
        onOpenChange={setShowShare}
        itemType="workout"
        itemName={workout.name}
        itemData={workout as unknown as Record<string, unknown>}
      />
    </div>
  )
}

function TodayWorkoutBanner({
  workouts,
  onStart,
  onPreview,
}: {
  workouts: Workout[]
  onStart: (workout: Workout) => void
  onPreview: (workout: Workout) => void
}) {
  if (workouts.length === 0) return null
  const saved = workouts.filter((w) => w.source !== 'premade')
  const premade = workouts.filter((w) => w.source === 'premade')
  const prioritized = [...saved, ...premade].slice(0, 4)

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm font-semibold text-emerald-300">Recommended for today</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {prioritized.map((w) => (
          <div key={w.id} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 sm:truncate">{w.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {w.exercises.length} exercises · <span className="capitalize">{w.difficulty}</span>
                {w.source !== 'premade' && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Saved</span>}
              </p>
            </div>
            <div className="flex items-center justify-end gap-1.5 sm:shrink-0">
              <Button variant="ghost" size="icon-sm" onClick={() => onPreview(w)} title="Preview">
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => onStart(w)}>
                <Play className="w-3 h-3" />
                Start
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkoutPreviewDialog({
  workout,
  averageDurationMin,
  unitSystem,
  onClose,
}: {
  workout: Workout | null
  averageDurationMin?: number
  unitSystem: UnitSystem
  onClose: () => void
}) {
  return (
    <Dialog open={!!workout} onOpenChange={(open) => { if (!open) onClose() }}>
      {workout && (
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{workout.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">{workout.source || 'premade'}</Badge>
                <Badge variant="outline" className="capitalize">{workout.difficulty}</Badge>
                {workout.day_label && (
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{workout.day_label}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{workout.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="font-data text-lg font-semibold">{workout.exercises.length}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Exercises</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="font-data text-lg font-semibold">{formatAverageWorkoutTime(averageDurationMin ?? workout.estimated_duration_min)}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Time</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="font-data text-lg font-semibold">{workout.muscle_groups.length}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Focus</p>
              </div>
            </div>

            <div className="space-y-3">
              {workout.exercises.map((exercise, exerciseIndex) => (
                <div key={`${workout.id}-${exercise.exercise.id}-${exerciseIndex}`} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="border-b border-border/40 bg-muted/20 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{exercise.exercise.name}</p>
                      <span className="text-[11px] text-muted-foreground">{exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                      <span>Set</span>
                      <span className="text-center">{getSetMetricLabel(exercise.exercise)}</span>
                      <span className="text-right">Weight</span>
                    </div>
                    <div className="space-y-1">
                      {exercise.sets.map((set) => (
                        <div
                          key={`${exercise.exercise.id}-${set.set_number}-${set.drop_set_index ?? 'base'}`}
                          className={getDropSetRowClass(
                            'grid grid-cols-3 items-center rounded-lg border border-transparent bg-background/60 px-2 py-1.5 text-xs',
                            set,
                          )}
                        >
                          <span className={cn('font-medium', getDropSetLabelClass(set))}>{getSetDisplayName(set)}</span>
                          <span className="text-center font-data font-semibold tabular-nums">{set.reps}</span>
                          <span className="text-right font-data tabular-nums text-muted-foreground">
                            {set.weight_kg && set.weight_kg > 0
                              ? `${unitSystem === 'imperial' ? Math.round(kgToLbs(set.weight_kg)) : Math.round(set.weight_kg)} ${getWeightUnitLabel(unitSystem)}`
                              : 'BW'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
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
  const [durationUnits, setDurationUnits] = useState<Record<string, 'sec' | 'min'>>({})

  const getDurationUnit = (key: string, defaultUnit: 'sec' | 'min' = 'sec') => durationUnits[key] ?? defaultUnit
  const setDurationUnit = (key: string, unit: 'sec' | 'min') => {
    setDurationUnits((current) => ({ ...current, [key]: unit }))
  }
  const displayDurationValue = (valueSec: number | undefined, unit: 'sec' | 'min') => {
    if (valueSec === undefined || valueSec === 0) return ''
    return unit === 'min' ? String(Math.round((valueSec / 60) * 100) / 100) : String(valueSec)
  }
  const parseDurationValue = (input: string, unit: 'sec' | 'min') => {
    const parsed = parseFloat(input) || 0
    return unit === 'min' ? Math.round(parsed * 60) : parsed
  }

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
              set_number: getNextStandardSetNumber(exercise.sets),
              set_type: 'standard',
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

  const addDropSetToExercise = (instanceId: string) => {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.instanceId !== instanceId) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        const sourceSetNumber = getDropSetSourceNumber(exercise.sets)
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: sourceSetNumber,
              set_type: 'drop',
              drop_from_set_number: sourceSetNumber,
              drop_set_index: exercise.sets.filter((set) => set.set_type === 'drop' && set.drop_from_set_number === sourceSetNumber).length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: getDropSetWeight(lastSet?.weight_kg),
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              interval_duration_sec: lastSet?.interval_duration_sec,
              rest_seconds: 0,
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

  const updateExerciseSetMetric = (instanceId: string, metric: ExerciseSetMetric) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.instanceId === instanceId
          ? {
              ...exercise,
              exercise: { ...exercise.exercise, set_metric: metric },
            }
          : exercise
      )
    )
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
      sets: normalizeSetNumbers(exercise.sets).map((set) => ({
        set_number: set.set_number,
        set_type: set.set_type || 'standard',
        drop_from_set_number: set.drop_from_set_number,
        drop_set_index: set.drop_set_index,
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
                  <Input
                    value={exerciseQuery}
                    onChange={(e) => setExerciseQuery(e.target.value)}
                    placeholder="Search exercise variations"
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="pl-9 pr-8"
                  />
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
                    <Select
                      value={getExerciseSetMetric(exercise.exercise)}
                      onValueChange={(value) => updateExerciseSetMetric(exercise.instanceId, value as ExerciseSetMetric)}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue placeholder="Metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {SET_METRIC_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <div className={`grid ${isRunningIntervalExercise(exercise.exercise) ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[80px_1fr_1fr_1fr_1fr_auto]'} gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground`}>
                      <span>Round</span>
                      <span>Intervals</span>
                      <span>Work</span>
                      <span>Work Unit</span>
                      <span>Rest</span>
                      {!isRunningIntervalExercise(exercise.exercise) && <span>Rest Unit</span>}
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
                  ) : inputMode === 'time_only' ? (
                    <div className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Set</span>
                      <span>Minutes</span>
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
                      <span>{getSetMetricLabel(exercise.exercise)}</span>
                      <span>Weight ({getWeightUnitLabel(unitSystem)})</span>
                      <span>Rest Sec</span>
                    </div>
                  )}
                  {exercise.sets.map((set, setIndex) => (
                    inputMode === 'interval' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className={`grid ${isRunningIntervalExercise(exercise.exercise) ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[80px_1fr_1fr_1fr_1fr_auto]'} gap-2`}>
                        {(() => {
                          const workUnitKey = `${exercise.instanceId}-${setIndex}-work`
                          const restUnitKey = `${exercise.instanceId}-${setIndex}-rest`
                          const workUnit = getDurationUnit(workUnitKey)
                          const restUnit = getDurationUnit(restUnitKey)
                          return (
                            <>
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
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
                          value={displayDurationValue(set.interval_duration_sec, workUnit)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'interval_duration_sec', e.target.value === '' ? 0 : parseDurationValue(e.target.value, workUnit))}
                          placeholder={workUnit === 'min' ? 'e.g. 1.5' : 'e.g. 20'}
                        />
                        <Select value={workUnit} onValueChange={(value) => setDurationUnit(workUnitKey, value as 'sec' | 'min')}>
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sec">sec</SelectItem>
                            <SelectItem value="min">min</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={0}
                          value={displayDurationValue(set.rest_seconds, restUnit)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : parseDurationValue(e.target.value, restUnit))}
                          placeholder={restUnit === 'min' ? 'e.g. 1' : 'e.g. 40'}
                        />
                        {!isRunningIntervalExercise(exercise.exercise) && (
                          <Select value={restUnit} onValueChange={(value) => setDurationUnit(restUnitKey, value as 'sec' | 'min')}>
                            <SelectTrigger className="h-10 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sec">sec</SelectItem>
                              <SelectItem value="min">min</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                            </>
                          )
                        })()}
                      </div>
                    ) : inputMode === 'treadmill' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">
                          {getSetDisplayName(set)}
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
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : inputMode === 'run_walk' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'bike' || inputMode === 'rower' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'watts', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Watts" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'time_only' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                        <Input
                          type="number"
                          min={0}
                          value={formatNumericInput(set.reps)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Minutes"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={formatNumericInput(set.rest_seconds)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="Rest sec"
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                      <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                        <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                        <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                        <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'machine_level', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Level" />
                        <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <div
                        key={`${exercise.instanceId}-${setIndex}`}
                        className={getDropSetRowClass('grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 rounded-xl border border-transparent px-2 py-2', set)}
                      >
                        <div className={cn('flex items-center px-3 text-sm font-medium', getDropSetLabelClass(set))}>
                          {getSetDisplayName(set)}
                        </div>
                        <Input
                          type="number"
                          value={formatNumericInput(set.reps)}
                          onChange={(e) => updateSetField(exercise.instanceId, setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder={getSetMetricPlaceholder(exercise.exercise)}
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
                        <Button variant="ghost" size="icon-sm" onClick={() => setExercises((current) => current.map((item) => item.instanceId === exercise.instanceId ? { ...item, sets: normalizeSetNumbers(item.sets.filter((_, index) => index !== setIndex)) || item.sets } : item))} disabled={exercise.sets.length <= 1}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addSetToExercise(exercise.instanceId)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {inputMode === 'interval' ? 'Add round' : 'Add set'}
                  </Button>
                  {inputMode === 'strength' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => addDropSetToExercise(exercise.instanceId)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add drop set
                    </Button>
                  )}
                </div>
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
  journalEntries,
  initialExercises,
  initialStartedAt,
  onClose,
  onPause,
  onSessionChange,
  onComplete,
  mode = 'live',
  lockedTiming,
}: {
  workout: Workout
  metProfile: MetProfile
  unitSystem: UnitSystem
  workoutLogs: import('@/types').WorkoutLog[]
  journalEntries: import('@/types').JournalEntry[]
  initialExercises?: ActiveExercise[]
  initialStartedAt?: string | null
  onClose: () => void
  onPause: () => void
  onSessionChange: (exercises: ActiveExercise[], startedAt?: string | null) => void
  onComplete: (payload: { exercises: ActiveExercise[]; caloriesBurned: number; totalVolumeKg: number; durationMin: number }, options?: { saveAsTemplate?: boolean; templateName?: string }) => void
  mode?: 'live' | 'edit-log'
  lockedTiming?: {
    date: string
    startedAt?: string | null
    completedAt?: string | null
    durationMin?: number
  }
}) {
  const isEditMode = mode === 'edit-log'
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
  const [startedAt, setStartedAt] = useState<string | null>(isEditMode ? (lockedTiming?.startedAt ?? null) : (initialStartedAt ?? null))
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [restEndsAtMs, setRestEndsAtMs] = useState<number | null>(null)
  const [showSaveRoutineName, setShowSaveRoutineName] = useState(false)
  const [saveRoutineName, setSaveRoutineName] = useState(`${workout.name} (${getTodayISO()})`)

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
      setStartedAt(isEditMode ? (lockedTiming?.startedAt ?? null) : (initialStartedAt ?? null))
      return
    }
    setExercises(createActiveExercisesFromWorkout(workout))
    setStartedAt(isEditMode ? (lockedTiming?.startedAt ?? null) : (initialStartedAt ?? null))
  }, [initialExercises, initialStartedAt, isEditMode, lockedTiming?.startedAt, workout])

  useEffect(() => {
    if (isEditMode) return
    const hasCompletedSet = exercises.some((exercise) => exercise.sets.some((set) => set.completed))
    if (!hasCompletedSet) {
      setStartedAt(null)
      setRestEndsAtMs(null)
    }
  }, [exercises, isEditMode])

  useEffect(() => {
    setSaveRoutineName(`${workout.name} (${getTodayISO()})`)
    setShowSaveRoutineName(false)
  }, [workout.id, workout.name])

  useEffect(() => {
    if (isEditMode) return
    if (!startedAt && !restEndsAtMs) return
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isEditMode, startedAt, restEndsAtMs])

  useEffect(() => {
    if (restEndsAtMs && restEndsAtMs <= nowMs) {
      setRestEndsAtMs(null)
    }
  }, [nowMs, restEndsAtMs])

  useEffect(() => {
    onSessionChange(exercises, startedAt)
  }, [exercises, startedAt, onSessionChange])

  const completedSets = exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length
  const totalSets = exercises.flatMap((exercise) => exercise.sets).length
  const progress = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
  const liveDurationSeconds = useMemo(() => {
    if (isEditMode) return 0
    if (!startedAt) return 0
    const startedMs = new Date(startedAt).getTime()
    if (Number.isNaN(startedMs)) return 0
    return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  }, [isEditMode, nowMs, startedAt])
  const restRemainingSeconds = isEditMode ? 0 : (restEndsAtMs ? Math.max(0, Math.ceil((restEndsAtMs - nowMs) / 1000)) : 0)
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
      sets: normalizeSetNumbers(exercise.sets).map((set) => ({
        set_number: set.set_number,
        set_type: set.set_type || 'standard',
        drop_from_set_number: set.drop_from_set_number,
        drop_set_index: set.drop_set_index,
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

  const updateLiveExerciseSetMetric = (exerciseIndex: number, metric: ExerciseSetMetric) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              exercise: { ...exercise.exercise, set_metric: metric },
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
              set_number: getNextStandardSetNumber(exercise.sets),
              set_type: 'standard',
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

  const addDropSetToExercise = (exerciseIndex: number) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        const sourceSetNumber = getDropSetSourceNumber(exercise.sets)
        const baseWeight = lastSet?.actual_weight ?? lastSet?.weight_kg ?? 0
        const dropWeight = getDropSetWeight(baseWeight)
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: sourceSetNumber,
              set_type: 'drop',
              drop_from_set_number: sourceSetNumber,
              drop_set_index: exercise.sets.filter((set) => set.set_type === 'drop' && set.drop_from_set_number === sourceSetNumber).length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: dropWeight,
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              machine_level: lastSet?.machine_level,
              resistance_level: lastSet?.resistance_level,
              watts: lastSet?.watts,
              cadence_rpm: lastSet?.cadence_rpm,
              rest_seconds: 0,
              completed: false,
              actual_reps: lastSet?.actual_reps ?? lastSet?.reps ?? 10,
              actual_weight: dropWeight,
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
          sets: normalizeSetNumbers(
            exercise.sets.filter((_, currentSetIndex) => currentSetIndex !== setIndex)
          ),
        }
      })
    )
  }

  const removeExerciseFromLiveWorkout = (exerciseIndex: number) => {
    setExercises((current) => current.filter((_, currentIndex) => currentIndex !== exerciseIndex))
  }

  const applyWeightToAllSets = (exerciseIndex: number, weight_kg: number) => {
    setExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => ({ ...set, actual_weight: weight_kg })),
            }
          : exercise
      )
    )
  }

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    if (isEditMode) {
      setExercises((current) =>
        current.map((exercise, currentExerciseIndex) =>
          currentExerciseIndex === exerciseIndex
            ? {
                ...exercise,
                sets: exercise.sets.map((set, currentSetIndex) =>
                  currentSetIndex === setIndex ? { ...set, completed: !set.completed } : set
                ),
              }
            : exercise
        )
      )
      return
    }

    let toggledToCompleted = false
    let restSecondsForSet = 0

    const nextExercises = exercises.map((exercise, currentExerciseIndex) =>
      currentExerciseIndex === exerciseIndex
        ? {
            ...exercise,
            sets: exercise.sets.map((set, currentSetIndex) => {
              if (currentSetIndex !== setIndex) return set
              const nextCompleted = !set.completed
              toggledToCompleted = nextCompleted
              restSecondsForSet = Math.max(0, Number(set.rest_seconds) || 0)
              return { ...set, completed: nextCompleted }
            }),
          }
        : exercise
    )
    const remainingCompletedSets = nextExercises.flatMap((e) => e.sets).filter((s) => s.completed).length
    setExercises(nextExercises)

    // Reset the duration timer if all sets are unchecked
    if (!toggledToCompleted && remainingCompletedSets === 0) {
      setStartedAt(null)
    }

    if (toggledToCompleted && restSecondsForSet > 0) {
      setRestEndsAtMs(Date.now() + restSecondsForSet * 1000)
    } else if (!toggledToCompleted) {
      setRestEndsAtMs(null)
    }
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

  const handleCompleteWorkout = async (options?: { saveAsTemplate?: boolean; templateName?: string }) => {
    if (exercises.length === 0) {
      toast.error('Add at least one exercise before completing this workout.')
      return
    }

    setIsCompleting(true)
    const metCalories = summary.caloriesBurned
    const durationMin = summary.durationMin || workout.estimated_duration_min
    const weightKg = metProfile.weightKg

    try {
      let strengthCalories = 0
      let cardioMetCalories = 0
      const activityMap: Record<string, number> = {}

      for (const ex of exercises) {
        const exSummary = summarizeExercises([
          {
            exercise: ex.exercise,
            sets: ex.sets.map((set) => ({
              set_number: set.set_number,
              set_type: set.set_type,
              drop_from_set_number: set.drop_from_set_number,
              drop_set_index: set.drop_set_index,
              reps: set.actual_reps ?? set.reps,
              weight_kg: set.actual_weight ?? set.weight_kg ?? 0,
              speed_mph: set.actual_speed_mph ?? set.speed_mph,
              incline_pct: set.actual_incline_pct ?? set.incline_pct,
              machine_level: set.actual_machine_level ?? set.machine_level,
              resistance_level: set.actual_resistance_level ?? set.resistance_level,
              watts: set.actual_watts ?? set.watts,
              cadence_rpm: set.actual_cadence_rpm ?? set.cadence_rpm,
              interval_duration_sec: set.interval_duration_sec,
              rest_seconds: set.rest_seconds,
            })),
          },
        ], metProfile)

        if (isCardioExercise(ex.exercise)) {
          cardioMetCalories += exSummary.caloriesBurned
          const activity = getApiActivity(ex.exercise)
          activityMap[activity] = (activityMap[activity] || 0) + exSummary.durationMin
        } else {
          strengthCalories += exSummary.caloriesBurned
        }
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

      const blendedCardioCalories = apiTotal > 0
        ? Math.round(apiTotal * 0.65 + cardioMetCalories * 0.35)
        : cardioMetCalories

      const finalCalories = Math.max(
        0,
        Math.round(strengthCalories + blendedCardioCalories)
      )

      onComplete({ exercises, caloriesBurned: finalCalories, totalVolumeKg: summary.totalVolumeKg, durationMin }, options)
    } catch {
      onComplete({ exercises, caloriesBurned: metCalories, totalVolumeKg: summary.totalVolumeKg, durationMin }, options)
    } finally {
      setIsCompleting(false)
    }
  }

  const renderExerciseAdder = (title: string, description: string) => (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Search exercise variations"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              className="pl-9 pr-8"
            />
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
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addCustomExerciseToLiveWorkout}>
          Add Custom
        </Button>
      </div>
    </div>
  )

  const lockedDurationLabel = lockedTiming?.durationMin ? formatAverageWorkoutTime(lockedTiming.durationMin) : '—'
  const lockedStartedLabel = lockedTiming?.startedAt ? formatWorkoutTime(lockedTiming.startedAt) : '—'
  const lockedCompletedLabel = lockedTiming?.completedAt ? formatWorkoutTime(lockedTiming.completedAt) : '—'

  return (
    <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0">
      <DialogHeader className="flex-shrink-0 px-3 pb-0 pt-3 sm:px-6 sm:pt-6">
        <DialogTitle>{isEditMode ? `Edit ${workout.name}` : workout.name}</DialogTitle>
      </DialogHeader>

      <div className="relative flex min-h-0 flex-1">
        {!isEditMode && (
          <WorkoutTimerStrip
            durationSeconds={liveDurationSeconds}
            restSeconds={restRemainingSeconds}
            progress={progress}
            isTimerStarted={startedAt !== null}
            onStartTimer={() => setStartedAt(new Date().toISOString())}
            onSkipRest={() => setRestEndsAtMs(null)}
          />
        )}
        <div className="min-w-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="space-y-5 pb-16 sm:pb-0">
            <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{progress}%</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Progress</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="font-data text-2xl font-semibold">{summary.caloriesBurned}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. kcal</p>
          </div>
          {isEditMode ? (
            <>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
                <p className="font-data text-2xl font-semibold">{lockedDurationLabel}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Logged time</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
                <p className="font-data text-2xl font-semibold">{lockedStartedLabel}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Started</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
                <p className="font-data text-2xl font-semibold">{formatElapsedSeconds(liveDurationSeconds)}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live timer</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 sm:hidden">
                <p className="font-data text-2xl font-semibold">{restRemainingSeconds > 0 ? formatElapsedSeconds(restRemainingSeconds) : '—'}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rest</p>
              </div>
            </>
          )}
        </div>

        <Progress value={progress} indicatorClassName="bg-emerald-500" className="h-1.5" />

        {isEditMode ? (
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Logged date</p>
                <p className="mt-1 text-sm text-foreground/90">{lockedTiming?.date ?? getTodayISO()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Started</p>
                <p className="mt-1 text-sm text-foreground/90">{lockedStartedLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Finished</p>
                <p className="mt-1 text-sm text-foreground/90">{lockedCompletedLabel} · {lockedDurationLabel}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">You can tweak the exercises and sets here without changing the original session timing.</p>
          </div>
        ) : startedAt && (
          <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Session timing</p>
                <p className="text-sm text-foreground/90">
                  Started {formatWorkoutTime(startedAt)}
                  {restRemainingSeconds > 0 && <span className="text-muted-foreground"> · Rest ends in {formatElapsedSeconds(restRemainingSeconds)}</span>}
                </p>
              </div>
              {restRemainingSeconds > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setRestEndsAtMs(null)}>
                  Skip Rest
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={() => setAllSetsCompletion(true)}>
            Select All Complete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAllSetsCompletion(false)}>
            Reset All
          </Button>
        </div>

        {renderExerciseAdder(
          isEditMode ? 'Add another exercise' : 'Add another exercise',
          isEditMode ? 'Adjust this completed workout with extra movements if you need to.' : 'Search and drop a movement into this live workout.'
        )}

        <div className="space-y-4">
          {exercises.map((exercise, exerciseIndex) => {
            const inputMode = getExerciseInputMode(exercise.exercise)
            const prevData = lastPerformance[exercise.exercise.id] || lastPerformance[`name:${exercise.exercise.name}`]
            return <div key={`${exercise.exercise.id}-${exerciseIndex}`} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                          ? ` @ ${unitSystem === 'imperial' ? Math.round(s.weight_kg * 2.205) : s.weight_kg} ${unitSystem === 'imperial' ? 'lb' : 'kg'}`
                          : ''
                        return `${s.actual_reps}${w}${si < prevData.sets.length - 1 ? ' · ' : ''}`
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Select
                    value={getExerciseSetMetric(exercise.exercise)}
                    onValueChange={(value) => updateLiveExerciseSetMetric(exerciseIndex, value as ExerciseSetMetric)}
                  >
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue placeholder="Metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {SET_METRIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="space-y-2 overflow-hidden">
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
                  <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <span>Set</span>
                    <span>Weight ({getWeightUnitLabel(unitSystem)})</span>
                    <span>{getSetMetricLabel(exercise.exercise)}</span>
                    <span>Done</span>
                  </div>
                )}
                {exercise.sets.map((set, setIndex) => (
                  inputMode === 'treadmill' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1.5 rounded-xl border px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{getShortSetDisplayName(set)}</span>
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_speed_mph)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_speed_mph', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={!isEditMode && set.completed}
                        placeholder="Speed MPH"
                      />
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_incline_pct)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_incline_pct', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={!isEditMode && set.completed}
                        placeholder="Incline %"
                      />
                      <Input
                        type="number"
                        value={formatNumericInput(set.actual_reps)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))}
                        disabled={!isEditMode && set.completed}
                        placeholder="Minutes"
                      />
                      <button type="button" className="justify-self-end sm:justify-self-auto" onClick={() => toggleSet(exerciseIndex, setIndex)}>
                        {set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end sm:justify-self-auto" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : inputMode === 'run_walk' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1.5 rounded-xl border px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{getShortSetDisplayName(set)}</span>
                      <Input type="number" value={formatNumericInput(set.actual_speed_mph)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_speed_mph', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Speed MPH" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Minutes" />
                      <button type="button" className="justify-self-end sm:justify-self-auto" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end sm:justify-self-auto" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : inputMode === 'bike' || inputMode === 'rower' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1.5 rounded-xl border px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{getShortSetDisplayName(set)}</span>
                      <Input type="number" value={formatNumericInput(set.actual_watts)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_watts', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Watts" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Minutes" />
                      <button type="button" className="justify-self-end sm:justify-self-auto" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end sm:justify-self-auto" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                    <div key={`${exercise.exercise.id}-${setIndex}`} className={`grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1.5 rounded-xl border px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`}>
                      <span className="font-data text-xs">{getShortSetDisplayName(set)}</span>
                      <Input type="number" value={formatNumericInput(set.actual_machine_level)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_machine_level', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Level" />
                      <Input type="number" value={formatNumericInput(set.actual_reps)} onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_reps', e.target.value === '' ? undefined : Number(e.target.value))} disabled={!isEditMode && set.completed} placeholder="Minutes" />
                      <button type="button" className="justify-self-end sm:justify-self-auto" onClick={() => toggleSet(exerciseIndex, setIndex)}>{set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</button>
                      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end sm:justify-self-auto" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <div
                      key={`${exercise.exercise.id}-${setIndex}`}
                      className={getDropSetRowClass(
                        `grid grid-cols-[3.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1.5 rounded-xl border px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-2 ${set.completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'}`,
                        set,
                      )}
                    >
                      <span className={cn('font-data text-xs', getDropSetLabelClass(set))}>{getShortSetDisplayName(set)}</span>
                      <Input
                        type="number"
                        value={formatWorkoutWeightInput(set.actual_weight, unitSystem)}
                        onChange={(e) => updateSet(exerciseIndex, setIndex, 'actual_weight', e.target.value === '' ? undefined : parseWorkoutWeightInput(e.target.value, unitSystem))}
                        disabled={!isEditMode && set.completed}
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
                          disabled={!isEditMode && set.completed}
                          placeholder={getSetMetricPlaceholder(exercise.exercise)}
                        />
                      <button type="button" className="justify-self-end sm:justify-self-auto" onClick={() => toggleSet(exerciseIndex, setIndex)}>
                        {set.completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end sm:justify-self-auto" onClick={() => removeSetFromExercise(exerciseIndex, setIndex)} disabled={exercise.sets.length <= 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => addSetToExercise(exerciseIndex)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add set
                </Button>
                {inputMode === 'strength' && (
                  <Button type="button" size="sm" variant="outline" onClick={() => addDropSetToExercise(exerciseIndex)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add drop set
                  </Button>
                )}
              </div>
              {!isCardioExercise(exercise.exercise) && (
                <ProgressionSuggestion
                  exerciseId={exercise.exercise.id}
                  exerciseName={exercise.exercise.name}
                  muscleGroups={exercise.exercise.muscle_groups}
                  workoutLogs={workoutLogs}
                  journalEntries={journalEntries}
                  completedSetsThisSession={exercise.sets
                    .filter((s) => s.completed && (s.actual_reps ?? 0) > 0)
                    .map((s) => ({ actual_reps: s.actual_reps ?? 0, weight_kg: s.actual_weight ?? 0 }))}
                  onApply={(weight_kg) => applyWeightToAllSets(exerciseIndex, weight_kg)}
                />
              )}
            </div>
          })}
        </div>

        {renderExerciseAdder('Need one more?', 'Add another exercise here without scrolling back to the top.')}

        {!isEditMode && (
          <>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Saved workout name</p>
                  <p className="text-xs text-muted-foreground">Default keeps today&apos;s date, but you can rename it before saving.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSaveRoutineName((current) => !current)}>
                  {showSaveRoutineName ? 'Hide' : 'Rename'}
                </Button>
              </div>
              {showSaveRoutineName && (
                <Input
                  className="mt-3"
                  value={saveRoutineName}
                  onChange={(e) => setSaveRoutineName(e.target.value)}
                  placeholder={`${workout.name} (${getTodayISO()})`}
                />
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="outline" className="w-full sm:min-w-[80px] sm:flex-1" onClick={onPause}>Pause</Button>
              <Button
                variant="outline"
                className="w-full gap-2 sm:flex-1"
                onClick={() => handleCompleteWorkout({ saveAsTemplate: true, templateName: saveRoutineName.trim() || `${workout.name} (${getTodayISO()})` })}
                disabled={isCompleting}
              >
                {isCompleting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving…</> : <><Copy className="h-4 w-4" /> Complete & Save Routine</>}
              </Button>
              <Button
                variant="brand"
                className="w-full gap-2 sm:flex-1"
                onClick={() => handleCompleteWorkout()}
                disabled={isCompleting}
              >
                {isCompleting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving…</> : <><Trophy className="h-4 w-4" /> Complete Workout</>}
              </Button>
            </div>
          </>
        )}
        {isEditMode && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="brand"
              className="w-full gap-2 sm:flex-1"
              onClick={() => handleCompleteWorkout()}
              disabled={isCompleting}
            >
              {isCompleting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Updating…</> : <><Pencil className="h-4 w-4" /> Update Workout</>}
            </Button>
          </div>
        )}
          </div>
        </div>
        {!isEditMode && (
          <WorkoutTimerBar
            durationSeconds={liveDurationSeconds}
            restSeconds={restRemainingSeconds}
            isTimerStarted={startedAt !== null}
            onStartTimer={() => setStartedAt(new Date().toISOString())}
            onSkipRest={() => setRestEndsAtMs(null)}
          />
        )}
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

function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url) return null

  const embedMatch = url.match(/youtube\.com\/embed\/([^?&/]+)/i)
  if (embedMatch?.[1]) return embedMatch[1]

  const watchMatch = url.match(/[?&]v=([^?&/]+)/i)
  if (watchMatch?.[1]) return watchMatch[1]

  const shortMatch = url.match(/youtu\.be\/([^?&/]+)/i)
  if (shortMatch?.[1]) return shortMatch[1]

  return null
}

function ExercisePreviewDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!exercise) { setVideos([]); setActiveId(null); return }
    const embeddedVideoId = extractYouTubeVideoId(exercise.video_url)

    setLoading(true)
    setActiveId(embeddedVideoId)
    fetch(`/api/youtube?q=${encodeURIComponent(exercise.name)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: YouTubeVideo[]) => {
        setVideos(data)
        if (data.length > 0) {
          setActiveId((current) => current ?? data[0].id)
        }
      })
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

        {!loading && !activeId && videos.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No short videos found.</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function WorkoutsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    workoutLogs,
    logWorkout,
    updateWorkoutLog,
    removeWorkoutLog,
    journalEntries,
    user,
    isDemoMode,
    customWorkouts,
    addCustomWorkout,
    updateCustomWorkout,
    removeCustomWorkout,
    setSocialComposerPrefill,
    updateProfile,
    syncNow,
  } = useAppStore()

  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null)
  const [tab, setTab] = useState<'log' | 'saved' | 'premade'>('log')
  const [runningWorkout, setRunningWorkout] = useState<Workout | null>(null)
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<PersistedActiveWorkoutSession | null>(null)
  const [didAutoResumeFromQuery, setDidAutoResumeFromQuery] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [editingLoggedWorkoutId, setEditingLoggedWorkoutId] = useState<string | null>(null)
  const [editingLoggedWorkoutSession, setEditingLoggedWorkoutSession] = useState<LoggedWorkoutEditSession | null>(null)
  const [remoteCustomWorkouts, setRemoteCustomWorkouts] = useState<Workout[]>([])
  const [savedWorkoutsLoading, setSavedWorkoutsLoading] = useState(false)
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false)
  const [draftSplit, setDraftSplit] = useState<WorkoutSplit>(user?.workout_split ?? 'ppl')
  const [draftSchedule, setDraftSchedule] = useState<SplitSchedule>(
    user?.split_schedule ?? buildDefaultSchedule(user?.workout_split ?? 'ppl')
  )
  const [splitSaving, setSplitSaving] = useState(false)

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
  const [loadingOlderHistory, setLoadingOlderHistory] = useState(false)
  const [manualAction, setManualAction] = useState<'log' | 'save'>('log')
  const [manualWorkoutName, setManualWorkoutName] = useState('')
  const [manualWorkoutDate, setManualWorkoutDate] = useState(getTodayISO())
  const [manualExercises, setManualExercises] = useState<EditableWorkoutExercise[]>([])
  const [pendingExercise, setPendingExercise] = useState<EditableWorkoutExercise | null>(null)
  const [manualSuggestionIndex, setManualSuggestionIndex] = useState(0)
  const unitSystem = user?.unit_system || 'imperial'
  const weightUnitLabel = getWeightUnitLabel(unitSystem)
  const showAcftKeyInstructions = user?.email?.toLowerCase() === ACFT_GUIDE_EMAIL
  const accountCustomWorkouts = useMemo(() => {
    if (isDemoMode) return customWorkouts

    const merged = new Map<string, Workout>()

    ;[...remoteCustomWorkouts, ...customWorkouts].forEach((workout) => {
      const existing = merged.get(workout.id)
      if (!existing) {
        merged.set(workout.id, workout)
        return
      }

      const existingUpdatedAt = new Date(existing.updated_at || 0).getTime()
      const workoutUpdatedAt = new Date(workout.updated_at || 0).getTime()
      if (workoutUpdatedAt >= existingUpdatedAt) {
        merged.set(workout.id, workout)
      }
    })

    return [...merged.values()].sort(
      (left, right) => new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    )
  }, [isDemoMode, remoteCustomWorkouts, customWorkouts])
  const shouldResumeFromQuery = searchParams.get('resume') === '1'

  const openPublishComposerForWorkout = useCallback((workout: Workout) => {
    setSocialComposerPrefill(buildSocialDraftFromWorkout(workout))
    router.push(`/dashboard/feed?compose=1&sourceKind=workout&sourceId=${encodeURIComponent(workout.id)}`)
  }, [router, setSocialComposerPrefill])

  const workoutLibrary = useMemo(() => [...accountCustomWorkouts, ...WORKOUTS.map((workout) => ({ ...workout, source: 'premade' as const }))], [accountCustomWorkouts])
  const todayRecommendedWorkouts = useMemo(() => {
    const todayDay = getTodayWeekDay()
    const schedule = user?.split_schedule ?? buildDefaultSchedule(user?.workout_split ?? 'ppl')
    const dayType = schedule[todayDay]
    if (!dayType || dayType === 'rest') return []
    return getWorkoutsForDayType(dayType, workoutLibrary)
  }, [user?.split_schedule, user?.workout_split, workoutLibrary])
  const todayWeekDay = getTodayWeekDay()
  const todaySplitDayType = (user?.split_schedule ?? buildDefaultSchedule(user?.workout_split ?? 'ppl'))[todayWeekDay]
  const splitPillLabel = todaySplitDayType ? SPLIT_DAY_LABELS[todaySplitDayType] : 'Set split'
  const linkedWorkoutRecoveryHeadsUp = useMemo(() => {
    if (todayRecommendedWorkouts.length === 0) return null

    const latestLinkedEntry = [...journalEntries]
      .filter((entry: JournalEntry) => entry.linked_item?.type === 'workout' && (entry.workout_id || entry.linked_item?.id))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0]

    if (!latestLinkedEntry) return null

    const linkedLog = workoutLogs.find((log) =>
      log.id === latestLinkedEntry.workout_id ||
      log.id === latestLinkedEntry.linked_item?.id ||
      log.workout_id === latestLinkedEntry.workout_id
    )

    if (!linkedLog) return null

    const overlapsToday = linkedLog.workout.muscle_groups.some((muscle) =>
      todayRecommendedWorkouts.some((workout) => workout.muscle_groups.includes(muscle))
    )

    if (!overlapsToday) return null

    if (latestLinkedEntry.energy <= 2 || latestLinkedEntry.mood <= 2) {
      return {
        tone: 'caution' as const,
        title: 'Recovery heads-up for today',
        detail: `${latestLinkedEntry.linked_item?.label || linkedLog.workout.name} was logged with ${latestLinkedEntry.energy}/5 energy and ${latestLinkedEntry.mood}/5 mood. Consider the lighter option or pull a little volume back.`,
      }
    }

    if (latestLinkedEntry.energy === 3 || latestLinkedEntry.mood === 3) {
      return {
        tone: 'steady' as const,
        title: 'Moderate effort signal',
        detail: `${latestLinkedEntry.linked_item?.label || linkedLog.workout.name} looked more middle-of-the-road in your journal. Today is probably best handled with solid execution over max intensity.`,
      }
    }

    return null
  }, [journalEntries, todayRecommendedWorkouts, workoutLogs])

  const openSplitDialog = () => {
    if (!user) return
    setDraftSplit(user.workout_split ?? 'ppl')
    setDraftSchedule(user.split_schedule ?? buildDefaultSchedule(user.workout_split ?? 'ppl'))
    setIsSplitDialogOpen(true)
  }

  const handleSplitSave = async () => {
    if (!user) return

    setSplitSaving(true)
    try {
      await updateProfile({ workout_split: draftSplit, split_schedule: draftSchedule })
      toast.success('Split schedule saved!')
      setIsSplitDialogOpen(false)
    } catch {
      toast.error('Could not save split schedule.')
    } finally {
      setSplitSaving(false)
    }
  }

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
    const filtered = accountCustomWorkouts.filter((w) => {
      if (savedWorkoutSplit !== 'all' && w.split_type !== savedWorkoutSplit) return false
      if (savedWorkoutMuscle !== 'all' && !w.muscle_groups.includes(savedWorkoutMuscle)) return false
      if (savedWorkoutSearch.trim()) {
        const q = savedWorkoutSearch.toLowerCase()
        if (!w.name.toLowerCase().includes(q) && !w.description.toLowerCase().includes(q)) return false
      }
      return true
    })

    if (!showAcftKeyInstructions) return filtered

    const completionTimes = new Map<string, number>()
    workoutLogs.forEach((log) => {
      const position = parseAcftWorkoutPosition(log.workout)
      if (!position) return

      const completedAt = log.completed_at || log.started_at
      const completionTime = completedAt ? new Date(completedAt).getTime() : 0
      if (!completionTime) return

      const existing = completionTimes.get(log.workout_id)
      if (existing === undefined || completionTime > existing) {
        completionTimes.set(log.workout_id, completionTime)
      }
    })

    return [...filtered].sort((left, right) => {
      const leftPosition = parseAcftWorkoutPosition(left)
      const rightPosition = parseAcftWorkoutPosition(right)

      if (!leftPosition && !rightPosition) {
        return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
      }

      if (!leftPosition) return -1
      if (!rightPosition) return 1

      const leftCompletedAt = completionTimes.get(left.id)
      const rightCompletedAt = completionTimes.get(right.id)
      const leftCompleted = leftCompletedAt !== undefined
      const rightCompleted = rightCompletedAt !== undefined

      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1
      }

      if (!leftCompleted && !rightCompleted) {
        return leftPosition.order - rightPosition.order
      }

      if (leftCompletedAt !== rightCompletedAt) {
        return (leftCompletedAt || 0) - (rightCompletedAt || 0)
      }

      return leftPosition.order - rightPosition.order
    })
  }, [accountCustomWorkouts, savedWorkoutSearch, savedWorkoutSplit, savedWorkoutMuscle, showAcftKeyInstructions, workoutLogs])

  const totalCaloriesBurned = workoutLogs.reduce((sum, log) => sum + (log.calories_burned_kcal || 0), 0)
  const todayLoggedWorkouts = workoutLogs.filter((log) => log.date === getTodayISO())

  const loadOlderWorkoutHistory = async () => {
    setLoadingOlderHistory(true)
    try {
      await syncNow({
        force: true,
        scopes: ['workouts', 'templates', 'journal'],
        profile: 'default',
      })
      toast.success('Loaded older workout history.')
    } catch {
      toast.error('Could not load older workout history.')
    } finally {
      setLoadingOlderHistory(false)
    }
  }
  const averageDurationByWorkoutId = useMemo(() => {
    const stats = new Map<string, { total: number; count: number }>()

    workoutLogs.forEach((log) => {
      if (!log.completed_at || typeof log.duration_min !== 'number' || log.duration_min <= 0) return

      const current = stats.get(log.workout_id) ?? { total: 0, count: 0 }
      current.total += log.duration_min
      current.count += 1
      stats.set(log.workout_id, current)
    })

    return new Map(
      [...stats.entries()].map(([workoutId, value]) => [workoutId, value.total / value.count])
    )
  }, [workoutLogs])

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
      startedAt: null,
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

  const handleActiveSessionExercisesChange = useCallback((exercises: ActiveExercise[], startedAt?: string | null) => {
    setActiveWorkoutSession((current) => {
      if (!current || !runningWorkout || current.workout.id !== runningWorkout.id) return current
      return {
        ...current,
        exercises,
        startedAt: startedAt === undefined ? current.startedAt : startedAt,
      }
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

  const updatePendingExerciseSetMetric = (metric: ExerciseSetMetric) => {
    setPendingExercise((current) => {
      if (!current) return current
      return {
        ...current,
        exercise: { ...current.exercise, set_metric: metric },
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
            set_number: getNextStandardSetNumber(current.sets),
            set_type: 'standard',
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

  const addDropSetToPendingExercise = () => {
    setPendingExercise((current) => {
      if (!current) return current
      const lastSet = current.sets[current.sets.length - 1]
      const sourceSetNumber = getDropSetSourceNumber(current.sets)
      return {
        ...current,
        sets: [
          ...current.sets,
          {
            set_number: sourceSetNumber,
            set_type: 'drop',
            drop_from_set_number: sourceSetNumber,
            drop_set_index: current.sets.filter((set) => set.set_type === 'drop' && set.drop_from_set_number === sourceSetNumber).length + 1,
            reps: lastSet?.reps ?? 10,
            weight_kg: getDropSetWeight(lastSet?.weight_kg),
            speed_mph: lastSet?.speed_mph,
            incline_pct: lastSet?.incline_pct,
            machine_level: lastSet?.machine_level,
            resistance_level: lastSet?.resistance_level,
            watts: lastSet?.watts,
            cadence_rpm: lastSet?.cadence_rpm,
            rest_seconds: 0,
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
        sets: normalizeSetNumbers(current.sets.filter((_, index) => index !== setIndex)),
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

  const updateManualExerciseSetMetric = (instanceId: string, metric: ExerciseSetMetric) => {
    setManualExercises((current) =>
      current.map((exercise) =>
        exercise.instanceId === instanceId
          ? {
              ...exercise,
              exercise: { ...exercise.exercise, set_metric: metric },
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
              set_number: getNextStandardSetNumber(exercise.sets),
              set_type: 'standard',
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

  const addDropSetToManualExercise = (instanceId: string) => {
    setManualExercises((current) =>
      current.map((exercise) => {
        if (exercise.instanceId !== instanceId) return exercise
        const lastSet = exercise.sets[exercise.sets.length - 1]
        const sourceSetNumber = getDropSetSourceNumber(exercise.sets)
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              set_number: sourceSetNumber,
              set_type: 'drop',
              drop_from_set_number: sourceSetNumber,
              drop_set_index: exercise.sets.filter((set) => set.set_type === 'drop' && set.drop_from_set_number === sourceSetNumber).length + 1,
              reps: lastSet?.reps ?? 10,
              weight_kg: getDropSetWeight(lastSet?.weight_kg),
              speed_mph: lastSet?.speed_mph,
              incline_pct: lastSet?.incline_pct,
              machine_level: lastSet?.machine_level,
              resistance_level: lastSet?.resistance_level,
              watts: lastSet?.watts,
              cadence_rpm: lastSet?.cadence_rpm,
              rest_seconds: 0,
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
          sets: normalizeSetNumbers(exercise.sets.filter((_, index) => index !== setIndex)),
        }
      })
    )
  }

  const buildWorkoutFromManual = () => {
    const normalizedExercises: WorkoutExercise[] = manualExercises.map((exercise) => ({
      exercise: exercise.exercise,
      sets: normalizeSetNumbers(exercise.sets).map((set) => ({
        set_number: set.set_number,
        set_type: set.set_type || 'standard',
        drop_from_set_number: set.drop_from_set_number,
        drop_set_index: set.drop_set_index,
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
      manualAction === 'save' || editingLoggedWorkoutId
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

    if ((manualAction === 'save' || editingLoggedWorkoutId) && !manualWorkoutName.trim()) {
      toast.error(editingLoggedWorkoutId ? 'Name the workout before updating it.' : 'Name the workout before saving it.')
      return
    }

    if (editingLoggedWorkoutId && !manualWorkoutDate) {
      toast.error('Choose a workout date before updating the log.')
      return
    }

    const existingLog = editingLoggedWorkoutId
      ? workoutLogs.find((log) => log.id === editingLoggedWorkoutId) ?? null
      : null
    const builtWorkout = buildWorkoutFromManual()
    const workout = editingLoggedWorkoutId && existingLog
      ? {
          ...builtWorkout,
          id: existingLog.workout_id || existingLog.workout.id,
        }
      : builtWorkout

    const logPayload = {
      id: existingLog?.id || `wl-${Date.now()}`,
      user_id: user.id,
      workout_id: workout.id,
      workout,
      date: editingLoggedWorkoutId ? manualWorkoutDate : getTodayISO(),
      started_at: editingLoggedWorkoutId
        ? applyWorkoutDateToTimestamp(
            manualWorkoutDate,
            existingLog?.started_at,
            new Date(Date.now() - Math.max(1, manualSummary.durationMin) * 60000),
          )
        : new Date(Date.now() - Math.max(1, manualSummary.durationMin) * 60000).toISOString(),
      completed_at: editingLoggedWorkoutId
        ? applyWorkoutDateToTimestamp(
            manualWorkoutDate,
            existingLog?.completed_at,
            new Date(),
          )
        : new Date().toISOString(),
      duration_min: manualSummary.durationMin,
      calories_burned_kcal: manualSummary.caloriesBurned,
      total_volume_kg: manualSummary.totalVolumeKg,
      exercises: workout.exercises.map((exercise) => ({
        exercise_id: exercise.exercise.id,
        exercise_name: exercise.exercise.name,
        sets: exercise.sets.map((set) => ({
          set_number: set.set_number,
          set_type: set.set_type || 'standard',
          drop_from_set_number: set.drop_from_set_number,
          drop_set_index: set.drop_set_index,
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
      rating: existingLog?.rating || (4 as 4),
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
      setManualWorkoutDate(getTodayISO())
      setManualExercises([])
      setEditingLoggedWorkoutId(null)
      setPendingExercise(null)
    })
  }

  const closeLoggedWorkoutEditor = (options?: { silent?: boolean }) => {
    setEditingLoggedWorkoutId(null)
    setEditingLoggedWorkoutSession(null)
    setManualAction('log')
    setManualWorkoutName('')
    setManualWorkoutDate(getTodayISO())
    setManualExercises([])
    setPendingExercise(null)
    setManualSearch('')
    if (!options?.silent) {
      toast.success('Closed workout editor.')
    }
  }

  const loadLoggedWorkoutForEdit = (logId: string) => {
    const target = workoutLogs.find((log) => log.id === logId)
    if (!target) return

    setEditingLoggedWorkoutId(logId)
    setEditingLoggedWorkoutSession({
      log: target,
      exercises: createActiveExercisesFromWorkoutLog(target),
    })
    toast.success('Opened completed workout editor.')
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

    const success = await removeCustomWorkout(workout.id)
    if (!success) {
      toast.error('Failed to remove saved workout.')
      return
    }

    if (!isDemoMode) {
      setRemoteCustomWorkouts((current) => current.filter((item) => item.id !== workout.id))
    }
    toast.success('Saved workout removed.')
  }

  if (!user) return null

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-3xl font-bold tracking-tight">Workouts</h2>
            <p className="text-sm text-muted-foreground">Log what you did today, then save it as a workout if you want to reuse it later.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-emerald-500/35 bg-emerald-500/8 px-4 text-sm font-semibold text-emerald-300 hover:border-emerald-400/45 hover:bg-emerald-500/12 hover:text-emerald-200"
              onClick={openSplitDialog}
            >
              <Zap className="mr-2 h-4 w-4" />
              <span className="truncate">{splitPillLabel}</span>
            </Button>
            <Button variant="outline" className="h-11 gap-2 rounded-full px-4" onClick={() => { setEditingWorkout(null); setBuilderOpen(true) }}>
              <Sparkles className="h-4 w-4" />
              Build Workout
            </Button>
          </div>
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

        {todayRecommendedWorkouts.length > 0 && (
          <div className="hidden space-y-1.5 md:block">
            <p className="text-xs text-muted-foreground">
              {WEEK_DAY_LABELS[todayWeekDay]} · <span className="font-medium text-foreground">{todaySplitDayType ? SPLIT_DAY_LABELS[todaySplitDayType] : ''} Day</span>
            </p>
            <TodayWorkoutBanner
              workouts={todayRecommendedWorkouts}
              onStart={startWorkout}
              onPreview={setPreviewWorkout}
            />
          </div>
        )}

        <div className="md:hidden">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {WEEK_DAY_LABELS[todayWeekDay]} · <span className="font-medium text-foreground">{todaySplitDayType ? SPLIT_DAY_LABELS[todaySplitDayType] : 'No split set'}</span>
            </p>
            {todayRecommendedWorkouts.length > 0 ? (
              <TodayWorkoutBanner
                workouts={todayRecommendedWorkouts}
                onStart={startWorkout}
                onPreview={setPreviewWorkout}
              />
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Recommended for today</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {todaySplitDayType === 'rest'
                    ? 'Today is marked as a rest day in your split.'
                    : todaySplitDayType
                      ? `No workouts match your ${SPLIT_DAY_LABELS[todaySplitDayType].toLowerCase()} day yet. Save one, build one, or adjust your split.`
                      : 'Set your training split to get workout recommendations here.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {linkedWorkoutRecoveryHeadsUp && (
          <div className={cn(
            'rounded-2xl border px-4 py-3',
            linkedWorkoutRecoveryHeadsUp.tone === 'caution'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-blue-500/30 bg-blue-500/10'
          )}>
            <p className="text-sm font-semibold">{linkedWorkoutRecoveryHeadsUp.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{linkedWorkoutRecoveryHeadsUp.detail}</p>
          </div>
        )}

        <Dialog open={isSplitDialogOpen} onOpenChange={setIsSplitDialogOpen}>
          <DialogContent className="max-w-lg border-border/60 bg-card/95 p-0 backdrop-blur sm:max-h-[85vh]">
            <DialogHeader className="border-b border-border/60 px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-emerald-400" />
                Workout Split Schedule
              </DialogTitle>
              <DialogDescription>
                Choose your training split and assign the workout type for each day.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 overflow-y-auto p-5">
              <div className="space-y-2">
                <Label>Training Split</Label>
                <Select
                  value={draftSplit}
                  onValueChange={(value) => {
                    const nextSplit = value as WorkoutSplit
                    setDraftSplit(nextSplit)
                    setDraftSchedule(buildDefaultSchedule(nextSplit))
                  }}
                >
                  <SelectTrigger className="border-border/60 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPLIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Weekly Schedule</Label>
                <div className="grid gap-2">
                  {WEEK_DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-12 shrink-0 text-xs font-medium',
                          day === todayWeekDay ? 'text-emerald-400' : 'text-muted-foreground'
                        )}
                      >
                        {WEEK_DAY_LABELS[day]}
                      </span>
                      <Select
                        value={draftSchedule[day as WeekDay] ?? 'rest'}
                        onValueChange={(value) => setDraftSchedule((prev) => ({ ...prev, [day]: value as SplitDayType }))}
                      >
                        <SelectTrigger className="h-9 border-border/60 bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPLIT_DAY_OPTIONS[draftSplit].map((option) => (
                            <SelectItem key={option} value={option} className="text-xs">
                              {SPLIT_DAY_LABELS[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsSplitDialogOpen(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSplitSave}
                disabled={splitSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {splitSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Schedule
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="hidden gap-3 md:grid md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
            <p className="font-data text-xl sm:text-2xl font-semibold">{todayLoggedWorkouts.reduce((sum, log) => sum + (log.calories_burned_kcal || 0), 0)}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Today&apos;s kcal burned</p>
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

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'log' | 'saved' | 'premade')}>
        <div className="overflow-x-auto border-b border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto min-w-max items-center gap-0 bg-transparent p-0">
            <TabsTrigger value="log" className="relative rounded-none border-0 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
              Log Workout
            </TabsTrigger>
            <TabsTrigger value="saved" className="relative rounded-none border-0 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
              Saved Workouts
            </TabsTrigger>
            <TabsTrigger value="premade" className="relative rounded-none border-0 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
              Premade Workouts
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
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="pl-9"
                    />
                    {manualSearch && (
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setManualSearch('')}>
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
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-muted-foreground">{workoutLogs.length} loaded</p>
                              <button
                                type="button"
                                onClick={() => void loadOlderWorkoutHistory()}
                                className="text-[10px] font-medium text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-50"
                                disabled={loadingOlderHistory}
                              >
                                {loadingOlderHistory ? 'Loading…' : 'Load older'}
                              </button>
                            </div>
                          </div>
                          {workoutLogs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((log) => {
                            const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0)
                            const isLogToday = log.date === getTodayISO()
                            const isExpanded = expandedLogId === log.id
                            const startedTime = formatWorkoutTime(log.started_at)
                            const finishedTime = formatWorkoutTime(log.completed_at)
                            const durationLabel = formatWorkoutDuration(log.started_at, log.completed_at, log.duration_min)
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
                                      {log.exercises.length} exercise{log.exercises.length !== 1 ? 's' : ''} · {totalSets} sets · {durationLabel}
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
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                          {[
                                            { label: 'Started', value: startedTime },
                                            { label: 'Finished', value: finishedTime },
                                            { label: 'Duration', value: durationLabel },
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
                                                          ? `${Math.round((set.weight_kg || 0) * 2.205)} lb`
                                                          : `${set.weight_kg} kg`
                                                        : null
                                                      return (
                                                        <div
                                                          key={set.set_number}
                                                          className={getDropSetRowClass(
                                                            'grid grid-cols-3 items-center text-xs rounded-lg border border-transparent px-2 py-1.5 bg-background/60',
                                                            set,
                                                          )}
                                                        >
                                                          <span className={cn('font-medium', getDropSetLabelClass(set))}>{getSetDisplayName(set)}</span>
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
                                  {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''} · {averageDurationByWorkoutId.has(w.id) ? formatAverageWorkoutTime(averageDurationByWorkoutId.get(w.id)) : 'Complete once to see time'} · <span className="capitalize">{w.difficulty}</span>
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
                      <div className="flex items-center gap-2">
                        <Select
                          value={getExerciseSetMetric(pendingExercise.exercise)}
                          onValueChange={(value) => updatePendingExerciseSetMetric(value as ExerciseSetMetric)}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue placeholder="Metric" />
                          </SelectTrigger>
                          <SelectContent>
                            {SET_METRIC_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon-sm" onClick={() => setPendingExercise(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                          <span>{getSetMetricLabel(pendingExercise.exercise, pendingExercise.exercise.name)}</span>
                          <span>{isAssistedPullExercise(pendingExercise.exercise) ? `Assistance (${weightUnitLabel})` : `Weight (${weightUnitLabel})`}</span>
                          <span>Rest Sec</span>
                          <span />
                        </div>
                      )}
                      {pendingExercise.sets.map((set, setIndex) => (
                        pendingMode === 'interval' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                            <Input type="number" min={1} value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 1 : Math.max(1, Number(e.target.value)))} placeholder="# intervals" />
                            <Input type="number" min={1} value={formatNumericInput(set.interval_duration_sec)} onChange={(e) => updatePendingSetField(setIndex, 'interval_duration_sec', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Work sec" />
                            <Input type="number" min={0} value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'treadmill' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updatePendingSetField(setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                            <Input type="number" value={formatNumericInput(set.incline_pct)} onChange={(e) => updatePendingSetField(setIndex, 'incline_pct', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Incline %" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'run_walk' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updatePendingSetField(setIndex, 'speed_mph', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Speed MPH" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'bike' || pendingMode === 'rower' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updatePendingSetField(setIndex, 'watts', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Watts" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : pendingMode === 'level_cardio' || pendingMode === 'basic_cardio' ? (
                          <div key={`${pendingExercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2">
                            <div className="flex items-center px-3 text-sm font-medium text-muted-foreground">{getSetDisplayName(set)}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Minutes" />
                            <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updatePendingSetField(setIndex, 'machine_level', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Level" />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <div
                            key={`${pendingExercise.instanceId}-${setIndex}`}
                            className={getDropSetRowClass('grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 rounded-xl border border-transparent px-2 py-2', set)}
                          >
                            <div className={cn('flex items-center px-3 text-sm font-medium', getDropSetLabelClass(set))}>{getSetDisplayName(set)}</div>
                            <Input type="number" value={formatNumericInput(set.reps)} onChange={(e) => updatePendingSetField(setIndex, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} placeholder={getSetMetricPlaceholder(pendingExercise.exercise, pendingExercise.exercise.name)} />
                            <Input type="number" value={formatWorkoutWeightInput(set.weight_kg, unitSystem)} onChange={(e) => updatePendingSetField(setIndex, 'weight_kg', parseWorkoutWeightInput(e.target.value, unitSystem))} placeholder={isAssistedPullExercise(pendingExercise.exercise) ? `Assistance (${weightUnitLabel})` : `Weight (${weightUnitLabel})`} />
                            <Input type="number" value={formatNumericInput(set.rest_seconds)} onChange={(e) => updatePendingSetField(setIndex, 'rest_seconds', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="Rest sec" />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeSetFromPendingExercise(setIndex)} disabled={pendingExercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        )
                      ))}
                    </div>
                  )
                })()}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addSetToPendingExercise}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {getExerciseInputMode(pendingExercise.exercise) === 'interval' ? 'Add round' : 'Add set'}
                      </Button>
                      {pendingMode === 'strength' && (
                        <Button type="button" size="sm" variant="outline" onClick={addDropSetToPendingExercise}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add drop set
                        </Button>
                      )}
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

                {(manualAction === 'save' || editingLoggedWorkoutId) && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label>{editingLoggedWorkoutId ? 'Workout name' : 'Saved workout name'}</Label>
                      <Input
                        value={manualWorkoutName}
                        onChange={(e) => setManualWorkoutName(e.target.value)}
                        placeholder={editingLoggedWorkoutId ? 'e.g. Upper body session' : 'e.g. Upper body pump'}
                      />
                    </div>
                    {editingLoggedWorkoutId && (
                      <div className="space-y-1.5">
                        <Label>Workout date</Label>
                        <Input
                          type="date"
                          value={manualWorkoutDate}
                          onChange={(e) => setManualWorkoutDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="brand" className="w-full" onClick={handleLogManualWorkout}>
                    {editingLoggedWorkoutId ? 'Update Logged Workout' : manualAction === 'save' ? 'Save Workout' : 'Log Workout'}
                  </Button>
                  {editingLoggedWorkoutId && (
                    <Button variant="outline" className="w-full" onClick={closeLoggedWorkoutEditor}>
                      Close Editor
                    </Button>
                  )}
                </div>
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
                          <Select
                            value={getExerciseSetMetric(exercise.exercise)}
                            onValueChange={(value) => updateManualExerciseSetMetric(exercise.instanceId, value as ExerciseSetMetric)}
                          >
                            <SelectTrigger className="h-8 w-[110px] text-xs">
                              <SelectValue placeholder="Metric" />
                            </SelectTrigger>
                            <SelectContent>
                              {SET_METRIC_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        <div className="overflow-x-auto">
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
                            <span>{getSetMetricLabel(exercise.exercise)}</span>
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
                              <span className="flex items-center font-data text-sm">{getSetDisplayName(set)}</span>
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
                              <span className="flex items-center font-data text-sm">{getSetDisplayName(set)}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.speed_mph)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'speed_mph', Number(e.target.value))} className="h-8 text-xs" placeholder="Speed MPH" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : inputMode === 'bike' || inputMode === 'rower' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{getSetDisplayName(set)}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.watts)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'watts', Number(e.target.value))} className="h-8 text-xs" placeholder="Watts" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : inputMode === 'level_cardio' || inputMode === 'basic_cardio' ? (
                            <div key={`${exercise.instanceId}-${setIndex}`} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 border-b border-border/30 px-3 py-2 last:border-b-0">
                              <span className="flex items-center font-data text-sm">{getSetDisplayName(set)}</span>
                              <Input type="number" value={set.reps} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))} className="h-8 text-xs" placeholder="Minutes" />
                              <Input type="number" value={formatNumericInput(set.machine_level)} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'machine_level', Number(e.target.value))} className="h-8 text-xs" placeholder="Level" />
                              <Input type="number" value={set.rest_seconds} onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'rest_seconds', Number(e.target.value))} className="h-8 text-xs" />
                              <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSetFromManualExercise(exercise.instanceId, setIndex)} disabled={exercise.sets.length <= 1}><X className="h-3.5 w-3.5" /></Button></div>
                            </div>
                          ) : (
                            <div
                              key={`${exercise.instanceId}-${setIndex}`}
                              className={getDropSetRowClass('grid grid-cols-5 gap-2 border-b border-border/30 px-3 py-2 last:border-b-0', set)}
                            >
                              <span className={cn('flex items-center font-data text-sm', getDropSetLabelClass(set))}>{getSetDisplayName(set)}</span>
                              <Input
                                type="number"
                                value={set.reps}
                                onChange={(e) => updateManualSetField(exercise.instanceId, setIndex, 'reps', Number(e.target.value))}
                                className="h-8 text-xs"
                                placeholder={getSetMetricPlaceholder(exercise.exercise)}
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
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => addSetToManualExercise(exercise.instanceId)}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add set
                        </Button>
                        {inputMode === 'strength' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => addDropSetToManualExercise(exercise.instanceId)}>
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add drop set
                          </Button>
                        )}
                      </div>
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
                {todayLoggedWorkouts.map((log) => {
                  const startedTime = formatWorkoutTime(log.started_at)
                  const finishedTime = formatWorkoutTime(log.completed_at)
                  const durationLabel = formatWorkoutDuration(log.started_at, log.completed_at, log.duration_min)

                  return (
                  <div key={log.id} className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{log.workout.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.exercises.length} exercises · {durationLabel} · {log.calories_burned_kcal || 0} kcal
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Started: <span className="font-medium text-foreground/85">{startedTime}</span></span>
                          <span>Finished: <span className="font-medium text-foreground/85">{finishedTime}</span></span>
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <Button variant="outline" size="sm" onClick={() => loadLoggedWorkoutForEdit(log.id)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => removeWorkoutLog(log.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )})}
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
              <p className="text-lg font-semibold">Saved workouts</p>
              <p className="mt-1 text-sm text-muted-foreground">Start a workout you already know, or edit it before you run it.</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => { setEditingWorkout(null); setBuilderOpen(true) }}>
              <Plus className="h-4 w-4" />
              Create Saved Workout
            </Button>
          </div>

          {showAcftKeyInstructions && (
            <Card className="border-primary/20 bg-primary/[0.04]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" />
                  ACFT Key Exercise Instructions
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quick reference for the 10-week ACFT saved workout plan.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {ACFT_KEY_INSTRUCTIONS.map((section) => (
                  <div key={section.title} className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-sm font-semibold">{section.title}</p>
                    <div className="mt-2 space-y-1">
                      {section.lines.map((line) => (
                        <p key={line} className="text-xs leading-relaxed text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      autoCapitalize="none"
                      autoCorrect="off"
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
                        {(['all', 'ppl', 'upper_lower', '3day_fullbody', '4day', '5day', '6day', 'cardio_focus', 'custom'] as const).map(s => (
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
                    <SavedWorkoutCard key={workout.id} workout={workout} averageDurationMin={averageDurationByWorkoutId.get(workout.id)} onStart={startWorkout} onPreview={setPreviewWorkout} onEdit={(item) => { setEditingWorkout(item); setBuilderOpen(true) }} onPublish={openPublishComposerForWorkout} onDelete={handleDeleteWorkout} />
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
        </TabsContent>

        <TabsContent value="premade" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">Premade workouts</p>
              <p className="mt-1 text-sm text-muted-foreground">Use these as-is or tweak one into your own saved workout.</p>
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
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  {premadeSearch && (
                    <button type="button" onClick={() => setPremadeSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
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
                              {([['all', 'All'], ['ppl', 'PPL'], ['upper_lower', 'Upper/Lower'], ['3day_fullbody', 'Full Body'], ['4day', '4-Day'], ['5day', 'Bro Split'], ['6day', '6-Day'], ['cardio_focus', 'Cardio'], ['custom', 'Custom']] as const).map(([val, label]) => (
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
                  <SavedWorkoutCard key={workout.id} workout={{ ...workout, source: 'premade' }} averageDurationMin={averageDurationByWorkoutId.get(workout.id)} onStart={startWorkout} onPreview={setPreviewWorkout} onEdit={(item) => { setEditingWorkout(item); setBuilderOpen(true) }} />
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
            journalEntries={journalEntries}
            initialExercises={activeWorkoutSession?.workout.id === runningWorkout.id ? activeWorkoutSession.exercises : undefined}
            initialStartedAt={activeWorkoutSession?.workout.id === runningWorkout.id ? activeWorkoutSession.startedAt : null}
            onClose={pauseRunningWorkout}
            onPause={pauseRunningWorkout}
            onSessionChange={handleActiveSessionExercisesChange}
            onComplete={async ({ exercises, caloriesBurned, totalVolumeKg, durationMin }, options) => {
              const completedAt = new Date().toISOString()
              const startedAt = activeWorkoutSession?.startedAt ?? completedAt
              const startedTime = new Date(startedAt).getTime()
              const completedTime = new Date(completedAt).getTime()
              const actualDurationMin = Number.isNaN(startedTime) || Number.isNaN(completedTime) || completedTime <= startedTime
                ? null
                : Math.max(1, Math.round((completedTime - startedTime) / 60000))
              const resolvedDurationMin = actualDurationMin ?? durationMin
              const performedExercises = normalizeActiveExercisesForWorkout(exercises)
              const performedMuscleGroups = Array.from(new Set(performedExercises.flatMap((exercise) => exercise.exercise.muscle_groups)))

              const performedWorkout: Workout = {
                ...runningWorkout,
                exercises: performedExercises,
                estimated_duration_min: resolvedDurationMin,
                muscle_groups: (performedMuscleGroups.length > 0 ? performedMuscleGroups : runningWorkout.muscle_groups) as Workout['muscle_groups'],
                updated_at: new Date().toISOString(),
              }

              logWorkout({
                id: `wl-${Date.now()}`,
                user_id: user.id,
                workout_id: runningWorkout.id,
                workout: performedWorkout,
                date: getTodayISO(),
                started_at: startedAt,
                completed_at: completedAt,
                duration_min: resolvedDurationMin,
                calories_burned_kcal: caloriesBurned,
                total_volume_kg: totalVolumeKg,
                exercises: exercises.map((exercise) => ({
                  exercise_id: exercise.exercise.id,
                  exercise_name: exercise.exercise.name,
                  sets: exercise.sets.map((set) => ({
                    set_number: set.set_number,
                    set_type: set.set_type || 'standard',
                    drop_from_set_number: set.drop_from_set_number,
                    drop_set_index: set.drop_set_index,
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
                const resolvedTemplateName = options.templateName?.trim() || `${runningWorkout.name} (${getTodayISO()})`
                const savedRoutine: Workout = {
                  ...performedWorkout,
                  id: `cw-${Date.now()}`,
                  name: resolvedTemplateName,
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

      <Dialog open={!!editingLoggedWorkoutSession} onOpenChange={(open) => { if (!open) closeLoggedWorkoutEditor({ silent: true }) }}>
        {editingLoggedWorkoutSession && (
          <ActiveWorkoutModal
            workout={editingLoggedWorkoutSession.log.workout}
            metProfile={getMetProfile(user)}
            unitSystem={unitSystem}
            workoutLogs={workoutLogs}
            journalEntries={journalEntries}
            initialExercises={editingLoggedWorkoutSession.exercises}
            onClose={closeLoggedWorkoutEditor}
            onPause={closeLoggedWorkoutEditor}
            onSessionChange={(exercises) => {
              setEditingLoggedWorkoutSession((current) => current ? { ...current, exercises } : current)
            }}
            mode="edit-log"
            lockedTiming={{
              date: editingLoggedWorkoutSession.log.date,
              startedAt: editingLoggedWorkoutSession.log.started_at,
              completedAt: editingLoggedWorkoutSession.log.completed_at,
              durationMin: editingLoggedWorkoutSession.log.duration_min,
            }}
            onComplete={({ exercises, caloriesBurned, totalVolumeKg }) => {
              const currentLog = editingLoggedWorkoutSession.log
              const performedExercises = normalizeActiveExercisesForWorkout(exercises)
              const performedMuscleGroups = Array.from(new Set(performedExercises.flatMap((exercise) => exercise.exercise.muscle_groups)))

              const performedWorkout: Workout = {
                ...currentLog.workout,
                exercises: performedExercises,
                muscle_groups: (performedMuscleGroups.length > 0 ? performedMuscleGroups : currentLog.workout.muscle_groups) as Workout['muscle_groups'],
                updated_at: new Date().toISOString(),
              }

              updateWorkoutLog(currentLog.id, {
                id: currentLog.id,
                user_id: currentLog.user_id,
                workout_id: currentLog.workout_id,
                workout: performedWorkout,
                date: currentLog.date,
                started_at: currentLog.started_at,
                completed_at: currentLog.completed_at,
                duration_min: currentLog.duration_min,
                calories_burned_kcal: caloriesBurned,
                total_volume_kg: totalVolumeKg,
                exercises: exercises.map((exercise) => ({
                  exercise_id: exercise.exercise.id,
                  exercise_name: exercise.exercise.name,
                  sets: exercise.sets.map((set) => ({
                    set_number: set.set_number,
                    set_type: set.set_type || 'standard',
                    drop_from_set_number: set.drop_from_set_number,
                    drop_set_index: set.drop_set_index,
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
                rating: currentLog.rating,
              })

              toast.success('Workout updated without changing the original logged time.')
              closeLoggedWorkoutEditor({ silent: true })
            }}
          />
        )}
      </Dialog>

      <WorkoutPreviewDialog
        workout={previewWorkout}
        averageDurationMin={previewWorkout ? averageDurationByWorkoutId.get(previewWorkout.id) : undefined}
        unitSystem={unitSystem}
        onClose={() => setPreviewWorkout(null)}
      />
      <ExercisePreviewDialog exercise={previewExercise} onClose={() => setPreviewExercise(null)} />
    </div>
  )
}
