import { NextRequest, NextResponse } from 'next/server'
import type { SocialFollowRelationship, SocialPost, SocialPostUser } from '@/types'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

type PublicSocialResponse = {
  posts: SocialPost[]
  profiles: SocialPostUser[]
  follows: SocialFollowRelationship[]
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function GET(req: NextRequest) {
  if (!(await getAuthUser(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  const profilesResp = await db
    .from('profiles')
    .select('id, name, username, avatar_url, banner_url, bio, profile_visibility')

  if (profilesResp.error) {
    return NextResponse.json({ error: profilesResp.error.message }, { status: 500 })
  }

  let appStateResp = await db
    .from('user_app_state')
    .select('user_id, social_posts, social_follows')

  const missingSocialColumns =
    !!appStateResp.error &&
    (
      appStateResp.error.message.includes('social_posts') ||
      appStateResp.error.message.includes('social_follows') ||
      appStateResp.error.message.includes('schema cache')
    )

  if (missingSocialColumns) {
    appStateResp = await db
      .from('user_app_state')
      .select('user_id')
  }

  if (appStateResp.error) {
    return NextResponse.json({ error: appStateResp.error.message }, { status: 500 })
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

  const profiles = Array.from(profileMap.values()).sort((a, b) => a.name.localeCompare(b.name))
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

  const payload: PublicSocialResponse = {
    posts: Array.from(publicPostsById.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    profiles,
    follows: Array.from(followsByKey.values()),
  }

  return NextResponse.json(payload)
}
