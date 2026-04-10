'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { AnimatePresence } from 'framer-motion'
import { Compass, Plus, Search, UserPlus, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { XpBadge } from '@/components/ui/XpBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import {
  DEFAULT_SOCIAL_POSTS,
  buildSocialDraftFromRecipe,
  buildSocialDraftFromPost,
  buildSocialDraftFromSavedMeal,
  buildSocialDraftFromWorkout,
  SOCIAL_FILTER_OPTIONS,
  SOCIAL_SORT_OPTIONS,
  MEAL_SUB_FILTER_OPTIONS,
  WORKOUT_SUB_FILTER_OPTIONS,
  buildRecipeFromPost,
  buildSavedMealFromPost,
  buildWorkoutFromPost,
  matchesSocialFilter,
  matchesSocialSubFilter,
  searchSocialPosts,
  sortSocialPosts,
} from '@/lib/social-feed'
import type { SocialSubFilter } from '@/lib/social-feed'
import { SocialPostCard } from '@/components/feed/SocialPostCard'
import { SocialPostDetailDialog } from '@/components/feed/SocialPostDetailDialog'
import { SocialPostUseDialog, type SocialUseDialogPayload } from '@/components/feed/SocialPostUseDialog'
import { SocialPostComposerDialog } from '@/components/feed/SocialPostComposerDialog'
import { categorizeIngredient, estimatePrice } from '@/lib/grocery-generator'
import { buildSocialProfileHref, canViewPost, getFollowRelationship } from '@/lib/social-connections'
import type { CalendarReminder, SocialFeedFilter, SocialFeedSort, SocialFollowRelationship, SocialPost, SocialPostDraft, SocialPostUser } from '@/types'

const FEED_BATCH_SIZE = 6
const SOCIAL_PUBLIC_CACHE_TTL_MS = 1000 * 60 * 3

type CachedPublicSocialPayload = PublicSocialPayload & {
  cachedAt: number
}

type PublicSocialPayload = {
  posts: SocialPost[]
  profiles: SocialPostUser[]
  follows: SocialFollowRelationship[]
}

function getPublicSocialCacheKey(userId: string, includeProfiles: boolean) {
  return `rivora-social-public:${userId}:${includeProfiles ? 'profiles' : 'feed'}`
}

function readPublicSocialCache(userId: string, includeProfiles: boolean): PublicSocialPayload | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(getPublicSocialCacheKey(userId, includeProfiles))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedPublicSocialPayload> | null
    if (!parsed || typeof parsed.cachedAt !== 'number') return null
    if (Date.now() - parsed.cachedAt > SOCIAL_PUBLIC_CACHE_TTL_MS) return null

    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
    }
  } catch {
    return null
  }
}

function writePublicSocialCache(userId: string, includeProfiles: boolean, payload: PublicSocialPayload) {
  if (typeof window === 'undefined') return

  try {
    const nextPayload: CachedPublicSocialPayload = {
      ...payload,
      cachedAt: Date.now(),
    }
    window.sessionStorage.setItem(getPublicSocialCacheKey(userId, includeProfiles), JSON.stringify(nextPayload))
  } catch {
    // Ignore cache write failures.
  }
}

function clearPublicSocialCache(userId: string | null | undefined) {
  if (typeof window === 'undefined' || !userId) return

  try {
    window.sessionStorage.removeItem(getPublicSocialCacheKey(userId, false))
    window.sessionStorage.removeItem(getPublicSocialCacheKey(userId, true))
  } catch {
    // Ignore cache clear failures.
  }
}

