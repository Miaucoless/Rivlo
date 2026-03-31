'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dumbbell, UtensilsCrossed, BookOpen, CheckCircle, Loader2, AlertCircle, ArrowLeft, ShoppingCart, Flame, Heart, MessageSquare, Sparkles, CalendarRange, Droplets, Target, TrendingUp, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { GroceryItem, GroceryList, SavedMealTemplate, WeeklyRecapShareData } from '@/types'

type SharedItem = {
  share_id: string
  item_type: 'workout' | 'saved_meal' | 'recipe' | 'grocery_list' | 'weekly_recap'
  item_name: string
  item_data: Record<string, unknown>
  owner_name: string
  message?: string
  created_at: string
}

type ShareReaction = {
  reaction: 'fire' | 'love' | 'try_this' | 'inspired'
  count: number
}

type ShareComment = {
  id: string
  body: string
  created_at: string
  user_name: string
  username?: string | null
  is_owner: boolean
}

const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  saved_meal: 'Saved Meal',
  recipe: 'Recipe',
  grocery_list: 'Grocery List',
  weekly_recap: 'Weekly Recap',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-5 h-5" />,
  saved_meal: <UtensilsCrossed className="w-5 h-5" />,
  recipe: <BookOpen className="w-5 h-5" />,
  grocery_list: <ShoppingCart className="w-5 h-5" />,
  weekly_recap: <Sparkles className="w-5 h-5" />,
}

