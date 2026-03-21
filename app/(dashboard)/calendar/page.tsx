'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Dumbbell, Apple, Scale, BookOpen, Circle, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/useAppStore'

const EVENT_COLORS = {
  workout: { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Dumbbell, dot: 'bg-emerald-400' },
  meal: { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Apple, dot: 'bg-blue-400' },
  weight_check: { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Scale, dot: 'bg-amber-400' },
  journal: { bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: BookOpen, dot: 'bg-purple-400' },
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const { getCalendarEvents } = useAppStore()

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

                  // Event dots (max 3)
                  const eventTypesSet = new Set(dayEvents.map((e) => e.type))
                  const eventTypes = Array.from(eventTypesSet).slice(0, 3)

                  return (
                    <motion.button
                      key={dateStr}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedDate(day)}
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
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
                {selectedDate && isToday(selectedDate) && (
                  <Badge variant="success" className="text-xs">Today</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {selectedEvents.length > 0 ? (
                  <motion.div
                    key={selectedDateStr || 'empty'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {selectedEvents.map((event, i) => {
                      const config = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS]
                      const Icon = config?.icon || Circle
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border ${config?.bg} transition-all`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold capitalize">{event.type.replace('_', ' ')}</p>
                            <p className="text-xs opacity-70 truncate">{event.title}</p>
                          </div>
                        </div>
                      )
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="no-events"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center"
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
    </div>
  )
}
