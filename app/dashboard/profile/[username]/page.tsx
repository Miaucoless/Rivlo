'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { ArrowLeft, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { XpBadge } from '@/components/ui/XpBadge'
import { AvatarWithBadge } from '@/components/ui/AvatarWithBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PeopleDialog } from '@/components/feed/PeopleDialog'
import { SocialPostCard } from '@/components/feed/SocialPostCard'
import { SocialPostDetailDialog } from '@/components/feed/SocialPostDetailDialog'
import { SocialPostUseDialog, type SocialUseDialogPayload } from '@/components/feed/SocialPostUseDialog'
import { createClient } from '@/lib/supabase'
import {
  DEFAULT_SOCIAL_POSTS,
  buildRecipeFromPost,
  buildSavedMealFromPost,
  buildWorkoutFromPost,
  getSocialCreatorByUsername,
  getSocialCreators,
} from '@/lib/social-feed'
import { canViewProfile, getFollowerCount, getFollowingCount, getFollowRelationship, mergeSocialProfiles } from '@/lib/social-connections'
import { categorizeIngredient, estimatePrice } from '@/lib/grocery-generator'
import { useAppStore } from '@/store/useAppStore'
import type { CalendarReminder, SocialFollowRelationship, SocialPost, SocialPostUser } from '@/types'
import { toast } from 'sonner'

type PublicSocialPayload = {
  posts: SocialPost[]
  profiles: SocialPostUser[]
  follows: SocialFollowRelationship[]
}

const PUBLIC_PROFILE_CACHE_TTL_MS = 1000 * 60 * 3

type CachedPublicSocialPayload = PublicSocialPayload & {
  cachedAt: number
}

function getPublicSocialCacheKey(userId: string) {
  return `rivora-social-public:${userId}:profiles`
}

function readPublicSocialCache(userId: string): PublicSocialPayload | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(getPublicSocialCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedPublicSocialPayload> | null
    if (!parsed || typeof parsed.cachedAt !== 'number') return null
    if (Date.now() - parsed.cachedAt > PUBLIC_PROFILE_CACHE_TTL_MS) return null

    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
    }
  } catch {
    return null
  }
}

function writePublicSocialCache(userId: string, payload: PublicSocialPayload) {
  if (typeof window === 'undefined') return

  try {
    const nextPayload: CachedPublicSocialPayload = {
      ...payload,
      cachedAt: Date.now(),
    }
    window.sessionStorage.setItem(getPublicSocialCacheKey(userId), JSON.stringify(nextPayload))
  } catch {
    // Ignore cache write failures.
  }
}

