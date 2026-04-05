'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, UtensilsCrossed, BookOpen, CheckCircle, ExternalLink, Loader2, Inbox, ShoppingCart, Trash2, Sparkles, Circle, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { GroceryList, SavedMealTemplate, Workout } from '@/types'
import { DEMO_INBOX_ITEMS } from '@/lib/demo-shares'

const IMPORTED_FRIEND_SHARE_STORAGE_KEY = 'rivora-imported-friend-shares'

function readStoredImportedFriendShareIds() {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const raw = window.sessionStorage.getItem(IMPORTED_FRIEND_SHARE_STORAGE_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set<string>()
  }
}

function persistImportedFriendShareId(friendShareId: string) {
  if (typeof window === 'undefined') return

  try {
    const existingIds = Array.from(readStoredImportedFriendShareIds())
    if (!existingIds.includes(friendShareId)) existingIds.push(friendShareId)
    window.sessionStorage.setItem(IMPORTED_FRIEND_SHARE_STORAGE_KEY, JSON.stringify(existingIds))
  } catch {
    // Ignore storage issues and keep going
  }
}

function normalizeImportedSavedMeal(raw: unknown): SavedMealTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const meal = raw as Record<string, unknown>
  const rawItems = Array.isArray(meal.items) ? meal.items : []

  return {
    id: typeof meal.id === 'string' ? meal.id : crypto.randomUUID(),
    name: typeof meal.name === 'string' && meal.name.trim() ? meal.name.trim() : 'Imported Meal',
    meal_type:
      meal.meal_type === 'breakfast' ||
      meal.meal_type === 'lunch' ||
      meal.meal_type === 'dinner' ||
      meal.meal_type === 'snack' ||
      meal.meal_type === 'drink'
        ? meal.meal_type
        : 'lunch',
    macros: {
      calories: Number((meal.macros as Record<string, unknown> | undefined)?.calories ?? 0) || 0,
      protein_g: Number((meal.macros as Record<string, unknown> | undefined)?.protein_g ?? 0) || 0,
      carbs_g: Number((meal.macros as Record<string, unknown> | undefined)?.carbs_g ?? 0) || 0,
      fat_g: Number((meal.macros as Record<string, unknown> | undefined)?.fat_g ?? 0) || 0,
    },
    items: rawItems.map((item) => {
      const rawItem = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const matchedName =
        typeof rawItem.matched_name === 'string' && rawItem.matched_name.trim()
          ? rawItem.matched_name.trim()
          : typeof rawItem.name === 'string' && rawItem.name.trim()
            ? rawItem.name.trim()
            : typeof rawItem.input === 'string' && rawItem.input.trim()
              ? rawItem.input.trim()
              : 'Item'

      return {
        input: typeof rawItem.input === 'string' && rawItem.input.trim() ? rawItem.input.trim() : matchedName,
        matched_name: matchedName,
        amount: Number(rawItem.amount ?? 1) || 1,
        unit: typeof rawItem.unit === 'string' && rawItem.unit.trim() ? rawItem.unit.trim() : 'serving',
        macros: rawItem.macros && typeof rawItem.macros === 'object'
          ? {
              calories: Number((rawItem.macros as Record<string, unknown>).calories ?? 0) || 0,
              protein_g: Number((rawItem.macros as Record<string, unknown>).protein_g ?? 0) || 0,
              carbs_g: Number((rawItem.macros as Record<string, unknown>).carbs_g ?? 0) || 0,
              fat_g: Number((rawItem.macros as Record<string, unknown>).fat_g ?? 0) || 0,
            }
          : undefined,
      }
    }),
    updated_at: typeof meal.updated_at === 'string' && meal.updated_at ? meal.updated_at : new Date().toISOString(),
  }
}

type InboxItem = {
  friend_share_id: string
  share_id: string
  item_type: 'workout' | 'saved_meal' | 'recipe' | 'grocery_list' | 'weekly_recap' | 'social_post'
  item_name: string
  token: string
  message?: string
  owner_name: string
  created_at: string
  imported_at?: string
}

type DemoInboxItem = InboxItem & {
  demo_payload?: Workout | SavedMealTemplate | GroceryList | null
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-4 h-4 shrink-0" />,
  saved_meal: <UtensilsCrossed className="w-4 h-4 shrink-0" />,
  recipe: <BookOpen className="w-4 h-4 shrink-0" />,
  grocery_list: <ShoppingCart className="w-4 h-4 shrink-0" />,
  weekly_recap: <Sparkles className="w-4 h-4 shrink-0" />,
  social_post: <Share2 className="w-4 h-4 shrink-0" />,
}

const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  saved_meal: 'Saved Meal',
  recipe: 'Recipe',
  grocery_list: 'Grocery List',
  weekly_recap: 'Weekly Recap',
  social_post: 'Social Post',
}

