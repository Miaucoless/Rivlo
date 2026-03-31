'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, UtensilsCrossed, BookOpen, CheckCircle, ExternalLink, Loader2, Inbox, ShoppingCart, Trash2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { GroceryList, SavedMealTemplate } from '@/types'

type InboxItem = {
  friend_share_id: string
  share_id: string
  item_type: 'workout' | 'saved_meal' | 'recipe' | 'grocery_list' | 'weekly_recap'
  item_name: string
  token: string
  message?: string
  owner_name: string
  created_at: string
  imported_at?: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-4 h-4 shrink-0" />,
  saved_meal: <UtensilsCrossed className="w-4 h-4 shrink-0" />,
  recipe: <BookOpen className="w-4 h-4 shrink-0" />,
  grocery_list: <ShoppingCart className="w-4 h-4 shrink-0" />,
  weekly_recap: <Sparkles className="w-4 h-4 shrink-0" />,
}

const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  saved_meal: 'Saved Meal',
  recipe: 'Recipe',
  grocery_list: 'Grocery List',
  weekly_recap: 'Weekly Recap',
}

const TYPE_FILTERS = ['all', 'workout', 'saved_meal', 'recipe', 'grocery_list', 'weekly_recap'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function SharedInbox() {
  const router = useRouter()
  const addSavedMeal = useAppStore((state) => state.addSavedMeal)
  const setGroceryList = useAppStore((state) => state.setGroceryList)
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [importing, setImporting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  const loadInbox = useCallback(async () => {
    const token = await getToken()
    if (!token) { setLoading(false); return }
    try {
      const url = filter === 'all' ? '/api/share/inbox' : `/api/share/inbox?type=${filter}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data: InboxItem[] = await res.json()
      setItems(data)
      // Pre-mark already imported
      const alreadyImported = new Set(data.filter((i) => !!i.imported_at).map((i) => i.friend_share_id))
      setImportedIds(alreadyImported)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    loadInbox()
  }, [loadInbox])

  async function handleImport(item: InboxItem) {
    setImporting(item.friend_share_id)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/share/${item.token}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friend_share_id: item.friend_share_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      if (data.item_type === 'saved_meal' && data.imported_item) {
        addSavedMeal(data.imported_item as SavedMealTemplate)
      }
      if (data.item_type === 'grocery_list' && data.imported_item) {
        setGroceryList(data.imported_item as GroceryList)
      }
      setImportedIds((prev) => { const n = new Set(prev); n.add(item.friend_share_id); return n })
      toast.success(`${item.item_name} added to your account!`)
    } catch {
      toast.error('Import failed. Please try again.')
    } finally {
      setImporting(null)
    }
  }

  async function handleDelete(item: InboxItem) {
    setDeleting(item.friend_share_id)
    try {
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
            const isViewOnly = item.item_type === 'weekly_recap'
            return (
              <div key={item.friend_share_id} className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
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
                    disabled={isDeleting}
                    onClick={() => router.push(`/share/${item.token}`)}
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
                      disabled={isImporting || isDeleting}
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
                    disabled={isDeleting || isImporting}
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
