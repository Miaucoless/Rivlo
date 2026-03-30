import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

const VALID_REACTIONS = ['fire', 'love', 'try_this', 'inspired'] as const
type ValidReaction = typeof VALID_REACTIONS[number]

async function getOptionalUser(request: NextRequest) {
  try {
    return await getAuthUser(request)
  } catch {
    return null
  }
}

async function resolveSharedItem(token: string) {
  const db = getServiceClient()
  const { data, error } = await db
    .from('shared_items')
    .select('id, item_name, owner_id')
    .eq('share_token', token)
    .single()

  if (error || !data) return null
  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = getServiceClient()
  const user = await getOptionalUser(request)
  const sharedItem = await resolveSharedItem(params.token)

  if (!sharedItem) {
    return NextResponse.json({ error: 'Share not found.' }, { status: 404 })
  }

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    db
      .from('share_reactions')
      .select('user_id, reaction')
      .eq('share_id', sharedItem.id),
    db
      .from('share_comments')
      .select('id, user_id, body, created_at')
      .eq('share_id', sharedItem.id)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const commenterIds = [...new Set((comments ?? []).map((comment) => comment.user_id))]
  const { data: profiles } = commenterIds.length > 0
    ? await db.from('profiles').select('id, name, username').in('id', commenterIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]))
  const reactionCounts = VALID_REACTIONS.map((reaction) => ({
    reaction,
    count: (reactions ?? []).filter((entry) => entry.reaction === reaction).length,
  })).filter((entry) => entry.count > 0)

  return NextResponse.json({
    current_reaction: user ? (reactions ?? []).find((entry) => entry.user_id === user.id)?.reaction ?? null : null,
    reactions: reactionCounts,
    comments: (comments ?? []).map((comment) => {
      const profile = profileMap[comment.user_id]
      return {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        user_name: profile?.name ?? 'Rivora user',
        username: profile?.username ?? null,
        is_owner: comment.user_id === sharedItem.owner_id,
      }
    }),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const sharedItem = await resolveSharedItem(params.token)

  if (!sharedItem) {
    return NextResponse.json({ error: 'Share not found.' }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as
    | { type?: 'reaction'; reaction?: ValidReaction }
    | { type?: 'comment'; body?: string }
    | null

  if (!body?.type) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (body.type === 'reaction') {
    if (!body.reaction || !VALID_REACTIONS.includes(body.reaction)) {
      return NextResponse.json({ error: 'Invalid reaction.' }, { status: 400 })
    }

    const { data: existingReaction } = await db
      .from('share_reactions')
      .select('id, reaction')
      .eq('share_id', sharedItem.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingReaction?.reaction === body.reaction) {
      await db.from('share_reactions').delete().eq('id', existingReaction.id)
      return NextResponse.json({ success: true, toggled_off: true })
    }

    const { error } = await db.from('share_reactions').upsert({
      share_id: sharedItem.id,
      user_id: user.id,
      reaction: body.reaction,
    }, { onConflict: 'share_id,user_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (sharedItem.owner_id !== user.id) {
      await db.from('notifications').insert({
        user_id: sharedItem.owner_id,
        type: 'info',
        title: 'New reaction on your share',
        message: `${user.user_metadata?.name || user.email || 'Someone'} reacted to ${sharedItem.item_name}.`,
        action_url: `/share/${params.token}`,
      })
    }

    return NextResponse.json({ success: true })
  }

  const commentBody = body.body?.trim()
  if (!commentBody) {
    return NextResponse.json({ error: 'Write a comment first.' }, { status: 400 })
  }

  if (commentBody.length > 280) {
    return NextResponse.json({ error: 'Comments must be 280 characters or less.' }, { status: 400 })
  }

  const { error } = await db.from('share_comments').insert({
    share_id: sharedItem.id,
    user_id: user.id,
    body: commentBody,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (sharedItem.owner_id !== user.id) {
    await db.from('notifications').insert({
      user_id: sharedItem.owner_id,
      type: 'info',
      title: 'New comment on your share',
      message: `${user.user_metadata?.name || user.email || 'Someone'} commented on ${sharedItem.item_name}.`,
      action_url: `/share/${params.token}`,
    })
  }

  return NextResponse.json({ success: true })
}