const TYPE_FILTERS = ['all', 'workout', 'saved_meal', 'recipe', 'grocery_list', 'social_post'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function SharedInbox() {
  const router = useRouter()
  const isDemoMode = useAppStore((state) => state.isDemoMode)
  const addSavedMeal = useAppStore((state) => state.addSavedMeal)
  const addCustomWorkout = useAppStore((state) => state.addCustomWorkout)
  const savedMeals = useAppStore((state) => state.savedMeals)
  const customWorkouts = useAppStore((state) => state.customWorkouts)
  const setGroceryList = useAppStore((state) => state.setGroceryList)
  const [items, setItems] = useState<DemoInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [importing, setImporting] = useState<string | null>(null)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadInbox = useCallback(async () => {
    if (isDemoMode) {
      const demoItems = filter === 'all' ? DEMO_INBOX_ITEMS : DEMO_INBOX_ITEMS.filter((item) => item.item_type === filter)
      setItems(demoItems)
      setImportedIds(readStoredImportedFriendShareIds())
      setLoading(false)
      return
    }

    const token = await getToken()
    if (!token) { setLoading(false); return }
    try {
      const url = filter === 'all' ? '/api/share/inbox' : `/api/share/inbox?type=${filter}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data: DemoInboxItem[] = await res.json()
      setItems(data)
      // Pre-mark already imported
      const alreadyImported = new Set(data.filter((i) => !!i.imported_at).map((i) => i.friend_share_id))
      const storedImported = readStoredImportedFriendShareIds()
      storedImported.forEach((id) => alreadyImported.add(id))
      setImportedIds(alreadyImported)
    } finally {
      setLoading(false)
    }
  }, [filter, isDemoMode])

  useEffect(() => {
    setLoading(true)
    loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const syncImportedFromStorage = () => {
      const storedImported = readStoredImportedFriendShareIds()
      if (storedImported.size === 0) return
      setImportedIds((current) => {
        const next = new Set(current)
        storedImported.forEach((id) => next.add(id))
        return next
      })
    }

    syncImportedFromStorage()
    window.addEventListener('focus', syncImportedFromStorage)
    window.addEventListener('pageshow', syncImportedFromStorage)

    return () => {
      window.removeEventListener('focus', syncImportedFromStorage)
      window.removeEventListener('pageshow', syncImportedFromStorage)
    }
  }, [])

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(items.map((item) => item.friend_share_id))
      return new Set(Array.from(current).filter((id) => visibleIds.has(id)))
    })
  }, [items])

  async function importItem(item: DemoInboxItem) {
    if (isDemoMode) {
      if (item.item_type === 'saved_meal' && item.demo_payload) {
        const meal = item.demo_payload as SavedMealTemplate
        if (!savedMeals.some((savedMeal) => savedMeal.id === meal.id)) addSavedMeal(meal)
      }
      if (item.item_type === 'workout' && item.demo_payload) {
        const workout = item.demo_payload as Workout
        if (!customWorkouts.some((savedWorkout) => savedWorkout.id === workout.id)) addCustomWorkout(workout)
      }
      if (item.item_type === 'grocery_list' && item.demo_payload) {
        setGroceryList(item.demo_payload as GroceryList)
      }

      persistImportedFriendShareId(item.friend_share_id)
      setImportedIds((prev) => { const next = new Set(prev); next.add(item.friend_share_id); return next })
      return true
    }

    try {
      const token = await getToken()
      if (!token) return false
      const res = await fetch(`/api/share/${item.token}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friend_share_id: item.friend_share_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Import failed')
      if (data.item_type === 'saved_meal' && data.imported_item) {
        const importedMeal = normalizeImportedSavedMeal(data.imported_item)
        if (importedMeal && !savedMeals.some((meal) => meal.id === importedMeal.id)) {
          addSavedMeal(importedMeal)
        }
      }
      if (data.item_type === 'workout' && data.imported_item) {
        const importedWorkout = data.imported_item as Workout
        if (!customWorkouts.some((workout) => workout.id === importedWorkout.id)) {
          addCustomWorkout(importedWorkout)
        }
      }
      if (data.item_type === 'grocery_list' && data.imported_item) {
        setGroceryList(data.imported_item as GroceryList)
      }
      persistImportedFriendShareId(item.friend_share_id)
      setImportedIds((prev) => { const n = new Set(prev); n.add(item.friend_share_id); return n })
      return true
    } catch (err) {
      throw err instanceof Error ? err : new Error('Import failed. Please try again.')
    }
  }

  async function handleImport(item: DemoInboxItem) {
    setImporting(item.friend_share_id)
    try {
      await importItem(item)
      toast.success(`${item.item_name} added to your account!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed. Please try again.')
    } finally {
      setImporting(null)
    }
  }

  function toggleSelected(friendShareId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(friendShareId)) next.delete(friendShareId)
      else next.add(friendShareId)
      return next
    })
  }

  const importableItems = items.filter((item) => item.item_type !== 'weekly_recap' && item.item_type !== 'social_post' && !importedIds.has(item.friend_share_id))
  const selectedImportableItems = importableItems.filter((item) => selectedIds.has(item.friend_share_id))

  async function handleImportMany(targetItems: DemoInboxItem[], mode: 'all' | 'selected') {
    if (targetItems.length === 0) return

    setBulkImporting(true)
    let successCount = 0
    let failureCount = 0

    for (const item of targetItems) {
      setImporting(item.friend_share_id)
      try {
        const imported = await importItem(item)
        if (imported) successCount += 1
      } catch {
        failureCount += 1
      }
    }

    setImporting(null)
    setBulkImporting(false)
    if (mode === 'selected') {
      setSelectedIds((current) => {
        const next = new Set(current)
        targetItems.forEach((item) => next.delete(item.friend_share_id))
        return next
      })
    }

    if (successCount > 0 && failureCount === 0) {
      toast.success(`${successCount} item${successCount === 1 ? '' : 's'} imported.`)
      return
    }

    if (successCount > 0 && failureCount > 0) {
      toast.success(`${successCount} item${successCount === 1 ? '' : 's'} imported. ${failureCount} failed.`)
      return
    }

    toast.error(`Could not import ${mode === 'all' ? 'these items' : 'the selected items'}.`)
  }

  async function handleDelete(item: DemoInboxItem) {
    setDeleting(item.friend_share_id)
    try {
      if (isDemoMode) {
        setItems((current) => current.filter((entry) => entry.friend_share_id !== item.friend_share_id))
        setImportedIds((current) => {
          const next = new Set(current)
          next.delete(item.friend_share_id)
          return next
        })
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(item.friend_share_id)
          return next
        })
        toast.success('Removed from Shared With Me.')
        return
      }

      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/share/inbox/${item.friend_share_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')

      setItems((current) => current.filter((entry) => entry.friend_share_id !== item.friend_share_id))
      setImportedIds((current) => {
        const next = new Set(current)
        next.delete(item.friend_share_id)
        return next
      })
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(item.friend_share_id)
        return next
      })
      toast.success('Removed from Shared With Me.')
    } catch {
      toast.error('Could not remove this shared item.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          disabled={bulkImporting || importableItems.length === 0}
          onClick={() => handleImportMany(importableItems, 'all')}
        >
          {bulkImporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Import All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          disabled={bulkImporting || selectedImportableItems.length === 0}
          onClick={() => handleImportMany(selectedImportableItems, 'selected')}
        >
          {bulkImporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Import Selected
        </Button>
        {selectedImportableItems.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {selectedImportableItems.length} selected
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/60 rounded-xl">
          <Inbox className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nothing shared with you yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">When friends share workouts, meals, recipes, or grocery lists, they&apos;ll appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isImported = importedIds.has(item.friend_share_id)
            const isImporting = importing === item.friend_share_id
            const isDeleting = deleting === item.friend_share_id
            const isViewOnly = item.item_type === 'weekly_recap' || item.item_type === 'social_post'
            const isSelectable = !isImported && !isViewOnly
            const isSelected = selectedIds.has(item.friend_share_id)
            return (
              <div key={item.friend_share_id} className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={!isSelectable || isDeleting || bulkImporting}
                    onClick={() => toggleSelected(item.friend_share_id)}
                    className={`mt-0.5 shrink-0 rounded-full transition-colors ${
                      isSelectable ? 'text-muted-foreground hover:text-foreground' : 'cursor-not-allowed text-muted-foreground/30'
                    }`}
                    aria-label={isSelected ? 'Deselect item' : 'Select item'}
                  >
                    {isSelected ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <span className="mt-0.5 text-muted-foreground">{TYPE_ICONS[item.item_type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      From <span className="text-foreground/80">{item.owner_name}</span>
                      {' · '}
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{TYPE_LABELS[item.item_type]}</Badge>
                </div>

                {item.message && (
                  <p className="text-xs italic text-muted-foreground/80 border-l-2 border-border/50 pl-2">&ldquo;{item.message}&rdquo;</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    disabled={isDeleting || bulkImporting}
                    onClick={() => router.push(`/share/${item.token}?friend_share_id=${item.friend_share_id}`)}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </Button>
                  {isViewOnly ? (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-medium px-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      View only
                    </div>
                  ) : isImported ? (
                    <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium px-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Imported
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      disabled={isImporting || isDeleting || bulkImporting}
                      onClick={() => handleImport(item)}
                    >
                      {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Import
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    disabled={isDeleting || isImporting || bulkImporting}
                    onClick={() => handleDelete(item)}
                  >
                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
