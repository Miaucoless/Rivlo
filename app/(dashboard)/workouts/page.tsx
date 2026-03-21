'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dumbbell, Play, ChevronRight, ChevronDown, Clock, Flame,
  BarChart3, CheckCircle, Circle, Trophy, Target, Video, Plus, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/useAppStore'
import { WORKOUTS } from '@/lib/mock-data'
import type { Workout, WorkoutExercise, WorkoutSet } from '@/types'
import { format } from 'date-fns'
import { getTodayISO } from '@/lib/utils'
import { toast } from 'sonner'

const MUSCLE_COLORS: Record<string, string> = {
  chest: 'bg-rose-500/15 text-rose-400',
  back: 'bg-blue-500/15 text-blue-400',
  shoulders: 'bg-purple-500/15 text-purple-400',
  biceps: 'bg-amber-500/15 text-amber-400',
  triceps: 'bg-orange-500/15 text-orange-400',
  quads: 'bg-emerald-500/15 text-emerald-400',
  hamstrings: 'bg-teal-500/15 text-teal-400',
  glutes: 'bg-cyan-500/15 text-cyan-400',
  calves: 'bg-lime-500/15 text-lime-400',
  core: 'bg-indigo-500/15 text-indigo-400',
  cardio: 'bg-red-500/15 text-red-400',
}

// Active workout tracker
interface ActiveSet extends WorkoutSet {
  completed: boolean
  actual_reps: number
  actual_weight: number
}

interface ActiveExercise {
  exercise_name: string
  sets: ActiveSet[]
}

