import { NextRequest, NextResponse } from 'next/server'
import type { SocialFollowRelationship, SocialPost, SocialPostUser } from '@/types'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

type PublicSocialResponse = {
  posts: SocialPost[]
  profiles: SocialPostUser[]
  follows: SocialFollowRelationship[]
}

const MAX_LIGHTWEIGHT_FEED_ROWS = 120
const MAX_PUBLIC_POSTS = 90

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const includeProfiles = req.nextUrl.searchParams.get('includeProfiles') === '1'

  let appStateQuery = db
    .from('user_app_state')
    .select('user_id, social_posts, social_follows')

  if (!includeProfiles) {
    appStateQuery = appStateQuery.limit(MAX_LIGHTWEIGHT_FEED_ROWS)
  }

  let appStateResp = await appStateQuery

  const missingSocialColumns =
    !!appStateResp.error &&
    (
      appStateResp.error.message.includes('social_posts') ||
      appStateResp.error.message.includes('social_follows') ||
      appStateResp.error.message.includes('schema cache')
    )

  if (missingSocialColumns) {
    let fallbackQuery = db
      .from('user_app_state')
      .select('user_id')

    if (!includeProfiles) {
      fallbackQuery = fallbackQuery.limit(MAX_LIGHTWEIGHT_FEED_ROWS)
    }

    appStateResp = await fallbackQuery
  }

  if (appStateResp.error) {
    return NextResponse.json({ error: appStateResp.error.message }, { status: 500 })
  }

  const feedOwnerIds = Array.from(
    new Set(
      (appStateResp.data ?? [])
        .map((row) => (row as { user_id?: string | null }).user_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const profilesResp = includeProfiles
    ? await db
        .from('profiles')
        .select('id, name, username, avatar_url, banner_url, bio, profile_visibility')
    : feedOwnerIds.length > 0
      ? await db
          .from('profiles')
          .select('id, name, username, avatar_url, banner_url, bio, profile_visibility')
          .in('id', [...new Set([...feedOwnerIds, authUser.id])])
      : { data: [], error: null }

  if (profilesResp.error) {
    return NextResponse.json({ error: profilesResp.error.message }, { status: 500 })
  }

  const profileMap = new Map<string, SocialPostUser>()
  for (const profile of profilesResp.data ?? []) {
    if (!profile.id || !profile.name) continue
    profileMap.set(profile.id, {
      id: profile.id,
      name: profile.name,
      username: profile.username ?? profile.name.toLowerCase().replace(/[^a-z0-9_]+/g, ''),
      avatar_url: profile.avatar_url ?? undefined,
      banner_url: (profile as { banner_url?: string | null }).banner_url ?? undefined,
      bio: profile.bio ?? undefined,
      profile_visibility: profile.profile_visibility === 'private' ? 'private' : 'public',
    })
  }

  const followsByKey = new Map<string, SocialFollowRelationship>()
  const publicPostsById = new Map<string, SocialPost>()

  for (const row of appStateResp.data ?? []) {
    const ownerId = (row as { user_id?: string | null }).user_id
    if (!ownerId) continue

    const ownerProfile = profileMap.get(ownerId)
    if (!ownerProfile) continue

    for (const follow of asArray<SocialFollowRelationship>((row as { social_follows?: unknown }).social_follows)) {
      if (!follow?.followerId || !follow?.followingId || !follow?.status) continue
      const key = `${follow.followerId}:${follow.followingId}`
      if (!followsByKey.has(key)) {
        followsByKey.set(key, follow)
      }
    }

    if (ownerProfile.profile_visibility !== 'public') continue

    for (const post of asArray<SocialPost>((row as { social_posts?: unknown }).social_posts)) {
      if (!post?.id || post.audience !== 'public') continue
      publicPostsById.set(post.id, {
        ...post,
        user: {
          ...ownerProfile,
          ...post.user,
          id: ownerProfile.id,
          name: ownerProfile.name,
          username: ownerProfile.username,
          avatar_url: ownerProfile.avatar_url,
          banner_url: ownerProfile.banner_url,
          bio: ownerProfile.bio,
          profile_visibility: ownerProfile.profile_visibility,
        },
      })
    }
  }

  const posts = Array.from(publicPostsById.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_PUBLIC_POSTS)

  const relevantProfileIds = new Set<string>()
  posts.forEach((post) => {
    relevantProfileIds.add(post.user.id)
    ;(post.taggedUsers ?? []).forEach((taggedUser) => relevantProfileIds.add(taggedUser.id))
  })

  const follows = Array.from(followsByKey.values())
  follows.forEach((follow) => {
    if (follow.followerId === authUser.id || follow.followingId === authUser.id) {
      relevantProfileIds.add(follow.followerId)
      relevantProfileIds.add(follow.followingId)
    }
  })

  const profiles = Array.from(profileMap.values())
    .filter((profile) => includeProfiles || relevantProfileIds.has(profile.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const payload: PublicSocialResponse = {
    posts,
    profiles,
    follows,
  }

  return NextResponse.json(payload)
}
