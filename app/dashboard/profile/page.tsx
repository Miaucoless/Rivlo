'use client'

import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Globe2, Loader2, Lock, PencilLine, Plus, Share2, UserCheck, Users, Dumbbell } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PeopleDialog } from '@/components/feed/PeopleDialog'
import { SocialPostCard } from '@/components/feed/SocialPostCard'
import { SocialPostComposerDialog } from '@/components/feed/SocialPostComposerDialog'
import { SocialPostDetailDialog } from '@/components/feed/SocialPostDetailDialog'
import { DEFAULT_SOCIAL_POSTS, buildSocialDraftFromPost, getSocialCreators } from '@/lib/social-feed'
import { getFollowerCount, getFollowingCount, mergeSocialProfiles } from '@/lib/social-connections'
import type { SocialFollowRelationship, SocialPost, SocialPostUser } from '@/types'
import { XpBadge } from '@/components/ui/XpBadge'
import { XpProgressBar } from '@/components/xp/XpProgressBar'

type ProfileComment = {
  id: string
  body: string
  created_at: string
  item_name: string
  item_type: string
  share_token: string | null
}

type PublicSocialPayload = {
  posts: SocialPost[]
  profiles: SocialPostUser[]
  follows: SocialFollowRelationship[]
}

const SOCIAL_PUBLIC_CACHE_TTL_MS = 1000 * 60 * 3

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

const DEMO_COMMENTS: ProfileComment[] = [
  {
    id: 'demo-profile-comment-1',
    body: 'Saving this for my next pull day. The volume looks right for a heavy start to the week.',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    item_name: 'Back Builder Strength Day',
    item_type: 'workout',
    share_token: 'demo-workout-token',
  },
  {
    id: 'demo-profile-comment-2',
    body: 'This is exactly the kind of quick high-protein lunch I needed for work days.',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    item_name: 'Mediterranean Chicken Bowl',
    item_type: 'saved_meal',
    share_token: 'demo-meal-token',
  },
]

