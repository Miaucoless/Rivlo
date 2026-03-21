'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Flame, Zap, Apple, Dumbbell, TrendingUp, Plus, ChevronRight,
  Target, Calendar, BookOpen, Trophy, BarChart3, ArrowUp, ArrowDown,
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
import { percentage, generateRecommendation, getTodayISO, formatCalories } from '@/lib/utils'
import { WORKOUTS } from '@/lib/mock-data'
import { toast } from 'sonner'

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.05 } } },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] } },
  },
}

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.name === 'weight' ? `${p.value.toFixed(1)} kg` : `${Math.round(p.value)} kcal`}
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
  const { user, getDailyTotals, getDailyMeals, weightHistory, workoutLogs, streak, journalEntries } = useAppStore()

  if (!user) return null

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

  // Calorie history for chart
  const calorieChartData = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'EEE')
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    // Simulate varying calorie data
    const base = user.calorie_target
    return {
      day: d,
      calories: i === 6 ? todayTotals.calories : Math.round(base + (Math.random() - 0.5) * 400),
      target: user.calorie_target,
    }
  })

  // Macro pie data
  const macroPieData = [
    { name: 'Protein', value: todayTotals.protein_g * 4, color: '#10b981' },
    { name: 'Carbs', value: todayTotals.carbs_g * 4, color: '#3b82f6' },
    { name: 'Fat', value: todayTotals.fat_g * 9, color: '#f59e0b' },
  ]

  // AI recommendation
  const recentAvg = {
    avg_calories: user.calorie_target - 150,
    avg_protein: user.protein_target_g - 25,
    workouts_this_week: workoutLogs.filter((w) => {
      const d = new Date(w.date)
      const now = new Date()
      return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
    }).length,
    current_weight: weightHistory[weightHistory.length - 1]?.weight_kg || user.weight_kg,
  }
  const recommendation = generateRecommendation(user, recentAvg)

  // Today's workout
  const todayWorkoutIdx = workoutLogs.length % WORKOUTS.length
  const todayWorkout = WORKOUTS[todayWorkoutIdx]

  // Stats
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
          <h2 className="text-2xl font-bold">Good {getGreeting()}, {user.name.split(' ')[0]} 👋</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {streak > 0 ? `${streak}-day streak — you're on fire! 🔥` : 'Start your streak today!'}
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAddMealDialog />
          <Button size="sm" variant="brand" className="gap-1.5 text-xs" onClick={() => toast.info('Log workout coming soon!')}>
            <Plus className="w-3.5 h-3.5" /> Log Workout
          </Button>
        </div>
      </motion.div>

      {/* Top stats row */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Calories Today',
            value: formatCalories(todayTotals.calories),
            sub: `of ${formatCalories(user.calorie_target)} kcal`,
            pct: caloriePct,
            icon: Flame,
            color: 'text-orange-400',
            barColor: caloriePct > 100 ? 'bg-red-500' : 'bg-orange-400',
          },
          {
            label: 'Protein',
            value: `${todayTotals.protein_g}g`,
            sub: `of ${user.protein_target_g}g`,
            pct: proteinPct,
            icon: Zap,
            color: 'text-emerald-400',
            barColor: 'bg-emerald-500',
          },
          {
            label: 'Weight',
            value: `${currentWeight.toFixed(1)} kg`,
            sub: weightChange < 0 ? `${weightChange.toFixed(1)} kg from start` : `+${weightChange.toFixed(1)} kg from start`,
            icon: TrendingUp,
            color: weightChange < 0 ? 'text-emerald-400' : 'text-rose-400',
            isWeight: true,
            weightDown: weightChange < 0,
          },
          {
            label: 'Workouts',
            value: recentAvg.workouts_this_week.toString(),
            sub: 'this week',
            icon: Dumbbell,
            color: 'text-blue-400',
            isCount: true,
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} variants={stagger.item}>
              <Card className="hover-lift">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <div className={`w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center ${stat.color}`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    {stat.isWeight && (
                      stat.weightDown
                        ? <ArrowDown className="w-3 h-3 text-emerald-500" />
                        : <ArrowUp className="w-3 h-3 text-rose-500" />
                    )}
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
                      <p className="text-xs text-muted-foreground mt-1">{stat.pct}% of goal</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Calorie history chart */}
        <motion.div
          variants={stagger.item}
          initial="initial"
          animate="animate"
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Calorie History</CardTitle>
                <Badge variant="outline" className="text-xs">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent>
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
                  <Tooltip content={<CustomTooltip />} />
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Macro breakdown pie */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Today's Macros</CardTitle>
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
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today's workout */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="hover-lift h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Today's Workout</CardTitle>
                <Badge variant="success">{todayWorkout.day_label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <p className="font-semibold text-sm">{todayWorkout.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {todayWorkout.exercises.length} exercises · ~{todayWorkout.estimated_duration_min} min
                  </p>
                </div>

                <div className="space-y-2">
                  {todayWorkout.exercises.slice(0, 3).map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                        {i + 1}
                      </div>
                      <span className="text-foreground">{ex.exercise.name}</span>
                      <span className="text-muted-foreground ml-auto">{ex.sets.length} sets</span>
                    </div>
                  ))}
                  {todayWorkout.exercises.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-7">+{todayWorkout.exercises.length - 3} more exercises</p>
                  )}
                </div>

                <Button
                  variant="brand"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => toast.info('Start workout from the Workouts page!')}
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                  Start Workout
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's meals */}
        <motion.div variants={stagger.item} initial="initial" animate="animate">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Today's Meals</CardTitle>
                <QuickAddMealDialog />
              </div>
            </CardHeader>
            <CardContent>
              {todayMeals.length > 0 ? (
                <div className="space-y-2">
                  {todayMeals.map((meal) => (
                    <div key={meal.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Apple className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{meal.name}</p>
                        <p className="text-xs text-muted-foreground">{meal.macros.calories} kcal · {meal.macros.protein_g}g protein</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{meal.time}</span>
                    </div>
                  ))}

                  {/* Daily summary */}
                  <div className="pt-2 border-t border-border mt-2">
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
                    {weightChange < 0 ? '↓' : '↑'} {Math.abs(weightChange).toFixed(1)} kg
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
                  <span>{weightHistory[0]?.weight_kg.toFixed(1)} kg start</span>
                  <span>{currentWeight.toFixed(1)} kg now</span>
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
                  { label: 'Meal Plan', icon: Apple, href: '/meals', color: 'text-blue-400 bg-blue-400/10' },
                  { label: 'Log Weight', icon: BarChart3, href: '/tracking', color: 'text-amber-400 bg-amber-400/10' },
                  { label: 'Calendar', icon: Calendar, href: '/calendar', color: 'text-purple-400 bg-purple-400/10' },
                  { label: 'Journal', icon: BookOpen, href: '/journal', color: 'text-rose-400 bg-rose-400/10' },
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
