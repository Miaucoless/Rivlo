'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Loader2, MessageSquareText, Send, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { DEMO_INBOX_ITEMS } from '@/lib/demo-shares'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

type InboxItem = {
  friend_share_id: string
  share_id: string
  item_type: 'workout' | 'saved_meal' | 'recipe' | 'grocery_list' | 'weekly_recap' | 'social_post'
  item_name: string
  token: string
  message?: string
  owner_name: string
  created_at: string
}

type ThreadReaction = {
  reaction: 'fire' | 'love' | 'try_this' | 'inspired'
  count: number
}

type ThreadComment = {
  id: string
  body: string
  created_at: string
  user_name: string
  username?: string | null
  is_owner?: boolean
}

type ThreadState = {
  current_reaction: ThreadReaction['reaction'] | null
  reactions: ThreadReaction[]
  comments: ThreadComment[]
}

const DEMO_THREAD_STORAGE_KEY = 'rivora-demo-shared-threads'

const REACTION_OPTIONS: Array<{ value: ThreadReaction['reaction']; label: string }> = [
  { value: 'fire', label: 'Strong' },
  { value: 'love', label: 'Love it' },
  { value: 'try_this', label: 'Try this' },
  { value: 'inspired', label: 'Inspired' },
]

const DEMO_THREAD_SEEDS: Record<string, ThreadState> = {
  'demo-workout-token': {
    current_reaction: 'try_this',
    reactions: [
      { reaction: 'try_this', count: 4 },
      { reaction: 'fire', count: 2 },
    ],
    comments: [
      {
        id: 'demo-comment-workout-1',
        body: 'This one fit my pull day really well. The deadlift volume feels good without wrecking recovery.',
        created_at: new Date(Date.now() - 1000 * 60 * 62).toISOString(),
        user_name: 'Jordan Lee',
        username: 'jordlee',
        is_owner: true,
      },
      {
        id: 'demo-comment-workout-2',
        body: 'Saving this for next week. I may trim one row set and keep the rest the same.',
        created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        user_name: 'Alex Morgan',
        username: 'alexmorgan',
      },
    ],
  },
  'demo-meal-token': {
    current_reaction: null,
    reactions: [{ reaction: 'love', count: 3 }],
    comments: [
      {
        id: 'demo-comment-meal-1',
        body: 'This meal keeps protein high without taking much prep time. I usually add cucumber on the side.',
        created_at: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
        user_name: 'Mia Brooks',
        username: 'miabrooks',
        is_owner: true,
      },
    ],
  },
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function readStoredDemoThreads(): Record<string, ThreadState> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(DEMO_THREAD_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ThreadState>) : {}
  } catch {
    return {}
  }
}

function persistDemoThreads(threads: Record<string, ThreadState>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DEMO_THREAD_STORAGE_KEY, JSON.stringify(threads))
  } catch {
    // Ignore storage issues for demo-only conversations.
  }
}

function buildDemoThread(token: string) {
  const stored = readStoredDemoThreads()
  return stored[token] ?? DEMO_THREAD_SEEDS[token] ?? { current_reaction: null, reactions: [], comments: [] }
}

function getReactionCount(reactions: ThreadReaction[], reaction: ThreadReaction['reaction']) {
  return reactions.find((entry) => entry.reaction === reaction)?.count ?? 0
}

