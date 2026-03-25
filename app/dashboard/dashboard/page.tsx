
'use client'

import React from 'react'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Zap, Apple, Dumbbell, TrendingUp, Plus, ChevronRight,
  Target, Calendar, BookOpen, Trophy, BarChart3, ArrowUp, ArrowDown, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/useAppStore'
import { WaterIntakeCard } from '@/components/dashboard/WaterIntakeCard'
import { percentage, generateRecommendation, getTodayISO, formatCalories, formatWeightDelta, formatWeightValue, getWeightUnitLabel } from '@/lib/utils'
import { toast } from 'sonner'

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.05 } } },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] } },
  },
}

function CustomTooltip({ active, payload, label, unitSystem }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.name === 'weight' ? formatWeightValue(p.value, unitSystem) : `${Math.round(p.value)} kcal`}
        </p>
      ))}
    </div>
  )
}

// Quick Add Meal Dialog
function QuickAddMealDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const { addMealEntry } = useAppStore()

  const handleAdd = () => {
    if (!name || !calories) {
      toast.error('Please fill in at least a name and calories')
      return
    }
    addMealEntry(getTodayISO(), {
      id: `meal-${Date.now()}`,
      meal_type: 'snack',
      name,
      macros: {
        calories: Number(calories),
        protein_g: Number(protein) || 0,
        carbs_g: 0,
        fat_g: 0,
      },
      time: format(new Date(), 'h:mm a'),
      recipe: null,
    })
    toast.success(`${name} logged! +${calories} kcal`)
    setOpen(false)
    setName('')
    setCalories('')
    setProtein('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Log Meal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Food name</Label>
            <Input placeholder="e.g. Chicken breast" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Calories</Label>
              <Input type="number" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Protein (g)</Label>
              <Input type="number" placeholder="optional" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" variant="brand" onClick={handleAdd}>Add to Today</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, getDailyTotals, getDailyMeals, mealEntries, weightHistory, workoutLogs, streak, journalEntries } = useAppStore()
  const [hasPausedWorkout, setHasPausedWorkout] = useState(false)
  const [expandedDashboardLogId, setExpandedDashboardLogId] = useState<string | null>(null)
  const [expandedMealType, setExpandedMealType] = useState<string | null>(null)
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshPausedState = () => {
      const rawSession = window.localStorage.getItem('rivlo-active-workout-session')
      setHasPausedWorkout(Boolean(rawSession))
    }

    refreshPausedState()
    window.addEventListener('focus', refreshPausedState)

    return () => window.removeEventListener('focus', refreshPausedState)
  }, [])

  if (!user) return null

  const unitSystem = user.unit_system || 'imperial'

  const today = getTodayISO()
  const todayTotals = getDailyTotals(today)
  const todayMeals = getDailyMeals(today)

  // Calorie progress
  const caloriePct = percentage(todayTotals.calories, user.calorie_target)
  const proteinPct = percentage(todayTotals.protein_g, user.protein_target_g)
  const carbsPct = percentage(todayTotals.carbs_g, user.carb_target_g)
  const fatPct = percentage(todayTotals.fat_g, user.fat_target_g)

  // Remaining
  const caloriesLeft = Math.max(0, user.calorie_target - todayTotals.calories)
  const proteinLeft = Math.max(0, user.protein_target_g - todayTotals.protein_g)

  // Weight data for chart
  const weightChartData = weightHistory
    .slice(-14)
    .map((entry) => ({
      date: format(new Date(entry.date), 'MM/dd'),
      weight: entry.weight_kg,
    }))

  const recentMealDays = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    const meals = mealEntries[date] || []
    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein_g: acc.protein_g + meal.macros.protein_g,
      }),
      { calories: 0, protein_g: 0 }
    )

    return {
      date,
      day: format(new Date(date), 'EEE'),
      meals,
      calories: totals.calories,
      protein_g: totals.protein_g,
      target: user.calorie_target,
    }
  })

  const calorieChartData = recentMealDays
    .filter((day) => day.meals.length > 0)
    .map((day) => ({
      day: day.day,
      calories: day.calories,
      target: day.target,
    }))

  // Macro pie data
  const macroPieData = [
    { name: 'Protein', value: todayTotals.protein_g * 4, color: '#10b981' },
    { name: 'Carbs', value: todayTotals.carbs_g * 4, color: '#3b82f6' },
    { name: 'Fat', value: todayTotals.fat_g * 9, color: '#f59e0b' },
  ]

  const loggedMealDays = recentMealDays.filter((day) => day.meals.length > 0)
  const workoutsThisWeek = workoutLogs.filter((w) => {
    const d = new Date(w.date)
    const now = new Date()
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
  }).length
  const recentAvg = loggedMealDays.length > 0
    ? {
        avg_calories: loggedMealDays.reduce((sum, day) => sum + day.calories, 0) / loggedMealDays.length,
        avg_protein: loggedMealDays.reduce((sum, day) => sum + day.protein_g, 0) / loggedMealDays.length,
        workouts_this_week: workoutsThisWeek,
        current_weight: weightHistory[weightHistory.length - 1]?.weight_kg || user.weight_kg,
      }
    : null
  const recommendation = recentAvg
    ? generateRecommendation(user, recentAvg)
    : 'Log a few meals, workouts, or weigh-ins and your dashboard insights will start reflecting real trends.'

  const todayWorkoutLogs = workoutLogs.filter((workout) => workout.date === today)
  const todayWorkoutCalories = todayWorkoutLogs.reduce((sum, workout) => sum + (workout.calories_burned_kcal || 0), 0)
  const todayWorkoutMinutes = todayWorkoutLogs.reduce((sum, workout) => sum + (workout.duration_min || 0), 0)
  const netCaloriesToday = Math.max(0, todayTotals.calories - todayWorkoutCalories)
  const netCaloriePct = percentage(netCaloriesToday, user.calorie_target)

  // Stats
  const hasWeightHistory = weightHistory.length > 0
  const startWeight = weightHistory[0]?.weight_kg || user.weight_kg
  const currentWeight = weightHistory[weightHistory.length - 1]?.weight_kg || user.weight_kg
  const weightChange = currentWeight - startWeight

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        variants={stagger.item}
        initial="initial"
        animate="animate"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Good {getGreeting()}, {user.name.split(' ')[0]} 👋</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {streak > 0 ? `${streak}-day streak — you're on fire! 🔥` : 'Start your streak today!'}
            </p>
            {hasPausedWorkout && (
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300 cursor-pointer hover:bg-emerald-500/20"
                onClick={() => router.push('/dashboard/workouts?resume=1')}
              >
                Paused workout ready
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <QuickAddMealDialog />
          {hasPausedWorkout ? (
            <Button
              size="sm"
              variant="brand"
              className="gap-1.5 text-xs"
              onClick={() => router.push('/dashboard/workouts?resume=1')}
            >
              <Dumbbell className="w-3.5 h-3.5" /> Continue Workout
            </Button>
          ) : (
            <Button
              size="sm"
              variant="brand"
              className="gap-1.5 text-xs"
              onClick={() => router.push('/dashboard/workouts')}
            >
              <Plus className="w-3.5 h-3.5" /> Log Workout
            </Button>
          )}
        </div>
      </motion.div>

      {/* Top stats row */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          {
            label: 'Calories Today',
            value: formatCalories(netCaloriesToday),
            sub: `${formatCalories(todayTotals.calories)} eaten · ${formatCalories(todayWorkoutCalories)} burned`,
            pct: netCaloriePct,
            icon: Flame,
            iconClass: 'text-emerald-500 bg-emerald-500/10',
            barColor: netCaloriePct > 100 ? 'bg-red-500' : 'bg-emerald-500',
          },
          {
            label: 'Protein',
            value: `${todayTotals.protein_g}g`,
            sub: `of ${user.protein_target_g}g`,
            pct: proteinPct,
            icon: Zap,
            iconClass: 'text-emerald-500 bg-emerald-500/10',
            barColor: 'bg-emerald-500',
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} variants={stagger.item}>
              <Card className="hover-lift">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${stat.iconClass}`}>
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    {stat.sub}
                  </p>
                  {stat.pct !== undefined && (
                    <div className="mt-3">
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${stat.barColor}`}
                          style={{ width: `${Math.min(stat.pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.label === 'Calories Today'
                          ? `${stat.pct}% of calorie goal after workouts`
                          : `${stat.pct}% of goal`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
        <WaterIntakeCard />
      </motion.div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Calorie history chart */}
        <motion.div
          variants={stagger.item}
          initial="initial"
          animate="animate"
          className="md:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Calorie History</CardTitle>
                <Badge variant="outline" className="text-xs">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {calorieChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={calorieChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cal-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip unitSystem={unitSystem} />} />
                      <Area
                        type="monotone"
                        dataKey="calories"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#cal-area)"
                        dot={{ fill: '#10b981', r: 3 }}
                        name="calories"
                      />
                      <Area
                        type="monotone"
                        dataKey="target"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        fill="none"
                        dot={false}
                        name="target"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Actual
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-amber-500 border-dashed inline-block" style={{ borderStyle: 'dashed', borderTopWidth: 1, backgroundColor: 'transparent', borderColor: '#f59e0b' }} /> Target
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <Flame className="mb-3 h-10 w-10 opacity-20" />
                  <p>No calorie history yet</p>
                  <p className="mt-1 text-xs">Your chart will appear once you log meals on at least one day.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Macro breakdown pie */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Today&apos;s Macros</CardTitle>
            </CardHeader>
            <CardContent>
              {todayTotals.calories > 0 ? (
                <>
                  <div className="flex justify-center mb-2">
                    <PieChart width={140} height={140}>
                      <Pie
                        data={macroPieData}
                        cx={70}
                        cy={70}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {macroPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Protein', value: todayTotals.protein_g, target: user.protein_target_g, color: '#10b981', unit: 'g' },
                      { label: 'Carbs', value: todayTotals.carbs_g, target: user.carb_target_g, color: '#3b82f6', unit: 'g' },
                      { label: 'Fat', value: todayTotals.fat_g, target: user.fat_target_g, color: '#f59e0b', unit: 'g' },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{m.label}</span>
                          <span className="font-medium">{m.value}g / {m.target}g</span>
                        </div>
                        <div className="progress-track h-1.5">
                          <div
                            className="progress-fill"
                            style={{ width: `${percentage(m.value, m.target)}%`, backgroundColor: m.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm text-center">
                  <Apple className="w-10 h-10 mb-3 opacity-20" />
                  <p>No meals logged today</p>
                  <p className="text-xs mt-1">Add your first meal above</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Today's workouts */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="hover-lift h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Today&apos;s Workouts</CardTitle>
                <a href="/dashboard/workouts">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Log Workout
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {todayWorkoutLogs.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                      <p className="font-data text-lg font-semibold">{todayWorkoutLogs.length}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sessions</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                      <p className="font-data text-lg font-semibold">{todayWorkoutMinutes}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Minutes</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                      <p className="font-data text-lg font-semibold">{todayWorkoutCalories}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">kcal</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {todayWorkoutLogs.map((workout) => {
                      const isExpanded = expandedDashboardLogId === workout.id
                      const totalSets = workout.exercises.reduce((s, e) => s + e.sets.length, 0)
                      return (
                        <div key={workout.id} className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                          {/* Header row */}
                          <div className="flex items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setExpandedDashboardLogId(isExpanded ? null : workout.id)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                            >
                              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                                <Dumbbell className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{workout.workout.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {workout.exercises.length} exercises · {totalSets} sets · {workout.duration_min || 0} min
                                </p>
                              </div>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="font-data text-sm font-semibold">{workout.calories_burned_kcal || 0}</p>
                                <p className="text-[10px] text-muted-foreground">kcal</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedDashboardLogId(isExpanded ? null : workout.id)}
                                className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                              >
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded exercises */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                                  {workout.exercises.map((exercise, exIdx) => (
                                    <div key={`${workout.id}-${exercise.exercise_id}-${exIdx}`} className="rounded-lg border border-border/40 overflow-hidden">
                                      <div className="px-3 py-1.5 bg-muted/30 border-b border-border/30">
                                        <p className="text-xs font-semibold">{exercise.exercise_name}</p>
                                      </div>
                                      <div className="px-3 py-2">
                                        <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider mb-1 px-1">
                                          <span>Set</span><span className="text-center">Reps</span><span className="text-right">Weight</span>
                                        </div>
                                        {exercise.sets.map((set) => (
                                          <div key={set.set_number} className="grid grid-cols-3 items-center text-xs rounded px-2 py-1 bg-background/40">
                                            <span className="text-muted-foreground font-medium">{set.set_number}</span>
                                            <span className="text-center font-data font-semibold tabular-nums">{set.actual_reps ?? set.target_reps}</span>
                                            <span className="text-right font-data tabular-nums text-muted-foreground">
                                              {(set.weight_kg || 0) > 0
                                                ? formatWeightValue(set.weight_kg || 0, user?.unit_system || 'imperial')
                                                : <span className="opacity-40">BW</span>}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center">
                  <Dumbbell className="w-10 h-10 mb-3 opacity-20" />
                  <p>No workouts logged yet today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's meals */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Today&apos;s Meals</CardTitle>
                <QuickAddMealDialog />
              </div>
            </CardHeader>
            <CardContent>
              {todayMeals.length > 0 ? (
                <div className="space-y-3">
                  {/* Macro stat grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Calories', value: todayTotals.calories, unit: 'kcal' },
                      { label: 'Protein', value: todayTotals.protein_g, unit: 'g' },
                      { label: 'Carbs', value: todayTotals.carbs_g, unit: 'g' },
                      { label: 'Fat', value: todayTotals.fat_g, unit: 'g' },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-muted/20 px-2 py-2.5 text-center">
                        <p className="font-data text-lg font-semibold leading-none">{value}</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">{unit === 'kcal' ? 'kcal' : label.slice(0, 4)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
                    const mealsOfType = todayMeals.filter((m) => m.meal_type === mealType)
                    if (mealsOfType.length === 0) return null
                    const typeCalories = mealsOfType.reduce((s, m) => s + m.macros.calories, 0)
                    const typeProtein = mealsOfType.reduce((s, m) => s + m.macros.protein_g, 0)
                    const typeCarbs = mealsOfType.reduce((s, m) => s + m.macros.carbs_g, 0)
                    const typeFat = mealsOfType.reduce((s, m) => s + m.macros.fat_g, 0)
                    const isOpen = expandedMealType === mealType
                    return (
                      <div key={mealType} className="rounded-xl border border-border/50 overflow-hidden">
                        {/* Header */}
                        <button
                          type="button"
                          onClick={() => setExpandedMealType(isOpen ? null : mealType)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Apple className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold capitalize">{mealType}</p>
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-data">{typeCalories}</span> kcal · <span className="font-data text-emerald-500">{typeProtein}g</span> protein
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{mealsOfType.length} item{mealsOfType.length > 1 ? 's' : ''}</span>
                            {isOpen
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </button>

                        {/* Expanded meals */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-border/40 divide-y divide-border/30">
                                {mealsOfType.map((meal) => {
                                  const isExpandable = !!meal.recipe || meal.entry_source === 'saved'
                                  const expanded = expandedMeals[meal.id] || false
                                  return (
                                    <div key={meal.id} className="px-3 py-2.5 bg-muted/10">
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        {isExpandable ? (
                                          <button
                                            type="button"
                                            className="flex items-center gap-1 text-xs font-medium truncate text-left"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setExpandedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))
                                            }}
                                          >
                                            {meal.name}
                                            <ChevronDown className={`w-3 h-3 flex-shrink-0 text-muted-foreground/60 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                                          </button>
                                        ) : (
                                          <span className="text-xs font-medium truncate">{meal.name}</span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground shrink-0">{meal.time}</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                        {[
                                          { label: 'Cal', value: meal.macros.calories, unit: '' },
                                          { label: 'Pro', value: meal.macros.protein_g, unit: 'g' },
                                          { label: 'Carb', value: meal.macros.carbs_g, unit: 'g' },
                                          { label: 'Fat', value: meal.macros.fat_g, unit: 'g' },
                                        ].map(({ label, value, unit }) => (
                                          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1 text-center">
                                            <p className="font-data text-[11px] font-semibold tabular-nums">{value}{unit}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                                          </div>
                                        ))}
                                      </div>
                                      {isExpandable && expanded && (
                                        <div className="mt-2 space-y-1 pl-2 border-l border-border/40">
                                          {meal.recipe && meal.recipe.ingredients && meal.recipe.ingredients.length > 0 ? (
                                            // Show recipe ingredients
                                            meal.recipe.ingredients.map((ingredient, ingredientIndex) => (
                                              <div key={`${meal.id}-recipe-ingredient-${ingredientIndex}`}>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-[11px] font-medium text-foreground/70 truncate">{ingredient.name}</span>
                                                  <span className="text-[10px] font-data text-muted-foreground/40">{ingredient.amount} {ingredient.unit}</span>
                                                </div>
                                                {ingredient.calories_per_unit && (
                                                  <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{Math.round(ingredient.calories_per_unit * ingredient.amount)} kcal</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{Math.round(ingredient.macros.protein_g * ingredient.amount)}g P</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{Math.round(ingredient.macros.carbs_g * ingredient.amount)}g C</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{Math.round(ingredient.macros.fat_g * ingredient.amount)}g F</span>
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : meal.meal_items && meal.meal_items.length > 0 ? (
                                            // Show meal items (for saved meals)
                                            meal.meal_items.map((item, itemIndex) => (
                                              <div key={`${meal.id}-item-${itemIndex}`}>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-[11px] font-medium text-foreground/70 truncate">{item.name}</span>
                                                  {item.amount != null && (
                                                    <span className="text-[10px] font-data text-muted-foreground/40">{item.amount}{item.unit}</span>
                                                  )}
                                                </div>
                                                {item.macros.calories > 0 && (
                                                  <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{item.macros.calories} kcal</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{item.macros.protein_g}g P</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{item.macros.carbs_g}g C</span>
                                                    <span className="text-[10px] text-border/30">·</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/50">{item.macros.fat_g}g F</span>
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                {/* Type totals row */}
                                <div className="px-3 py-2 bg-muted/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</p>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1">
                                    {[
                                      { label: 'Cal', value: typeCalories, unit: '' },
                                      { label: 'Pro', value: typeProtein, unit: 'g' },
                                      { label: 'Carb', value: typeCarbs, unit: 'g' },
                                      { label: 'Fat', value: typeFat, unit: 'g' },
                                    ].map(({ label, value, unit }) => (
                                      <div key={label} className="rounded-lg bg-background/60 border border-border/40 px-2 py-1 text-center">
                                        <p className="font-data text-[11px] font-semibold tabular-nums">{value}{unit}</p>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}

                  {/* Daily summary */}
                  <div className="pt-2 border-t border-border mt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total today</span>
                      <span className="font-semibold">{todayTotals.calories} / {user.calorie_target} kcal</span>
                    </div>
                    <div className="progress-track mt-1.5">
                      <div
                        className={`progress-fill ${caloriePct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(caloriePct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {caloriesLeft > 0
                        ? `${caloriesLeft} kcal remaining`
                        : `${todayTotals.calories - user.calorie_target} kcal over target`}
                    </p>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center">
                  <Apple className="w-10 h-10 mb-3 opacity-20" />
                  <p>No meals logged yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Insight + recent journal */}
        <motion.div variants={stagger.item} initial="initial" animate="animate" className="space-y-4">
          {/* AI insight */}
          <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-1">AI Insight</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weight trend card */}
          {weightHistory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold">Weight Trend</p>
                  <span className={`text-xs font-semibold ${weightChange < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {weightChange < 0 ? '↓' : '↑'} {formatWeightValue(Math.abs(weightChange), unitSystem).replace(/\s(?:kg|lbs)$/, ` ${getWeightUnitLabel(unitSystem)}`)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={weightChartData.slice(-7)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wt-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={1.5} fill="url(#wt-area)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatWeightValue(weightHistory[0]?.weight_kg || startWeight, unitSystem)} start</span>
                  <span>{formatWeightValue(currentWeight, unitSystem)} now</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Meal Plan', icon: Apple, href: '/dashboard/meals', color: 'text-emerald-500 bg-emerald-500/10' },
                  { label: 'Log Weight', icon: BarChart3, href: '/dashboard/tracking', color: 'text-emerald-500 bg-emerald-500/10' },
                  { label: 'Calendar', icon: Calendar, href: '/dashboard/calendar', color: 'text-emerald-500 bg-emerald-500/10' },
                  { label: 'Journal', icon: BookOpen, href: '/dashboard/journal', color: 'text-emerald-500 bg-emerald-500/10' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${item.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium group-hover:text-foreground text-muted-foreground">
                        {item.label}
                      </span>
                    </a>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
