'use client'

import { useMemo, useState } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import {
  CheckCircle2, AlertCircle, Clock, Dumbbell, ChevronRight,
  Flame, BarChart3, X, Star, Eye,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { EXERCISE_LIBRARY, WORKOUTS } from '@/lib/content-library'
import type { MuscleGroup, Workout } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

type RadarCategory = 'Back' | 'Chest' | 'Core' | 'Arms' | 'Shoulders' | 'Legs'

const CATEGORY_MUSCLES: Record<RadarCategory, MuscleGroup[]> = {
  Chest:     ['chest'],
  Back:      ['back'],
  Shoulders: ['shoulders'],
  Arms:      ['biceps', 'triceps', 'forearms'],
  Core:      ['core'],
  Legs:      ['quads', 'hamstrings', 'glutes', 'calves'],
}

const TARGET_SESSIONS: Record<RadarCategory, number> = {
  Chest: 2, Back: 2, Shoulders: 2, Arms: 2, Core: 3, Legs: 2,
}


const CATEGORY_COLOR: Record<RadarCategory, string> = {
  Chest:     '#3b82f6',
  Back:      '#8b5cf6',
  Shoulders: '#f59e0b',
  Arms:      '#ec4899',
  Core:      '#ef4444',
  Legs:      '#22c55e',
}

const CATEGORY_LABEL_POSITION: Record<RadarCategory, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  Chest: { dx: 0, dy: -10, anchor: 'middle' },
  Back: { dx: 14, dy: 0, anchor: 'start' },
  Shoulders: { dx: 18, dy: 6, anchor: 'start' },
  Arms: { dx: 0, dy: 12, anchor: 'middle' },
  Core: { dx: -12, dy: 6, anchor: 'end' },
  Legs: { dx: -12, dy: 0, anchor: 'end' },
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function muscleGroupsFromLog(log: ReturnType<typeof useAppStore.getState>['workoutLogs'][number]): MuscleGroup[] {
  const groups = new Set<MuscleGroup>()
  ;(log.workout?.muscle_groups ?? []).forEach((m) => groups.add(m))
  for (const loggedEx of log.exercises) {
    const lib = EXERCISE_LIBRARY.find((e) => e.id === loggedEx.exercise_id || e.name === loggedEx.exercise_name)
    ;(lib?.muscle_groups ?? []).forEach((m) => groups.add(m))
  }
  return Array.from(groups)
}

function muscleToCategory(m: MuscleGroup): RadarCategory | null {
  for (const [cat, muscles] of Object.entries(CATEGORY_MUSCLES) as [RadarCategory, MuscleGroup[]][]) {
    if (muscles.includes(m)) return cat
  }
  return null
}

function workoutCoversCategory(w: Workout, cat: RadarCategory): boolean {
  return w.muscle_groups.some((m) => CATEGORY_MUSCLES[cat].includes(m))
}


// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryStat = {
  category: RadarCategory
  sessions: number
  target: number
  score: number
  status: 'great' | 'ok' | 'low'
  lastLogged: string | null
  exercises: string[]
}

type WorkoutRec = {
  workout: Workout
  source: 'saved' | 'premade'
}

type CategoryRec = {
  category: RadarCategory
  status: 'ok' | 'low'
  sessions: number
  target: number
  workouts: WorkoutRec[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CategoryStat['status'] }) {
  if (status === 'great') return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> On track
    </span>
  )
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <Clock className="h-3 w-3" /> Getting there
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
      <AlertCircle className="h-3 w-3" /> Needs work
    </span>
  )
}