const REACTION_OPTIONS: Array<{
  value: ShareReaction['reaction']
  label: string
  icon: React.ReactNode
}> = [
  { value: 'fire', label: 'Fire', icon: <Flame className="w-3.5 h-3.5" /> },
  { value: 'love', label: 'Love', icon: <Heart className="w-3.5 h-3.5" /> },
  { value: 'try_this', label: 'Try this', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { value: 'inspired', label: 'Inspired', icon: <Sparkles className="w-3.5 h-3.5" /> },
]

// Resolve exercise name from either workout template or log structure
function getExerciseName(ex: Record<string, unknown>): string {
  if (typeof ex.exercise_name === 'string') return ex.exercise_name
  if (ex.exercise && typeof (ex.exercise as Record<string, unknown>).name === 'string') {
    return (ex.exercise as Record<string, unknown>).name as string
  }
  if (typeof ex.name === 'string') return ex.name
  return 'Exercise'
}

function formatGroceryAmount(item: GroceryItem): string | null {
  if (!(item.amount > 0)) return null
  return `${item.amount}${item.unit ? ` ${item.unit}` : ''}`
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const addSavedMeal = useAppStore((state) => state.addSavedMeal)
  const setGroceryList = useAppStore((state) => state.setGroceryList)

  const [item, setItem] = useState<SharedItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [reactions, setReactions] = useState<ShareReaction[]>([])
  const [currentReaction, setCurrentReaction] = useState<ShareReaction['reaction'] | null>(null)
  const [comments, setComments] = useState<ShareComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialPosting, setSocialPosting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
    })
  }, [])

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return }
        const data = await res.json()
        setItem(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const loadSocial = useCallback(async () => {
    setSocialLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/share/${token}/social`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) return
      setReactions(data.reactions ?? [])
      setCurrentReaction(data.current_reaction ?? null)
      setComments(data.comments ?? [])
    } finally {
      setSocialLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSocial()
  }, [authed, loadSocial])

  async function handleImport() {
    if (!authed) return
    setImporting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push(`/login?redirect=/share/${token}`); return }

      const res = await fetch(`/api/share/${token}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error('Import failed')
      if (data.item_type === 'saved_meal' && data.imported_item) {
        addSavedMeal(data.imported_item as SavedMealTemplate)
      }
      if (data.item_type === 'grocery_list' && data.imported_item) {
        setGroceryList(data.imported_item as GroceryList)
      }
      setImported(true)
      toast.success(`${item?.item_name} added to your account!`)
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  async function handleReaction(reaction: ShareReaction['reaction']) {
    if (!authed) {
      router.push(`/login?redirect=/share/${token}`)
      return
    }

    setSocialPosting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?redirect=/share/${token}`)
        return
      }

      const res = await fetch(`/api/share/${token}/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'reaction', reaction }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not react.')

      await loadSocial()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not react right now.')
    } finally {
      setSocialPosting(false)
    }
  }

  async function handleCommentSubmit() {
    if (!commentBody.trim()) return
    if (!authed) {
      router.push(`/login?redirect=/share/${token}`)
      return
    }

    setSocialPosting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?redirect=/share/${token}`)
        return
      }

      const res = await fetch(`/api/share/${token}/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'comment', body: commentBody }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not post comment.')

      setCommentBody('')
      await loadSocial()
      toast.success('Comment posted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post comment.')
    } finally {
      setSocialPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-transparent">
        <div className="absolute inset-0 bg-background/35 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.10),_transparent_38%)]" />
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/55 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-transparent p-4">
        <div className="absolute inset-0 bg-background/40 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.10),_transparent_34%)]" />
        <div className="relative flex min-h-screen items-center justify-center">
        <Card className="max-w-md w-full border-white/35 bg-white/72 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="pt-10 pb-8 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">This link is invalid or has expired.</p>
            <p className="text-sm text-muted-foreground">The item may have been deleted or the link is incorrect.</p>
            <Button variant="outline" onClick={() => router.push('/')} className="mt-2">Go home</Button>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  const macros = item.item_data?.macros as Record<string, number> | undefined
  const recap = item.item_type === 'weekly_recap' ? item.item_data as unknown as WeeklyRecapShareData : null
  const isViewOnly = item.item_type === 'weekly_recap'

  const exercises = item.item_data?.exercises as Record<string, unknown>[] | undefined
  const sharedGroceryList = item.item_type === 'grocery_list' ? item.item_data as unknown as GroceryList : null
  const groceryItems = Array.isArray(sharedGroceryList?.items) ? sharedGroceryList.items : []
  const groceryByCategory = groceryItems.reduce<Record<string, GroceryItem[]>>((acc, groceryItem) => {
    const category = groceryItem.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(groceryItem)
    return acc
  }, {})
  const groceryProgress = groceryItems.length > 0
    ? Math.round((groceryItems.filter((groceryItem) => groceryItem.checked).length / groceryItems.length) * 100)
    : 0
  const ingredients = item.item_data?.ingredients as { name: string; amount?: number; unit?: string }[] | undefined
  const mealItems = item.item_data?.items as { matched_name?: string; input?: string; amount?: number; unit?: string }[] | undefined

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/35 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.10),_transparent_34%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center justify-center">
        <div className="w-full max-w-xl space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/55 px-3 py-2 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/45">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Shared with you</p>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          <Card className="border-white/35 bg-white/72 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/72">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                {TYPE_ICONS[item.item_type]}
                <span>{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
              </div>
              <CardTitle className="text-xl">{item.item_name}</CardTitle>
              <p className="text-sm text-muted-foreground">Shared by <span className="text-foreground font-medium">{item.owner_name}</span></p>
            </CardHeader>

            <CardContent className="space-y-4">
              {item.message && (
                <p className="rounded-xl border border-white/30 bg-white/45 px-3 py-2 text-sm italic text-muted-foreground dark:border-white/10 dark:bg-white/5">&ldquo;{item.message}&rdquo;</p>
              )}

              {recap && (
                <div className="space-y-4 rounded-2xl border border-white/25 bg-white/35 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-white/30 bg-white/45 dark:border-white/10 dark:bg-white/5">
                      <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                      {recap.week_label}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {recap.status === 'winning' ? 'Winning week' : recap.status === 'steady' ? 'Steady week' : 'Reset week'}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-lg font-semibold">{recap.headline}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{recap.highlight}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Workouts', value: `${recap.workouts_completed}/${recap.target_workout_days}`, icon: Dumbbell },
                      { label: 'Protein', value: `${recap.protein_hit_days}/7`, icon: UtensilsCrossed },
                      { label: 'Hydration', value: `${recap.hydration_hit_days}/7`, icon: Droplets },
                      {
                        label: 'Weight',
                        value: typeof recap.weight_delta_kg === 'number'
                          ? `${recap.weight_delta_kg > 0 ? '+' : ''}${recap.weight_delta_kg.toFixed(1)} kg`
                          : 'No change',
                        icon: TrendingUp,
                      },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-xl border border-white/20 bg-white/40 p-3 text-center dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="mb-2 flex justify-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 dark:bg-white/[0.08]">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="font-data text-sm font-semibold">{value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-white/20 bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <Target className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended next move</p>
                        <p className="mt-1 text-sm text-foreground/90">{recap.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {macros && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Calories', value: Math.round(macros.calories ?? 0), unit: 'kcal' },
                    { label: 'Protein', value: Math.round(macros.protein_g ?? 0), unit: 'g' },
                    { label: 'Carbs', value: Math.round(macros.carbs_g ?? 0), unit: 'g' },
                    { label: 'Fat', value: Math.round(macros.fat_g ?? 0), unit: 'g' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="rounded-xl border border-white/25 bg-white/45 p-2 text-center backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                      <p className="font-data text-base font-semibold tabular-nums">{value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {item.item_type === 'saved_meal' && mealItems && mealItems.length > 0 && (
                <div className="space-y-1.5 rounded-2xl border border-white/25 bg-white/35 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingredients</p>
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {mealItems.map((mi, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-0.5">
                        <span className="truncate">{mi.matched_name ?? mi.input ?? 'Item'}</span>
                        {mi.amount && <span className="text-xs text-muted-foreground shrink-0 ml-2">{mi.amount}{mi.unit ? ` ${mi.unit}` : ''}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(item.item_type === 'workout' || item.item_type === 'workout_log' as string) && exercises && exercises.length > 0 && (
                <div className="space-y-1.5 rounded-2xl border border-white/25 bg-white/35 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exercises</p>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-0.5">
                        <span className="truncate">{getExerciseName(ex)}</span>
                        {Array.isArray(ex.sets) && (
                          <Badge variant="secondary" className="text-xs shrink-0 ml-2">{(ex.sets as unknown[]).length} sets</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.item_type === 'recipe' && ingredients && ingredients.length > 0 && (
                <div className="space-y-1.5 rounded-2xl border border-white/25 bg-white/35 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingredients</p>
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-0.5">
                        <span className="truncate">{ing.name}</span>
                        {ing.amount && <span className="text-xs text-muted-foreground shrink-0 ml-2">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.item_type === 'grocery_list' && groceryItems.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-white/25 bg-white/35 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <div className="rounded-xl border border-white/20 bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">Shopping Progress</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-data text-foreground">{groceryItems.filter((groceryItem) => groceryItem.checked).length}</span> of <span className="font-data">{groceryItems.length}</span> items checked off
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-data text-2xl font-bold text-emerald-400">{groceryProgress}%</p>
                        {sharedGroceryList && sharedGroceryList.total_estimated_cost > 0 ? (
                          <p className="text-[11px] text-muted-foreground">${sharedGroceryList.total_estimated_cost.toFixed(2)} est.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/50 dark:bg-white/[0.08]">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${groceryProgress}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(groceryByCategory).map(([category, entries]) => (
                      <div key={category} className="overflow-hidden rounded-xl border border-white/20 bg-white/40 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="flex items-center justify-between border-b border-white/15 px-4 py-3 dark:border-white/10">
                          <span className="font-semibold text-sm">{category}</span>
                          <span className="font-data text-[10px] text-muted-foreground">
                            {entries.filter((entry) => entry.checked).length}/{entries.length}
                          </span>
                        </div>
                        <div>
                          {entries.map((groceryItem, index) => {
                            const amountLabel = formatGroceryAmount(groceryItem)

                            return (
                              <div
                                key={`${category}-${groceryItem.ingredient}-${index}`}
                                className={`flex items-start gap-2 px-3 py-2.5 ${index < entries.length - 1 ? 'border-b border-white/10 dark:border-white/[0.08]' : ''}`}
                              >
                                <span className="mt-0.5 shrink-0 text-muted-foreground">
                                  {groceryItem.checked ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <Circle className="h-4 w-4" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-sm ${groceryItem.checked ? 'text-muted-foreground line-through' : 'text-foreground/90'}`}>
                                    {groceryItem.ingredient}
                                  </p>
                                  {amountLabel ? (
                                    <p className="text-xs text-muted-foreground">{amountLabel}</p>
                                  ) : null}
                                </div>
                                {groceryItem.estimated_price > 0 ? (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    ${groceryItem.estimated_price.toFixed(2)}
                                  </span>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-2xl border border-white/25 bg-white/35 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Community reactions</p>
                    <p className="text-sm text-muted-foreground">
                      Shared {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {socialLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {REACTION_OPTIONS.map((option) => {
                    const matchingReaction = reactions.find((reaction) => reaction.reaction === option.value)
                    const isActive = currentReaction === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleReaction(option.value)}
                        disabled={socialPosting}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-white/20 bg-white/45 text-muted-foreground hover:border-white/35 dark:border-white/10 dark:bg-white/5'
                        }`}
                      >
                        {option.icon}
                        <span>{option.label}</span>
                        <span className="font-data">{matchingReaction?.count ?? 0}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-2 rounded-xl border border-white/20 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation
                  </div>
                  <Textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    maxLength={280}
                    placeholder={authed ? 'Leave encouragement, feedback, or tell them you’re trying it too.' : 'Log in to comment on this share.'}
                    disabled={!authed || socialPosting}
                    className="min-h-[84px] border-white/20 bg-white/60 dark:border-white/10 dark:bg-white/[0.05]"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground">{commentBody.trim().length}/280</p>
                    <Button size="sm" onClick={() => void handleCommentSubmit()} disabled={!authed || socialPosting || !commentBody.trim()}>
                      {socialPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post comment'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {comments.length > 0 ? comments.map((comment) => (
                      <div key={comment.id} className="rounded-xl border border-white/15 bg-white/45 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {comment.user_name}
                            {comment.is_owner ? <span className="ml-1 text-xs text-emerald-400">Creator</span> : null}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</p>
                        </div>
                        {comment.username ? <p className="text-[11px] text-muted-foreground">@{comment.username}</p> : null}
                        <p className="mt-1 text-sm text-foreground/90">{comment.body}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No comments yet. Be the first to react.</p>
                    )}
                  </div>
                </div>
              </div>

              {isViewOnly ? (
                <div className="flex items-center gap-2 justify-center py-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4" />
                  Weekly recaps are view-only shares
                </div>
              ) : imported ? (
                <div className="flex items-center gap-2 justify-center py-2 text-emerald-500 font-medium text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Added to your account
                </div>
              ) : authed === true ? (
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : `Add ${TYPE_LABELS[item.item_type] ?? 'item'} to my account`}
                </Button>
              ) : authed === false ? (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => router.push(`/signup?redirect=/share/${token}`)}>Sign up to import</Button>
                  <Button variant="outline" className="flex-1 border-white/35 bg-white/55 dark:border-white/10 dark:bg-white/5" onClick={() => router.push(`/login?redirect=/share/${token}`)}>Log in</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
