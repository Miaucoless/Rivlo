'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'
import {
  TrendingDown, TrendingUp, Scale, BarChart3, Plus, Download,
  Target, Calendar, Dumbbell, Flame, Zap, Trophy,
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
import { percentage, getTodayISO, formatWeight } from '@/lib/utils'
import { toast } from 'sonner'

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value?.toFixed ? p.value.toFixed(1) : p.value}
          {p.name === 'weight' ? ' kg' : p.name === 'calories' ? ' kcal' : p.name === 'protein' ? 'g' : ''}
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
    addWeightEntry({
      id: `we-${Date.now()}`,
      user_id: user!.id,
      date: getTodayISO(),
      weight_kg: Number(weight),
      body_fat_pct: bodyFat ? Number(bodyFat) : undefined,
      notes: notes || undefined,
    })
    toast.success(`Weight logged: ${weight} kg 📊`)
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
          <DialogTitle>Log Today's Weight</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Weight (kg)</Label>
            <Input
              type="number"
              placeholder="e.g. 80.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              step={0.1}
              className="text-lg font-bold"
            />
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

export default function TrackingPage() {
  const { user, weightHistory, workoutLogs, getDailyTotals } = useAppStore()
  const [timeRange, setTimeRange] = useState<'2w' | '1m' | '3m' | 'all'>('1m')

  if (!user) return null

  // Filter weight data by range
  const now = new Date()
  const rangeMap: Record<string, number> = { '2w': 14, '1m': 30, '3m': 90, 'all': 9999 }
  const days = rangeMap[timeRange]
  const filteredWeight = weightHistory.filter((w) => {
    const d = new Date(w.date)
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= days
  })

  // Weight chart data
  const weightChartData = filteredWeight.map((entry) => ({
    date: format(new Date(entry.date), 'MM/dd'),
    weight: entry.weight_kg,
    bodyFat: entry.body_fat_pct,
  }))

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
    return {
      date: format(subDays(new Date(), 13 - i), 'MM/dd'),
      calories: totals.calories || Math.round(user.calorie_target + (Math.random() - 0.5) * 400),
      protein: totals.protein_g || Math.round(user.protein_target_g + (Math.random() - 0.5) * 30),
      target: user.calorie_target,
      protein_target: user.protein_target_g,
    }
  })

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

  // Personal records (mock)
  const prs = [
    { exercise: 'Bench Press', weight: '105 kg', date: format(subDays(new Date(), 1), 'MMM d'), new: true },
    { exercise: 'Squat', weight: '125 kg', date: format(subDays(new Date(), 8), 'MMM d'), new: false },
    { exercise: 'Deadlift', weight: '145 kg', date: format(subDays(new Date(), 15), 'MMM d'), new: false },
    { exercise: 'Pull-Ups', weight: '+12.5 kg', date: format(subDays(new Date(), 22), 'MMM d'), new: false },
  ]

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
          <p className="text-muted-foreground text-sm">Visualize your transformation over time</p>
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
            value: `${currentWeight.toFixed(1)} kg`,
            sub: `${isLosing ? '↓' : '↑'} ${weightChangeAbs.toFixed(1)} kg vs start`,
            icon: Scale,
            color: isLosing ? 'text-emerald-400' : 'text-rose-400',
          },
          {
            label: 'Goal',
            value: user.fitness_goal.replace('_', ' '),
            sub: projectedWeeksToGoal ? `~${projectedWeeksToGoal} weeks to goal` : 'On track',
            icon: Target,
            color: 'text-blue-400',
          },
          {
            label: 'Workouts Logged',
            value: workoutLogs.length.toString(),
            sub: `${workoutLogs.filter(w => {
              const d = new Date(w.date)
              return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
            }).length} this week`,
            icon: Dumbbell,
            color: 'text-purple-400',
          },
          {
            label: 'Avg Daily Calories',
            value: Math.round(calorieHistory.reduce((a, c) => a + c.calories, 0) / calorieHistory.length).toLocaleString(),
            sub: `Target: ${user.calorie_target.toLocaleString()} kcal`,
            icon: Flame,
            color: 'text-orange-400',
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
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className={`text-xl font-bold capitalize ${stat.color}`}>{stat.value}</p>
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
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={weightChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(weightChartData.length / 6)} />
                    <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} fill="url(#wt-grad)" dot={false} name="weight" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Body Fat % Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weightChartData.filter(d => d.bodyFat)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(weightChartData.length / 6)} />
                    <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="bodyFat" stroke="#f59e0b" strokeWidth={2} dot={false} name="bodyFat" />
                  </LineChart>
                </ResponsiveContainer>
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
                      <span className="font-semibold">{entry.weight_kg.toFixed(1)} kg</span>
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
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={calorieHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={user.calorie_target} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', position: 'right', fontSize: 10 }} />
                    <Bar dataKey="calories" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} name="calories" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Protein (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={calorieHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={user.protein_target_g} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Target', position: 'right', fontSize: 10 }} />
                    <Bar dataKey="protein" fill="#3b82f6" opacity={0.8} radius={[3, 3, 0, 0]} name="protein" />
                  </BarChart>
                </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workoutFreqData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 7]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={3} stroke="#10b981" strokeDasharray="4 2" label={{ value: 'Goal (3/wk)', position: 'right', fontSize: 10 }} />
                  <Bar dataKey="workouts" fill="#8b5cf6" opacity={0.8} radius={[3, 3, 0, 0]} name="workouts" />
                </BarChart>
              </ResponsiveContainer>
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
              <div className="space-y-3">
                {prs.map((pr, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{pr.exercise}</p>
                        <p className="text-xs text-muted-foreground">{pr.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400">{pr.weight}</span>
                      {pr.new && <Badge variant="success" className="text-xs">New PR! 🎉</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
