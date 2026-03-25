import { NextResponse } from 'next/server'
import { createAdminClient, getUserFromBearerToken } from '@/lib/server-supabase'
import { sendPushMessage, type StoredPushSubscription } from '@/lib/server-push'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request)
    const admin = createAdminClient()

    const { data: subscriptions, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, subscription')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ error: 'No device subscription found. Enable browser notifications first.' }, { status: 400 })
    }

    await Promise.all(
      subscriptions.map((subscription) =>
        sendPushMessage(subscription as StoredPushSubscription, {
          title: 'Rivlo notifications are live',
          body: 'This is a test notification from your settings page.',
          actionUrl: '/dashboard/settings',
          tag: `test-${Date.now()}`,
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 401 }
    )
  }
}
