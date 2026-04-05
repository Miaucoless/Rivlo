'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { ArrowLeft, Lock, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PeopleDialog } from '@/components/feed/PeopleDialog'
import { SocialPostDetailDialog } from '@/components/feed/SocialPostDetailDialog'
import { SocialPostUseDialog, type SocialUseDialogPayload } from '@/components/feed/SocialPostUseDialog'
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
import type { CalendarReminder, SocialPost, SocialPostUser } from '@/types'
import { toast } from 'sonner'

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>()
  const searchParams = useSearchParams()
  const requestedUsername = decodeURIComponent(params?.username ?? '').toLowerCase()
  const [followersOpen, setFollowersOpen] = useState(false)
  const [followingOpen, setFollowingOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionMode, setActionMode] = useState<'use' | null>(null)

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

  const allPosts = useMemo(() => {
    const seededPosts = DEFAULT_SOCIAL_POSTS
    return [
      ...socialPosts,
      ...seededPosts.filter((post) => !socialPosts.some((existing) => existing.id === post.id)),
    ]
  }, [socialPosts])

  const directory = useMemo(() => mergeSocialProfiles(allPosts, getSocialCreators(), user), [allPosts, user])
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

  const viewerId = user?.id ?? null
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

  const canSeePosts = profileUser ? canViewProfile(profileUser, viewerId, socialFollows) : false
  const relationship = profileUser ? getFollowRelationship(socialFollows, viewerId, profileUser.id) : null
  const followerCount = profileUser ? getFollowerCount(socialFollows, profileUser.id) : 0
  const followingCount = profileUser ? getFollowingCount(socialFollows, profileUser.id) : 0
  const selectedPostSaved = selectedPost ? socialSavedPostIds.includes(selectedPost.id) : false
  const selectedPostLiked = selectedPost ? socialLikedPostIds.includes(selectedPost.id) : false
  const selectedPostComments = selectedPost ? (socialPostComments[selectedPost.id] ?? []) : []
  const actionablePost = selectedPost && (selectedPost.type === 'meal' || selectedPost.type === 'workout') ? selectedPost : null

  const peopleById = useMemo(() => new Map(directory.map((person) => [person.id, person])), [directory])
  const followerProfiles = useMemo(() => {
    if (!profileUser) return []
    return socialFollows
      .filter((item) => item.followingId === profileUser.id && item.status === 'accepted')
      .map((item) => peopleById.get(item.followerId))
      .filter(Boolean) as SocialPostUser[]
  }, [peopleById, profileUser, socialFollows])
  const followingProfiles = useMemo(() => {
    if (!profileUser) return []
    return socialFollows
      .filter((item) => item.followerId === profileUser.id && item.status === 'accepted')
      .map((item) => peopleById.get(item.followingId))
      .filter(Boolean) as SocialPostUser[]
  }, [peopleById, profileUser, socialFollows])

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

      <Card className="overflow-hidden border-border/60">
        <div className="h-28 bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(20,184,166,0.08),rgba(15,23,42,0.04))]" />
        <CardContent className="relative -mt-10 space-y-6 px-5 pb-6 pt-0 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-background bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl font-bold text-white shadow-lg ${profileUser.avatar_url ? 'bg-cover bg-center bg-no-repeat' : ''}`}
                style={profileUser.avatar_url ? { backgroundImage: `url(${profileUser.avatar_url})` } : undefined}
              >
                {!profileUser.avatar_url ? profileUser.name.charAt(0).toUpperCase() : null}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Profile</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{profileUser.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>@{profileUser.username}</span>
                    {profileUser.profile_visibility === 'private' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs">
                        <Lock className="h-3 w-3" />
                        Private
                      </span>
                    ) : null}
                  </div>
                </div>
                {profileUser.bio ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{profileUser.bio}</p> : null}
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setFollowersOpen(true)}
                    className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <span className="font-semibold text-foreground">{followerCount}</span> Followers
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowingOpen(true)}
                    className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <span className="font-semibold text-foreground">{followingCount}</span> Following
                  </button>
                  <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-muted-foreground">
                    <span className="font-semibold text-foreground">{profilePosts.length}</span> Posts
                  </div>
                </div>
              </div>
            </div>

            {currentUserMatches ? null : (
              <Button onClick={handleFollow} className="rounded-full">
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
        </CardContent>
      </Card>

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
          <TabsList className="flex w-full max-w-md flex-nowrap gap-1 rounded-2xl bg-muted/40 p-1">
            <TabsTrigger value="posts" className="flex-1 rounded-xl">Posts</TabsTrigger>
            <TabsTrigger value="tagged" className="flex-1 rounded-xl">Tagged in Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            <PostGrid
              posts={profilePosts}
              emptyTitle="No posts here yet"
              emptyDetail="This person has not published anything to the feed yet."
              onOpenPost={(post) => {
                setSelectedPost(post)
                setDetailOpen(true)
              }}
            />
          </TabsContent>

          <TabsContent value="tagged" className="mt-0">
            <PostGrid
              posts={taggedPosts}
              emptyTitle="No tagged posts yet"
              emptyDetail="Posts that tag this person will show up here."
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
          toggleSaveSocialPost(selectedPost.id)
          toast.success(selectedPostSaved ? 'Removed from saves.' : 'Saved post.')
        }}
        onToggleLike={() => {
          if (!selectedPost) return
          toggleLikeSocialPost(selectedPost.id)
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
  emptyTitle,
  emptyDetail,
  onOpenPost,
}: {
  posts: SocialPost[]
  emptyTitle: string
  emptyDetail: string
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
    <div className="grid gap-4 lg:grid-cols-2">
      {posts.map((post) => (
        <Card
          key={post.id}
          className="cursor-pointer border-border/60 transition-colors hover:border-primary/30"
          onClick={() => onOpenPost(post)}
        >
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {post.type === 'meal' ? 'Meal post' : post.type === 'workout' ? 'Workout post' : post.type === 'day' ? 'Day post' : 'Post'}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{post.title}</h3>
              </div>
              <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                {format(new Date(post.createdAt), 'MMM d')}
              </div>
            </div>

            {post.caption ? <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{post.caption}</p> : null}

            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 4).map((tag) => (
                <div key={tag} className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                  {tag}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <MiniStat label="Likes" value={post.stats.likes ?? 0} />
              <MiniStat label="Comments" value={post.stats.comments ?? 0} />
              <MiniStat label="Used" value={post.stats.used} />
              <MiniStat label="Done" value={post.stats.completed} />
              <MiniStat label="Saved" value={post.stats.saved} />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenPost(post)
                }}
              >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Open Post
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 px-3 py-2">
      <p className="font-data text-sm font-semibold">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  )
}
