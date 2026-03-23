'use client'

import React from 'react'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Dumbbell, Apple, Scale, BookOpen, Circle, Zap,
  Flame, Clock, Pill, Plus, Trash2, Bell,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store/useAppStore'
import { formatWeightValue } from '@/lib/utils'
import type { CalendarReminder } from '@/types'

const EVENT_COLORS = {
  workout: { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Dumbbell, dot: 'bg-emerald-400' },
  meal: { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Apple, dot: 'bg-blue-400' },
  weight_check: { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Scale, dot: 'bg-amber-400' },
  journal: { bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: BookOpen, dot: 'bg-purple-400' },
  supplement: { bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Pill, dot: 'bg-cyan-400' },
  reminder: { bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30', icon: Bell, dot: 'bg-rose-400' },
}

const REMINDER_DOT_COLORS: Record<CalendarReminder['color'], string> = {
  default: 'bg-rose-400',
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  green: 'bg-emerald-400',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-400',
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [expandedType, setExpandedType] = useState<'meal' | 'supplement' | null>(null)
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<CalendarReminder | null>(null)
  // reminder form state
  const [rTitle, setRTitle] = useState('')
  const [rTime, setRTime] = useState('')
  const [rNotes, setRNotes] = useState('')
  const [rColor, setRColor] = useState<CalendarReminder['color']>('default')

  const { getCalendarEvents, getDailyMeals, workoutLogs, supplements, calendarReminders, addCalendarReminder, updateCalendarReminder, removeCalendarReminder, user } = useAppStore()
  const unitSystem = user?.unit_system || 'imperial'

  const events = getCalendarEvents()

  // Build events lookup by date
  const eventsByDate: Record<string, typeof events> = {}
  events.forEach((event) => {
    if (!eventsByDate[event.date]) eventsByDate[event.date] = []
    eventsByDate[event.date].push(event)
  })

  // Calendar days
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd })

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedEvents = selectedDateStr ? (eventsByDate[selectedDateStr] || []) : []
  const selectedMeals = selectedDateStr ? getDailyMeals(selectedDateStr) : []
  const selectedSupplements = selectedDateStr
    ? supplements.filter((s) => s.taken_dates.includes(selectedDateStr))
    : []
  const selectedWorkoutLogs = selectedDateStr ? workoutLogs.filter((log) => log.date === selectedDateStr) : []
  const selectedReminders = selectedDateStr
    ? calendarReminders.filter((r) => r.date === selectedDateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : []

  const openNewReminder = () => {
    setEditingReminder(null)
    setRTitle('')
    setRTime('')
    setRNotes('')
    setRColor('default')
    setReminderDialogOpen(true)
  }

  const openEditReminder = (r: CalendarReminder) => {
    setEditingReminder(r)
    setRTitle(r.title)
    setRTime(r.time || '')
    setRNotes(r.notes || '')
    setRColor(r.color)
    setReminderDialogOpen(true)
  }

  const saveReminder = () => {
    if (!rTitle.trim() || !selectedDateStr) return
    if (editingReminder) {
      updateCalendarReminder(editingReminder.id, { title: rTitle.trim(), time: rTime || undefined, notes: rNotes || undefined, color: rColor })
    } else {
      addCalendarReminder({
        id: `rem-${Date.now()}`,
        date: selectedDateStr,
        title: rTitle.trim(),
        time: rTime || undefined,
        notes: rNotes || undefined,
        color: rColor,
        created_at: new Date().toISOString(),
      })
    }
    setReminderDialogOpen(false)
  }

  // Stats for month
  const monthWorkouts = events.filter((e) => {
    const d = new Date(e.date)
    return e.type === 'workout' && isSameMonth(d, currentDate)
  }).length

  const monthMeals = events.filter((e) => {
    const d = new Date(e.date)
    return e.type === 'meal' && isSameMonth(d, currentDate)
  }).length

  const monthJournals = events.filter((e) => {
    const d = new Date(e.date)
    return e.type === 'journal' && isSameMonth(d, currentDate)
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Calendar</h2>
          <p className="text-muted-foreground text-sm">Your workouts, meals, and check-ins at a glance</p>
        </div>
        {/* Month stats */}
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Dumbbell className="w-3.5 h-3.5" /> {monthWorkouts} workouts
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <Apple className="w-3.5 h-3.5" /> {monthMeals} meal days
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <BookOpen className="w-3.5 h-3.5" /> {monthJournals} journal entries
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {Object.entries(EVENT_COLORS).map(([type, config]) => (
                  <span key={type} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                    {type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayEvents = eventsByDate[dateStr] || []
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isTodayDay = isToday(day)

                  // Event dots (max 3) + reminder dot
                  const eventTypesSet = new Set(dayEvents.map((e) => e.type))
                  const hasReminder = calendarReminders.some((r) => r.date === dateStr)
                  if (hasReminder) eventTypesSet.add('reminder')
                  const eventTypes = Array.from(eventTypesSet).slice(0, 3)

                  return (
                    <motion.button
                      key={dateStr}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedDate(day)
                        setExpandedType(null)
                        setExpandedWorkoutId(null)
                      }}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-1.5 px-1 text-xs transition-all duration-150 ${
                        !isCurrentMonth
                          ? 'text-muted-foreground/30'
                          : isSelected
                          ? 'bg-primary text-primary-foreground'
                          : isTodayDay
                          ? 'bg-primary/15 text-primary font-bold ring-1 ring-primary/40'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className="font-medium leading-none">{format(day, 'd')}</span>
                      {/* Event dots */}
                      {eventTypes.length > 0 && isCurrentMonth && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {eventTypes.map((type) => {
                            const config = EVENT_COLORS[type as keyof typeof EVENT_COLORS]
                            return (
                              <span
                                key={type}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected ? 'bg-white/70' : config?.dot
                                }`}
                              />
                            )
                          })}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected day detail */}
        <div>
          <Card className="sticky top-6 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
                  {selectedDate && isToday(selectedDate) && (
                    <Badge variant="success" className="text-xs">Today</Badge>
                  )}
                </CardTitle>
                {selectedDate && (
                  <Button variant="ghost" size="icon-sm" onClick={openNewReminder} title="Add reminder">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <AnimatePresence mode="wait">
                {selectedEvents.length > 0 || selectedReminders.length > 0 ? (
                  <motion.div
                    key={selectedDateStr || 'empty'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto overscroll-contain"
                  >
                    {/* Workout sections — collapsible */}
                    {selectedWorkoutLogs.map((log) => {
                      const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0)
                      const isExpanded = expandedWorkoutId === log.id
                      return (
                        <div key={log.id} className="border-b border-border/40 last:border-0">
                          {/* Collapsed header — always visible */}
                          <button
                            type="button"
                            onClick={() => setExpandedWorkoutId(isExpanded ? null : log.id)}
                            className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Dumbbell className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{log.workout.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {log.exercises.length} exercises · {totalSets} sets · {log.duration_min || 0}m
                                </p>
                              </div>
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              }
                            </div>
                          </button>

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
                                <div className="px-4 pb-4 space-y-4">
                                  {/* Muscle groups */}
                                  {log.workout.muscle_groups && log.workout.muscle_groups.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {log.workout.muscle_groups.map((mg) => (
                                        <span key={mg} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground capitalize">
                                          {String(mg).replace('_', ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Stats row */}
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { icon: Clock, label: 'Duration', value: `${log.duration_min || 0}m` },
                                      { icon: Flame, label: 'Burned', value: `${log.calories_burned_kcal || 0} kcal` },
                                    ].map(({ icon: Icon, label, value }) => (
                                      <div key={label} className="rounded-xl bg-muted/30 border border-border/50 px-2.5 py-2 text-center">
                                        <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                                        <p className="font-data text-xs font-semibold tabular-nums leading-none">{value}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Exercises */}
                                  <div className="space-y-3">
                                    {log.exercises.map((exercise, exIdx) => (
                                      <div key={`${log.id}-${exercise.exercise_id}-${exIdx}`} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-border/40 bg-muted/20">
                                          <p className="text-xs font-semibold">{exercise.exercise_name}</p>
                                        </div>
                                        <div className="px-3 py-2">
                                          <div className="grid grid-cols-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 px-1">
                                            <span>Set</span>
                                            <span className="text-center">Reps</span>
                                            <span className="text-right">Weight</span>
                                          </div>
                                          <div className="space-y-1">
                                            {exercise.sets.map((set) => (
                                              <div key={set.set_number} className="grid grid-cols-3 items-center text-xs rounded-lg px-2 py-1.5 bg-background/50">
                                                <span className="text-muted-foreground font-medium">{set.set_number}</span>
                                                <span className="text-center font-data font-semibold tabular-nums">
                                                  {set.actual_reps ?? set.target_reps}
                                                </span>
                                                <span className="text-right font-data tabular-nums text-muted-foreground">
                                                  {(set.weight_kg || 0) > 0
                                                    ? formatWeightValue(set.weight_kg || 0, unitSystem)
                                                    : <span className="text-muted-foreground/50">BW</span>}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    {/* Non-workout events */}
                    {selectedEvents
                      .filter(e => e.type !== 'workout')
                      .map((event, i) => {
                        const config = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS]
                        const Icon = config?.icon || Circle
                        const isExpandable = event.type === 'meal' || event.type === 'supplement'
                        const isExpanded = expandedType === event.type
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (isExpandable) {
                                setExpandedType((current) => (current === event.type ? null : event.type as 'meal' | 'supplement'))
                              }
                            }}
                            className={`w-full p-4 text-left transition-all hover:bg-muted/20 ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${config?.bg}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold capitalize">{event.type.replace('_', ' ')}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{event.title}</p>
                                {isExpandable && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {isExpanded ? 'Hide ↑' : 'Show details ↓'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Meal detail expansion */}
                            {event.type === 'meal' && isExpanded && selectedMeals.length > 0 && (
                              <div className="mt-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                                {selectedMeals.map((meal) => (
                                  <div key={meal.id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium truncate">{meal.name}</p>
                                      <span className="text-[11px] text-muted-foreground shrink-0">{meal.time}</span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">
                                      {meal.meal_type} · <span className="font-data">{meal.macros.calories}</span> kcal · <span className="font-data text-emerald-500">{meal.macros.protein_g}g</span> protein
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Supplement detail expansion */}
                            {event.type === 'supplement' && isExpanded && selectedSupplements.length > 0 && (
                              <div className="mt-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                                {selectedSupplements.map((s) => (
                                  <div key={s.id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                                    <p className="text-sm font-medium">{s.name}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">
                                      {s.amount} {s.unit} · {s.category}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </button>
                        )
                      })}

                    {/* Reminders */}
                    {selectedReminders.length > 0 && (
                      <div className="border-t border-border/40 last:border-0">
                        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Reminders</p>
                        </div>
                        <div className="space-y-0 divide-y divide-border/30">
                          {selectedReminders.map((r) => (
                            <div key={r.id} className="flex items-start gap-2.5 px-4 py-3 hover:bg-muted/10 group">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${REMINDER_DOT_COLORS[r.color]}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{r.title}</p>
                                {r.time && <p className="text-xs text-muted-foreground mt-0.5">{r.time}</p>}
                                {r.notes && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.notes}</p>}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button type="button" onClick={() => openEditReminder(r)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                                  <Bell className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => removeCalendarReminder(r.id)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty day with no events shown */}
                    {selectedWorkoutLogs.length === 0 && selectedEvents.filter(e => e.type !== 'workout').length === 0 && selectedReminders.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center p-4">
                        <Circle className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No events</p>
                        <p className="text-xs mt-0.5">Nothing logged on this day</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="no-events"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center p-4"
                  >
                    <Circle className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">No events</p>
                    <p className="text-xs mt-0.5">Nothing logged on this day</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Monthly summary */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Month Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Workouts', count: monthWorkouts, goal: 12, color: 'bg-emerald-500', icon: Dumbbell },
                { label: 'Meal Days', count: monthMeals, goal: 28, color: 'bg-blue-500', icon: Apple },
                { label: 'Journal Entries', count: monthJournals, goal: 14, color: 'bg-purple-500', icon: BookOpen },
              ].map((item) => {
                const Icon = item.icon
                const pct = Math.min(Math.round((item.count / item.goal) * 100), 100)
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" />
                        {item.label}
                      </span>
                      <span className="font-medium">{item.count}/{item.goal}</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reminder dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {selectedDate && (
              <p className="text-xs text-muted-foreground">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
            )}
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="e.g. Doctor appointment" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Time (optional)</Label>
              <Input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={rNotes} onChange={(e) => setRNotes(e.target.value)} placeholder="Any additional details..." className="min-h-[80px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {(Object.entries(REMINDER_DOT_COLORS) as [CalendarReminder['color'], string][]).map(([color, dot]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setRColor(color)}
                    className={`w-6 h-6 rounded-full ${dot} transition-all ${rColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
              <Button variant="brand" className="flex-1" onClick={saveReminder} disabled={!rTitle.trim()}>
                {editingReminder ? 'Update' : 'Add Reminder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
