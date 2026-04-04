'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'
import {
  Scale, Plus, Download,
  Target, Dumbbell, Flame, Zap, Trophy, Edit, Trash2, ChevronRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, BarChart, Bar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAppStore } from '@/store/useAppStore'
import { formatWeightForInput, formatWeightValue, getTodayISO, getWeightUnitLabel, kgToLbs, lbsToKg, percentage } from '@/lib/utils'
import { toast } from 'sonner'
import MuscleDistributionPanel from '@/components/tracking/MuscleDistributionPanel'

function TrackingEmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80">
        <Icon className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}

type ConnectedTrackingRecommendation = {
  title: string
  body: string
  supportingPoints: string[]
  status: string
  actionLabel: string
  actionHref: string
}

function buildTrackingRecommendation(args: {
  fitnessGoal: string
  avgCalories: number
  avgProtein: number
  calorieTarget: number
  proteinTarget: number
  workoutsThisWeek: number
  weightDeltaKg: number | null
  loggedNutritionDays: number
}) : ConnectedTrackingRecommendation {
  const {
    fitnessGoal,
    avgCalories,
    avgProtein,
    calorieTarget,
    proteinTarget,
    workoutsThisWeek,
    weightDeltaKg,
    loggedNutritionDays,
  } = args

  if (loggedNutritionDays < 4) {
    return {
      title: 'Build a better signal first',
      body: 'You need a few more logged nutrition days before Rivora can confidently connect intake to your weight trend.',
      supportingPoints: [
        'Log meals on at least 4 separate days',
        'Add one or two weigh-ins this week',
        'Then revisit the trend instead of changing targets early',
      ],
      status: 'Needs more data',
      actionLabel: 'Log Meals',
      actionHref: '/dashboard/meals',
    }
  }

  const calorieGap = calorieTarget - avgCalories
  const proteinGap = proteinTarget - avgProtein

  if (fitnessGoal === 'fat_loss' && weightDeltaKg != null && weightDeltaKg >= -0.15 && calorieGap < 200) {
    return {
      title: 'Your cut looks flatter than expected',
      body: 'Weight is not moving down much even though calories are fairly close to target. The next move is consistency, not a huge calorie change.',
      supportingPoints: [
        'Keep intake tighter across the next 7 days',
        'Watch for untracked extras and weekend drift',
        'Recheck the trend before lowering calories further',
      ],
      status: 'Stall risk',
      actionLabel: 'Review Meals',
      actionHref: '/dashboard/meals',
    }
  }

  if (fitnessGoal === 'muscle_gain' && weightDeltaKg != null && weightDeltaKg <= 0.05 && calorieGap > 150) {
    return {
      title: 'You probably need more consistent intake',
      body: 'Your recent weight trend is flat while average calories are still below target. The problem looks more like under-eating than training.',
      supportingPoints: [
        'Add one repeatable meal or shake daily',
        'Bring average intake closer to target before making other changes',
        'Let the scale trend update for 1 to 2 weeks',
      ],
      status: 'Under target',
      actionLabel: 'Open Meals',
      actionHref: '/dashboard/meals',
    }
  }

  if (proteinGap > 20) {
    return {
      title: 'Protein is the cleanest lever right now',
      body: `You are averaging about ${Math.round(avgProtein)} g against a ${proteinTarget} g goal. Bringing protein up is the most direct improvement available right now.`,
      supportingPoints: [
        'Aim to close the gap with one extra high-protein meal',
        'Prioritize protein earlier in the day',
        'Keep calories steady while you fix the macro split',
      ],
      status: 'Protein low',
      actionLabel: 'Open Meals',
      actionHref: '/dashboard/meals',
    }
  }

  if (workoutsThisWeek < 3 && fitnessGoal !== 'maintenance') {
    return {
      title: 'Training consistency is the bottleneck',
      body: `You have ${workoutsThisWeek} logged workout${workoutsThisWeek === 1 ? '' : 's'} this week. Right now, getting another session in will probably matter more than adjusting food.`,
      supportingPoints: [
        'Keep meals reasonably on target',
        'Log one more workout before making nutrition changes',
        'Use next week to judge whether progress re-accelerates',
      ],
      status: 'Training low',
      actionLabel: 'Log Workout',
      actionHref: '/dashboard/workouts',
    }
  }

  return {
    title: 'Your data is lining up well',
    body: 'Nutrition, training, and scale trend look coherent enough that you do not need a major adjustment right now.',
    supportingPoints: [
      'Keep your current calorie target steady',
      'Protect protein and workout consistency',
      'Judge progress from the next 1 to 2 weeks of trend data',
    ],
    status: 'On track',
    actionLabel: 'Review Tracking',
    actionHref: '/dashboard/tracking',
  }
}

function CustomTooltip({ active, payload, label, unitSystem }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value?.toFixed ? p.value.toFixed(1) : p.value}
          {p.name === 'weight' ? ` ${getWeightUnitLabel(unitSystem)}` : p.name === 'calories' ? ' kcal' : p.name === 'protein' ? 'g' : ''}
        </p>
      ))}
    </div>
  )
}

