'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle, Circle, Compass, Dumbbell, Inbox, Loader2, MessageSquareText, Search, Send, Share2, ShoppingCart, Sparkles, Target, TrendingUp, UtensilsCrossed, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { DEMO_INBOX_ITEMS } from '@/lib/demo-shares'
import { buildSocialProfileHref } from '@/lib/social-connections'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { GroceryItem, GroceryList, SavedMealTemplate, SocialPost, WeeklyRecapShareData, Workout } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type ConversationSummary = {
  id: string
  title: string
  username?: string | null
  avatar_url?: string | null
  latest_at: string
  latest_preview: string
  unread_count: number
  item_count: number
}

type TimelineEntry =
  | {
      id: string
      type: 'message'
      created_at: string
      body: string
      share_id: string
      direction: 'incoming' | 'outgoing'
    }
  | {
      id: string
      type: 'share'
      created_at: string
      share_id: string
      friend_share_id?: string
      token: string
      item_type: string
      item_name: string
      message?: string | null
      item_data?: Record<string, unknown> | null
      direction: 'incoming' | 'outgoing'
    }

type ConversationDetail = {
  counterpart: {
    id: string
    name: string
    username?: string | null
    avatar_url?: string | null
  }
  latest_share_id: string | null
  latest_share_token: string | null
  timeline: TimelineEntry[]
}

type ConversationsResponse = {
  conversations: ConversationSummary[]
  initialConversationId: string | null
  initialDetail: ConversationDetail | null
}

type DemoConversation = ConversationSummary & ConversationDetail

const DEMO_THREAD_STORAGE_KEY = 'rivora-demo-conversation-messages'
const IMPORTED_FRIEND_SHARE_STORAGE_KEY = 'rivora-imported-friend-shares'
const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  saved_meal: 'Saved Meal',
  recipe: 'Recipe',
  grocery_list: 'Grocery List',
  weekly_recap: 'Weekly Recap',
  social_post: 'Social Post',
}