async function getToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export default function ProfilePage() {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const xpState = useAppStore((state) => state.xpState)
  const isDemoMode = useAppStore((state) => state.isDemoMode)
  const socialPosts = useAppStore((state) => state.socialPosts)
  const socialFollows = useAppStore((state) => state.socialFollows)
  const socialSavedPostIds = useAppStore((state) => state.socialSavedPostIds)
  const socialLikedPostIds = useAppStore((state) => state.socialLikedPostIds)
  const socialPostComments = useAppStore((state) => state.socialPostComments)
  const savedMeals = useAppStore((state) => state.savedMeals)
  const customRecipes = useAppStore((state) => state.customRecipes)
  const customWorkouts = useAppStore((state) => state.customWorkouts)
  const createSocialPost = useAppStore((state) => state.createSocialPost)
  const updateSocialPost = useAppStore((state) => state.updateSocialPost)
  const updateProfile = useAppStore((state) => state.updateProfile)
  const removeSocialPost = useAppStore((state) => state.removeSocialPost)
  const toggleSaveSocialPost = useAppStore((state) => state.toggleSaveSocialPost)
  const toggleLikeSocialPost = useAppStore((state) => state.toggleLikeSocialPost)
  const addCommentToSocialPost = useAppStore((state) => state.addCommentToSocialPost)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState({
    name: user?.name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    avatar_url: user?.avatar_url ?? '',
    banner_url: user?.banner_url ?? '',
    profile_visibility: user?.profile_visibility ?? 'public',
  })
  const [saving, setSaving] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [comments, setComments] = useState<ProfileComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDraft, setComposerDraft] = useState<import('@/types').SocialPostDraft | null>(null)
  const [composerEditingPostId, setComposerEditingPostId] = useState<string | null>(null)
  const [followersOpen, setFollowersOpen] = useState(false)
  const [followingOpen, setFollowingOpen] = useState(false)
  const [remoteProfiles, setRemoteProfiles] = useState<SocialPostUser[]>([])
  const [remoteFollows, setRemoteFollows] = useState<SocialFollowRelationship[]>([])

  useEffect(() => {
    setDraft({
      name: user?.name ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
      avatar_url: user?.avatar_url ?? '',
      banner_url: user?.banner_url ?? '',
      profile_visibility: user?.profile_visibility ?? 'public',
    })
  }, [user?.avatar_url, user?.banner_url, user?.bio, user?.name, user?.profile_visibility, user?.username])

  useEffect(() => {
    tabsListRef.current?.scrollTo({ left: 0 })
  }, [])

  useEffect(() => {
    let active = true

    async function loadRemoteProfiles() {
      if (!user?.id || isDemoMode) {
        if (active) {
          setRemoteProfiles([])
          setRemoteFollows([])
        }
        return
      }

      const cachedPayload = readPublicSocialCache(user.id)
      if (cachedPayload) {
        if (!active) return
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

        if (!res.ok) throw new Error('Could not load your social directory right now.')
        const payload = await res.json() as PublicSocialPayload
        if (!active) return

        const nextPayload: PublicSocialPayload = {
          posts: Array.isArray(payload.posts) ? payload.posts : [],
          profiles: Array.isArray(payload.profiles) ? payload.profiles : [],
          follows: Array.isArray(payload.follows) ? payload.follows : [],
        }

        setRemoteProfiles(nextPayload.profiles)
        setRemoteFollows(nextPayload.follows)
        writePublicSocialCache(user.id, nextPayload)
      } catch (error) {
        if (!active) return
        console.error('Failed to load remote social profiles:', error)
      }
    }

    void loadRemoteProfiles()
    return () => {
      active = false
    }
  }, [isDemoMode, user?.id])

  useEffect(() => {
    let active = true

    async function loadComments() {
      setCommentsLoading(true)

      if (isDemoMode) {
        if (active) {
          setComments(DEMO_COMMENTS)
          setCommentsLoading(false)
        }
        return
      }

      try {
        const token = await getToken()
        if (!token) {
          if (active) setComments([])
          return
        }

        const res = await fetch('/api/profile/comments', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (!res.ok) throw new Error('Could not load your comments.')
        const data = (await res.json()) as ProfileComment[]
        if (active) setComments(data)
      } catch (error) {
        if (active) setComments([])
        toast.error(error instanceof Error ? error.message : 'Could not load your comments.')
      } finally {
        if (active) setCommentsLoading(false)
      }
    }

    void loadComments()

    return () => {
      active = false
    }
  }, [isDemoMode])

  const ownPosts = useMemo(() => {
    if (!user) return []
    return socialPosts.filter((post) => post.user.id === user.id)
  }, [socialPosts, user])
  const browseablePosts = useMemo(() => [
    ...socialPosts,
    ...DEFAULT_SOCIAL_POSTS.filter((post) => !socialPosts.some((existing) => existing.id === post.id)),
  ], [socialPosts])

  const allFollows = useMemo(() => {
    const deduped = new Map<string, SocialFollowRelationship>()
    for (const relationship of [...socialFollows, ...remoteFollows]) {
      deduped.set(`${relationship.followerId}:${relationship.followingId}`, relationship)
    }
    return Array.from(deduped.values())
  }, [remoteFollows, socialFollows])
  const socialProfiles = useMemo(
    () => mergeSocialProfiles(socialPosts, [...getSocialCreators(), ...remoteProfiles], user),
    [remoteProfiles, socialPosts, user]
  )
  const currentSocialUser = useMemo<SocialPostUser>(() => ({
    id: user.id,
    name: user.name,
    username: user.username || fallbackUsername(user.name),
    avatar_url: user.avatar_url,
    banner_url: user.banner_url,
    bio: user.bio,
    profile_visibility: user.profile_visibility ?? 'public',
  }), [user])
  const peopleById = useMemo(() => new Map(socialProfiles.map((profile) => [profile.id, profile])), [socialProfiles])
  const followerCount = getFollowerCount(allFollows, user?.id ?? '')
  const followingCount = getFollowingCount(allFollows, user?.id ?? '')
  const followers = useMemo(() => allFollows
    .filter((item) => item.followingId === user?.id && item.status === 'accepted')
    .map((item) => peopleById.get(item.followerId))
    .filter(Boolean), [allFollows, peopleById, user?.id])
  const following = useMemo(() => allFollows
    .filter((item) => item.followerId === user?.id && item.status === 'accepted')
    .map((item) => peopleById.get(item.followingId))
    .filter(Boolean), [allFollows, peopleById, user?.id])
  const savedPosts = useMemo(
    () => socialSavedPostIds
      .map((postId) => browseablePosts.find((post) => post.id === postId))
      .filter(Boolean) as SocialPost[],
    [browseablePosts, socialSavedPostIds]
  )
  const repostedPosts = useMemo(() => [...ownPosts].filter((post) => post.stats.remixed > 0).sort((a, b) => b.stats.remixed - a.stats.remixed), [ownPosts])

  if (!user) return null

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for your profile photo.')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Keep profile photos under 4 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setDraft((current) => ({ ...current, avatar_url: String(reader.result ?? '') }))
    }
    reader.readAsDataURL(file)
  }

  const handleBannerSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for your banner.')
      return
    }

    if (file.size > 6 * 1024 * 1024) {
      toast.error('Keep banner images under 6 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setDraft((current) => ({ ...current, banner_url: String(reader.result ?? '') }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    const name = draft.name.trim()
    const username = draft.username.trim().toLowerCase()
    const bio = draft.bio.trim()
    const profileVisibility = draft.profile_visibility === 'private' ? 'private' : 'public'

    if (!name) {
      toast.error('Add a name for your profile.')
      return
    }

    if (username && username.length < 3) {
      toast.error('Username must be at least 3 characters.')
      return
    }

    setSaving(true)

    if (isDemoMode) {
      updateProfile({
        name,
        username: username || undefined,
        bio: bio || undefined,
        avatar_url: draft.avatar_url || undefined,
        banner_url: draft.banner_url || undefined,
        profile_visibility: profileVisibility,
      })
      toast.success('Profile updated!')
      setIsEditingProfile(false)
      setSaving(false)
      return
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in again to update your profile.')

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          username: username || null,
          bio: bio || null,
          avatar_url: draft.avatar_url || null,
          banner_url: draft.banner_url || null,
          profile_visibility: profileVisibility,
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not update your profile.')

      updateProfile({
        name,
        username: payload?.username ?? (username || undefined),
        bio: payload?.bio ?? (bio || undefined),
        avatar_url: payload?.avatar_url ?? (draft.avatar_url || undefined),
        banner_url: payload?.banner_url ?? (draft.banner_url || undefined),
        profile_visibility: payload?.profile_visibility ?? profileVisibility,
      })
      toast.success('Profile updated!')
      setIsEditingProfile(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div className="relative rounded-[2rem] border border-border/50">
          <div
            className={`h-48 overflow-hidden rounded-[2rem] ${draft.banner_url ? 'bg-cover bg-center bg-no-repeat' : 'bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(20,184,166,0.08),rgba(15,23,42,0.04))]'}`}
            style={draft.banner_url ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.2)), url(${draft.banner_url})` } : undefined}
          />
          <input
            id="profile-banner-upload"
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerSelect}
          />
          <label
            htmlFor="profile-banner-upload"
            className="absolute bottom-0 right-3 z-10 inline-flex h-7 w-7 translate-y-[50%] cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/92 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
            aria-label="Change banner image"
          >
            <PencilLine className="h-3 w-3" />
          </label>
        </div>
        <div className="relative -mt-10 space-y-6 px-1 pb-1 pt-0 sm:px-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative h-20 w-20 shrink-0">
                <input
                  id="profile-avatar-upload"
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
                <label
                  htmlFor="profile-avatar-upload"
                  className={cn(
                    'flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-background bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl font-bold text-white shadow-lg',
                    draft.avatar_url ? 'bg-cover bg-center bg-no-repeat' : '',
                  )}
                  style={draft.avatar_url ? { backgroundImage: `url(${draft.avatar_url})` } : undefined}
                  aria-label="Change profile photo"
                >
                  {!draft.avatar_url ? nameOrFallback(draft.name || user.name) : null}
                </label>
                <label
                  htmlFor="profile-avatar-upload"
                  className="absolute bottom-0 right-0 z-10 inline-flex h-6 w-6 translate-x-[10%] translate-y-[22%] cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
                  aria-label="Upload profile photo"
                >
                  <PencilLine className="h-3 w-3" />
                </label>
                {xpState.has_crown && (
                  <span
                    className="pointer-events-none absolute"
                    style={{ top: -14, right: -8, filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.7))' }}
                  >
                    <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                      <path d="M2 18L4 8L9 13L14 2L19 13L24 8L26 18Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />
                      <rect x="2" y="18" width="24" height="4" rx="1" fill="#d97706" />
                      <circle cx="14" cy="3" r="2" fill="#fef08a" />
                      <circle cx="4.5" cy="8.5" r="1.5" fill="#fef08a" />
                      <circle cx="23.5" cy="8.5" r="1.5" fill="#fef08a" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">My Profile</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                    <XpBadge totalXp={xpState.total} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    @{user.username || fallbackUsername(user.name)} · Joined {format(new Date(user.created_at), 'MMMM yyyy')}
                  </p>
                  {draft.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{draft.bio}</p> : null}
                  <div className="mt-2">
                    <XpProgressBar totalXp={xpState.total} showBadge={false} />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-1">
                  <div className="min-w-[72px]">
                    <p className="text-lg font-semibold tracking-tight text-foreground">{ownPosts.length}</p>
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
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            {isEditingProfile ? (
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Display name</span>
                  <Input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="h-11 rounded-2xl"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Username</span>
                  <Input
                    value={draft.username}
                    onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value.replace(/\s+/g, '') }))}
                    className="h-11 rounded-2xl"
                    placeholder="yourname"
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Bio</span>
                  <Textarea
                    value={draft.bio}
                    onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                    className="min-h-[112px] rounded-2xl resize-none"
                    placeholder="Tell people what you are training for, what you like to cook, or how you use Rivora."
                    maxLength={220}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Profile photo, banner, bio, and username update everywhere your account appears.</span>
                    <span>{draft.bio.length}/220</span>
                  </div>
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Profile visibility</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, profile_visibility: 'public' }))}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                        draft.profile_visibility === 'public'
                          ? 'border-primary/35 bg-primary/10'
                          : 'border-border/60 bg-background hover:bg-muted/30'
                      )}
                    >
                      <Globe2 className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Public</p>
                        <p className="mt-1 text-xs text-muted-foreground">Everyone can view your profile and posts from around the app.</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, profile_visibility: 'private' }))}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                        draft.profile_visibility === 'private'
                          ? 'border-primary/35 bg-primary/10'
                          : 'border-border/60 bg-background hover:bg-muted/30'
                      )}
                    >
                      <Lock className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Private</p>
                        <p className="mt-1 text-xs text-muted-foreground">Only approved followers can view your posts and full profile. You still see everything normally.</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 md:min-w-[140px]">
              {isEditingProfile ? (
                <>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="h-11 rounded-2xl"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PencilLine className="mr-2 h-4 w-4" />}
                    Save Profile
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl"
                    onClick={() => {
                      setDraft({
                        name: user.name ?? '',
                        username: user.username ?? '',
                        bio: user.bio ?? '',
                        avatar_url: user.avatar_url ?? '',
                        banner_url: user.banner_url ?? '',
                        profile_visibility: user.profile_visibility ?? 'public',
                      })
                      setIsEditingProfile(false)
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 self-end rounded-full px-3 text-xs text-muted-foreground"
                  onClick={() => setIsEditingProfile(true)}
                  aria-label="Edit profile details"
                >
                  Edit details
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList ref={tabsListRef} className="flex h-auto w-full justify-start flex-nowrap gap-5 overflow-x-auto rounded-none border-b border-border/50 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="posts" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Posts</TabsTrigger>
          <TabsTrigger value="comments" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Comments</TabsTrigger>
          <TabsTrigger value="saves" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Saves</TabsTrigger>
          <TabsTrigger value="reposts" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Reposts</TabsTrigger>
          <TabsTrigger value="saved-meals" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Saved Meals</TabsTrigger>
          <TabsTrigger value="saved-workouts" className="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent">Saved Workouts</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Your posts</p>
                <p className="text-sm text-muted-foreground">Create and manage everything you publish to the feed from here.</p>
              </div>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  setComposerDraft(null)
                  setComposerEditingPostId(null)
                  setComposerOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Post
              </Button>
            </div>

            {ownPosts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                detail="Your published meals and workouts will show up here once you post them to the feed."
              />
            ) : (
              <div className="space-y-10">
                {ownPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    saved={socialSavedPostIds.includes(post.id)}
                    liked={socialLikedPostIds.includes(post.id)}
                    onOpen={(nextPost) => {
                      setSelectedPost(nextPost)
                      setDetailOpen(true)
                    }}
                    onToggleSave={(nextPost) => toggleSaveSocialPost(nextPost.id, nextPost)}
                    onToggleLike={(nextPost) => toggleLikeSocialPost(nextPost.id, nextPost)}
                    onAddComment={(nextPost, body) => addCommentToSocialPost(nextPost.id, body)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-0">
          {commentsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <EmptyState
              title="No comments yet"
              detail="Comments you leave on posts will appear here."
            />
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className="border-border/60">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {comment.item_type.replace('_', ' ')} · {format(new Date(comment.created_at), 'MMM d, yyyy')}
                      </p>
                      <p className="mt-1 font-semibold">{comment.item_name}</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{comment.body}</p>
                    </div>
                    {comment.share_token ? (
                      <Button asChild type="button" variant="outline" className="rounded-full">
                        <Link href={`/share/${comment.share_token}`}>Open Thread</Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saves" className="mt-0">
          {savedPosts.length === 0 ? (
            <EmptyState
              title="No saves yet"
              detail="Posts you save from the feed will show up here so you can get back to them quickly."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {savedPosts.map((post) => (
                <Card key={post.id} className="border-border/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{post.type} post</p>
                        <h3 className="mt-1 font-semibold">{post.title}</h3>
                      </div>
                      <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                        Saved
                      </div>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.caption}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reposts" className="mt-0">
          {repostedPosts.length === 0 ? (
            <EmptyState
              title="No reposts yet"
              detail="When people remix your posts into their own account, those posts will show up here."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {repostedPosts.map((post) => (
                <Card key={post.id} className="border-border/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{post.type} post</p>
                        <h3 className="mt-1 font-semibold">{post.title}</h3>
                      </div>
                      <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                        {post.stats.remixed} reposts
                      </div>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.caption}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved-meals" className="mt-0">
          {savedMeals.length === 0 ? (
            <EmptyState
              title="No saved meals yet"
              detail="Meals you save to your account will show up here for quick access."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {savedMeals.map((meal) => (
                <Card key={meal.id} className="border-border/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{meal.meal_type}</p>
                        <h3 className="mt-1 font-semibold">{meal.name}</h3>
                      </div>
                      <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                        {meal.items.length} items
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Cal" value={Math.round(meal.macros.calories)} />
                      <MiniStat label="Protein" value={`${Math.round(meal.macros.protein_g)}g`} />
                      <MiniStat label="Carbs" value={`${Math.round(meal.macros.carbs_g)}g`} />
                      <MiniStat label="Fat" value={`${Math.round(meal.macros.fat_g)}g`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved-workouts" className="mt-0">
          {customWorkouts.length === 0 ? (
            <EmptyState
              title="No saved workouts yet"
              detail="Saved and custom workouts will show up here so your profile reflects what you actually use."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {customWorkouts.map((workout) => (
                <Card key={workout.id} className="border-border/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{workout.day_label}</p>
                        <h3 className="mt-1 font-semibold">{workout.name}</h3>
                      </div>
                      <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                        {workout.estimated_duration_min} min
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{workout.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {workout.muscle_groups.slice(0, 4).map((group) => (
                        <div key={group} className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                          {group.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <MiniStat label="Exercises" value={workout.exercises.length} />
                      <MiniStat label="Level" value={capitalize(workout.difficulty)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SocialPostDetailDialog
        post={selectedPost}
        open={detailOpen}
        saved={Boolean(selectedPost && socialSavedPostIds.includes(selectedPost.id))}
        liked={Boolean(selectedPost && socialLikedPostIds.includes(selectedPost.id))}
        comments={selectedPost ? (socialPostComments[selectedPost.id] ?? []) : []}
        unitSystem={user.unit_system}
        canDelete={Boolean(selectedPost && ownPosts.some((post) => post.id === selectedPost.id))}
        onOpenChange={setDetailOpen}
        onToggleSave={() => {
          if (!selectedPost) return
          toggleSaveSocialPost(selectedPost.id, selectedPost)
        }}
        onToggleLike={() => {
          if (!selectedPost) return
          toggleLikeSocialPost(selectedPost.id, selectedPost)
        }}
        onAddComment={(body) => {
          if (!selectedPost) return
          addCommentToSocialPost(selectedPost.id, body)
        }}
        onUse={() => {}}
        onEdit={() => {
          if (!selectedPost) return
          setComposerDraft(buildSocialDraftFromPost(selectedPost))
          setComposerEditingPostId(selectedPost.id)
          setComposerOpen(true)
          setDetailOpen(false)
        }}
        onDelete={() => {
          if (!selectedPost) return
          removeSocialPost(selectedPost.id)
          setSelectedPost(null)
          setDetailOpen(false)
          toast.success('Post deleted.')
        }}
      />

      <SocialPostComposerDialog
        open={composerOpen}
        unitSystem={user.unit_system}
        initialDraft={composerDraft}
        currentUser={currentSocialUser}
        availablePeople={socialProfiles.filter((profile) => profile.id !== user.id)}
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
        onSubmit={(draft) => {
          if (composerEditingPostId) {
            updateSocialPost(composerEditingPostId, draft)
            toast.success('Post updated.')
          } else {
            createSocialPost(draft)
            toast.success('Post published to your feed.')
          }
          setComposerDraft(null)
          setComposerEditingPostId(null)
          setComposerOpen(false)
          router.push('/dashboard/feed')
        }}
      />

      <PeopleDialog
        open={followersOpen}
        onOpenChange={setFollowersOpen}
        title="Followers"
        description="People following your profile."
        people={followers}
        emptyTitle="No followers yet"
        emptyDetail="People who follow you will show up here."
      />

      <PeopleDialog
        open={followingOpen}
        onOpenChange={setFollowingOpen}
        title="Following"
        description="People you follow."
        people={following}
        emptyTitle="You are not following anyone yet"
        emptyDetail="Profiles you follow will show up here."
      />
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

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="border-dashed border-border/60">
      <CardContent className="px-5 py-12 text-center">
        <p className="font-medium">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function nameOrFallback(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'R'
}

function fallbackUsername(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'rivorauser'
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