export function SharedMessagesCenter({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const isDemoMode = useAppStore((state) => state.isDemoMode)
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [reacting, setReacting] = useState<ThreadReaction['reaction'] | null>(null)

  const loadInbox = useCallback(async () => {
    setLoading(true)

    if (isDemoMode) {
      setItems(
        DEMO_INBOX_ITEMS.map((item) => ({
          friend_share_id: item.friend_share_id,
          share_id: item.share_id,
          item_type: item.item_type,
          item_name: item.item_name,
          token: item.token,
          message: item.message,
          owner_name: item.owner_name,
          created_at: item.created_at,
        }))
      )
      setLoading(false)
      return
    }

    try {
      const token = await getToken()
      if (!token) {
        setItems([])
        return
      }

      const res = await fetch('/api/share/inbox', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (!res.ok) throw new Error('Could not load shared messages.')
      const data = (await res.json()) as InboxItem[]
      setItems(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load messages.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null)
      return
    }

    if (!selectedId || !items.some((item) => item.friend_share_id === selectedId)) {
      setSelectedId(items[0].friend_share_id)
    }
  }, [items, selectedId])

  const selectedItem = useMemo(
    () => items.find((item) => item.friend_share_id === selectedId) ?? null,
    [items, selectedId]
  )

  const loadThread = useCallback(async (item: InboxItem) => {
    setThreadLoading(true)

    if (isDemoMode) {
      setThread(buildDemoThread(item.token))
      setThreadLoading(false)
      return
    }

    try {
      const token = await getToken()
      const res = await fetch(`/api/share/${item.token}/social`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })

      if (!res.ok) throw new Error('Could not load this conversation.')
      const data = (await res.json()) as ThreadState
      setThread(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load this conversation.')
      setThread({ current_reaction: null, reactions: [], comments: [] })
    } finally {
      setThreadLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    if (!selectedItem) {
      setThread(null)
      return
    }

    void loadThread(selectedItem)
  }, [loadThread, selectedItem])

  const updateDemoThread = useCallback((token: string, updater: (current: ThreadState) => ThreadState) => {
    const storedThreads = readStoredDemoThreads()
    const nextThread = updater(storedThreads[token] ?? DEMO_THREAD_SEEDS[token] ?? { current_reaction: null, reactions: [], comments: [] })
    const nextThreads = { ...storedThreads, [token]: nextThread }
    persistDemoThreads(nextThreads)
    setThread(nextThread)
  }, [])

  const handleSendMessage = async () => {
    if (!selectedItem) return

    const message = draftMessage.trim()
    if (!message) return

    setSending(true)

    if (isDemoMode) {
      updateDemoThread(selectedItem.token, (current) => ({
        ...current,
        comments: [
          {
            id: `demo-comment-${Date.now()}`,
            body: message,
            created_at: new Date().toISOString(),
            user_name: user?.name ?? 'You',
            username: user?.username ?? 'you',
            is_owner: false,
          },
          ...current.comments,
        ],
      }))
      setDraftMessage('')
      setSending(false)
      return
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in again to send a message.')

      const res = await fetch(`/api/share/${selectedItem.token}/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'comment', body: message }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not send message.')

      setDraftMessage('')
      await loadThread(selectedItem)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const handleReaction = async (reaction: ThreadReaction['reaction']) => {
    if (!selectedItem) return

    setReacting(reaction)

    if (isDemoMode) {
      updateDemoThread(selectedItem.token, (current) => {
        const currentlySelected = current.current_reaction === reaction
        const nextCurrentReaction = currentlySelected ? null : reaction
        const nextReactions = REACTION_OPTIONS.reduce<ThreadReaction[]>((acc, option) => {
          let count = getReactionCount(current.reactions, option.value)

          if (current.current_reaction === option.value) {
            count = Math.max(0, count - 1)
          }

          if (nextCurrentReaction === option.value) {
            count += 1
          }

          if (count > 0) {
            acc.push({ reaction: option.value, count })
          }

          return acc
        }, [])

        return {
          current_reaction: nextCurrentReaction,
          reactions: nextReactions,
          comments: current.comments,
        }
      })
      setReacting(null)
      return
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in again to react.')

      const res = await fetch(`/api/share/${selectedItem.token}/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'reaction', reaction }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not react.')
      await loadThread(selectedItem)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not react.')
    } finally {
      setReacting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 px-5 py-12 text-center">
        <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-4 text-sm font-medium">No shared conversations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When someone shares a workout, meal, or recipe with you, the conversation will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]', compact && 'gap-3')}>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Shared Threads</p>
          <Badge variant="secondary" className="rounded-full text-[11px]">
            {items.length}
          </Badge>
        </div>
        <div className={cn('space-y-2 overflow-y-auto pr-1', compact ? 'max-h-[320px]' : 'max-h-[420px]')}>
          {items.map((item) => {
            const isActive = item.friend_share_id === selectedId
            const latestComment = item.message || 'Open this thread to reply or react.'

            return (
              <button
                key={item.friend_share_id}
                type="button"
                onClick={() => setSelectedId(item.friend_share_id)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/60 bg-background/70 hover:border-border hover:bg-muted/30'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.item_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.owner_name} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full text-[10px] uppercase">
                    {item.item_type.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{latestComment}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-[360px] flex-col rounded-3xl border border-border/60 bg-background/75',
          compact ? 'min-h-[360px]' : 'min-h-[460px]'
        )}
      >
        {selectedItem ? (
          <>
            <div className="border-b border-border/60 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{selectedItem.item_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Shared by {selectedItem.owner_name} · {formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true })}
                  </p>
                  {selectedItem.message ? (
                    <p className="mt-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      &ldquo;{selectedItem.message}&rdquo;
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => router.push(`/share/${selectedItem.token}?friend_share_id=${selectedItem.friend_share_id}`)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Share
                </Button>
              </div>
            </div>

            <div className="border-b border-border/60 px-5 py-3">
              <div className="flex flex-wrap gap-2">
                {REACTION_OPTIONS.map((option) => {
                  const count = getReactionCount(thread?.reactions ?? [], option.value)
                  const isSelected = thread?.current_reaction === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void handleReaction(option.value)}
                      disabled={reacting === option.value}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        isSelected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/60 bg-background hover:border-border hover:bg-muted/30'
                      )}
                    >
                      {reacting === option.value ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>{option.label}</span>
                      {count > 0 ? <span className="font-data text-[11px]">{count}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {threadLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : thread && thread.comments.length > 0 ? (
                <div className="space-y-3">
                  {thread.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={cn(
                        'max-w-[92%] rounded-2xl border px-4 py-3',
                        comment.is_owner
                          ? 'border-border/60 bg-muted/30'
                          : 'ml-auto border-primary/30 bg-primary/10'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {comment.user_name}
                          {comment.username ? ` · @${comment.username}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6">{comment.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-10 text-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No replies yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start the conversation with a quick note about how you want to use this share.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 px-5 py-4">
              <div className="space-y-3">
                <Textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Send a message about this shared item"
                  className="min-h-[96px] resize-none rounded-2xl border-border/70 bg-background"
                  maxLength={280}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Messages are added to this shared thread.</p>
                  <Button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={sending || draftMessage.trim().length === 0}
                    className="rounded-full px-4"
                  >
                    {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