async function getToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function getDemoConversations(): DemoConversation[] {
  const jordanShare = DEMO_INBOX_ITEMS.find((item) => item.token === 'demo-workout-token')
  const miaShare = DEMO_INBOX_ITEMS.find((item) => item.token === 'demo-meal-token')
  const chrisShare = DEMO_INBOX_ITEMS.find((item) => item.token === 'demo-grocery-token')

  const storedMessages = readStoredDemoMessages()

  return [
    {
      id: 'demo-friend-jordan',
      title: 'Jordan Lee',
      username: 'jordanlifts',
      avatar_url: null,
      latest_at: storedMessages['demo-friend-jordan']?.[0]?.created_at ?? jordanShare?.created_at ?? new Date().toISOString(),
      latest_preview: storedMessages['demo-friend-jordan']?.[0]?.body ?? jordanShare?.message ?? 'Shared a workout with you',
      unread_count: 1,
      item_count: 1,
      counterpart: {
        id: 'demo-friend-jordan',
        name: 'Jordan Lee',
        username: 'jordanlifts',
        avatar_url: null,
      },
      latest_share_id: jordanShare?.share_id ?? null,
      latest_share_token: jordanShare?.token ?? null,
      timeline: [
        {
          id: `share-${jordanShare?.share_id}`,
          type: 'share',
          created_at: jordanShare?.created_at ?? new Date().toISOString(),
          share_id: jordanShare?.share_id ?? 'demo-share-workout',
          token: jordanShare?.token ?? 'demo-workout-token',
          item_type: jordanShare?.item_type ?? 'workout',
          item_name: jordanShare?.item_name ?? 'Shared workout',
          message: jordanShare?.message,
          item_data: (jordanShare?.demo_payload ?? null) as Record<string, unknown> | null,
          direction: 'incoming',
        },
        {
          id: 'demo-jordan-message-1',
          type: 'message',
          created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
          share_id: jordanShare?.share_id ?? 'demo-share-workout',
          body: 'I think this one would fit your week really well. The first lift is heavy but the rest moves fast.',
          direction: 'incoming',
        },
        ...(storedMessages['demo-friend-jordan'] ?? []),
      ],
    },
    {
      id: 'demo-friend-mia',
      title: 'Mia Brooks',
      username: 'miameals',
      avatar_url: null,
      latest_at: storedMessages['demo-friend-mia']?.[0]?.created_at ?? miaShare?.created_at ?? new Date().toISOString(),
      latest_preview: storedMessages['demo-friend-mia']?.[0]?.body ?? miaShare?.message ?? 'Shared a meal with you',
      unread_count: 0,
      item_count: 1,
      counterpart: {
        id: 'demo-friend-mia',
        name: 'Mia Brooks',
        username: 'miameals',
        avatar_url: null,
      },
      latest_share_id: miaShare?.share_id ?? null,
      latest_share_token: miaShare?.token ?? null,
      timeline: [
        {
          id: `share-${miaShare?.share_id}`,
          type: 'share',
          created_at: miaShare?.created_at ?? new Date().toISOString(),
          share_id: miaShare?.share_id ?? 'demo-share-meal',
          token: miaShare?.token ?? 'demo-meal-token',
          item_type: miaShare?.item_type ?? 'saved_meal',
          item_name: miaShare?.item_name ?? 'Shared meal',
          message: miaShare?.message,
          item_data: (miaShare?.demo_payload ?? null) as Record<string, unknown> | null,
          direction: 'incoming',
        },
        {
          id: 'demo-mia-message-1',
          type: 'message',
          created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
          share_id: miaShare?.share_id ?? 'demo-share-meal',
          body: 'If you want more carbs after training, just add another half cup of rice.',
          direction: 'incoming',
        },
        ...(storedMessages['demo-friend-mia'] ?? []),
      ],
    },
    {
      id: 'demo-friend-chris',
      title: 'Chris Nolan',
      username: 'chrisbuilds',
      avatar_url: null,
      latest_at: storedMessages['demo-friend-chris']?.[0]?.created_at ?? chrisShare?.created_at ?? new Date().toISOString(),
      latest_preview: storedMessages['demo-friend-chris']?.[0]?.body ?? chrisShare?.message ?? 'Shared a grocery list with you',
      unread_count: 0,
      item_count: 1,
      counterpart: {
        id: 'demo-friend-chris',
        name: 'Chris Nolan',
        username: 'chrisbuilds',
        avatar_url: null,
      },
      latest_share_id: chrisShare?.share_id ?? null,
      latest_share_token: chrisShare?.token ?? null,
      timeline: [
        {
          id: `share-${chrisShare?.share_id}`,
          type: 'share',
          created_at: chrisShare?.created_at ?? new Date().toISOString(),
          share_id: chrisShare?.share_id ?? 'demo-share-grocery',
          token: chrisShare?.token ?? 'demo-grocery-token',
          item_type: chrisShare?.item_type ?? 'grocery_list',
          item_name: chrisShare?.item_name ?? 'Shared grocery list',
          message: chrisShare?.message,
          item_data: (chrisShare?.demo_payload ?? null) as Record<string, unknown> | null,
          direction: 'incoming',
        },
        ...(storedMessages['demo-friend-chris'] ?? []),
      ],
    },
  ].sort((left, right) => new Date(right.latest_at).getTime() - new Date(left.latest_at).getTime())
}

function readStoredDemoMessages(): Record<string, TimelineEntry[]> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(DEMO_THREAD_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, TimelineEntry[]>) : {}
  } catch {
    return {}
  }
}

function writeStoredDemoMessages(messages: Record<string, TimelineEntry[]>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DEMO_THREAD_STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // Ignore demo storage failures.
  }
}

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
    // Ignore storage issues and keep going.
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

function getItemIcon(itemType: string) {
  switch (itemType) {
    case 'saved_meal':
    case 'recipe':
      return <UtensilsCrossed className="h-4 w-4" />
    case 'workout':
      return <Dumbbell className="h-4 w-4" />
    case 'grocery_list':
      return <ShoppingCart className="h-4 w-4" />
    case 'social_post':
      return <Compass className="h-4 w-4" />
    default:
      return <Share2 className="h-4 w-4" />
  }
}

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