function WorkoutPreviewDialog({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
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
                <p className="text-lg font-semibold">{workout.exercises.length}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Exercises</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="text-lg font-semibold">~{workout.estimated_duration_min}m</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Duration</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                <p className="text-lg font-semibold">{workout.muscle_groups.length}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Muscle groups</p>
              </div>
            </div>
            <div className="space-y-3">
              {workout.exercises.map((ex, i) => (
                <div key={`${workout.id}-${ex.exercise.id}-${i}`} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="border-b border-border/40 bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{ex.exercise.name}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{ex.sets.length} sets</span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                      <span>Set</span>
                      <span className="text-center">Reps</span>
                      <span className="text-right">Weight</span>
                    </div>
                    <div className="space-y-1">
                      {ex.sets.map((set) => (
                        <div key={`${ex.exercise.id}-${set.set_number}`} className="grid grid-cols-3 items-center rounded-lg bg-background/60 px-2 py-1.5 text-xs">
                          <span className="font-medium">{set.set_number}</span>
                          <span className="text-center font-semibold tabular-nums">{set.reps}</span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {set.weight_kg && set.weight_kg > 0 ? `${Math.round(set.weight_kg)} kg` : 'BW'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button asChild className="w-full gap-1.5">
              <Link href="/dashboard/workouts">
                Start this workout <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

function WorkoutRecCard({ rec, onPreview }: { rec: WorkoutRec; onPreview: (w: Workout) => void }) {
  const muscles = rec.workout.muscle_groups.slice(0, 3)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/25">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40">
        <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{rec.workout.name}</p>
          {rec.source === 'saved' && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1 shrink-0">
              <Star className="h-2.5 w-2.5" /> Saved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> ~{rec.workout.estimated_duration_min}m
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground capitalize">
            <Flame className="h-3 w-3" /> {rec.workout.difficulty}
          </span>
          <div className="flex flex-wrap gap-1">
            {muscles.map((m) => (
              <span key={m} className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground px-2" onClick={() => onPreview(rec.workout)}>
          <Eye className="h-3 w-3" /> Preview
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 px-2">
          <Link href="/dashboard/workouts">Start <ChevronRight className="h-3 w-3" /></Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MuscleDistributionPanel() {
  const workoutLogs  = useAppStore((s) => s.workoutLogs)
  const customWorkouts = useAppStore((s) => s.customWorkouts)
  const [selectedCat, setSelectedCat] = useState<RadarCategory | null>(null)
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null)

  const { radarData, categoryStats, recommendations } = useMemo(() => {
    const today     = new Date()
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const fourWeeksAgo = format(addDays(today, -28), 'yyyy-MM-dd')

    const sessionCount: Record<RadarCategory, number> = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Core: 0, Legs: 0 }
    const lastLogged:   Record<RadarCategory, string | null> = { Chest: null, Back: null, Shoulders: null, Arms: null, Core: null, Legs: null }
    const exercisesByCategory: Record<RadarCategory, Set<string>> = {
      Chest: new Set(), Back: new Set(), Shoulders: new Set(), Arms: new Set(), Core: new Set(), Legs: new Set(),
    }

    for (const log of workoutLogs) {
      if (log.date < fourWeeksAgo) continue
      const muscles = muscleGroupsFromLog(log)
      const cats = new Set(muscles.map(muscleToCategory).filter(Boolean) as RadarCategory[])

      if (log.date >= weekStart) {
        cats.forEach((c) => {
          sessionCount[c]++
          if (!lastLogged[c] || log.date > lastLogged[c]!) lastLogged[c] = log.date
        })
      }

      // Collect exercises per category for the tooltip
      for (const loggedEx of log.exercises) {
        if (log.date >= weekStart) {
          const lib = EXERCISE_LIBRARY.find((e) => e.id === loggedEx.exercise_id || e.name === loggedEx.exercise_name)
          ;(lib?.muscle_groups ?? []).forEach((m) => {
            const cat = muscleToCategory(m)
            if (cat) exercisesByCategory[cat].add(loggedEx.exercise_name)
          })
        }
      }
    }

    // Build radar data — score normalised 0-100
    const radarData = (Object.keys(CATEGORY_MUSCLES) as RadarCategory[]).map((cat) => ({
      category: cat,
      score: Math.min(100, Math.round((sessionCount[cat] / TARGET_SESSIONS[cat]) * 100)),
      sessions: sessionCount[cat],
      target: TARGET_SESSIONS[cat],
    }))

    const categoryStats: CategoryStat[] = radarData.map((d) => ({
      ...d,
      status: d.sessions >= d.target ? 'great' : d.sessions >= 1 ? 'ok' : 'low',
      lastLogged: lastLogged[d.category as RadarCategory],
      exercises: Array.from(exercisesByCategory[d.category as RadarCategory]),
    }))

    // Build grouped recommendations: up to 3 workouts per lagging category
    // Priority: saved workouts first, then premade
    const allWorkouts: WorkoutRec[] = [
      ...customWorkouts.map((w) => ({ workout: w, source: 'saved' as const })),
      ...WORKOUTS.map((w) => ({ workout: w, source: 'premade' as const })),
    ]

    const lagging = categoryStats
      .filter((s) => s.status !== 'great')
      .sort((a, b) => a.sessions - b.sessions) // lowest first

    const recommendations: CategoryRec[] = []

    for (const cat of lagging) {
      const matches = allWorkouts
        .filter(({ workout }) => workoutCoversCategory(workout, cat.category as RadarCategory))
        .slice(0, 3)
      if (matches.length === 0) continue
      recommendations.push({
        category: cat.category as RadarCategory,
        status: cat.status as 'ok' | 'low',
        sessions: cat.sessions,
        target: cat.target,
        workouts: matches,
      })
    }

    return { radarData, categoryStats, recommendations }
  }, [workoutLogs, customWorkouts])

  const hasData = workoutLogs.length > 0
  const activeStat = selectedCat ? categoryStats.find((s) => s.category === selectedCat) ?? null : null

  const selectedIsOnTrack = activeStat?.status === 'great'
  const filteredRecs = selectedCat && !selectedIsOnTrack
    ? recommendations.filter((r) => r.category === selectedCat)
    : recommendations

  return (
    <div className="space-y-4">
      <WorkoutPreviewDialog workout={previewWorkout} onClose={() => setPreviewWorkout(null)} />

      {/* Top row: radar + category grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">

        {/* Radar chart */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Muscle Balance</CardTitle>
            <p className="text-xs text-muted-foreground">This week — tap a category to filter</p>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={270}>
              <RadarChart
                data={radarData}
                cx="50%"
                cy="50%"
                outerRadius="56%"
                margin={{ top: 34, right: 84, bottom: 34, left: 84 }}
              >
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.9} />
                <PolarAngleAxis
                  dataKey="category"
                  tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
                    const cat = payload.value as RadarCategory
                    const isSelected = selectedCat === cat
                    const stat = categoryStats.find((s) => s.category === cat)
                    const color = stat ? CATEGORY_COLOR[cat] : '#6b7280'
                    const labelPosition = CATEGORY_LABEL_POSITION[cat]
                    return (
                      <text
                        x={x + labelPosition.dx} y={y + labelPosition.dy}
                        textAnchor={labelPosition.anchor} dominantBaseline="central"
                        fontSize={11}
                        fontWeight={isSelected ? 700 : 500}
                        fill={isSelected ? color : 'hsl(var(--muted-foreground))'}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                      >
                        {payload.value}
                      </text>
                    )
                  }}
                />
                {/* Target ring */}
                <Radar
                  name="Target"
                  dataKey="target"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.45}
                  fill="hsl(var(--muted))"
                  fillOpacity={0.08}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  isAnimationActive={false}
                  dot={false}
                />
                {/* Actual */}
                <Radar
                  name="This week"
                  dataKey="score"
                  stroke={selectedCat ? CATEGORY_COLOR[selectedCat] : '#22c55e'}
                  fill={selectedCat ? CATEGORY_COLOR[selectedCat] : '#22c55e'}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: selectedCat ? CATEGORY_COLOR[selectedCat] : '#22c55e', strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category grid */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Weekly Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground">Tap a group to filter recommendations</p>
              </div>
              {selectedCat && (
                <button
                  onClick={() => setSelectedCat(null)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              {categoryStats.map((cat) => {
                const isSelected = selectedCat === cat.category
                const color = CATEGORY_COLOR[cat.category as RadarCategory]
                const pct = Math.min(100, Math.round((cat.sessions / cat.target) * 100))
                return (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCat(isSelected ? null : cat.category as RadarCategory)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all duration-150 hover:border-white/20',
                      isSelected ? 'border-white/25 bg-white/5 shadow-sm' : 'border-border/50 bg-muted/20',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{cat.category}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{cat.sessions}/{cat.target}x</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <StatusPill status={cat.status} />
                    {cat.exercises.length > 0 && (
                      <p className="mt-1 text-[10px] text-muted-foreground/60 truncate">
                        {cat.exercises.slice(0, 2).join(' · ')}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected category detail */}
      {activeStat && (
        <Card className="border-white/15">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{activeStat.category}</h3>
                  <StatusPill status={activeStat.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeStat.sessions === 0
                    ? 'No sets logged this week. Schedule a session below.'
                    : activeStat.sessions < activeStat.target
                    ? `${activeStat.target - activeStat.sessions} more session${activeStat.target - activeStat.sessions > 1 ? 's' : ''} recommended this week.`
                    : `You've hit your ${activeStat.target}× weekly target — great work!`}
                </p>
                {activeStat.exercises.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeStat.exercises.map((ex) => (
                      <span key={ex} className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold tabular-nums" style={{ color: CATEGORY_COLOR[activeStat.category as RadarCategory] }}>
                  {activeStat.sessions}/{activeStat.target}
                </p>
                <p className="text-[11px] text-muted-foreground">sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workout recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-sm">
                {selectedIsOnTrack ? 'Recommended Workouts' : selectedCat ? `${selectedCat} Workouts` : 'Recommended Workouts'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedIsOnTrack
                  ? `${selectedCat} is on track — focus on these other muscle groups instead`
                  : 'Saved workouts shown first'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          {filteredRecs.length > 0 ? (
            filteredRecs.map((catRec) => (
              <div key={catRec.category}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: CATEGORY_COLOR[catRec.category] }}
                  >
                    {catRec.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {catRec.sessions}/{catRec.target}× this week
                  </span>
                </div>
                <div className="space-y-2">
                  {catRec.workouts.map((rec) => (
                    <WorkoutRecCard key={rec.workout.id} rec={rec} onPreview={setPreviewWorkout} />
                  ))}
                </div>
              </div>
            ))
          ) : selectedCat ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No workouts found for {selectedCat}.</p>
              <Button asChild size="sm" variant="outline" className="mt-3 text-xs gap-1">
                <Link href="/dashboard/workouts">Browse all workouts <ChevronRight className="h-3 w-3" /></Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">You&apos;re on track across all muscle groups!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {!hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
              <Dumbbell className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-sm">No workout data yet</p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
              Log your first workout and Rivora will show which muscle groups you&apos;re training, what&apos;s lagging, and exactly what to do next.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-5 gap-1.5 text-xs">
              <Link href="/dashboard/workouts">Log a Workout</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
