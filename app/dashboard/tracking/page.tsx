'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'
import {
  TrendingDown, TrendingUp, Scale, BarChart3, Plus, Download,
  Target, Calendar, Dumbbell, Flame, Zap, Trophy, Edit, Trash2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, BarChart, Bar, Legend,
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
  const { addWeightEntry, removeWeightEntry, user } = useAppStore()

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

  // Workout frequency
  const workoutFreqData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = subDays(new Date(), (7 - i) * 7)
    const weekEnd = subDays(new Date(), (6 - i) * 7)
    const count = workoutLogs.filter((w) => {
      const d = new Date(w.date)
      return d >= weekStart && d <= weekEnd
    }).length
    return {
      week: format(weekStart, 'MMM d'),
      workouts: count,
    }
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
            sub: `${workoutLogs.filter(w => {
              const d = new Date(w.date)
              return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
            }).length} this week`,
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
      <Tabs defaultValue="weight">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="workouts">Workouts</TabsTrigger>
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
                    <AreaChart data={weightChartData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(weightChartData.length / 6)} />
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
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Calories (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {calorieHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <Flame className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No nutrition data yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Log meals and your calorie history will appear here.</p>
                  </div>
                ) : (
                  <div
                    className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2"
                    style={{ touchAction: 'pan-x' } as React.CSSProperties}
                  >
                    <div style={{ minWidth: 560 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={calorieHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                          <ReferenceLine y={user.calorie_target} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', position: 'right', fontSize: 10 }} />
                          <Bar dataKey="calories" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} name="calories" maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Protein (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {calorieHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <Zap className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No protein data yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Log meals and your protein history will appear here.</p>
                  </div>
                ) : (
                  <div
                    className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2"
                    style={{ touchAction: 'pan-x' } as React.CSSProperties}
                  >
                    <div style={{ minWidth: 560 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={calorieHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                          <ReferenceLine y={user.protein_target_g} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', position: 'right', fontSize: 10 }} />
                          <Bar dataKey="protein" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} name="protein" maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Workouts tab */}
        <TabsContent value="workouts">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Weekly Workout Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2"
                style={{ touchAction: 'pan-x' } as React.CSSProperties}
              >
                <div style={{ minWidth: 560 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={workoutFreqData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 7]} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                      <ReferenceLine y={3} stroke="#10b981" strokeDasharray="4 2" label={{ value: 'Goal (3/wk)', position: 'right', fontSize: 10 }} />
                      <Bar dataKey="workouts" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} name="workouts" maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No personal records yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Log workouts with weighted sets and your PRs will appear here automatically.</p>
                </div>
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