export function SharedConversations() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemoMode = useAppStore((state) => state.isDemoMode)
  const addSavedMeal = useAppStore((state) => state.addSavedMeal)
  const addCustomWorkout = useAppStore((state) => state.addCustomWorkout)
  const setGroceryList = useAppStore((state) => state.setGroceryList)
  const savedMeals = useAppStore((state) => state.savedMeals)
  const customWorkouts = useAppStore((state) => state.customWorkouts)
  const notifications = useAppStore((state) => state.notifications)
  const markNotificationRead = useAppStore((state) => state.markNotificationRead)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [previewEntry, setPreviewEntry] = useState<Extract<TimelineEntry, { type: 'share' }> | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importingPreview, setImportingPreview] = useState(false)
  const [importedFriendShareIds, setImportedFriendShareIds] = useState<Set<string>>(new Set())
  const timelineScrollRef = useRef<HTMLDivElement | null>(null)
  const timelineEndRef = useRef<HTMLDivElement | null>(null)
  const authTokenRef = useRef<string | null>(null)
  const hydratedDetailIdRef = useRef<string | null>(null)

  const getCachedToken = async () => {
    if (authTokenRef.current) return authTokenRef.current
    const token = await getToken()
    authTokenRef.current = token
    return token
  }

  const openProfile = (username?: string | null, name?: string | null) => {
    router.push(buildSocialProfileHref({ username, name }))
  }

  useEffect(() => {
    setImportedFriendShareIds(readStoredImportedFriendShareIds())
  }, [])

  useLayoutEffect(() => {
    if (!selectedId || !detail || detailLoading) return

    const frame = window.requestAnimationFrame(() => {
      const nestedFrame = window.requestAnimationFrame(() => {
        const container = timelineScrollRef.current
        if (!container) return
        container.scrollTop = container.scrollHeight
        timelineEndRef.current?.scrollIntoView({ block: 'end' })
      })

      return () => window.cancelAnimationFrame(nestedFrame)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [selectedId, detail, detailLoading, detail?.timeline.length])

  useEffect(() => {
    if (!selectedId || !detail || detailLoading) return

    const timeout = window.setTimeout(() => {
      const container = timelineScrollRef.current
      if (!container) return
      container.scrollTop = container.scrollHeight
      timelineEndRef.current?.scrollIntoView({ block: 'end' })
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [selectedId, detail, detailLoading, detail?.timeline.length])

  useEffect(() => {
    let active = true

    async function loadConversations() {
      setLoading(true)

      if (isDemoMode) {
        const demoConversations = getDemoConversations()
        if (!active) return
        setConversations(demoConversations)
        setLoading(false)
        return
      }

      try {
        const token = await getCachedToken()
        if (!token) {
          if (active) setConversations([])
          return
        }

        const requestedConversation = searchParams.get('conversation')
        const endpoint = requestedConversation
          ? `/api/share/conversations?selected=${encodeURIComponent(requestedConversation)}`
          : '/api/share/conversations'

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Could not load shared threads.')

        if (!active) return

        if (Array.isArray(data)) {
          setConversations(data as ConversationSummary[])
          return
        }

        const payload = data as ConversationsResponse
        setConversations(payload.conversations ?? [])

        if (payload.initialConversationId) {
          hydratedDetailIdRef.current = payload.initialDetail ? payload.initialConversationId : null
          setSelectedId(payload.initialConversationId)
        } else {
          hydratedDetailIdRef.current = null
          setSelectedId(null)
        }

        if (payload.initialDetail) {
          setDetail(payload.initialDetail)
        } else {
          setDetail(null)
        }
      } catch (error) {
        if (active) setConversations([])
        toast.error(error instanceof Error ? error.message : 'Could not load shared threads.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadConversations()

    return () => {
      active = false
    }
  }, [isDemoMode, searchParams])

  useEffect(() => {
    const requestedConversation = searchParams.get('conversation')
    if (requestedConversation) {
      setSelectedId(requestedConversation)
      return
    }

  }, [searchParams])

  useEffect(() => {
    if (!selectedId) return

    notifications
      .filter((notification) =>
        !notification.read &&
        notification.action_url?.startsWith(`/dashboard/shared?conversation=${selectedId}`)
      )
      .forEach((notification) => {
        markNotificationRead(notification.id)
      })
  }, [markNotificationRead, notifications, selectedId])

  useEffect(() => {
    let active = true

    async function loadDetail(conversationId: string) {
      const shouldHydrateSilently = hydratedDetailIdRef.current === conversationId
      if (!shouldHydrateSilently) setDetailLoading(true)

      if (isDemoMode) {
        const demoConversation = getDemoConversations().find((conversation) => conversation.id === conversationId) ?? null
        if (!active) return
        setDetail(demoConversation)
        hydratedDetailIdRef.current = null
        setDetailLoading(false)
        return
      }

      try {
        const token = await getCachedToken()
        if (!token) {
          if (active) setDetail(null)
          return
        }

        const res = await fetch(`/api/share/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Could not load this shared thread.')
        if (active) setDetail(data as ConversationDetail)
      } catch (error) {
        if (active) setDetail(null)
        toast.error(error instanceof Error ? error.message : 'Could not load this shared thread.')
      } finally {
        hydratedDetailIdRef.current = null
        if (active) setDetailLoading(false)
      }
    }

    if (selectedId) {
      if (detail?.counterpart.id === selectedId && hydratedDetailIdRef.current === selectedId) {
        hydratedDetailIdRef.current = null
        return
      }
      void loadDetail(selectedId)
    } else {
      setDetail(null)
    }

    return () => {
      active = false
    }
  }, [detail?.counterpart.id, isDemoMode, selectedId])

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) => {
      return (
        conversation.title.toLowerCase().includes(query) ||
        (conversation.username ?? '').toLowerCase().includes(query) ||
        conversation.latest_preview.toLowerCase().includes(query)
      )
    })
  }, [conversations, search])

  const handleOpenConversation = (conversationId: string) => {
    setSelectedId(conversationId)
    router.replace(`/dashboard/shared?conversation=${conversationId}`, { scroll: false })
  }

  const handleOpenPreview = (entry: Extract<TimelineEntry, { type: 'share' }>) => {
    if (entry.item_type === 'social_post') {
      const socialPost = entry.item_data as SocialPost | null
      if (socialPost?.id) {
        router.push(`/dashboard/feed?post=${encodeURIComponent(socialPost.id)}`)
        return
      }
    }

    setPreviewEntry(entry)
    setPreviewOpen(true)
  }

  const handleSend = async () => {
    const message = draftMessage.trim()
    if (!selectedId || !detail || !message) return

    setSending(true)

    if (isDemoMode) {
      const nextMessage: TimelineEntry = {
        id: `demo-message-${Date.now()}`,
        type: 'message',
        created_at: new Date().toISOString(),
        body: message,
        share_id: detail.latest_share_id ?? 'demo-share',
        direction: 'outgoing',
      }

      const stored = readStoredDemoMessages()
      const existing = stored[selectedId] ?? []
      const nextStored = { ...stored, [selectedId]: [...existing, nextMessage] }
      writeStoredDemoMessages(nextStored)
      setDetail((current) => current ? { ...current, timeline: [...current.timeline, nextMessage] } : current)
      setConversations((current) => current.map((conversation) => conversation.id === selectedId ? {
        ...conversation,
        latest_at: nextMessage.created_at,
        latest_preview: nextMessage.body,
      } : conversation).sort((left, right) => new Date(right.latest_at).getTime() - new Date(left.latest_at).getTime()))
      setDraftMessage('')
      setSending(false)
      return
    }

    try {
      const token = await getCachedToken()
      if (!token) throw new Error('Sign in again to add a comment.')

      const res = await fetch(`/api/share/conversations/${selectedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          body: message,
          share_id: detail.latest_share_id,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Could not post comment.')
      setDraftMessage('')

      const refresh = await fetch(`/api/share/conversations/${selectedId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const refreshedData = await refresh.json().catch(() => null)
      if (refresh.ok && refreshedData) {
        setDetail(refreshedData as ConversationDetail)
      }

      setConversations((current) => current.map((conversation) => conversation.id === selectedId ? {
        ...conversation,
        latest_at: new Date().toISOString(),
        latest_preview: message,
      } : conversation).sort((left, right) => new Date(right.latest_at).getTime() - new Date(left.latest_at).getTime()))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post comment.')
    } finally {
      setSending(false)
    }
  }

  const handleImportPreview = async () => {
    if (!previewEntry) return
    if (previewEntry.item_type === 'social_post' || previewEntry.item_type === 'weekly_recap') return

    setImportingPreview(true)

    try {
      if (isDemoMode) {
        if (previewEntry.item_type === 'saved_meal' && previewEntry.item_data) {
          const meal = previewEntry.item_data as SavedMealTemplate
          if (!savedMeals.some((savedMeal) => savedMeal.id === meal.id)) addSavedMeal(meal)
        }

        if (previewEntry.item_type === 'workout' && previewEntry.item_data) {
          const workout = previewEntry.item_data as Workout
          if (!customWorkouts.some((savedWorkout) => savedWorkout.id === workout.id)) addCustomWorkout(workout)
        }

        if (previewEntry.item_type === 'grocery_list' && previewEntry.item_data) {
          setGroceryList(previewEntry.item_data as GroceryList)
        }

        if (previewEntry.friend_share_id) {
          persistImportedFriendShareId(previewEntry.friend_share_id)
          setImportedFriendShareIds((current) => new Set([...current, previewEntry.friend_share_id!]))
        }

        toast.success(`${previewEntry.item_name} added to your account.`)
        setPreviewOpen(false)
        return
      }

      const token = await getCachedToken()
      if (!token) throw new Error('Sign in again to import this item.')

      const res = await fetch(`/api/share/${previewEntry.token}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(previewEntry.friend_share_id ? { friend_share_id: previewEntry.friend_share_id } : {}),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Could not import this item.')

      if (data.item_type === 'saved_meal' && data.imported_item) {
        const importedMeal = normalizeImportedSavedMeal(data.imported_item)
        if (importedMeal && !savedMeals.some((meal) => meal.id === importedMeal.id)) addSavedMeal(importedMeal)
      }

      if (data.item_type === 'workout' && data.imported_item) {
        const importedWorkout = data.imported_item as Workout
        if (!customWorkouts.some((workout) => workout.id === importedWorkout.id)) addCustomWorkout(importedWorkout)
      }

      if (data.item_type === 'grocery_list' && data.imported_item) {
        setGroceryList(data.imported_item as GroceryList)
      }

      if (previewEntry.friend_share_id) {
        persistImportedFriendShareId(previewEntry.friend_share_id)
        setImportedFriendShareIds((current) => new Set([...current, previewEntry.friend_share_id!]))
      }

      toast.success(`${previewEntry.item_name} added to your account.`)
      setPreviewOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import this item.')
    } finally {
      setImportingPreview(false)
    }
  }

  const mobileShowingDetail = Boolean(selectedId)
  const importedInPreview = previewEntry?.friend_share_id ? importedFriendShareIds.has(previewEntry.friend_share_id) : false
  const previewSocialPost = previewEntry?.item_type === 'social_post' ? previewEntry.item_data as SocialPost | undefined : undefined
  const previewRecap = previewEntry?.item_type === 'weekly_recap' ? previewEntry.item_data as WeeklyRecapShareData | undefined : undefined
  const previewMacros = previewSocialPost?.type === 'meal'
    ? {
        calories: previewSocialPost.mealData?.calories ?? 0,
        protein_g: previewSocialPost.mealData?.protein ?? 0,
        carbs_g: previewSocialPost.mealData?.carbs ?? 0,
        fat_g: previewSocialPost.mealData?.fat ?? 0,
      }
    : previewEntry?.item_data?.macros as Record<string, number> | undefined
  const previewExercises = previewSocialPost?.type === 'workout'
    ? previewSocialPost.workoutData?.exercises
    : previewEntry?.item_data?.exercises as Record<string, unknown>[] | undefined
  const previewIngredients = previewSocialPost?.type === 'meal'
    ? previewSocialPost.mealData?.ingredients
    : previewEntry?.item_data?.ingredients as Array<{ name: string; amount?: number; unit?: string }> | undefined
  const previewMealItems = previewSocialPost?.type === 'meal'
    ? previewSocialPost.mealData?.ingredients?.map((ingredient) => ({
        matched_name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
      }))
    : previewEntry?.item_data?.items as Array<{ matched_name?: string; input?: string; amount?: number; unit?: string }> | undefined
  const previewGroceryList = previewEntry?.item_type === 'grocery_list' ? previewEntry.item_data as GroceryList | undefined : undefined
  const previewGroceryItems = Array.isArray(previewGroceryList?.items) ? previewGroceryList.items : []
  const previewGroceryByCategory = previewGroceryItems.reduce<Record<string, GroceryItem[]>>((acc, groceryItem) => {
    const category = groceryItem.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(groceryItem)
    return acc
  }, {})
  const previewGroceryProgress = previewGroceryItems.length > 0
    ? Math.round((previewGroceryItems.filter((groceryItem) => groceryItem.checked).length / previewGroceryItems.length) * 100)
    : 0
  const previewIsViewOnly = previewEntry?.item_type === 'social_post' || previewEntry?.item_type === 'weekly_recap'

  return (
    <>
      <div className="grid h-[calc(100dvh-11rem)] min-h-[calc(100vh-11rem)] min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className={cn('min-h-0', mobileShowingDetail ? 'hidden lg:flex lg:flex-col' : 'flex flex-col')}>
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Messages</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Shared comment threads</h2>
            </div>
            <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              {conversations.length}
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shared threads"
              className="h-11 rounded-2xl border-border/70 bg-background pl-10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 px-5 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/45" />
              <p className="mt-4 text-sm font-medium">No shared threads yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conversations start when you share or receive a meal, workout, grocery list, or post.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conversation) => {
                const isActive = conversation.id === selectedId
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleOpenConversation(conversation.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                      isActive
                        ? 'border-primary/35 bg-primary/10'
                        : 'border-border/60 bg-background/70 hover:border-border hover:bg-muted/25'
                    )}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openProfile(conversation.username, conversation.title)
                      }}
                      className="shrink-0 rounded-full transition-opacity hover:opacity-85"
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white"
                        style={conversation.avatar_url ? { backgroundImage: `url(${conversation.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        {!conversation.avatar_url ? conversation.title.charAt(0).toUpperCase() : null}
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        {conversation.username ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openProfile(conversation.username, conversation.title)
                            }}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-sm font-semibold hover:text-primary">{conversation.title}</p>
                            <p className="text-xs text-muted-foreground">@{conversation.username}</p>
                          </button>
                        ) : (
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{conversation.title}</p>
                            {conversation.username ? <p className="text-xs text-muted-foreground">@{conversation.username}</p> : null}
                          </div>
                        )}
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.latest_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="line-clamp-1 text-sm text-muted-foreground">{conversation.latest_preview}</p>
                        {conversation.unread_count > 0 ? (
                          <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={cn('min-h-0 overflow-hidden', !mobileShowingDetail ? 'hidden lg:flex lg:flex-col' : 'flex flex-col')}>
        {selectedId ? (
          <>
            <div className="border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  onClick={() => {
                    setSelectedId(null)
                    router.replace('/dashboard/shared', { scroll: false })
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => openProfile(detail?.counterpart.username, detail?.counterpart.name)}
                  className="flex min-w-0 items-center gap-3 rounded-2xl text-left transition-opacity hover:opacity-85"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white"
                    style={detail?.counterpart.avatar_url ? { backgroundImage: `url(${detail.counterpart.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    {!detail?.counterpart.avatar_url ? detail?.counterpart.name?.charAt(0).toUpperCase() : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{detail?.counterpart.name ?? 'Conversation'}</p>
                    <p className="text-sm text-muted-foreground">
                      {detail?.counterpart.username ? `@${detail.counterpart.username}` : 'Shared items and replies'}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <>
                <div ref={timelineScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5">
                  <div className="space-y-4">
                    {detail.timeline.map((entry) => (
                      <div key={entry.id} className={cn('flex', entry.direction === 'outgoing' ? 'justify-end' : 'justify-start')}>
                        {entry.type === 'message' ? (
                          <div className={cn(
                            'max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%]',
                            entry.direction === 'outgoing'
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border/60 bg-background'
                          )}>
                            <p className="text-sm leading-6">{entry.body}</p>
                            <p className={cn(
                              'mt-2 text-[11px]',
                              entry.direction === 'outgoing' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        ) : (
                          <div className={cn(
                            'w-full max-w-[320px] rounded-[28px] border p-3 sm:max-w-[320px]',
                            entry.direction === 'outgoing'
                              ? 'border-primary/30 bg-primary/10'
                              : 'border-border/60 bg-background'
                          )}>
                            <div className="flex min-h-[152px] flex-col justify-between rounded-2xl border border-border/60 bg-muted/20 p-3">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-full border border-border/60 bg-background/80 p-2 text-muted-foreground">
                                  {getItemIcon(entry.item_type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    {TYPE_LABELS[entry.item_type] ?? entry.item_type.replace('_', ' ')}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-base font-semibold leading-tight">{entry.item_name}</p>
                                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                    {entry.direction === 'incoming' ? 'Shared with you' : 'You shared this'} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                  </p>
                                  {entry.message ? (
                                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                                      &ldquo;{entry.message}&rdquo;
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-9 min-w-[108px] rounded-full border-border/70 bg-background/80"
                                  onClick={() => handleOpenPreview(entry)}
                                >
                                  {entry.item_type === 'social_post' ? 'Open Post' : 'Preview'}
                                </Button>
                                {entry.friend_share_id && importedFriendShareIds.has(entry.friend_share_id) ? (
                                  <div className="flex h-9 min-w-[108px] items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-500">
                                    Imported
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={timelineEndRef} className="h-px w-full" />
                  </div>
                </div>

                <div className="border-t border-border/60 px-4 py-4 sm:px-5">
                  <div className="flex gap-3">
                    <Textarea
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      className="min-h-[62px] resize-none rounded-2xl border-border/70 bg-background"
                      maxLength={280}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending || draftMessage.trim().length === 0}
                      className="h-auto rounded-2xl px-4"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-5 text-center">
            <Users className="h-10 w-10 text-muted-foreground/45" />
            <p className="mt-4 text-base font-semibold">Select a shared thread</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Shared meals, workouts, grocery lists, and post comments will appear together here so the feedback stays tied to the item.
            </p>
          </div>
        )}
      </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          {previewEntry ? (
            <div className="flex max-h-[min(82dvh,760px)] flex-col">
              <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-border/70 bg-muted/35 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {TYPE_LABELS[previewEntry.item_type] ?? previewEntry.item_type}
                  </Badge>
                  {previewEntry.direction === 'incoming' ? (
                    <Badge variant="outline" className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-500">
                      Shared with you
                    </Badge>
                  ) : null}
                </div>
                <DialogTitle className="mt-3 text-xl">{previewEntry.item_name}</DialogTitle>
                <DialogDescription className="mt-1">
                  Quick preview from this thread. You can add it to your account without leaving the comment view.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  {previewEntry.message ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      &ldquo;{previewEntry.message}&rdquo;
                    </div>
                  ) : null}

                  {previewSocialPost ? (
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {previewSocialPost.type === 'meal' ? 'Meal post' : 'Workout post'}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          @{previewSocialPost.user.username}
                        </Badge>
                      </div>
                      {previewSocialPost.caption ? (
                        <p className="text-sm leading-6 text-foreground/90">{previewSocialPost.caption}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {previewRecap ? (
                    <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">{previewRecap.week_label}</Badge>
                        <Badge variant="outline" className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                          {previewRecap.status === 'winning' ? 'Winning week' : previewRecap.status === 'steady' ? 'Steady week' : 'Reset week'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{previewRecap.headline}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{previewRecap.highlight}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: 'Workouts', value: `${previewRecap.workouts_completed}/${previewRecap.target_workout_days}`, icon: Dumbbell },
                          { label: 'Protein', value: `${previewRecap.protein_hit_days}/7`, icon: UtensilsCrossed },
                          { label: 'Hydration', value: `${previewRecap.hydration_hit_days}/7`, icon: Sparkles },
                          {
                            label: 'Weight',
                            value: typeof previewRecap.weight_delta_kg === 'number'
                              ? `${previewRecap.weight_delta_kg > 0 ? '+' : ''}${previewRecap.weight_delta_kg.toFixed(1)} kg`
                              : 'No change',
                            icon: TrendingUp,
                          },
                        ].map(({ label, value, icon: Icon }) => (
                          <div key={label} className="rounded-xl border border-border/60 bg-background/85 p-3 text-center">
                            <div className="mb-2 flex justify-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-muted/20">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            <p className="font-data text-sm font-semibold">{value}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/85 p-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                          <Target className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended next move</p>
                          <p className="mt-1 text-sm text-foreground/90">{previewRecap.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {previewMacros ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: 'Calories', value: Math.round(previewMacros.calories ?? 0), unit: 'kcal' },
                        { label: 'Protein', value: Math.round(previewMacros.protein_g ?? 0), unit: 'g' },
                        { label: 'Carbs', value: Math.round(previewMacros.carbs_g ?? 0), unit: 'g' },
                        { label: 'Fat', value: Math.round(previewMacros.fat_g ?? 0), unit: 'g' },
                      ].map(({ label, value, unit }) => (
                        <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                          <p className="font-data text-base font-semibold tabular-nums">
                            {value}
                            <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {(previewEntry.item_type === 'saved_meal' || (previewEntry.item_type === 'social_post' && previewSocialPost?.type === 'meal')) && previewMealItems && previewMealItems.length > 0 ? (
                    <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ingredients</p>
                      <div className="space-y-2">
                        {previewMealItems.slice(0, 8).map((item, index) => (
                          <div key={`${item.matched_name ?? item.input ?? 'ingredient'}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate">{item.matched_name ?? item.input ?? 'Item'}</span>
                            {item.amount ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.amount}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {previewEntry.item_type === 'recipe' && previewIngredients && previewIngredients.length > 0 ? (
                    <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ingredients</p>
                      <div className="space-y-2">
                        {previewIngredients.slice(0, 8).map((ingredient, index) => (
                          <div key={`${ingredient.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate">{ingredient.name}</span>
                            {ingredient.amount ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {ingredient.amount}{ingredient.unit ? ` ${ingredient.unit}` : ''}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(previewEntry.item_type === 'workout' || (previewEntry.item_type === 'social_post' && previewSocialPost?.type === 'workout')) && previewExercises && previewExercises.length > 0 ? (
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Exercises</p>
                      <div className="space-y-2">
                        {previewExercises.slice(0, 6).map((exercise, index) => {
                          const rawExercise = exercise as Record<string, unknown>
                          const setArray = Array.isArray(rawExercise.sets) ? rawExercise.sets as Array<Record<string, unknown>> : null
                          const numericSetCount = typeof exercise.sets === 'number'
                            ? exercise.sets
                            : setArray?.length
                          const setLabel = typeof numericSetCount === 'number' && numericSetCount > 0
                            ? `${numericSetCount} ${numericSetCount === 1 ? 'set' : 'sets'}`
                            : null
                          const reps = typeof exercise.reps === 'string'
                            ? exercise.reps
                            : typeof exercise.reps === 'number'
                              ? String(exercise.reps)
                              : setArray && setArray.length > 0
                                ? (() => {
                                    const repValues = setArray
                                      .map((set) => Number(set.reps ?? set.target_reps ?? set.actual_reps))
                                      .filter((value) => Number.isFinite(value) && value > 0)

                                    if (repValues.length === 0) return null
                                    const minReps = Math.min(...repValues)
                                    const maxReps = Math.max(...repValues)
                                    return minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`
                                  })()
                                : null

                          return (
                            <div key={`${getExerciseName(exercise as Record<string, unknown>)}-${index}`} className="rounded-xl border border-border/60 bg-background/85 px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-medium">{getExerciseName(exercise as Record<string, unknown>)}</p>
                                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                  {setLabel ? <span>{setLabel}</span> : null}
                                  {reps ? <span>{reps} reps</span> : null}
                                  {'rest' in exercise && typeof exercise.rest === 'number' ? <span>{exercise.rest}s rest</span> : null}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {previewEntry.item_type === 'grocery_list' && previewGroceryItems.length > 0 ? (
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="rounded-xl border border-border/60 bg-background/85 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Shopping progress</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-data text-foreground">{previewGroceryItems.filter((item) => item.checked).length}</span> of <span className="font-data">{previewGroceryItems.length}</span> items checked
                            </p>
                          </div>
                          <p className="font-data text-xl font-semibold text-emerald-500">{previewGroceryProgress}%</p>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${previewGroceryProgress}%` }} />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(previewGroceryByCategory).map(([category, items]) => (
                          <div key={category} className="overflow-hidden rounded-xl border border-border/60 bg-background/85">
                            <div className="border-b border-border/60 px-4 py-3">
                              <p className="text-sm font-semibold">{category}</p>
                            </div>
                            <div>
                              {items.slice(0, 5).map((groceryItem, index) => {
                                const amountLabel = formatGroceryAmount(groceryItem)

                                return (
                                  <div
                                    key={`${category}-${groceryItem.ingredient}-${index}`}
                                    className={cn(
                                      'flex items-start gap-2 px-3 py-2.5',
                                      index < Math.min(items.length, 5) - 1 ? 'border-b border-border/50' : ''
                                    )}
                                  >
                                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                                      {groceryItem.checked ? (
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                      ) : (
                                        <Circle className="h-4 w-4" />
                                      )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className={cn('truncate text-sm', groceryItem.checked ? 'line-through text-muted-foreground' : 'text-foreground/90')}>
                                        {groceryItem.ingredient}
                                      </p>
                                      {amountLabel ? <p className="text-xs text-muted-foreground">{amountLabel}</p> : null}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="border-t border-border/60 px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                {previewIsViewOnly ? (
                  <div className="flex h-10 items-center text-sm text-muted-foreground">
                    {previewEntry.item_type === 'social_post' ? 'Social posts stay preview-only in shared comment threads.' : 'Weekly recaps stay preview-only in shared comment threads.'}
                  </div>
                ) : importedInPreview ? (
                  <div className="flex h-10 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-500">
                    <CheckCircle className="h-4 w-4" />
                    Added to your account
                  </div>
                ) : (
                  <Button type="button" className="rounded-full" onClick={() => void handleImportPreview()} disabled={importingPreview}>
                    {importingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Import to my account
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