async function getToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export default function FeedPage() {
  const {
    user,
    socialPosts,
    socialFollows,
    socialSavedPostIds,
    socialLikedPostIds,
    socialPostComments,
    socialComposerPrefill,
    isDemoMode,
    savedMeals,
    customRecipes,
    customWorkouts,
    toggleSaveSocialPost,
    toggleLikeSocialPost,
    addCommentToSocialPost,
    incrementSocialPostStats,
    createSocialPost,
    updateSocialPost,
    removeSocialPost,
    requestToFollowUser,
    cancelFollowRequest,
    unfollowUser,
    setSocialComposerPrefill,
    addSavedMeal,
    addCustomRecipe,
    addPlannedMeal,
    addGroceryItem,
    addCustomWorkout,
    addCalendarReminder,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'explore' | 'following' | 'people'>('explore')
  const [filter, setFilter] = useState<SocialFeedFilter>('all')
  const [subFilter, setSubFilter] = useState<SocialSubFilter | null>(null)
  const [sort, setSort] = useState<SocialFeedSort>('new')
  const [query, setQuery] = useState('')
  const [peopleQuery, setPeopleQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const deferredPeopleQuery = useDeferredValue(peopleQuery)
  const [visibleCount, setVisibleCount] = useState(FEED_BATCH_SIZE)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionMode, setActionMode] = useState<'use' | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDraft, setComposerDraft] = useState<SocialPostDraft | null>(null)
  const [composerEditingPostId, setComposerEditingPostId] = useState<string | null>(null)
  const [remotePublicPosts, setRemotePublicPosts] = useState<SocialPost[]>([])
  const [remoteProfiles, setRemoteProfiles] = useState<SocialPostUser[]>([])
  const [remoteFollows, setRemoteFollows] = useState<SocialFollowRelationship[]>([])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewerId = user?.id ?? (isDemoMode ? 'demo-user-001' : null)

  useEffect(() => {
    let active = true

    async function loadPublicFeed() {
      if (!viewerId || isDemoMode) {
        if (active) {
          setRemotePublicPosts([])
          setRemoteProfiles([])
          setRemoteFollows([])
        }
        return
      }

      const includeProfiles = true
      const cachedPayload = readPublicSocialCache(viewerId, includeProfiles)
      if (cachedPayload) {
        if (!active) return
        setRemotePublicPosts(cachedPayload.posts)
        setRemoteFollows(cachedPayload.follows)
        if (includeProfiles) {
          setRemoteProfiles(cachedPayload.profiles)
        }
        return
      }

      try {
        const token = await getToken()
        if (!token) return

        const res = await fetch(`/api/social/public${includeProfiles ? '?includeProfiles=1' : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (!res.ok) throw new Error('Could not load public posts right now.')
        const payload = await res.json() as PublicSocialPayload

        if (!active) return
        const nextPayload: PublicSocialPayload = {
          posts: Array.isArray(payload.posts) ? payload.posts : [],
          profiles: Array.isArray(payload.profiles) ? payload.profiles : [],
          follows: Array.isArray(payload.follows) ? payload.follows : [],
        }
        setRemotePublicPosts(nextPayload.posts)
        setRemoteFollows(nextPayload.follows)
        if (includeProfiles) {
          setRemoteProfiles(nextPayload.profiles)
        }
        writePublicSocialCache(viewerId, includeProfiles, nextPayload)
      } catch (error) {
        if (!active) return
        console.error('Public social feed load failed:', error)
      }
    }

    void loadPublicFeed()

    return () => {
      active = false
    }
  }, [activeTab, isDemoMode, viewerId])

  const allFollows = useMemo(() => {
    const deduped = new Map<string, SocialFollowRelationship>()
    for (const relationship of [...socialFollows, ...remoteFollows]) {
      deduped.set(`${relationship.followerId}:${relationship.followingId}`, relationship)
    }
    return Array.from(deduped.values())
  }, [remoteFollows, socialFollows])

  const allPosts = useMemo(() => {
    const seededPosts = DEFAULT_SOCIAL_POSTS
    const combinedPosts = [
      ...socialPosts,
      ...remotePublicPosts.filter((remotePost) => {
        if (remotePost.user.id === viewerId) return false
        return !socialPosts.some((post) => post.id === remotePost.id)
      }),
    ]
    return [
      ...combinedPosts,
      ...seededPosts.filter((defaultPost) => !combinedPosts.some((post) => post.id === defaultPost.id)),
    ]
  }, [remotePublicPosts, socialPosts, viewerId])

  // Explore: all posts marked public (no follow required)
  const explorePosts = useMemo(() => (
    allPosts.filter((post) => post.audience === 'public')
  ), [allPosts])

  // Following: posts by people the viewer follows (accepted) + own posts
  const followingPosts = useMemo(() => {
    const followedIds = new Set(
      allFollows
        .filter((r) => r.followerId === viewerId && r.status === 'accepted')
        .map((r) => r.followingId)
    )
    return allPosts.filter((post) => post.user.id === viewerId || followedIds.has(post.user.id))
  }, [allPosts, allFollows, viewerId])

  const visibleFeedPosts = activeTab === 'following' ? followingPosts : explorePosts

  const socialProfiles = useMemo(() => (
    remoteProfiles
      .filter((profile) => profile.id !== viewerId)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [remoteProfiles, viewerId])

  const filteredPeople = useMemo(() => {
    const lookup = deferredPeopleQuery.trim().toLowerCase()
    if (!lookup) return socialProfiles
    return socialProfiles.filter((profile) => (
      profile.name.toLowerCase().includes(lookup) || profile.username.toLowerCase().includes(lookup)
    ))
  }, [deferredPeopleQuery, socialProfiles])

  const filteredPosts = useMemo(() => {
    const searched = searchSocialPosts(visibleFeedPosts, deferredQuery)
    const filtered = searched
      .filter((post) => matchesSocialFilter(post, filter))
      .filter((post) => matchesSocialSubFilter(post, subFilter))
    return sortSocialPosts(filtered, sort)
  }, [deferredQuery, filter, subFilter, sort, visibleFeedPosts])

  // Reset sub-filter when the main content filter changes
  useEffect(() => {
    setSubFilter(null)
  }, [filter])

  // Reset visible count when switching tabs
  useEffect(() => {
    setVisibleCount(FEED_BATCH_SIZE)
  }, [activeTab])

  useEffect(() => {
    setVisibleCount(FEED_BATCH_SIZE)
  }, [deferredQuery, filter, sort])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      const nextEntry = entries[0]
      if (!nextEntry?.isIntersecting) return
      setVisibleCount((current) => Math.min(filteredPosts.length, current + FEED_BATCH_SIZE))
    }, { rootMargin: '120px 0px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filteredPosts.length])

  useEffect(() => {
    if (searchParams.get('compose') !== '1') return
    const sourceKind = searchParams.get('sourceKind')
    const sourceId = searchParams.get('sourceId')

    let nextDraft = socialComposerPrefill

    if (!nextDraft && sourceKind && sourceId) {
      if (sourceKind === 'workout') {
        const workout = customWorkouts.find((item) => item.id === sourceId)
        if (workout) nextDraft = buildSocialDraftFromWorkout(workout)
      } else if (sourceKind === 'saved_meal') {
        const meal = savedMeals.find((item) => item.id === sourceId)
        if (meal) nextDraft = buildSocialDraftFromSavedMeal(meal)
      } else if (sourceKind === 'recipe') {
        const recipe = customRecipes.find((item) => item.id === sourceId)
        if (recipe) nextDraft = buildSocialDraftFromRecipe(recipe)
      }
    }

    if (!nextDraft) return

    setComposerDraft(nextDraft)
    setComposerEditingPostId(null)
    setComposerOpen(true)
    setSocialComposerPrefill(null)
    router.replace(pathname, { scroll: false })
  }, [customRecipes, customWorkouts, pathname, router, savedMeals, searchParams, setSocialComposerPrefill, socialComposerPrefill])

  useEffect(() => {
    const requestedPostId = searchParams.get('post')
    if (!requestedPostId) return

    const requestedPost = allPosts.find((post) => post.id === requestedPostId)
    if (!requestedPost || !canViewPost(requestedPost, viewerId, allFollows)) return

    setFilter('all')
    setSelectedPost(requestedPost)
    setDetailOpen(true)
  }, [allPosts, allFollows, searchParams, viewerId])

  const visiblePosts = filteredPosts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredPosts.length
  const hasAnyPosts = visibleFeedPosts.length > 0
  const activePost = useMemo(() => {
    if (!selectedPost) return null
    return visibleFeedPosts.find((post) => post.id === selectedPost.id) ?? null
  }, [selectedPost, visibleFeedPosts])

  const selectedPostSaved = activePost ? socialSavedPostIds.includes(activePost.id) : false
  const selectedPostLiked = activePost ? socialLikedPostIds.includes(activePost.id) : false
  const selectedPostComments = activePost ? (socialPostComments[activePost.id] ?? []) : []
  const actionablePost = activePost && (activePost.type === 'meal' || activePost.type === 'workout') ? activePost : null
  const canDeleteActivePost = Boolean(activePost && user && activePost.user.id === user.id && socialPosts.some((post) => post.id === activePost.id))
  const currentUser: SocialPostUser = user
    ? {
        id: user.id,
        name: user.name,
        username: user.username || user.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        bio: user.bio,
        profile_visibility: user.profile_visibility,
      }
    : {
        id: 'demo-user-001',
        name: 'Alex Morgan',
        username: 'alexmorgan',
      }

  const openPost = (post: SocialPost) => {
    if (!visibleFeedPosts.some((p) => p.id === post.id)) return
    setSelectedPost(post)
    setDetailOpen(true)
  }

  const submitUseFlow = (payload: SocialUseDialogPayload) => {
    if (!activePost) return

    if (payload.postType === 'meal') {
      const attributionTitle = payload.title
      const workingPost: SocialPost = {
        ...activePost,
        title: attributionTitle,
        caption: payload.caption,
        mealData: payload.mealData,
      }

      const shouldAddToMyMeals = payload.addToMyMeals

      if (shouldAddToMyMeals) {
        addSavedMeal(buildSavedMealFromPost(workingPost, 1, attributionTitle))
      }

      if (payload.addToMealPlan) {
        const recipe = buildRecipeFromPost(workingPost, 1, attributionTitle)
        addCustomRecipe(recipe)
        addPlannedMeal(payload.mealPlanDay, payload.mealPlanSlot, {
          type: 'recipe',
          recipe,
          recipe_amount: { kind: 'servings', servings: payload.mealData.servings || 1 },
        })
      }

      if (payload.addIngredientsToGrocery) {
        payload.mealData.ingredients.forEach((ingredient) => {
          addGroceryItem({
            ingredient: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            category: categorizeIngredient(ingredient.name),
            estimated_price: estimatePrice(ingredient.amount, ingredient.unit, categorizeIngredient(ingredient.name)),
          })
        })
      }

      incrementSocialPostStats(activePost.id, { used: 1 })
    } else {
      const workingPost: SocialPost = {
        ...activePost,
        title: payload.title,
        caption: payload.caption,
        workoutData: payload.workoutData,
      }
      const shouldAddToMyWorkouts = payload.addToMyWorkouts
      const workout = buildWorkoutFromPost(workingPost, {
        title: payload.title,
        keepWeights: payload.keepWeights,
        autoAdjustWeights: payload.autoAdjustWeights,
        splitType: payload.addToSplit ? payload.splitType : (user?.workout_split ?? 'custom'),
        dayLabel: payload.addToSplit ? payload.splitDayLabel : 'Social Save',
        inspiredByUsername: undefined,
      })

      if (shouldAddToMyWorkouts) {
        addCustomWorkout(workout)
      }

      if (payload.scheduleFor !== 'none') {
        const scheduleDate = payload.scheduleFor === 'today' ? new Date() : addDays(new Date(), 1)
        const reminder: CalendarReminder = {
          id: `social-reminder-${Date.now()}`,
          date: format(scheduleDate, 'yyyy-MM-dd'),
          title: workout.name,
          notes: `Scheduled from @${activePost.user.username}'s post.`,
          color: 'green',
          kind: 'reminder',
          created_at: new Date().toISOString(),
        }
        addCalendarReminder(reminder)
      }

      incrementSocialPostStats(activePost.id, { used: 1 })
    }

    setActionMode(null)
    setSelectedPost(null)
  }

  const publishPost = (draft: SocialPostDraft) => {
    if (composerEditingPostId) {
      updateSocialPost(composerEditingPostId, draft)
    } else {
      createSocialPost(draft)
    }
    clearPublicSocialCache(viewerId)
    setComposerDraft(null)
    setComposerEditingPostId(null)
    setComposerOpen(false)
    setActiveTab('explore')
    setFilter('all')
    setSubFilter(null)
    setSort('new')
    setQuery('')
    setVisibleCount(FEED_BATCH_SIZE)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const handleEditPost = () => {
    if (!activePost || !user || activePost.user.id !== user.id) return
    setComposerDraft(buildSocialDraftFromPost(activePost))
    setComposerEditingPostId(activePost.id)
    setComposerOpen(true)
    setDetailOpen(false)
  }

  const handleFollowAction = (profile: SocialPostUser) => {
    const relationship = getFollowRelationship(allFollows, viewerId, profile.id)
    if (relationship?.status === 'accepted') {
      unfollowUser(profile.id)
      return
    }
    if (relationship?.status === 'pending') {
      cancelFollowRequest(profile.id)
      return
    }

    requestToFollowUser(profile)
  }

  const handleDeletePost = () => {
    if (!activePost || !user || activePost.user.id !== user.id) return
    removeSocialPost(activePost.id)
    clearPublicSocialCache(user.id)
    setDetailOpen(false)
    setSelectedPost(null)
    setActionMode(null)
    if (searchParams.get('post')) {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete('post')
      const nextQuery = nextParams.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Social Feed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">See what your network is actually using</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Explore public posts from everyone, or switch to Following to see only the people you follow.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="h-11 rounded-full px-5" onClick={() => { setComposerDraft(null); setComposerEditingPostId(null); setComposerOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'explore' | 'following' | 'people')}>
        <TabsList className="mb-4 h-auto rounded-full border border-border/70 bg-muted/40 p-1">
          <TabsTrigger value="explore" className="rounded-full px-5 text-sm font-medium">
            <Compass className="mr-2 h-4 w-4" />
            Explore
          </TabsTrigger>
          <TabsTrigger value="following" className="rounded-full px-5 text-sm font-medium">
            <Users className="mr-2 h-4 w-4" />
            Following
          </TabsTrigger>
          <TabsTrigger value="people" className="rounded-full px-5 text-sm font-medium">
            <UserPlus className="mr-2 h-4 w-4" />
            People
          </TabsTrigger>
        </TabsList>

        {(activeTab === 'explore' || activeTab === 'following') && (
          <Card className="overflow-hidden border-border/70 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-4 border-b border-border/70 pb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search meals, workouts, creators"
                  className="h-11 rounded-full border-border/70 bg-background pl-10 pr-4"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
                    {filteredPosts.length} result{filteredPosts.length === 1 ? '' : 's'}
                  </Badge>
                  <span>{activeTab === 'following' ? 'From people you follow' : 'All public posts'}</span>
                  <span className="text-border">•</span>
                  <span>{SOCIAL_SORT_OPTIONS.find((option) => option.value === sort)?.label}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Content</p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {SOCIAL_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFilter(option.value)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          filter === option.value
                            ? 'border-primary/20 bg-primary text-primary-foreground'
                            : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(filter === 'meals' || filter === 'workouts') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {filter === 'meals' ? 'Dietary' : 'Focus'}
                      </p>
                      {subFilter && (
                        <button
                          type="button"
                          onClick={() => setSubFilter(null)}
                          className="text-[10px] font-medium text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {(filter === 'meals' ? MEAL_SUB_FILTER_OPTIONS : WORKOUT_SUB_FILTER_OPTIONS).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSubFilter(subFilter === option.value ? null : option.value)}
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                            subFilter === option.value
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sort</p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {SOCIAL_SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSort(option.value)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          sort === option.value
                            ? 'border-border bg-foreground text-background'
                            : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {filteredPosts.length === 0 ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/10 px-6 text-center">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                    {!hasAnyPosts && !isDemoMode ? 'No posts yet' : 'No matches'}
                  </Badge>
                  <CardTitle className="mt-4 text-lg">
                    {!hasAnyPosts && !isDemoMode
                      ? activeTab === 'following'
                        ? 'Be the first out of your friends to post!'
                        : 'The feed is empty right now'
                      : 'Nothing matches this view yet'}
                  </CardTitle>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {!hasAnyPosts && !isDemoMode
                      ? activeTab === 'following'
                        ? 'Once you or someone you follow shares a post, it will show up here. Start the momentum with the first one.'
                        : 'Posts only show up here once you or people in your network actually share them. Create one to get the feed started.'
                      : activeTab === 'following'
                      ? 'Follow some people in the People tab and their posts will show up here.'
                      : 'Try a different search or clear some filters to open the feed back up.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {visiblePosts.map((post) => (
                        <SocialPostCard
                          key={post.id}
                          post={post}
                          saved={socialSavedPostIds.includes(post.id)}
                          liked={socialLikedPostIds.includes(post.id)}
                          onOpen={openPost}
                          onToggleSave={(nextPost) => toggleSaveSocialPost(nextPost.id, nextPost)}
                          onToggleLike={(nextPost) => toggleLikeSocialPost(nextPost.id, nextPost)}
                          onAddComment={(nextPost, body) => addCommentToSocialPost(nextPost.id, body)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  <div ref={sentinelRef} className="h-8" />

                  {hasMore ? (
                    <div className="flex justify-center pt-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] text-muted-foreground">
                        Loading more posts
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex justify-center pt-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] text-muted-foreground">
                        You&apos;ve reached the end of this view
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <TabsContent value="people" className="mt-0">
          <Card className="overflow-hidden border-border/70 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                  placeholder="Search by name or username"
                  className="h-11 rounded-full border-border/70 bg-background pl-10 pr-4"
                />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'} &mdash; Public accounts follow instantly; private accounts require approval.
              </p>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {filteredPeople.length === 0 ? (
                <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/10 px-6 text-center">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">No results</Badge>
                  <CardTitle className="mt-4 text-lg">No people found</CardTitle>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Try a different name or username.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredPeople.map((profile) => {
                    const relationship = getFollowRelationship(allFollows, viewerId, profile.id)
                    const isFollowing = relationship?.status === 'accepted'
                    const isPending = relationship?.status === 'pending'
                    return (
                      <li key={profile.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          className="flex-shrink-0"
                          onClick={() => router.push(buildSocialProfileHref(profile))}
                        >
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.name}
                              className="h-10 w-10 rounded-full object-cover ring-1 ring-border/50"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground ring-1 ring-border/50">
                              {profile.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="block min-w-0 text-left hover:underline"
                            onClick={() => router.push(buildSocialProfileHref(profile))}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold leading-5">{profile.name}</span>
                              <XpBadge totalXp={profile.xp_total ?? 0} size="sm" className="shrink-0" />
                            </span>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs text-muted-foreground">@{profile.username}</span>
                            {profile.profile_visibility === 'private' && (
                              <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">Private</Badge>
                            )}
                          </div>
                          {profile.bio && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{profile.bio}</p>
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          {isFollowing ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="rounded-full">
                                  Following
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleFollowAction(profile)}
                                >
                                  Unfollow
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : isPending ? (
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
                              Requested
                            </Button>
                          ) : (
                            <Button size="sm" className="rounded-full" onClick={() => handleFollowAction(profile)}>
                              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                              {profile.profile_visibility === 'private' ? 'Request' : 'Follow'}
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SocialPostDetailDialog
        post={activePost}
        open={detailOpen}
        saved={selectedPostSaved}
        liked={selectedPostLiked}
        comments={selectedPostComments}
        unitSystem={user?.unit_system || 'imperial'}
        canDelete={canDeleteActivePost}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            if (searchParams.get('post')) {
              const nextParams = new URLSearchParams(searchParams.toString())
              nextParams.delete('post')
              const nextQuery = nextParams.toString()
              router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
            }

            if (!actionMode) setSelectedPost(null)
          }
        }}
        onToggleSave={() => {
          if (!activePost || (activePost.type !== 'meal' && activePost.type !== 'workout')) return
          toggleSaveSocialPost(activePost.id, activePost)
        }}
        onToggleLike={() => {
          if (!activePost) return
          toggleLikeSocialPost(activePost.id, activePost)
        }}
        onAddComment={(body) => {
          if (!activePost) return
          addCommentToSocialPost(activePost.id, body)
        }}
        onUse={() => {
          if (!activePost || (activePost.type !== 'meal' && activePost.type !== 'workout')) return
          setDetailOpen(false)
          setActionMode('use')
        }}
        onEdit={handleEditPost}
        onDelete={handleDeletePost}
      />

      <SocialPostUseDialog
        post={actionablePost}
        open={actionMode !== null && actionablePost !== null}
        mode={actionMode ?? 'use'}
        defaultSplitType={user?.workout_split ?? 'custom'}
        unitSystem={user?.unit_system || 'imperial'}
        onOpenChange={(open) => {
          if (!open) {
            setActionMode(null)
            setSelectedPost(null)
          }
        }}
        onSubmit={submitUseFlow}
      />

      <SocialPostComposerDialog
        open={composerOpen}
        unitSystem={user?.unit_system || 'imperial'}
        initialDraft={composerDraft}
        currentUser={currentUser}
        availablePeople={socialProfiles}
        savedMeals={savedMeals}
        recipes={customRecipes}
        workouts={customWorkouts}
        onOpenChange={(open) => {
          setComposerOpen(open)
          if (!open) {
            setComposerDraft(null)
            setComposerEditingPostId(null)
          }
        }}
        onSubmit={publishPost}
      />


    </div>
  )
}
