'use client'

import { createClient } from '@/lib/supabase'

async function getAccessToken() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new Error('You need to be signed in to manage email reminders.')
  }

  return data.session.access_token
}

export async function sendTestEmailNotification() {
  const token = await getAccessToken()

  const response = await fetch('/api/notifications/test-email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send a test email.')
  }
}
