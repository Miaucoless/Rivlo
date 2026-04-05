import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, username, avatar_url, banner_url, bio, profile_visibility } = body

  const updates: Record<string, string | null> = {}
  if (name !== undefined) updates.name = name
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (banner_url !== undefined) updates.banner_url = banner_url
  if (bio !== undefined) updates.bio = bio
  if (username !== undefined) updates.username = typeof username === 'string' && username.trim() ? username.toLowerCase() : null
  if (profile_visibility !== undefined) {
    updates.profile_visibility = profile_visibility === 'private' ? 'private' : 'public'
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = getServiceClient()

  const performUpdate = async (nextUpdates: Record<string, string | null>) => {
    return db
      .from('profiles')
      .update(nextUpdates)
      .eq('id', user.id)
      .select('id, name, username, avatar_url, banner_url, bio, profile_visibility')
      .single()
  }

  let { data, error } = await performUpdate(updates)

  const missingVisibilityColumn =
    profile_visibility !== undefined &&
    !!error &&
    (error.message.includes('profile_visibility') || error.message.includes('schema cache'))

  const missingUsernameColumn =
    username !== undefined &&
    !!error &&
    (error.message.includes('username') || error.message.includes('schema cache'))

  const missingBannerColumn =
    banner_url !== undefined &&
    !!error &&
    (error.message.includes('banner_url') || error.message.includes('schema cache'))

  if (missingVisibilityColumn || missingBannerColumn || missingUsernameColumn) {
    const {
      profile_visibility: _ignoredVisibility,
      banner_url: _ignoredBanner,
      username: _ignoredUsername,
      ...fallbackUpdates
    } = updates
    const retry = await performUpdate(fallbackUpdates)
    data = retry.data
    error = retry.error
  }

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
