import type { SocialFollowRelationship, SocialPost, SocialPostUser, UserProfile } from '@/types'

function slugifyProfileSegment(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'profile'
}

export function buildSocialProfileHref(profile: {
  username?: string | null
  name?: string | null
}) {
  const username = typeof profile.username === 'string' ? profile.username.trim() : ''
  const name = typeof profile.name === 'string' ? profile.name.trim() : ''
  const pathSegment = username || slugifyProfileSegment(name)
  const query = name ? `?name=${encodeURIComponent(name)}` : ''

  return `/dashboard/profile/${encodeURIComponent(pathSegment)}${query}`
}

export function mergeSocialProfiles(
  posts: SocialPost[],
  creators: SocialPostUser[],
  currentUser?: UserProfile | null
): SocialPostUser[] {
  const map = new Map<string, SocialPostUser>()

  creators.forEach((creator) => {
    map.set(creator.id, creator)
  })

  posts.forEach((post) => {
    const existing = map.get(post.user.id)
    map.set(post.user.id, existing ? { ...existing, ...post.user } : post.user)
  })

  if (currentUser) {
    map.set(currentUser.id, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username || currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      avatar_url: currentUser.avatar_url,
      bio: currentUser.bio,
      profile_visibility: currentUser.profile_visibility ?? 'public',
    })
  }

  return Array.from(map.values())
}

export function getFollowRelationship(
  follows: SocialFollowRelationship[],
  followerId: string | null | undefined,
  followingId: string | null | undefined
) {
  if (!followerId || !followingId) return null
  return follows.find((item) => item.followerId === followerId && item.followingId === followingId) ?? null
}

export function getFollowerCount(follows: SocialFollowRelationship[], userId: string) {
  return follows.filter((item) => item.followingId === userId && item.status === 'accepted').length
}

export function getFollowingCount(follows: SocialFollowRelationship[], userId: string) {
  return follows.filter((item) => item.followerId === userId && item.status === 'accepted').length
}

export function getFollowers(follows: SocialFollowRelationship[], userId: string) {
  return follows.filter((item) => item.followingId === userId && item.status === 'accepted').map((item) => item.followerId)
}

export function canViewProfile(
  profile: Pick<SocialPostUser, 'id' | 'profile_visibility'>,
  viewerId: string | null | undefined,
  follows: SocialFollowRelationship[]
) {
  if (viewerId && profile.id === viewerId) return true
  if ((profile.profile_visibility ?? 'public') === 'public') return true
  return !!getFollowRelationship(follows, viewerId, profile.id)?.status && getFollowRelationship(follows, viewerId, profile.id)?.status === 'accepted'
}

export function canViewPost(
  post: SocialPost,
  viewerId: string | null | undefined,
  follows: SocialFollowRelationship[]
) {
  if (viewerId && post.user.id === viewerId) return true
  if (post.audience === 'public') return true
  return getFollowRelationship(follows, viewerId, post.user.id)?.status === 'accepted'
}
