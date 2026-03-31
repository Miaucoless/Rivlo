
'use client'

import React from 'react'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Zap, Apple, Dumbbell, TrendingUp, Plus, ScanLine, Search,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { WaterIntakeCard } from '@/components/dashboard/WaterIntakeCard'
import { DailyQuoteCard } from '@/components/dashboard/DailyQuoteCard'
import { CodeScannerDialog } from '@/components/meals/CodeScannerDialog'
import { getKnownFoodCatalog, primeFoodSearchCache } from '@/lib/food-search'
import { buildWeeklyReview } from '@/lib/weekly-review'
import type { BarcodeFoodLookupResult } from '@/lib/barcode-food'
import type { FoodCatalogItem } from '@/lib/food-search'
import type { SavedMealTemplate } from '@/types'
import { cn, percentage, getTodayISO, formatCalories, formatWeightDelta, formatWeightValue, getWeightUnitLabel } from '@/lib/utils'
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

function getWorkoutSetDisplayName(set: { set_number: number; set_type?: 'standard' | 'drop'; drop_set_index?: number }) {
  if (set.set_type === 'drop') {
    return `Drop Set ${set.drop_set_index ?? 1}`
  }
  return `Set ${set.set_number}`
}

function getWorkoutSetRowClass(set: { set_type?: 'standard' | 'drop' }) {
  return cn(
    'grid grid-cols-3 items-center text-xs rounded px-2 py-1 bg-background/40',
    set.set_type === 'drop' && 'ml-4 w-[calc(100%-1rem)] border border-dashed border-primary/25 bg-primary/[0.05]'
  )
}

const DASHBOARD_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'] as const
type DashboardMealType = (typeof DASHBOARD_MEAL_TYPES)[number]

function dashboardMealTypeLabel(type: DashboardMealType) {
  switch (type) {
    case 'breakfast':
      return 'Breakfast'
    case 'lunch':
      return 'Lunch'
    case 'dinner':
      return 'Dinner'
    case 'snack':
      return 'Snack'
    default:
      return 'Drink'
  }
}

function formatScannedFoodName(item: BarcodeFoodLookupResult) {
  if (item.brand && !item.name.toLowerCase().startsWith(item.brand.toLowerCase())) {
    return `${item.brand} ${item.name}`
  }
  return item.name
}

type DashboardSearchResult =
  | { kind: 'food'; item: FoodCatalogItem; score: number }
  | { kind: 'saved'; item: SavedMealTemplate; score: number }