async function getToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>()
  const searchParams = useSearchParams()
  const requestedUsername = decodeURIComponent(params?.username ?? '').toLowerCase()
  const [followersOpen, setFollowersOpen] = useState(false)
  const [followingOpen, setFollowingOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionMode, setActionMode] = useState<'use' | null>(null)
  const [remotePublicPosts, setRemotePublicPosts] = useState<SocialPost[]>([])
  const [remoteProfiles, setRemoteProfiles] = useState<SocialPostUser[]>([])
  const [remoteFollows, setRemoteFollows] = useState<SocialFollowRelationship[]>([])

  const {
    user,
    socialPosts,
    socialFollows,
    socialSavedPostIds,
    socialLikedPostIds,
    socialPostComments,
    requestToFollowUser,
    cancelFollowRequest,
    unfollowUser,
    toggleSaveSocialPost,
    toggleLikeSocialPost,
    addCommentToSocialPost,
    incrementSocialPostStats,
    addSavedMeal,
    addCustomRecipe,
    addPlannedMeal,
    addGroceryItem,
    addCustomWorkout,
    addCalendarReminder,
  } = useAppStore()
  const viewerId = user?.id ?? null

  useEffect(() => {
    let active = true

    async function loadPublicSocialData() {
      if (!viewerId) {
        if (active) {
          setRemotePublicPosts([])
          setRemoteProfiles([])
          setRemoteFollows([])
        }
        return
      }

      const cachedPayload = readPublicSocialCache(viewerId)
      if (cachedPayload) {
        if (!active) return
        setRemotePublicPosts(cachedPayload.posts)
        setRemoteProfiles(cachedPayload.profiles)
        setRemoteFollows(cachedPayload.follows)
        return
      }

      try {
        const token = await getToken()
        if (!token) return

        const res = await fetch('/api/social/public?includeProfiles=1', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (!res.ok) throw new Error('Could not load this profile right now.')
        const payload = await res.json() as PublicSocialPayload

        if (!active) return
        const nextPayload: PublicSocialPayload = {
          posts: Array.isArray(payload.posts) ? payload.posts : [],
          profiles: Array.isArray(payload.profiles) ? payload.profiles : [],
          follows: Array.isArray(payload.follows) ? payload.follows : [],
        }
        setRemotePublicPosts(nextPayload.posts)
        setRemoteProfiles(nextPayload.profiles)
        setRemoteFollows(nextPayload.follows)
        writePublicSocialCache(viewerId, nextPayload)
      } catch (error) {
        if (!active) return
        console.error('Public profile preload failed:', error)
      }
    }

    void loadPublicSocialData()
    return () => {
      active = false
    }
  }, [viewerId])

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
      ...remotePublicPosts.filter((post) => {
        if (post.user.id === viewerId) return false
        return !socialPosts.some((existing) => existing.id === post.id)
      }),
    ]
    return [
      ...combinedPosts,
      ...seededPosts.filter((post) => !combinedPosts.some((existing) => existing.id === post.id)),
    ]
  }, [remotePublicPosts, socialPosts, viewerId])

  const directory = useMemo(() => mergeSocialProfiles(allPosts, [...getSocialCreators(), ...remoteProfiles], user), [allPosts, remoteProfiles, user])
  const fallbackName = searchParams.get('name')?.trim() || null
  const normalizedFallbackName = fallbackName?.toLowerCase() ?? null
  const currentUserMatches = user?.username?.toLowerCase() === requestedUsername
  const seededCreator = getSocialCreatorByUsername(requestedUsername)

  const profileUser = useMemo(() => (
    currentUserMatches
      ? directory.find((profile) => profile.id === user?.id) ?? null
      : directory.find((profile) => profile.username.toLowerCase() === requestedUsername)
        ?? (normalizedFallbackName
          ? directory.find((profile) => profile.name.trim().toLowerCase() === normalizedFallbackName)
          : null)
        ?? seededCreator
        ?? (fallbackName ? {
          id: `fallback-${requestedUsername}`,
          name: fallbackName,
          username: requestedUsername,
          profile_visibility: 'public' as const,
        } : null)
  ), [currentUserMatches, directory, fallbackName, normalizedFallbackName, requestedUsername, seededCreator, user?.id])

  const profilePosts = useMemo(
    () => (profileUser ? allPosts.filter((post) => post.user.id === profileUser.id) : []),
    [allPosts, profileUser]
  )
  const taggedPosts = useMemo(
    () => (
      profileUser
        ? allPosts.filter((post) =>
          post.user.id !== profileUser.id
          && (post.taggedUsers ?? []).some((taggedUser) => taggedUser.id === profileUser.id)
        )
        : []
    ),
    [allPosts, profileUser]
  )

  const canSeePosts = profileUser ? canViewProfile(profileUser, viewerId, allFollows) : false
  const relationship = profileUser ? getFollowRelationship(allFollows, viewerId, profileUser.id) : null
  const followerCount = profileUser ? getFollowerCount(allFollows, profileUser.id) : 0
  const followingCount = profileUser ? getFollowingCount(allFollows, profileUser.id) : 0
  const selectedPostSaved = selectedPost ? socialSavedPostIds.includes(selectedPost.id) : false
  const selectedPostLiked = selectedPost ? socialLikedPostIds.includes(selectedPost.id) : false
  const selectedPostComments = selectedPost ? (socialPostComments[selectedPost.id] ?? []) : []
  const actionablePost = selectedPost && (selectedPost.type === 'meal' || selectedPost.type === 'workout') ? selectedPost : null

  const peopleById = useMemo(() => new Map(directory.map((person) => [person.id, person])), [directory])
  const followerProfiles = useMemo(() => {
    if (!profileUser) return []
    return allFollows
      .filter((item) => item.followingId === profileUser.id && item.status === 'accepted')
      .map((item) => peopleById.get(item.followerId))
      .filter(Boolean) as SocialPostUser[]
  }, [allFollows, peopleById, profileUser])
  const followingProfiles = useMemo(() => {
    if (!profileUser) return []
    return allFollows
      .filter((item) => item.followerId === profileUser.id && item.status === 'accepted')
      .map((item) => peopleById.get(item.followingId))
      .filter(Boolean) as SocialPostUser[]
  }, [allFollows, peopleById, profileUser])

  if (!profileUser) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" className="h-10 w-fit rounded-full px-4">
          <Link href="/dashboard/feed">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feed
          </Link>
        </Button>
        <Card className="border-dashed border-border/60">
          <CardContent className="px-6 py-16 text-center">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
              Profile not found
            </Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">We couldn&apos;t find that person</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Try opening the post again from the feed and jumping in from the creator header.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleFollow = () => {
    if (relationship?.status === 'accepted') {
      unfollowUser(profileUser.id)
      return
    }
    if (relationship?.status === 'pending') {
      cancelFollowRequest(profileUser.id)
      return
    }
    requestToFollowUser(profileUser)
  }

  const submitUseFlow = (payload: SocialUseDialogPayload) => {
    if (!selectedPost) return

    if (payload.postType === 'meal') {
      const attributionTitle = payload.title
      const workingPost: SocialPost = {
        ...selectedPost,
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

      incrementSocialPostStats(selectedPost.id, { used: 1 })
      toast.success('Meal added to your account.')
    } else {
      const workingPost: SocialPost = {
        ...selectedPost,
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
          notes: `Scheduled from @${selectedPost.user.username}'s post.`,
          color: 'green',
          kind: 'reminder',
          created_at: new Date().toISOString(),
        }
        addCalendarReminder(reminder)
      }

      incrementSocialPostStats(selectedPost.id, { used: 1 })
      toast.success('Workout added to your account.')
    }

    setActionMode(null)
    setSelectedPost(null)
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="h-10 w-fit rounded-full px-4">
        <Link href="/dashboard/feed">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Feed
        </Link>
      </Button>

      <section className="space-y-5">
        <div
          className={`h-48 overflow-hidden rounded-[2rem] border border-border/50 ${profileUser?.banner_url ? 'bg-cover bg-center bg-no-repeat' : 'bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(20,184,166,0.08),rgba(15,23,42,0.04))]'}`}
          style={profileUser?.banner_url ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.2)), url(${profileUser.banner_url})` } : undefined}
        />
        <div className="relative -mt-10 space-y-6 px-1 pb-1 pt-0 sm:px-2">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <AvatarWithBadge
                src={profileUser.avatar_url ?? undefined}
                name={profileUser.name}
                size={80}
                hasCrown={profileUser.has_crown}
                className="border-4 border-background shadow-lg"
              />

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Profile</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{profileUser.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>@{profileUser.username}</span>
                    {profileUser.xp_total != null ? <XpBadge totalXp={profileUser.xp_total} size="sm" /> : null}
                    {profileUser.profile_visibility === 'private' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs">
                        <Lock className="h-3 w-3" />
                        Private
                      </span>
                    ) : null}
                  </div>
                </div>
                {profileUser.bio ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{profileUser.bio}</p> : null}
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3 pt-1">
                  <div className="min-w-[72px]">
                    <p className="text-lg font-semibold tracking-tight text-foreground">{profilePosts.length}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Posts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFollowersOpen(true)}
                    className="min-w-[88px] text-left transition-opacity hover:opacity-80"
                  >
                    <p className="text-lg font-semibold tracking-tight text-foreground">{followerCount}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Followers</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowingOpen(true)}
                    className="min-w-[88px] text-left transition-opacity hover:opacity-80"
                  >
                    <p className="text-lg font-semibold tracking-tight text-foreground">{followingCount}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Following</p>
                  </button>
                </div>
              </div>
            </div>

            {currentUserMatches ? null : (
              <Button onClick={handleFollow} className="rounded-full md:mt-2">
                {relationship?.status === 'accepted'
                  ? 'Following'
                  : relationship?.status === 'pending'
                    ? 'Requested'
                    : profileUser.profile_visibility === 'private'
                      ? 'Request Follow'
                      : 'Follow'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {!canSeePosts ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="px-6 py-16 text-center">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
              Private profile
            </Badge>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Follow request required</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Only approved followers can see posts on this private profile.
            </p>
            {currentUserMatches ? null : (
              <div className="mt-5 flex justify-center">
                <Button onClick={handleFollow} className="rounded-full">
                  {relationship?.status === 'pending' ? 'Requested' : 'Request Follow'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="posts" className="space-y-4">
          <TabsList className="flex h-auto w-full max-w-md flex-nowrap gap-5 overflow-x-auto rounded-none border-b border-border/50 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="posts" className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Posts</TabsTrigger>
            <TabsTrigger value="tagged" className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Tagged in Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            <PostGrid
              posts={profilePosts}
              savedPostIds={socialSavedPostIds}
              likedPostIds={socialLikedPostIds}
              emptyTitle="No posts here yet"
              emptyDetail="This person has not published anything to the feed yet."
              onToggleSave={toggleSaveSocialPost}
              onToggleLike={toggleLikeSocialPost}
              onAddComment={addCommentToSocialPost}
              onOpenPost={(post) => {
                setSelectedPost(post)
                setDetailOpen(true)
              }}
            />
          </TabsContent>

          <TabsContent value="tagged" className="mt-0">
            <PostGrid
              posts={taggedPosts}
              savedPostIds={socialSavedPostIds}
              likedPostIds={socialLikedPostIds}
              emptyTitle="No tagged posts yet"
              emptyDetail="Posts that tag this person will show up here."
              onToggleSave={toggleSaveSocialPost}
              onToggleLike={toggleLikeSocialPost}
              onAddComment={addCommentToSocialPost}
              onOpenPost={(post) => {
                setSelectedPost(post)
                setDetailOpen(true)
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      <SocialPostDetailDialog
        post={selectedPost}
        open={detailOpen}
        saved={selectedPostSaved}
        liked={selectedPostLiked}
        comments={selectedPostComments}
        unitSystem={user?.unit_system ?? 'imperial'}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open && !actionMode) setSelectedPost(null)
        }}
        onToggleSave={() => {
          if (!selectedPost) return
          toggleSaveSocialPost(selectedPost.id, selectedPost)
          toast.success(selectedPostSaved ? 'Removed from saves.' : 'Saved post.')
        }}
        onToggleLike={() => {
          if (!selectedPost) return
          toggleLikeSocialPost(selectedPost.id, selectedPost)
          toast.success(selectedPostLiked ? 'Removed like.' : 'Liked post.')
        }}
        onAddComment={(body) => {
          if (!selectedPost) return
          addCommentToSocialPost(selectedPost.id, body)
        }}
        onUse={() => {
          if (!selectedPost || (selectedPost.type !== 'meal' && selectedPost.type !== 'workout')) return
          setDetailOpen(false)
          setActionMode('use')
        }}
      />

      <SocialPostUseDialog
        post={actionablePost}
        open={actionMode !== null && actionablePost !== null}
        mode={actionMode ?? 'use'}
        defaultSplitType={user?.workout_split ?? 'custom'}
        unitSystem={user?.unit_system ?? 'imperial'}
        onOpenChange={(open) => {
          if (!open) {
            setActionMode(null)
            setSelectedPost(null)
          }
        }}
        onSubmit={submitUseFlow}
      />

      <PeopleDialog
        open={followersOpen}
        onOpenChange={setFollowersOpen}
        title="Followers"
        description={`People following @${profileUser.username}.`}
        people={followerProfiles}
        emptyTitle="No followers yet"
        emptyDetail="Follower profiles will appear here once people follow this account."
      />

      <PeopleDialog
        open={followingOpen}
        onOpenChange={setFollowingOpen}
        title="Following"
        description={`People @${profileUser.username} follows.`}
        people={followingProfiles}
        emptyTitle="Not following anyone yet"
        emptyDetail="Followed profiles will appear here once this account follows people."
      />
    </div>
  )
}

function PostGrid({
  posts,
  savedPostIds,
  likedPostIds,
  emptyTitle,
  emptyDetail,
  onToggleSave,
  onToggleLike,
  onAddComment,
  onOpenPost,
}: {
  posts: SocialPost[]
  savedPostIds: string[]
  likedPostIds: string[]
  emptyTitle: string
  emptyDetail: string
  onToggleSave: (postId: string, sourcePost?: SocialPost) => void
  onToggleLike: (postId: string, sourcePost?: SocialPost) => void
  onAddComment: (postId: string, body: string) => void
  onOpenPost: (post: SocialPost) => void
}) {
  if (posts.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="px-5 py-12 text-center">
          <h2 className="text-lg font-semibold">{emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyDetail}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <SocialPostCard
          key={post.id}
          post={post}
          saved={savedPostIds.includes(post.id)}
          liked={likedPostIds.includes(post.id)}
          onOpen={onOpenPost}
          onToggleSave={(nextPost) => onToggleSave(nextPost.id, nextPost)}
          onToggleLike={(nextPost) => onToggleLike(nextPost.id, nextPost)}
          onAddComment={(nextPost, body) => onAddComment(nextPost.id, body)}
        />
      ))}
    </div>
  )
}