// Log weight dialog
function LogWeightDialog() {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [notes, setNotes] = useState('')
  const { addWeightEntry, user } = useAppStore()

  const handleLog = () => {
    if (!weight || isNaN(Number(weight))) {
      toast.error('Please enter a valid weight')
      return
    }
    
    const weightNumber = Number(weight)
    const weightKg = user?.unit_system === 'metric' ? weightNumber : lbsToKg(weightNumber)
    
    addWeightEntry({
      id: `we-${Date.now()}`,
      user_id: user!.id,
      date: getTodayISO(),
      weight_kg: weightKg,
      body_fat_pct: bodyFat ? Number(bodyFat) : undefined,
      notes: notes || undefined,
    })
    toast.success(`Weight logged: ${weight} ${getWeightUnitLabel(user?.unit_system || 'imperial')} 📊`)
    setOpen(false)
    setWeight('')
    setBodyFat('')
    setNotes('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Log Weight
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Today&apos;s Weight</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Weight ({getWeightUnitLabel(user?.unit_system || 'imperial')})</Label>
            <Input
              type="number"
              placeholder={user?.unit_system === 'metric' ? 'e.g. 80.5' : 'e.g. 177'}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              step={user?.unit_system === 'metric' ? 0.1 : 1}
              className="text-lg font-bold"
            />
            <p className="text-xs text-muted-foreground">
              Using {user?.unit_system === 'metric' ? 'kilograms' : 'pounds'} based on your settings
            </p>
            <p className="text-xs text-muted-foreground">
              Please enter your weight to {user?.fitness_goal === 'muscle_gain' ? 'gain muscle' : user?.fitness_goal === 'fat_loss' ? 'lose fat' : 'maintain weight'}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Body Fat % (optional)</Label>
            <Input
              type="number"
              placeholder="e.g. 18.5"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              step={0.1}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="Any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="w-full" variant="brand" onClick={handleLog}>Save Entry</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Edit weight dialog
function EditWeightDialog({ entry, open, setOpen }: { entry: any; open: boolean; setOpen: (open: boolean) => void }) {
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [notes, setNotes] = useState('')
  const { addWeightEntry, user } = useAppStore()

  useEffect(() => {
    if (entry) {
      setWeight(formatWeightForInput(entry.weight_kg, user?.unit_system || 'imperial'))
      setBodyFat(entry.body_fat_pct?.toString() || '')
      setNotes(entry.notes || '')
    }
  }, [entry, user?.unit_system])

  const handleUpdate = () => {
    if (!weight || isNaN(Number(weight))) {
      toast.error('Please enter a valid weight')
      return
    }
    
    const weightKg = user?.unit_system === 'metric' ? Number(weight) : lbsToKg(Number(weight))
    addWeightEntry({
      id: entry.id,
      user_id: user!.id,
      date: entry.date,
      weight_kg: weightKg,
      body_fat_pct: bodyFat ? Number(bodyFat) : undefined,
      notes: notes || undefined,
    })
    
    toast.success(`Weight updated: ${weight} ${getWeightUnitLabel(user?.unit_system || 'imperial')} 📊`)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Weight Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="weight">Weight ({getWeightUnitLabel(user?.unit_system || 'imperial')})</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={`Enter weight in ${getWeightUnitLabel(user?.unit_system || 'imperial')}`}
            />
            <p className="text-xs text-muted-foreground">
              Using {user?.unit_system === 'metric' ? 'kilograms' : 'pounds'} based on your settings
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-bodyfat">Body Fat % (optional)</Label>
            <Input
              id="edit-bodyfat"
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder="Enter body fat percentage"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleUpdate} className="flex-1">
              Update Weight
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function TrackingPage() {
  const { user, weightHistory, workoutLogs, getDailyTotals, removeWeightEntry } = useAppStore()
  const [timeRange, setTimeRange] = useState<'2w' | '1m' | '3m' | 'all'>('1m')
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [nutritionMetric, setNutritionMetric] = useState<'calories' | 'protein'>('calories')
  const [selectedPrExercise, setSelectedPrExercise] = useState<string | null>(null)

  const handleDeleteWeight = (id: string) => {
    if (confirm('Are you sure you want to delete this weight entry?')) {
      removeWeightEntry(id)
      toast.success('Weight entry deleted')
    }
  }

  const handleEditWeight = (entry: any) => {
    setEditingEntry(entry)
    setEditDialogOpen(true)
  }

  if (!user) return null

  const unitSystem = user.unit_system || 'imperial'

  // Filter weight data by range
  const now = new Date()
  const rangeMap: Record<string, number> = { '2w': 14, '1m': 30, '3m': 90, 'all': 9999 }
  const days = rangeMap[timeRange]
  const filteredWeight = weightHistory.filter((w) => {
    const d = new Date(w.date)
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= days
  }).sort((a, b) => a.date.localeCompare(b.date))

  // Weight chart data
  const weightChartData = filteredWeight.map((entry) => ({
    date: format(new Date(entry.date), 'MM/dd'),
    weight: unitSystem === 'metric' ? entry.weight_kg : kgToLbs(entry.weight_kg),
    bodyFat: entry.body_fat_pct,
  }))
  const weightValues = weightChartData.map((entry) => entry.weight)
  const bodyFatValues = weightChartData
    .map((entry) => entry.bodyFat)
    .filter((value): value is number => typeof value === 'number')
  const weightAxisDomain: [number, number] =
    weightValues.length > 0
      ? [Math.min(...weightValues) - 1, Math.max(...weightValues) + 1]
      : [0, 10]
  const bodyFatAxisDomain: [number, number] =
    bodyFatValues.length > 0
      ? [Math.max(0, Math.min(...bodyFatValues) - 1), Math.max(...bodyFatValues) + 1]
      : [0, 10]

  // Key weight stats
  const startWeight = filteredWeight[0]?.weight_kg || user.weight_kg
  const currentWeight = filteredWeight[filteredWeight.length - 1]?.weight_kg || user.weight_kg
  const weightChange = currentWeight - startWeight
  const weightChangeAbs = Math.abs(weightChange)
  const isLosing = weightChange < 0
  const projectedWeeksAtCurrentPace = user.fitness_goal === 'fat_loss'
    ? Math.abs(weightChange) > 0 ? Math.round(10 / (weightChangeAbs / (days / 7))) : 20
    : null

  const goalTimeframeLabel = user.goal_timeframe_weeks
    ? `${user.goal_timeframe_weeks} week target`
    : projectedWeeksAtCurrentPace
      ? `~${projectedWeeksAtCurrentPace} weeks at current pace`
      : 'On track'

  // Calorie history
  const calorieHistory = Array.from({ length: 14 }, (_, i) => {
    const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
    const totals = getDailyTotals(date)
    // Only include days where the user actually logged meals (calories > 0)
    if (totals.calories === 0) return null
    return {
      date: format(subDays(new Date(), 13 - i), 'MM/dd'),
      calories: totals.calories,
      protein: totals.protein_g,
      target: user.calorie_target,
      protein_target: user.protein_target_g,
    }
  }).filter(Boolean) as { date: string; calories: number; protein: number; target: number; protein_target: number }[]

  const workoutsThisWeek = workoutLogs.filter((workout) => {
    const workoutDate = new Date(workout.date)
    return (now.getTime() - workoutDate.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length

  const avgCalories = calorieHistory.length > 0
    ? calorieHistory.reduce((sum, day) => sum + day.calories, 0) / calorieHistory.length
    : 0
  const avgProtein = calorieHistory.length > 0
    ? calorieHistory.reduce((sum, day) => sum + day.protein, 0) / calorieHistory.length
    : 0

  const recentWeightWindow = filteredWeight.slice(-14)
  const recentWeightDeltaKg = recentWeightWindow.length >= 2
    ? recentWeightWindow[recentWeightWindow.length - 1].weight_kg - recentWeightWindow[0].weight_kg
    : null

  const connectedRecommendation = buildTrackingRecommendation({
    fitnessGoal: user.fitness_goal,
    avgCalories,
    avgProtein,
    calorieTarget: user.calorie_target,
    proteinTarget: user.protein_target_g,
    workoutsThisWeek,
    weightDeltaKg: recentWeightDeltaKg,
    loggedNutritionDays: calorieHistory.length,
  })

  const prProgressions = (() => {
    const byExercise = new Map<string, Array<{ isoDate: string; weightKg: number; workoutName: string }>>()

    workoutLogs.forEach((log) => {
      log.exercises.forEach((exercise) => {
        const bestSetWeight = exercise.sets.reduce((max, set) => Math.max(max, Number(set.weight_kg ?? 0)), 0)
        if (!Number.isFinite(bestSetWeight) || bestSetWeight <= 0) return

        const nextEntries = byExercise.get(exercise.exercise_name) ?? []
        nextEntries.push({
          isoDate: log.date,
          weightKg: bestSetWeight,
          workoutName: log.workout.name,
        })
        byExercise.set(exercise.exercise_name, nextEntries)
      })
    })

    return new Map(
      Array.from(byExercise.entries()).map(([exercise, entries]) => {
        const dedupedByDate = new Map<string, { isoDate: string; weightKg: number; workoutName: string }>()

        entries.forEach((entry) => {
          const existing = dedupedByDate.get(entry.isoDate)
          if (!existing || entry.weightKg >= existing.weightKg) {
            dedupedByDate.set(entry.isoDate, entry)
          }
        })

        const progression = Array.from(dedupedByDate.values())
          .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
          .map((entry) => ({
            ...entry,
            displayDate: format(new Date(entry.isoDate), 'MM/dd'),
            weight:
              unitSystem === 'metric'
                ? Math.round(entry.weightKg * 10) / 10
                : Math.round(kgToLbs(entry.weightKg) * 10) / 10,
          }))

        return [exercise, progression]
      })
    )
  })()

  const prs = Array.from(prProgressions.entries())
    .map(([exercise, progression]) => {
      if (progression.length < 2) return null

      let runningBest = progression[0].weightKg
      let latestPrEntry: (typeof progression)[number] | null = null

      for (let i = 1; i < progression.length; i += 1) {
        const entry = progression[i]
        if (entry.weightKg > runningBest) {
          runningBest = entry.weightKg
          latestPrEntry = entry
        }
      }

      if (!latestPrEntry) return null

      return {
        achievedAt: latestPrEntry.isoDate,
        weightKg: latestPrEntry.weightKg,
        exercise,
        weight: formatWeightValue(latestPrEntry.weightKg, unitSystem),
        date: format(new Date(latestPrEntry.isoDate), 'MMM d, yyyy'),
        // A PR is only "new" if it beat an existing baseline and happened recently.
        new: (new Date().getTime() - new Date(latestPrEntry.isoDate).getTime()) < 7 * 24 * 60 * 60 * 1000,
      }
    })
    .filter((pr): pr is {
      achievedAt: string
      weightKg: number
      exercise: string
      weight: string
      date: string
      new: boolean
    } => pr !== null)
    .sort((a, b) => {
      if (a.new !== b.new) return Number(b.new) - Number(a.new)
      if (a.achievedAt !== b.achievedAt) return b.achievedAt.localeCompare(a.achievedAt)
      return b.weightKg - a.weightKg
    })
    .map((pr, index) => ({
      ...pr,
      rank: index + 1,
    }))

  const resolvedSelectedPrExercise =
    selectedPrExercise && prs.some((pr) => pr.exercise === selectedPrExercise)
      ? selectedPrExercise
      : null

  const selectedPr = prs.find((pr) => pr.exercise === resolvedSelectedPrExercise) ?? null
  const selectedPrProgress = selectedPr ? (prProgressions.get(selectedPr.exercise) ?? []) : []
  const selectedPrFirstWeight = selectedPrProgress[0]?.weight
  const selectedPrLatestWeight = selectedPrProgress[selectedPrProgress.length - 1]?.weight
  const selectedPrDelta =
    selectedPrFirstWeight != null && selectedPrLatestWeight != null
      ? Math.round((selectedPrLatestWeight - selectedPrFirstWeight) * 10) / 10
      : null
  const topPrByWeight = prs.reduce<(typeof prs)[number] | null>((best, pr) => {
    if (!best || pr.weightKg > best.weightKg) return pr
    return best
  }, null)

  const handleExport = () => {
    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')

    const createLineChartSvg = ({
      data,
      stroke,
      fillId,
      fillFrom,
      fillTo,
      ySuffix = '',
    }: {
      data: Array<{ label: string; value: number }>
      stroke: string
      fillId: string
      fillFrom: string
      fillTo: string
      ySuffix?: string
    }) => {
      if (data.length < 2) {
        return '<div class="chart-empty">Not enough data to draw this chart yet.</div>'
      }

      const width = 760
      const height = 270
      const padding = { top: 18, right: 18, bottom: 38, left: 48 }
      const rawValues = data.map((point) => point.value)
      const rawMin = Math.min(...rawValues)
      const rawMax = Math.max(...rawValues)
      const spread = rawMax - rawMin
      const yPadding = spread === 0 ? Math.max(rawMax * 0.08, 1) : spread * 0.18
      const min = Math.max(0, rawMin - yPadding)
      const max = rawMax + yPadding
      const xRange = width - padding.left - padding.right
      const yRange = height - padding.top - padding.bottom
      const toX = (index: number) =>
        padding.left + (data.length === 1 ? xRange / 2 : (index / (data.length - 1)) * xRange)
      const toY = (value: number) =>
        padding.top + (max === min ? yRange / 2 : ((max - value) / (max - min)) * yRange)

      const points = data.map((point, index) => ({
        ...point,
        index,
        x: toX(index),
        y: toY(point.value),
      }))
      const labelStep = Math.max(1, Math.ceil(data.length / 6))
      const minValue = Math.min(...rawValues)
      const maxValue = Math.max(...rawValues)
      const shouldShowPointLabel = (index: number, value: number) =>
        data.length <= 8
        || index === 0
        || index === data.length - 1
        || value === minValue
        || value === maxValue
        || index % labelStep === 0
      const shouldShowAxisLabel = (index: number) =>
        index === 0 || index === data.length - 1 || index % labelStep === 0

      const linePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ')
      const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`

      const ticks = Array.from({ length: 4 }, (_, index) => {
        const value = min + ((max - min) / 3) * index
        const y = toY(value)
        return { value, y }
      })

      return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Trend chart">
          <defs>
            <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${fillFrom}" stop-opacity="0.30" />
              <stop offset="100%" stop-color="${fillTo}" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          ${ticks.map((tick) => `
            <g>
              <line x1="${padding.left}" y1="${tick.y.toFixed(2)}" x2="${width - padding.right}" y2="${tick.y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 6" />
              <text x="${padding.left - 10}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end" fill="rgba(245,247,246,0.48)" font-size="11">${Math.round(tick.value)}${ySuffix}</text>
            </g>
          `).join('')}
          <path d="${areaPath}" fill="url(#${fillId})" />
          <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map((point) => `
            <g>
              ${shouldShowPointLabel(point.index, point.value) ? `
              <text
                x="${point.x.toFixed(2)}"
                y="${(point.y - 14).toFixed(2)}"
                text-anchor="middle"
                fill="#f5f7f6"
                font-size="11"
                font-weight="700"
              >${point.value % 1 === 0 ? point.value.toFixed(0) : point.value.toFixed(1)}${ySuffix}</text>` : ''}
              <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" fill="${stroke}" />
              <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="8" fill="${stroke}" fill-opacity="0.16" />
              ${shouldShowAxisLabel(point.index) ? `<text x="${point.x.toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="rgba(245,247,246,0.58)" font-size="11">${escapeHtml(point.label)}</text>` : ''}
            </g>
          `).join('')}
        </svg>
      `
    }

    const createBarChartSvg = ({
      data,
      barColor,
      targetColor,
    }: {
      data: Array<{ label: string; value: number; target: number }>
      barColor: string
      targetColor: string
    }) => {
      if (data.length === 0) {
        return '<div class="chart-empty">No nutrition history has been logged yet.</div>'
      }

      const width = 760
      const height = 270
      const padding = { top: 18, right: 18, bottom: 38, left: 48 }
      const max = Math.max(...data.map((point) => Math.max(point.value, point.target)), 1) * 1.12
      const chartWidth = width - padding.left - padding.right
      const chartHeight = height - padding.top - padding.bottom
      const groupWidth = chartWidth / data.length
      const barWidth = Math.min(34, groupWidth * 0.58)
      const toY = (value: number) => padding.top + ((max - value) / max) * chartHeight
      const labelStep = Math.max(1, Math.ceil(data.length / 6))
      const shouldShowLabel = (index: number) =>
        data.length <= 8 || index === 0 || index === data.length - 1 || index % labelStep === 0

      const ticks = Array.from({ length: 4 }, (_, index) => {
        const value = (max / 3) * index
        const y = toY(value)
        return { value, y }
      })

      return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Bar chart">
          ${ticks.map((tick) => `
            <g>
              <line x1="${padding.left}" y1="${tick.y.toFixed(2)}" x2="${width - padding.right}" y2="${tick.y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 6" />
              <text x="${padding.left - 10}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end" fill="rgba(245,247,246,0.48)" font-size="11">${Math.round(tick.value)}</text>
            </g>
          `).join('')}
          ${data.map((point, index) => {
            const centerX = padding.left + groupWidth * index + groupWidth / 2
            const barHeight = Math.max(6, ((point.value / max) * chartHeight))
            const barY = height - padding.bottom - barHeight
            const targetY = toY(point.target)
            return `
              <g>
                ${shouldShowLabel(index) ? `
                <text
                  x="${centerX.toFixed(2)}"
                  y="${Math.max(padding.top + 12, barY - 8).toFixed(2)}"
                  text-anchor="middle"
                  fill="#f5f7f6"
                  font-size="11"
                  font-weight="700"
                >${Math.round(point.value)}</text>` : ''}
                <rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${barY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="10" fill="${barColor}" />
                <line x1="${(centerX - barWidth / 2 - 6).toFixed(2)}" y1="${targetY.toFixed(2)}" x2="${(centerX + barWidth / 2 + 6).toFixed(2)}" y2="${targetY.toFixed(2)}" stroke="${targetColor}" stroke-width="2.5" stroke-linecap="round" />
                ${shouldShowLabel(index) ? `<text x="${centerX.toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="rgba(245,247,246,0.58)" font-size="11">${escapeHtml(point.label)}</text>` : ''}
              </g>
            `
          }).join('')}
        </svg>
      `
    }

    const weightRows = [...filteredWeight]
      .reverse()
      .map((entry) => `
        <tr>
          <td>${escapeHtml(format(new Date(entry.date), 'MMM d, yyyy'))}</td>
          <td>${escapeHtml(formatWeightValue(entry.weight_kg, unitSystem))}</td>
          <td>${entry.body_fat_pct != null ? `${entry.body_fat_pct}%` : '—'}</td>
          <td>${entry.notes ? escapeHtml(entry.notes) : '—'}</td>
        </tr>
      `)
      .join('')

    const calorieRows = calorieHistory
      .map((day) => `
        <tr>
          <td>${escapeHtml(day.date)}</td>
          <td>${day.calories.toLocaleString()} kcal</td>
          <td>${day.protein}g</td>
          <td>${day.target.toLocaleString()} kcal</td>
          <td>${day.protein_target}g</td>
        </tr>
      `)
      .join('')

    const workoutRows = [...workoutLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((workout) => {
        const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
        return `
          <tr>
            <td>${escapeHtml(format(new Date(workout.date), 'MMM d, yyyy'))}</td>
            <td>${escapeHtml(workout.workout.name)}</td>
            <td>${workout.exercises.length}</td>
            <td>${totalSets}</td>
            <td>${workout.duration_min || 0} min</td>
            <td>${workout.calories_burned_kcal || 0} kcal</td>
          </tr>
        `
      })
      .join('')

    const prRows = prs
      .map((pr) => `
        <tr>
          <td>${escapeHtml(pr.exercise)}</td>
          <td>${escapeHtml(pr.weight)}</td>
          <td>${escapeHtml(pr.date)}</td>
          <td>${pr.new ? 'New this week' : 'Tracked PR'}</td>
        </tr>
      `)
      .join('')

    const weightTrendChart = createLineChartSvg({
      data: weightChartData.map((point) => ({ label: point.date, value: point.weight })),
      stroke: '#21c58f',
      fillId: 'weightTrendFill',
      fillFrom: '#21c58f',
      fillTo: '#21c58f',
      ySuffix: unitSystem === 'metric' ? 'kg' : 'lb',
    })

    const calorieTrendChart = createBarChartSvg({
      data: calorieHistory.map((point) => ({
        label: point.date,
        value: point.calories,
        target: point.target,
      })),
      barColor: '#21c58f',
      targetColor: '#fbbf24',
    })

    const proteinTrendChart = createLineChartSvg({
      data: calorieHistory.map((point) => ({
        label: point.date,
        value: point.protein,
      })),
      stroke: '#60a5fa',
      fillId: 'proteinTrendFill',
      fillFrom: '#60a5fa',
      fillTo: '#60a5fa',
      ySuffix: 'g',
    })

    const reportHtml = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Rivora Progress Report</title>
          <style>
            :root {
              color-scheme: dark;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 32px;
              font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #07110f;
              color: #f5f7f6;
            }
            .report {
              max-width: 1100px;
              margin: 0 auto;
            }
            .hero {
              padding: 28px;
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 24px;
              background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(255,255,255,0.03));
            }
            .eyebrow {
              margin: 0 0 12px;
              font-size: 12px;
              letter-spacing: 0.26em;
              text-transform: uppercase;
              color: #7ee7c4;
            }
            h1, h2, h3, p {
              margin: 0;
            }
            h1 {
              font-size: 36px;
              line-height: 1;
              margin-bottom: 12px;
            }
            .hero-meta {
              margin-top: 18px;
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .stat {
              padding: 16px;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 18px;
              background: rgba(7, 12, 11, 0.65);
            }
            .stat-label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.18em;
              color: rgba(245,247,246,0.58);
            }
            .stat-value {
              margin-top: 10px;
              font-size: 28px;
              font-weight: 700;
            }
            .sections {
              display: grid;
              gap: 18px;
              margin-top: 20px;
            }
            .chart-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
            }
            .chart-panel {
              padding: 16px;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 18px;
              background: rgba(7,12,11,0.55);
            }
            .chart-panel.wide {
              grid-column: 1 / -1;
            }
            .chart-title {
              font-size: 15px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .chart-sub {
              color: rgba(245,247,246,0.58);
              font-size: 13px;
              line-height: 1.5;
              margin-bottom: 12px;
            }
            .chart-svg {
              width: 100%;
              height: auto;
              display: block;
            }
            .chart-empty {
              padding: 22px;
              border: 1px dashed rgba(255,255,255,0.12);
              border-radius: 16px;
              color: rgba(245,247,246,0.58);
              text-align: center;
              font-size: 13px;
            }
            .card {
              padding: 22px;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 22px;
              background: rgba(255,255,255,0.03);
            }
            .card h2 {
              font-size: 20px;
              margin-bottom: 6px;
            }
            .card-sub {
              color: rgba(245,247,246,0.66);
              margin-bottom: 16px;
              line-height: 1.6;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              text-align: left;
              padding: 12px 10px;
              border-bottom: 1px solid rgba(255,255,255,0.08);
              vertical-align: top;
            }
            th {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.18em;
              color: rgba(245,247,246,0.58);
            }
            td {
              font-size: 14px;
              color: #f5f7f6;
            }
            .bullets {
              margin: 14px 0 0;
              padding-left: 18px;
              color: rgba(245,247,246,0.76);
            }
            .bullets li + li {
              margin-top: 8px;
            }
            .empty {
              padding: 18px;
              border: 1px dashed rgba(255,255,255,0.12);
              border-radius: 18px;
              color: rgba(245,247,246,0.58);
            }
            @media (max-width: 820px) {
              body {
                padding: 18px;
              }
              h1 {
                font-size: 28px;
              }
              .hero-meta {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
              .chart-grid {
                grid-template-columns: 1fr;
              }
              .chart-panel.wide {
                grid-column: auto;
              }
              th, td {
                padding: 10px 8px;
                font-size: 13px;
              }
            }
          </style>
        </head>
        <body>
          <div class="report">
            <section class="hero">
              <p class="eyebrow">Rivora Progress Report</p>
              <h1>${escapeHtml(user.name)}</h1>
              <p>Exported on ${escapeHtml(format(new Date(), 'MMMM d, yyyy'))}. This report summarizes your current weight trend, nutrition history, workout activity, and coaching recommendation in a readable format.</p>
              <div class="hero-meta">
                <div class="stat">
                  <p class="stat-label">Current weight</p>
                  <p class="stat-value">${escapeHtml(formatWeightValue(currentWeight, unitSystem))}</p>
                </div>
                <div class="stat">
                  <p class="stat-label">Goal</p>
                  <p class="stat-value">${escapeHtml(user.fitness_goal.replaceAll('_', ' '))}</p>
                </div>
                <div class="stat">
                  <p class="stat-label">Workouts this week</p>
                  <p class="stat-value">${workoutsThisWeek}</p>
                </div>
                <div class="stat">
                  <p class="stat-label">Avg daily calories</p>
                  <p class="stat-value">${Math.round(avgCalories).toLocaleString()}</p>
                </div>
              </div>
            </section>

            <div class="sections">
              <section class="card">
                <p class="eyebrow">Connected Recommendation</p>
                <h2>${escapeHtml(connectedRecommendation.title)}</h2>
                <p class="card-sub">${escapeHtml(connectedRecommendation.body)}</p>
                <ul class="bullets">
                  ${connectedRecommendation.supportingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
                </ul>
              </section>

              <section class="card">
                <p class="eyebrow">Trend Charts</p>
                <h2>Visual snapshots</h2>
                <p class="card-sub">A readable export of your main tracking graphs so you can review progress without digging through raw data.</p>
                <div class="chart-grid">
                  <div class="chart-panel wide">
                    <p class="chart-title">Weight trend</p>
                    <p class="chart-sub">Recent weigh-ins over the selected tracking range.</p>
                    ${weightTrendChart}
                  </div>
                  <div class="chart-panel">
                    <p class="chart-title">Daily calories vs target</p>
                    <p class="chart-sub">Logged calorie intake with your target marked in gold.</p>
                    ${calorieTrendChart}
                  </div>
                  <div class="chart-panel">
                    <p class="chart-title">Protein trend</p>
                    <p class="chart-sub">Recent protein intake across logged nutrition days.</p>
                    ${proteinTrendChart}
                  </div>
                </div>
              </section>

              <section class="card">
                <p class="eyebrow">Weight History</p>
                <h2>Logged weigh-ins</h2>
                <p class="card-sub">Your recorded weights${unitSystem === 'metric' ? ' in kilograms' : ' in pounds'} with optional body-fat notes.</p>
                ${weightRows
                  ? `<table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Weight</th>
                          <th>Body Fat</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>${weightRows}</tbody>
                    </table>`
                  : '<div class="empty">No weight entries have been logged yet.</div>'}
              </section>

              <section class="card">
                <p class="eyebrow">Nutrition History</p>
                <h2>Recent daily intake</h2>
                <p class="card-sub">Days where meals were actually logged, along with calorie and protein targets.</p>
                ${calorieRows
                  ? `<table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Calories</th>
                          <th>Protein</th>
                          <th>Calorie Target</th>
                          <th>Protein Target</th>
                        </tr>
                      </thead>
                      <tbody>${calorieRows}</tbody>
                    </table>`
                  : '<div class="empty">No meal history is available yet.</div>'}
              </section>

              <section class="card">
                <p class="eyebrow">Workout History</p>
                <h2>Logged sessions</h2>
                <p class="card-sub">Your recorded workouts with session length, exercise count, set count, and estimated calories burned.</p>
                ${workoutRows
                  ? `<table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Workout</th>
                          <th>Exercises</th>
                          <th>Sets</th>
                          <th>Duration</th>
                          <th>Calories</th>
                        </tr>
                      </thead>
                      <tbody>${workoutRows}</tbody>
                    </table>`
                  : '<div class="empty">No workouts have been logged yet.</div>'}
              </section>

              <section class="card">
                <p class="eyebrow">Personal Records</p>
                <h2>Strength highlights</h2>
                <p class="card-sub">Top personal records pulled from your logged workout sets.</p>
                ${prRows
                  ? `<table>
                      <thead>
                        <tr>
                          <th>Exercise</th>
                          <th>Best Weight</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>${prRows}</tbody>
                    </table>`
                  : '<div class="empty">No weight-based personal records are available yet.</div>'}
              </section>
            </div>
          </div>
        </body>
      </html>
    `

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rivora-progress-report-${format(new Date(), 'yyyy-MM-dd')}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Progress report exported!')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Progress Tracking</h2>
          <p className="text-muted-foreground text-sm hidden sm:block">Visualize your transformation over time</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export Data
          </Button>
          <LogWeightDialog />
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Current Weight',
            value: formatWeightValue(currentWeight, unitSystem),
            sub: `${isLosing ? '↓' : '↑'} ${formatWeightValue(weightChangeAbs, unitSystem)} vs start`,
            icon: Scale,
          },
          {
            label: 'Goal',
            value: user.fitness_goal.replace('_', ' '),
            sub: goalTimeframeLabel,
            icon: Target,
          },
          {
            label: 'Workouts Logged',
            value: workoutLogs.length.toString(),
            sub: `${workoutsThisWeek} this week`,
            icon: Dumbbell,
          },
          {
            label: 'Avg Daily Calories',
            value: calorieHistory.length > 0
              ? Math.round(calorieHistory.reduce((a, c) => a + c.calories, 0) / calorieHistory.length).toLocaleString()
              : '—',
            sub: calorieHistory.length > 0 ? `Target: ${user.calorie_target.toLocaleString()} kcal` : 'No meals logged yet',
            icon: Flame,
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover-lift">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-xl font-bold capitalize tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts */}
      <Tabs defaultValue="workouts">
        <div className="mb-4">
          <TabsList>
            <TabsTrigger value="workouts">Workouts</TabsTrigger>
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="prs">Personal Records</TabsTrigger>
          </TabsList>
        </div>

        {/* Weight tab */}
        <TabsContent value="weight">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Weight Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={weightChartData} margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          interval={Math.floor(weightChartData.length / 6)}
                          padding={{ left: 4, right: 16 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          domain={weightAxisDomain}
                          tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                          width={38}
                        />
                        <Tooltip content={<CustomTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                        <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} fill="url(#wt-grad)" dot={false} name="weight" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Body Fat % Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={weightChartData.filter(d => d.bodyFat)} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(weightChartData.length / 6)} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          domain={bodyFatAxisDomain}
                          tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                          width={42}
                        />
                        <Tooltip content={<CustomTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                        <Line type="monotone" dataKey="bodyFat" stroke="#10b981" strokeWidth={2} dot={false} name="bodyFat" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weight log table */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weight Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...filteredWeight].reverse().slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted-foreground">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                    <div className="flex items-center gap-4">
                      {entry.body_fat_pct && (
                        <span className="text-xs text-amber-400">{entry.body_fat_pct.toFixed(1)}% BF</span>
                      )}
                      <span className="font-semibold">{formatWeightValue(entry.weight_kg, unitSystem)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditWeight(entry)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWeight(entry.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nutrition tab */}
        <TabsContent value="nutrition">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm">
                  Daily {nutritionMetric === 'calories' ? 'Calories' : 'Protein'} (Last 14 Days)
                </CardTitle>
                <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => setNutritionMetric('calories')}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      nutritionMetric === 'calories'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Calories
                  </button>
                  <button
                    type="button"
                    onClick={() => setNutritionMetric('protein')}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      nutritionMetric === 'protein'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Protein
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {calorieHistory.length === 0 ? (
                <TrackingEmptyState
                  icon={nutritionMetric === 'calories' ? Flame : Zap}
                  title={nutritionMetric === 'calories' ? 'No nutrition data yet' : 'No protein data yet'}
                  body={nutritionMetric === 'calories'
                    ? 'Log meals for a few days and this chart will turn into a real intake trend against your target.'
                    : 'Once you start logging meals, Rivora will show how closely your protein intake matches your target.'}
                >
                  <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                    <a href="/dashboard/meals">{nutritionMetric === 'calories' ? 'Open Meals' : 'Start Logging Meals'}</a>
                  </Button>
                </TrackingEmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={calorieHistory} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                    <ReferenceLine
                      y={nutritionMetric === 'calories' ? user.calorie_target : user.protein_target_g}
                      stroke="#f59e0b"
                      strokeDasharray="4 2"
                      label={{ value: 'Target', position: 'right', fontSize: 10 }}
                    />
                    <Bar
                      dataKey={nutritionMetric}
                      fill={nutritionMetric === 'calories' ? '#10b981' : '#0ea5e9'}
                      opacity={0.85}
                      radius={[3, 3, 0, 0]}
                      name={nutritionMetric}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 border-primary/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.07),rgba(255,255,255,0.02))]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Connected Recommendation</p>
                    <Badge variant="outline" className="border-primary/20 bg-background/70 text-[10px]">
                      {connectedRecommendation.status}
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{connectedRecommendation.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{connectedRecommendation.body}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {connectedRecommendation.supportingPoints.map((point) => (
                      <div key={point} className="rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                        {point}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:w-[280px]">
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Read From Your Data</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Calorie adherence</span>
                          <span className="font-medium">{percentage(Math.round(avgCalories), user.calorie_target)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.min(percentage(Math.round(avgCalories), user.calorie_target), 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Protein adherence</span>
                          <span className="font-medium">{percentage(Math.round(avgProtein), user.protein_target_g)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/80 transition-all duration-300" style={{ width: `${Math.min(percentage(Math.round(avgProtein), user.protein_target_g), 100)}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                          <p className="text-muted-foreground">Workouts</p>
                          <p className="mt-1 font-medium text-foreground">{workoutsThisWeek} this week</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                          <p className="text-muted-foreground">Weight trend</p>
                          <p className="mt-1 font-medium text-foreground">
                            {recentWeightDeltaKg == null
                              ? 'Not enough data'
                              : `${recentWeightDeltaKg < 0 ? 'Down' : 'Up'} ${formatWeightValue(Math.abs(recentWeightDeltaKg), unitSystem)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-1.5">
                      <Link href={connectedRecommendation.actionHref}>
                        {connectedRecommendation.actionLabel}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRs tab */}
        <TabsContent value="prs">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-sm">Personal Records</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Recent and strongest logged PRs, with a tap-to-view progress chart for each lift.</p>
                </div>
                {prs.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:w-auto">
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-center">
                      <p className="font-data text-lg font-semibold">{prs.length}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Tracked</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-center">
                      <p className="font-data text-lg font-semibold">{prs.filter((pr) => pr.new).length}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">This Week</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-center">
                      <p className="font-data text-lg font-semibold">{topPrByWeight?.weight ?? '—'}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Top Lift</p>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {prs.length === 0 ? (
                <TrackingEmptyState
                  icon={Trophy}
                  title="No personal records yet"
                  body="A lift shows up here once you repeat it and beat your previous best weight."
                >
                  <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                    <a href="/dashboard/workouts">Open Workouts</a>
                  </Button>
                </TrackingEmptyState>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-3">
                    {prs.map((pr) => (
                      <div
                        key={`${pr.exercise}-${pr.date}`}
                        className={`w-full rounded-2xl border bg-gradient-to-r p-4 text-left transition-colors ${
                          selectedPr?.exercise === pr.exercise
                            ? 'border-emerald-500/45 from-emerald-500/10 via-muted/20 to-background'
                            : 'border-border/50 from-muted/45 via-muted/20 to-background hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPrExercise((current) => (current === pr.exercise ? null : pr.exercise))}
                          className="w-full text-left"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                                <Trophy className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">#{pr.rank}</Badge>
                                  <p className="text-sm font-semibold">{pr.exercise}</p>
                                  {pr.new && <Badge variant="success" className="text-[10px]">New PR</Badge>}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">Hit on {pr.date}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:min-w-[13rem]">
                              <div className="rounded-xl border border-border/40 bg-background/80 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Best Weight</p>
                                <p className="mt-1 font-data text-lg font-semibold">{pr.weight}</p>
                              </div>
                              <div className="rounded-xl border border-border/40 bg-background/80 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Action</p>
                                <p className="mt-1 text-sm font-medium text-foreground">
                                  {selectedPr?.exercise === pr.exercise
                                    ? 'Viewing progress'
                                    : 'View progress'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>

                        {selectedPr?.exercise === pr.exercise && selectedPrProgress.length > 0 && (
                          <div className="mt-4 border-t border-border/40 pt-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {selectedPrProgress.length} sessions
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {selectedPrDelta == null
                                  ? 'No change yet'
                                  : `${selectedPrDelta > 0 ? '+' : ''}${selectedPrDelta}${unitSystem === 'metric' ? ' kg' : ' lb'}`}
                              </Badge>
                            </div>
                            <ResponsiveContainer width="100%" height={170}>
                              <LineChart data={selectedPrProgress} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} width={42} />
                                <Tooltip content={<CustomTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                                <Line
                                  type="monotone"
                                  dataKey="weight"
                                  stroke="#10b981"
                                  strokeWidth={2.25}
                                  dot={{ r: 3, fill: '#10b981' }}
                                  activeDot={{ r: 5 }}
                                  name="weight"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                            {selectedPrProgress.length === 1 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                First logged PR on {selectedPrProgress[0].displayDate}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workouts tab */}
        <TabsContent value="workouts">
          <MuscleDistributionPanel />
        </TabsContent>

      </Tabs>

      {/* Edit Weight Dialog */}
      {editingEntry && (
        <EditWeightDialog
          entry={editingEntry}
          open={editDialogOpen}
          setOpen={setEditDialogOpen}
        />
      )}
    </div>
  )
}
