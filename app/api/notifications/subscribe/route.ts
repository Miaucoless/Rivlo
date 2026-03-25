import { NextResponse } from 'next/server'
import { createAdminClient, getUserFromBearerToken } from '@/lib/server-supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const body = await request.json().catch(() => null)
    const subscription = body?.subscription

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Missing push subscription payload.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription,
        user_agent: body?.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 401 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const body = await request.json().catch(() => null)
    const endpoint = body?.endpoint

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing subscription endpoint.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 401 }
    )
  }
}