function WorkoutCard({ workout, onStart }: { workout: Workout; onStart: (w: Workout) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="hover-lift overflow-hidden">
      {/* Colored top stripe */}
      <div className={`h-1 ${
        workout.day_label.toLowerCase().includes('push') ? 'bg-gradient-to-r from-rose-400 to-pink-500' :
        workout.day_label.toLowerCase().includes('pull') ? 'bg-gradient-to-r from-blue-400 to-cyan-500' :
        'bg-gradient-to-r from-emerald-400 to-teal-500'
      }`} />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{workout.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{workout.description}</p>
          </div>
          <Badge variant={
            workout.difficulty === 'beginner' ? 'success' :
            workout.difficulty === 'intermediate' ? 'warning' : 'destructive'
          } className="capitalize flex-shrink-0 ml-2">
            {workout.difficulty}
          </Badge>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3" />{workout.exercises.length} exercises</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{workout.estimated_duration_min} min</span>
          <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{workout.day_label}</span>
        </div>

        {/* Muscle groups */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {workout.muscle_groups.map((mg) => (
            <span key={mg} className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${MUSCLE_COLORS[mg] || 'bg-muted text-muted-foreground'}`}>
              {mg.replace('_', ' ')}
            </span>
          ))}
        </div>

        {/* Exercise preview (expandable) */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <span>{expanded ? 'Hide' : 'Preview'} exercises</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-3"
            >
              <div className="space-y-2 pb-2">
                {workout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-center leading-5 font-semibold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-foreground font-medium">{ex.exercise.name}</p>
                      <p className="text-muted-foreground">{ex.sets.length} sets × {ex.sets[0]?.reps} reps · {ex.exercise.equipment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <Button
          variant="brand"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => onStart(workout)}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Start Workout
        </Button>
      </CardContent>
    </Card>
  )
}

// Active workout modal
function ActiveWorkoutModal({
  workout,
  onClose,
  onComplete,
}: {
  workout: Workout
  onClose: () => void
  onComplete: (log: ActiveExercise[]) => void
}) {
  const [exercises, setExercises] = useState<ActiveExercise[]>(
    workout.exercises.map((ex) => ({
      exercise_name: ex.exercise.name,
      sets: ex.sets.map((s) => ({
        ...s,
        completed: false,
        actual_reps: s.reps,
        actual_weight: s.weight_kg || 0,
      })),
    }))
  )
  const [videoExercise, setVideoExercise] = useState<string | null>(null)
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [startTime] = useState(new Date())
  const [timer, setTimer] = useState<number | null>(null)

  const completedSets = exercises.flatMap((e) => e.sets).filter((s) => s.completed).length
  const totalSets = exercises.flatMap((e) => e.sets).length
  const progress = Math.round((completedSets / totalSets) * 100)

  const toggleSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) => {
      const next = [...prev]
      next[exIdx] = {
        ...next[exIdx],
        sets: next[exIdx].sets.map((s, i) =>
          i === setIdx ? { ...s, completed: !s.completed } : s
        ),
      }
      return next
    })
    // Start rest timer
    const restSec = workout.exercises[exIdx]?.sets[setIdx]?.rest_seconds || 60
    setTimer(restSec)
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t === null || t <= 1) {
          clearInterval(interval)
          toast.info('Rest complete! Ready for next set.')
          return null
        }
        return t - 1
      })
    }, 1000)
  }

  const updateSet = (exIdx: number, setIdx: number, field: 'actual_reps' | 'actual_weight', value: number) => {
    setExercises((prev) => {
      const next = [...prev]
      next[exIdx] = {
        ...next[exIdx],
        sets: next[exIdx].sets.map((s, i) =>
          i === setIdx ? { ...s, [field]: value } : s
        ),
      }
      return next
    })
  }

  const videoUrl = workout.exercises[currentExIdx]?.exercise.video_url

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-emerald-400" />
          {workout.name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-muted/40 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-muted-foreground">{completedSets}/{totalSets} sets completed</span>
            {timer !== null && (
              <span className="text-emerald-400 font-semibold text-sm animate-pulse">
                Rest: {timer}s
              </span>
            )}
          </div>
          <Progress value={progress} indicatorClassName="bg-emerald-500" />
        </div>

        {/* Exercise tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {exercises.map((ex, i) => {
            const completedEx = ex.sets.filter((s) => s.completed).length
            return (
              <button
                key={i}
                onClick={() => setCurrentExIdx(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentExIdx === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {i + 1}. {ex.exercise_name.split(' ').slice(0, 2).join(' ')}
                {completedEx === ex.sets.length && <span className="ml-1">✓</span>}
              </button>
            )
          })}
        </div>

        {/* Current exercise */}
        {exercises[currentExIdx] && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{exercises[currentExIdx].exercise_name}</h3>
              {videoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setVideoExercise(videoUrl)}
                >
                  <Video className="w-3.5 h-3.5" />
                  How to
                </Button>
              )}
            </div>

            {/* Video embed */}
            {videoExercise && (
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <iframe
                  src={videoExercise}
                  className="w-full h-full"
                  allowFullScreen
                  title="Exercise video"
                />
                <button
                  onClick={() => setVideoExercise(null)}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}

            {/* Sets table */}
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground px-2">
                <span>Set</span>
                <span>Target</span>
                <span>Weight (kg)</span>
                <span>Reps</span>
                <span>Done</span>
              </div>
              {exercises[currentExIdx].sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={`grid grid-cols-5 gap-2 items-center px-2 py-2.5 rounded-lg transition-all duration-200 ${
                    set.completed ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/40'
                  }`}
                >
                  <span className="text-sm font-semibold">{set.set_number}</span>
                  <span className="text-xs text-muted-foreground">{set.reps} @ {set.weight_kg || 'BW'}kg</span>
                  <Input
                    type="number"
                    value={set.actual_weight}
                    onChange={(e) => updateSet(currentExIdx, setIdx, 'actual_weight', Number(e.target.value))}
                    className="h-7 text-xs px-2"
                    step={2.5}
                    disabled={set.completed}
                  />
                  <Input
                    type="number"
                    value={set.actual_reps}
                    onChange={(e) => updateSet(currentExIdx, setIdx, 'actual_reps', Number(e.target.value))}
                    className="h-7 text-xs px-2"
                    disabled={set.completed}
                  />
                  <button
                    onClick={() => toggleSet(currentExIdx, setIdx)}
                    className="flex justify-center"
                  >
                    {set.completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setCurrentExIdx((i) => Math.max(0, i - 1))}
                disabled={currentExIdx === 0}
              >
                Previous
              </Button>
              <Button
                variant={currentExIdx < exercises.length - 1 ? 'brand' : 'brand'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (currentExIdx < exercises.length - 1) {
                    setCurrentExIdx((i) => i + 1)
                  } else {
                    onComplete(exercises)
                  }
                }}
              >
                {currentExIdx < exercises.length - 1 ? 'Next Exercise →' : '🏆 Complete Workout'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  )
}

export default function WorkoutsPage() {
  const { workoutLogs, logWorkout, user } = useAppStore()
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null)

  const handleComplete = (exercises: ActiveExercise[]) => {
    if (!user || !activeWorkout) return
    logWorkout({
      id: `wl-${Date.now()}`,
      user_id: user.id,
      workout_id: activeWorkout.id,
      workout: activeWorkout,
      date: getTodayISO(),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_min: 60,
      exercises: exercises.map((ex) => ({
        exercise_id: ex.exercise_name.toLowerCase().replace(/ /g, '-'),
        exercise_name: ex.exercise_name,
        sets: ex.sets.map((s) => ({
          set_number: s.set_number,
          target_reps: s.reps,
          actual_reps: s.actual_reps,
          weight_kg: s.actual_weight,
        })),
      })),
      rating: 4,
    })
    toast.success('Workout completed! 💪 Great session!')
    setActiveWorkout(null)
  }

  const recentLogs = workoutLogs.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Workouts</h2>
          <p className="text-muted-foreground text-sm">Your PPL program with exercise guides</p>
        </div>
        <Badge variant="success" className="gap-1">
          <Trophy className="w-3 h-3" />
          {workoutLogs.length} logged
        </Badge>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">My Program</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Program Tab */}
        <TabsContent value="programs" className="mt-4">
          <div className="mb-4 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
            <p className="text-sm font-semibold text-emerald-400 mb-1">Push / Pull / Legs Split</p>
            <p className="text-xs text-muted-foreground">
              6-day split designed for optimal muscle growth and recovery. Each muscle group trained twice per week with progressive overload built in.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKOUTS.map((workout) => (
              <motion.div
                key={workout.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <WorkoutCard workout={workout} onStart={setActiveWorkout} />
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <Card key={log.id} className="hover-lift">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{log.workout.name || 'Workout'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.date), 'MMM d, yyyy')}
                            {log.duration_min && ` · ${log.duration_min} min`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {log.rating && (
                          <div className="flex gap-0.5 justify-end">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-xs ${i < log.rating! ? 'text-amber-400' : 'text-muted-foreground'}`}>★</span>
                            ))}
                          </div>
                        )}
                        <Badge variant="success" className="text-xs mt-1">Completed</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
              <Dumbbell className="w-12 h-12 mb-4 opacity-20" />
              <p>No workouts logged yet</p>
              <p className="text-xs mt-1">Start your first workout above</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Active workout modal */}
      <Dialog open={!!activeWorkout} onOpenChange={() => setActiveWorkout(null)}>
        {activeWorkout && (
          <ActiveWorkoutModal
            workout={activeWorkout}
            onClose={() => setActiveWorkout(null)}
            onComplete={handleComplete}
          />
        )}
      </Dialog>
    </div>
  )
}
