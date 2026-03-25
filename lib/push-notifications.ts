'use client'

import { createClient } from '@/lib/supabase'

export type PushNotificationStatus = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

async function getAccessToken() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new Error('You need to be signed in to manage notifications.')
  }

  return data.session.access_token
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return registration
}

async function syncSubscriptionToServer(subscription: PushSubscription) {
  const token = await getAccessToken()

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to save your push subscription.')
  }
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
    }
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = registration ? await registration.pushManager.getSubscription() : null

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!subscription,
  }
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    throw new Error('This browser does not support push notifications.')
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await getRegistration()
  const existing = await registration.pushManager.getSubscription()

  if (existing) {
    await syncSubscriptionToServer(existing)
    return existing
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  })

  await syncSubscriptionToServer(subscription)
  return subscription
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const token = await getAccessToken()

  await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
    }),
  })

  await subscription.unsubscribe()
}

export async function sendTestPushNotification() {
  const token = await getAccessToken()

  const response = await fetch('/api/notifications/test', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send a test notification.')
  }
}
