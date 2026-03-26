import webpush, { type PushSubscription as WebPushSubscription } from 'web-push'
import { createAdminClient } from '@/lib/server-supabase'

export type StoredPushSubscription = {
  id?: string
  user_id: string
  endpoint: string
  subscription: WebPushSubscription
}

let configured = false

function ensureWebPushConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@rivorafit.com'

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID keys. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
}

export async function sendPushMessage(
  record: StoredPushSubscription,
  payload: {
    title: string
    body: string
    actionUrl: string
    tag: string
  }
) {
  ensureWebPushConfigured()

  try {
    await webpush.sendNotification(
      record.subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        actionUrl: payload.actionUrl,
        tag: payload.tag,
      })
    )

    return { ok: true as const }
  } catch (error: any) {
    const statusCode = Number(error?.statusCode)

    if (statusCode === 404 || statusCode === 410) {
      const admin = createAdminClient()
      await admin.from('push_subscriptions').delete().eq('endpoint', record.endpoint)
    }

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