function normalizeDashboardSearch(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreDashboardSearch(name: string, aliases: string[], query: string) {
  const normalizedQuery = normalizeDashboardSearch(query)
  if (!normalizedQuery) return 0

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const candidates = [name, ...aliases].map(normalizeDashboardSearch).filter(Boolean)

  let bestScore = 0

  candidates.forEach((candidate) => {
    let score = 0

    if (candidate === normalizedQuery) score += 120
    if (candidate.startsWith(normalizedQuery)) score += 80
    if (candidate.includes(normalizedQuery)) score += 50

    const candidateTokens = candidate.split(' ').filter(Boolean)
    const overlap = queryTokens.filter((token) => candidateTokens.includes(token)).length
    score += overlap * 14

    bestScore = Math.max(bestScore, score)
  })

  return bestScore
}

// Quick Add Meal Dialog
function QuickAddMealDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'search' | 'manual' | 'saved' | 'scan'>('search')
  const [mealType, setMealType] = useState<DashboardMealType>('snack')
  const [selectedSavedMealId, setSelectedSavedMealId] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const { addMealEntry, savedMeals } = useAppStore()

  const selectedSavedMeal = savedMeals.find((meal) => meal.id === selectedSavedMealId) ?? null

  useEffect(() => {
    if (!open) return
    if (!selectedSavedMealId && savedMeals.length > 0) {
      setSelectedSavedMealId(savedMeals[0].id)
    }
  }, [open, savedMeals, selectedSavedMealId])

  useEffect(() => {
    if (!open || mode !== 'search') return

    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    const timer = setTimeout(async () => {
      await primeFoodSearchCache(query)
      if (cancelled) return

      const savedMatches = savedMeals
        .map((meal) => ({
          kind: 'saved' as const,
          item: meal,
          score: scoreDashboardSearch(
            meal.name,
            meal.items.map((item) => item.matched_name),
            query,
          ),
        }))
        .filter((result) => result.score > 0)

      const foodMatches = getKnownFoodCatalog()
        .map((item) => ({
          kind: 'food' as const,
          item,
          score: scoreDashboardSearch(item.name, item.aliases, query),
        }))
        .filter((result) => result.score > 0)

      setSearchResults(
        [...savedMatches, ...foodMatches]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10),
      )
      setSearchLoading(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, open, savedMeals, searchQuery])

  const resetState = () => {
    setMode('search')
    setMealType('snack')
    setSelectedSavedMealId(savedMeals[0]?.id ?? '')
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setName('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
  }

  const handleAddManual = () => {
    if (!name || !calories) {
      toast.error('Please fill in at least a name and calories')
      return
    }
    addMealEntry(getTodayISO(), {
      id: `meal-${Date.now()}`,
      meal_type: mealType,
      name,
      macros: {
        calories: Number(calories),
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
      },
      time: format(new Date(), 'h:mm a'),
      recipe: null,
    })
    toast.success(`${name} added to ${dashboardMealTypeLabel(mealType).toLowerCase()}.`)
    setOpen(false)
    resetState()
  }

  const handleAddSavedMeal = () => {
    if (!selectedSavedMeal) {
      toast.error('Pick a saved meal first.')
      return
    }

    addMealEntry(getTodayISO(), {
      id: `meal-${Date.now()}`,
      meal_type: mealType,
      name: selectedSavedMeal.name,
      macros: selectedSavedMeal.macros,
      time: format(new Date(), 'h:mm a'),
      recipe: null,
      meal_items: selectedSavedMeal.items.map((item) => ({
        name: item.matched_name,
        macros: item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        amount: item.amount,
        unit: item.unit,
      })),
      entry_source: 'saved',
      saved_meal_template_id: selectedSavedMeal.id,
    })

    toast.success(`${selectedSavedMeal.name} added to ${dashboardMealTypeLabel(mealType).toLowerCase()}.`)
    setOpen(false)
    resetState()
  }

  const handleAddCatalogSearchResult = (item: FoodCatalogItem) => {
    addMealEntry(getTodayISO(), {
      id: `meal-${Date.now()}`,
      meal_type: mealType,
      name: item.name,
      macros: item.macros_per_serving,
      time: format(new Date(), 'h:mm a'),
      recipe: null,
      meal_items: [
        {
          name: item.name,
          macros: item.macros_per_serving,
          amount: item.default_serving_amount,
          unit: item.default_serving_unit,
        },
      ],
      entry_source: 'search',
    })

    toast.success(`${item.name} added to ${dashboardMealTypeLabel(mealType).toLowerCase()}.`)
    setOpen(false)
    resetState()
  }

  const handleAddSearchResult = (result: DashboardSearchResult) => {
    if (result.kind === 'saved') {
      addMealEntry(getTodayISO(), {
        id: `meal-${Date.now()}`,
        meal_type: mealType,
        name: result.item.name,
        macros: result.item.macros,
        time: format(new Date(), 'h:mm a'),
        recipe: null,
        meal_items: result.item.items.map((item) => ({
          name: item.matched_name,
          macros: item.macros ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          amount: item.amount,
          unit: item.unit,
        })),
        entry_source: 'saved',
        saved_meal_template_id: result.item.id,
      })

      toast.success(`${result.item.name} added to ${dashboardMealTypeLabel(mealType).toLowerCase()}.`)
      setOpen(false)
      resetState()
      return
    }

    handleAddCatalogSearchResult(result.item)
  }

  const handleAddScannedMeal = (item: BarcodeFoodLookupResult, targetMealType: DashboardMealType) => {
    const displayName = formatScannedFoodName(item)

    addMealEntry(getTodayISO(), {
      id: `meal-${Date.now()}`,
      meal_type: targetMealType,
      name: displayName,
      macros: item.macros,
      time: format(new Date(), 'h:mm a'),
      recipe: null,
      meal_items: [
        {
          name: displayName,
          macros: item.macros,
          amount: item.serving_amount,
          unit: item.serving_unit,
        },
      ],
      entry_source: 'search',
    })

    toast.success(`${displayName} added to ${dashboardMealTypeLabel(targetMealType).toLowerCase()}.`)
    setScannerOpen(false)
    setOpen(false)
    resetState()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) resetState()
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Log Meal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'search', label: 'Search' },
                { value: 'manual', label: 'Manual' },
                { value: 'saved', label: 'Saved' },
                { value: 'scan', label: 'Scan' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === option.value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Meal type</Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as DashboardMealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DASHBOARD_MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {dashboardMealTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === 'search' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Search meals or foods</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search chicken bowl, greek yogurt, banana..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Results add a single serving to today&apos;s {dashboardMealTypeLabel(mealType).toLowerCase()}.
                  </p>
                </div>

                <div className="space-y-2">
                  {searchQuery.trim().length < 2 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                      Start typing to search foods and saved meals.
                    </div>
                  ) : searchLoading ? (
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                      Searching foods and meals...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                      No matches yet. Try a simpler food name like &quot;eggs&quot; or &quot;turkey sandwich&quot;.
                    </div>
                  ) : (
                    searchResults.map((result) => {
                      const macros = result.kind === 'saved' ? result.item.macros : result.item.macros_per_serving
                      const meta = result.kind === 'saved'
                        ? `${result.item.items.length} ingredient${result.item.items.length === 1 ? '' : 's'}`
                        : result.item.default_serving_label

                      return (
                        <button
                          key={`${result.kind}-${result.item.id}`}
                          type="button"
                          onClick={() => handleAddSearchResult(result)}
                          className="w-full rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold">{result.item.name}</p>
                                <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {result.kind === 'saved' ? 'Saved' : 'Food'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {meta}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold">{Math.round(macros.calories)} cal</p>
                              <p className="text-xs text-muted-foreground">{Math.round(macros.protein_g * 10) / 10}g protein</p>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {mode === 'saved' && (
              <div className="space-y-4">
                {savedMeals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                    No saved meals yet. Build one in Meals, or use Manual or Scan here.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Pick a saved meal</Label>
                      <Select
                        value={selectedSavedMealId}
                        onValueChange={(value) => {
                          setSelectedSavedMealId(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a meal" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedMeals.map((meal) => (
                            <SelectItem key={meal.id} value={meal.id}>
                              {meal.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSavedMeal ? (
                      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                        <p className="text-sm font-semibold">{selectedSavedMeal.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                          {selectedSavedMeal.meal_type} · {selectedSavedMeal.items.length} ingredient{selectedSavedMeal.items.length === 1 ? '' : 's'}
                        </p>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {[
                            { label: 'Cal', value: selectedSavedMeal.macros.calories },
                            { label: 'Pro', value: `${selectedSavedMeal.macros.protein_g}g` },
                            { label: 'Carb', value: `${selectedSavedMeal.macros.carbs_g}g` },
                            { label: 'Fat', value: `${selectedSavedMeal.macros.fat_g}g` },
                          ].map((macro) => (
                            <div key={macro.label} className="rounded-lg border border-border/40 bg-background/60 px-2 py-2 text-center">
                              <p className="font-data text-xs font-semibold">{macro.value}</p>
                              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{macro.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <Button className="w-full" variant="brand" onClick={handleAddSavedMeal}>
                      Add Saved Meal
                    </Button>
                  </>
                )}
              </div>
            )}

            {mode === 'manual' && (
              <div className="space-y-4">
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
                    <Input type="number" placeholder="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Carbs (g)</Label>
                    <Input type="number" placeholder="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fat (g)</Label>
                    <Input type="number" placeholder="0" value={fat} onChange={(e) => setFat(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" variant="brand" onClick={handleAddManual}>
                  Add Manually
                </Button>
              </div>
            )}

            {mode === 'scan' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ScanLine className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Scan a barcode or nutrition label</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Use your camera for a barcode, or upload a nutrition label photo, then drop it straight into today&apos;s {dashboardMealTypeLabel(mealType).toLowerCase()}.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="w-full gap-2" variant="brand" onClick={() => setScannerOpen(true)}>
                  <ScanLine className="h-4 w-4" />
                  Open Food Scanner
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        initialTarget="today"
        initialMealType={mealType}
        lockTarget
        onAddToToday={(item, targetMealType) => handleAddScannedMeal(item, targetMealType as DashboardMealType)}
        onSaveMeal={() => undefined}
      />
    </>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const {
    user,
    getDailyTotals,
    getDailyMeals,
    mealEntries,
    waterLogs,
    weightHistory,
    workoutLogs,
    streak,
    journalEntries,
    supplements,
    notificationPreferences,
  } = useAppStore()
  const [hasPausedWorkout, setHasPausedWorkout] = useState(false)
  const [expandedDashboardLogId, setExpandedDashboardLogId] = useState<string | null>(null)
  const [expandedMealType, setExpandedMealType] = useState<string | null>(null)
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshPausedState = () => {
      const rawSession = window.localStorage.getItem('rivora-active-workout-session')
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

  const sortedWeightHistory = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date))

  // Calorie progress
  const caloriePct = percentage(todayTotals.calories, user.calorie_target)
  const proteinPct = percentage(todayTotals.protein_g, user.protein_target_g)
  const carbsPct = percentage(todayTotals.carbs_g, user.carb_target_g)
  const fatPct = percentage(todayTotals.fat_g, user.fat_target_g)

  // Remaining
  const caloriesLeft = Math.max(0, user.calorie_target - todayTotals.calories)
  const proteinLeft = Math.max(0, user.protein_target_g - todayTotals.protein_g)

  // Weight data for chart
  const weightChartData = sortedWeightHistory
    .slice(-14)
    .map((entry) => ({
      date: format(parseISO(entry.date), 'MM/dd'),
      weight: entry.weight_kg,
    }))
  const recentWeightChartData = weightChartData.slice(-7)
  const recentWeightValues = recentWeightChartData.map((entry) => entry.weight)
  const weightTrendDomain = recentWeightValues.length > 1
    ? (() => {
        const minWeight = Math.min(...recentWeightValues)
        const maxWeight = Math.max(...recentWeightValues)
        const spread = maxWeight - minWeight
        const padding = Math.max(spread * 0.35, unitSystem === 'metric' ? 0.3 : 0.14)

        return [Math.max(0, minWeight - padding), maxWeight + padding] as [number, number]
      })()
    : undefined

  const recentMealDays = Array.from({ length: 7 }, (_, i) => {
    const dayDate = subDays(new Date(), 6 - i)
    const date = format(dayDate, 'yyyy-MM-dd')
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
      day: format(dayDate, 'EEE'),
      meals,
      calories: totals.calories,
      protein_g: totals.protein_g,
      target: user.calorie_target,
    }
  })

  const weeklyReview = buildWeeklyReview({
    user,
    workoutLogs,
    mealEntries,
    waterLogs,
    weightHistory,
    journalEntries,
    supplements,
    notificationPreferences,
  })
  const workoutRecoveryAction = weeklyReview.recovery_actions.find((action) =>
    action.type === 'shift_workouts' || action.type === 'lighter_targets'
  )
  const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'] as const
  const openMealSlots = mealSlots.filter((slot) => !todayMeals.some((meal) => meal.meal_type === slot))
  const proteinLeftCapped = Math.max(0, proteinLeft)
  const caloriesRemainingText = caloriesLeft > 0
    ? `${caloriesLeft} kcal left for the day`
    : `${todayTotals.calories - user.calorie_target} kcal over target`
  const mealsLoggedCount = todayMeals.length
  const nextOpenMealSlot = openMealSlots[0]
    ? `${openMealSlots[0].charAt(0).toUpperCase()}${openMealSlots[0].slice(1)}`
    : null
  const proteinHitRatePct = weeklyReview.days.length > 0
    ? Math.round((weeklyReview.summary.protein_hit_days / weeklyReview.days.length) * 100)
    : 0
  const hydrationHitRatePct = weeklyReview.days.length > 0
    ? Math.round((weeklyReview.summary.hydration_hit_days / weeklyReview.days.length) * 100)
    : 0
  const overCaloriesBy = Math.max(0, todayTotals.calories - user.calorie_target)
  const showMealSupportCard = expandedMealType === null
  const mealSupport = (() => {
    if (todayMeals.length === 0) {
      return {
        eyebrow: 'Build the day',
        title: 'Start with one reliable meal you can repeat',
        detail: 'Logging one easy, protein-forward meal first makes the rest of the day much easier to steer.',
        stats: [
          {
            label: 'Open slots',
            value: `${mealSlots.length}`,
            sub: 'breakfast · lunch · dinner · snack',
          },
          {
            label: 'Protein target',
            value: `${user.protein_target_g}g`,
            sub: 'still open today',
          },
        ],
        nextStep: 'A simple breakfast or lunch with clear protein is the easiest place to begin.',
      }
    }

    if (overCaloriesBy >= 150 && openMealSlots.length > 0) {
      return {
        eyebrow: 'Ease the landing',
        title: 'Keep the rest of today lighter and easier to track',
        detail: `You are already ${overCaloriesBy} kcal over target, so the best move is a lighter ${nextOpenMealSlot?.toLowerCase() ?? 'finish'} with straightforward protein.`,
        stats: [
          {
            label: 'Over target',
            value: `${overCaloriesBy}`,
            sub: 'kcal above goal',
          },
          {
            label: 'Open slots',
            value: `${openMealSlots.length}`,
            sub: openMealSlots.join(' · '),
          },
        ],
        nextStep: 'Skip the “reset tomorrow” mindset and just make the next meal cleaner and easier.',
      }
    }

    if (proteinLeftCapped >= 25) {
      return {
        eyebrow: 'Protein gap',
        title: 'Protein is the cleanest lever right now',
        detail: `You still have ${proteinLeftCapped}g left, and getting about ${Math.min(proteinLeftCapped, 35)}g in the next meal would move the day a lot.`,
        stats: [
          {
            label: 'Protein left',
            value: `${proteinLeftCapped}g`,
            sub: caloriesRemainingText,
          },
          {
            label: 'Week protein',
            value: `${weeklyReview.summary.protein_hit_days}/${weeklyReview.days.length}`,
            sub: 'goal-hit days',
          },
        ],
        nextStep: `${nextOpenMealSlot ?? 'Your next meal'} is the best place to anchor the rest of the day.`,
      }
    }

    if (openMealSlots.length === 0) {
      return {
        eyebrow: 'Finish clean',
        title: 'The structure is there, now keep the closeout light',
        detail: 'All major meal slots are filled, so the goal now is to avoid unplanned extras and keep the day easy to finish.',
        stats: [
          {
            label: 'Meals logged',
            value: `${mealsLoggedCount}`,
            sub: 'entries across the day',
          },
          {
            label: 'Hydration week',
            value: `${weeklyReview.summary.hydration_hit_days}/${weeklyReview.days.length}`,
            sub: 'water-goal days',
          },
        ],
        nextStep: hydrationHitRatePct < 50
          ? 'If anything else gets logged tonight, make it water first.'
          : 'Only add something else if it clearly supports recovery or hunger.',
      }
    }

    if (proteinHitRatePct < 45) {
      return {
        eyebrow: 'Weekly pattern',
        title: 'Consistency matters more than a perfect macro day',
        detail: `You have only hit protein on ${weeklyReview.summary.protein_hit_days} of ${weeklyReview.days.length} days this week, so making the next open meal predictable matters most.`,
        stats: [
          {
            label: 'Open slots',
            value: `${openMealSlots.length}`,
            sub: openMealSlots.join(' · '),
          },
          {
            label: 'Week protein',
            value: `${proteinHitRatePct}%`,
            sub: 'weekly hit rate',
          },
        ],
        nextStep: `Make ${nextOpenMealSlot?.toLowerCase() ?? 'the next meal'} easy to repeat instead of trying to optimize everything at once.`,
      }
    }

    return {
      eyebrow: 'Keep it steady',
      title: 'The rest of today is still easy to steer',
      detail: `You have ${openMealSlots.length} open meal slot${openMealSlots.length === 1 ? '' : 's'} and ${caloriesLeft > 0 ? `${caloriesLeft} kcal left` : `${overCaloriesBy} kcal over target`}.`,
      stats: [
        {
          label: 'Open slots',
          value: `${openMealSlots.length}`,
          sub: openMealSlots.length > 0 ? openMealSlots.join(' · ') : 'all major slots filled',
        },
        {
          label: 'Hydration week',
          value: `${hydrationHitRatePct}%`,
          sub: 'goal-hit rate',
        },
      ],
      nextStep: nextOpenMealSlot
        ? `Use ${nextOpenMealSlot.toLowerCase()} to keep the day simple and intentional.`
        : 'Keep the rest of the evening easy to log and light to finish.',
    }
  })()

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

  const todayWorkoutLogs = workoutLogs.filter((workout) => workout.date === today)
  const todayWorkoutCalories = todayWorkoutLogs.reduce((sum, workout) => sum + (workout.calories_burned_kcal || 0), 0)
  const todayWorkoutMinutes = todayWorkoutLogs.reduce((sum, workout) => sum + (workout.duration_min || 0), 0)
  const hasExpandedWorkout = todayWorkoutLogs.some((workout) => workout.id === expandedDashboardLogId)
  const showWorkoutSupportCard = !hasExpandedWorkout
  const remainingWorkoutSlots = Math.max(0, weeklyReview.summary.target_workout_days - weeklyReview.summary.workouts_completed)
  const netCaloriesToday = Math.max(0, todayTotals.calories - todayWorkoutCalories)
  const netCaloriePct = percentage(netCaloriesToday, user.calorie_target)

  // Stats
  const hasWeightHistory = sortedWeightHistory.length > 0
  const startWeight = sortedWeightHistory[0]?.weight_kg || user.weight_kg
  const currentWeight = sortedWeightHistory[sortedWeightHistory.length - 1]?.weight_kg || user.weight_kg
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
          <h2 className="text-xl sm:text-2xl font-bold">Good {getGreeting()}, {user.name.split(' ')[0]}</h2>
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
        <motion.div variants={stagger.item} initial="initial" animate="animate" className="self-start">
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
        <motion.div variants={stagger.item} initial="initial" animate="animate" className="md:space-y-4">
          <Card className="hover-lift md:min-h-[33.5rem]">
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
            <CardContent className="flex h-full flex-col">
              {todayWorkoutLogs.length > 0 ? (
                <div className="flex flex-col space-y-3">
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

                  <div className={`space-y-2 overflow-y-auto pr-1 ${hasExpandedWorkout ? 'md:max-h-[25.5rem]' : 'md:max-h-[11.75rem]'}`}>
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
                                        {exercise.sets.map((set, setIndex) => (
                                          <div key={`${exercise.exercise_id}-${set.set_number}-${set.drop_set_index ?? 'main'}-${setIndex}`} className={getWorkoutSetRowClass(set)}>
                                            <span className={cn('font-medium text-muted-foreground', set.set_type === 'drop' && 'text-primary')}>{getWorkoutSetDisplayName(set)}</span>
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
                <div className="flex flex-col">
                  <div className="flex min-h-[11.5rem] items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/[0.06] px-5 py-8 text-center text-muted-foreground md:min-h-[15.5rem]">
                    <div className="max-w-[17rem]">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-muted/20">
                        <Dumbbell className="h-5 w-5 opacity-40" />
                      </div>
                      <p className="text-sm font-medium text-foreground/80">No workouts logged yet today</p>
                      <p className="mt-1 text-xs leading-5">Log your first session to see today&apos;s workout summary here.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {showWorkoutSupportCard && (
            <Card className="hidden md:block md:min-h-[18.5rem]">
              <CardContent className="flex h-full flex-col justify-between p-4">
                <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {todayWorkoutLogs.length > 0 ? 'Keep the week moving' : 'Shape the rest of the week'}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5">
                      {todayWorkoutLogs.length > 0
                        ? 'Use the rest of this week to protect consistency, not perfection.'
                        : 'A smaller, easier session is better than waiting for the perfect day.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Week pace</p>
                    <p className="mt-1 font-data text-lg font-semibold">
                      {weeklyReview.summary.workouts_completed}/{weeklyReview.summary.target_workout_days}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {remainingWorkoutSlots} workout{remainingWorkoutSlots === 1 ? '' : 's'} still open
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {todayWorkoutLogs.length > 0 ? 'Logged days' : 'Reset ready'}
                    </p>
                    <p className="mt-1 font-data text-lg font-semibold">
                      {todayWorkoutLogs.length > 0 ? `${weeklyReview.summary.days_tracked}/${weeklyReview.days.length}` : weeklyReview.recovery_actions.length}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {todayWorkoutLogs.length > 0
                        ? 'days with activity data'
                        : `recovery action${weeklyReview.recovery_actions.length === 1 ? '' : 's'} available`}
                    </p>
                  </div>
                </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Next step</p>
                  <p className="mt-1 text-xs font-medium leading-5">
                    {workoutRecoveryAction?.title ?? 'Place your next workout on the day you are most likely to follow through.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Today's meals */}
        <motion.div variants={stagger.item} initial="initial" animate="animate" className="md:space-y-4">
          <Card className="md:min-h-[33.5rem]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Today&apos;s Meals</CardTitle>
                <QuickAddMealDialog />
              </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col">
              {todayMeals.length > 0 ? (
                <div className="flex flex-col space-y-3">
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
                              <div className="max-h-[44vh] overflow-y-auto border-t border-border/40 divide-y divide-border/30 pr-1 md:max-h-none md:overflow-visible md:pr-0">
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
                                            <>
                                              <div className="rounded-lg bg-muted/20 px-2 py-1.5 mb-1.5">
                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Recipe Macros</p>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  <span className="text-[10px] font-data text-muted-foreground/70">{meal.macros.calories} kcal</span>
                                                  <span className="text-[10px] text-border/30">·</span>
                                                  <span className="text-[10px] font-data text-muted-foreground/70">{meal.macros.protein_g}g P</span>
                                                  <span className="text-[10px] text-border/30">·</span>
                                                  <span className="text-[10px] font-data text-muted-foreground/70">{meal.macros.carbs_g}g C</span>
                                                  <span className="text-[10px] text-border/30">·</span>
                                                  <span className="text-[10px] font-data text-muted-foreground/70">{meal.macros.fat_g}g F</span>
                                                </div>
                                              </div>
                                              {meal.recipe.ingredients.map((ingredient, ingredientIndex) => (
                                                <div key={`${meal.id}-recipe-ingredient-${ingredientIndex}`}>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-medium text-foreground/70 truncate">{ingredient.name}</span>
                                                    <span className="text-[10px] font-data text-muted-foreground/40">{ingredient.amount} {ingredient.unit}</span>
                                                  </div>
                                                  {(ingredient.calories_per_unit ?? 0) > 0 && (
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
                                              ))}
                                            </>
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
                <div className="flex flex-col">
                  <div className="flex flex-1 flex-col items-center justify-center h-40 text-muted-foreground text-sm text-center">
                    <Apple className="w-10 h-10 mb-3 opacity-20" />
                    <p>No meals logged yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {showMealSupportCard && (
            <Card className="hidden md:block md:min-h-[18.5rem]">
              <CardContent className="flex h-full flex-col justify-between p-4">
                <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{mealSupport.eyebrow}</p>
                    <p className="mt-1 text-sm font-medium leading-5">{mealSupport.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{mealSupport.detail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {mealSupport.stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 font-data text-lg font-semibold">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
                    </div>
                  ))}
                </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Fastest win</p>
                  <p className="mt-1 text-xs font-medium leading-5">{mealSupport.nextStep}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* AI Insight + recent journal */}
        <motion.div variants={stagger.item} initial="initial" animate="animate" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">Weekly Check-In</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        weeklyReview.status === 'winning'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : weeklyReview.status === 'steady'
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      )}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      {weeklyReview.status === 'winning' ? 'Winning week' : weeklyReview.status === 'steady' ? 'Steady week' : 'Reset week'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {weeklyReview.week_label} · {weeklyReview.recovery_actions.length > 0
                      ? `${weeklyReview.recovery_actions.length} recovery action${weeklyReview.recovery_actions.length === 1 ? '' : 's'} ready`
                      : 'No reset needed right now'}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Next move</p>
                <p className="mt-1.5 text-sm font-semibold leading-5">{weeklyReview.recommendation.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{weeklyReview.recommendation.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Workouts', value: `${weeklyReview.summary.workouts_completed}/${weeklyReview.summary.target_workout_days}`, sub: 'planned days' },
                  { label: 'Protein', value: `${weeklyReview.summary.protein_hit_days}/${weeklyReview.days.length}`, sub: 'goal-hit days' },
                  { label: 'Hydration', value: `${weeklyReview.summary.hydration_hit_days}/${weeklyReview.days.length}`, sub: 'water-goal days' },
                  { label: 'Tracked', value: `${weeklyReview.summary.days_tracked}/${weeklyReview.days.length}`, sub: 'days with data' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                      <p className="font-data text-lg font-semibold">{item.value}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{item.sub}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily quote */}
          <DailyQuoteCard />

          {/* Weight trend card */}
          {sortedWeightHistory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold">Weight Trend</p>
                  <span className={`text-xs font-semibold ${weightChange < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {weightChange < 0 ? '↓' : '↑'} {formatWeightValue(Math.abs(weightChange), unitSystem).replace(/\s(?:kg|lbs)$/, ` ${getWeightUnitLabel(unitSystem)}`)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={72}>
                  <AreaChart data={recentWeightChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wt-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {weightTrendDomain ? <YAxis domain={weightTrendDomain} hide /> : null}
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#wt-area)"
                      dot={{ r: 2.5, fill: '#10b981', strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatWeightValue(sortedWeightHistory[0]?.weight_kg || startWeight, unitSystem)} start</span>
                  <span>{formatWeightValue(currentWeight, unitSystem)} now</span>
                </div>
              </CardContent>
            </Card>
          )}

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
