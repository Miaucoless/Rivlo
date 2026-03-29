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
  const projectedWeeksToGoal = user.fitness_goal === 'fat_loss'
    ? Math.abs(weightChange) > 0 ? Math.round(10 / (weightChangeAbs / (days / 7))) : 20
    : null

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

  // Personal records — derived from actual logged workout sets
  const prMap = new Map<string, { weight: number; date: string }>()
  for (const log of workoutLogs) {
    for (const exercise of log.exercises) {
      for (const set of exercise.sets) {
        const w = set.weight_kg ?? 0
        if (w <= 0) continue
        const existing = prMap.get(exercise.exercise_name)
        if (!existing || w > existing.weight) {
          prMap.set(exercise.exercise_name, { weight: w, date: log.date })
        }
      }
    }
  }
  // Sort by weight desc, take top 10
  const prs = Array.from(prMap.entries())
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 10)
    .map(([name, { weight, date }]) => ({
      exercise: name,
      weight: formatWeightValue(weight, unitSystem),
      date: format(new Date(date), 'MMM d, yyyy'),
      // Mark as new PR if achieved in the last 7 days
      new: (new Date().getTime() - new Date(date).getTime()) < 7 * 24 * 60 * 60 * 1000,
    }))

  const handleExport = () => {
    const data = {
      weight_history: weightHistory,
      calorie_history: calorieHistory,
      workout_logs: workoutLogs,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grays-progress-data.json'
    a.click()
    toast.success('Data exported!')
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
            sub: projectedWeeksToGoal ? `~${projectedWeeksToGoal} weeks to goal` : 'On track',
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

      <Card className="border-primary/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.07),rgba(255,255,255,0.02))]">
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

      {/* Charts */}
      <Tabs defaultValue="weight">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="prs">Personal Records</TabsTrigger>
          </TabsList>

          {/* Time range selector */}
          <div className="flex gap-1">
            {(['2w', '1m', '3m', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  timeRange === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
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
        </TabsContent>

        {/* PRs tab */}
        <TabsContent value="prs">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Personal Records</CardTitle>
            </CardHeader>
            <CardContent>
              {prs.length === 0 ? (
                <TrackingEmptyState
                  icon={Trophy}
                  title="No personal records yet"
                  body="Log weighted workouts and Rivora will surface your best lifts here automatically."
                >
                  <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                    <a href="/dashboard/workouts">Open Workouts</a>
                  </Button>
                </TrackingEmptyState>
              ) : (
                <div className="space-y-3">
                  {prs.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <Trophy className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{pr.exercise}</p>
                          <p className="text-xs text-muted-foreground">{pr.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold tabular-nums">{pr.weight}</span>
                        {pr.new && <Badge variant="success" className="text-xs">New PR! 🎉</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
