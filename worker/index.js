self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: 'Rivora',
      body: event.data ? event.data.text() : 'You have a new notification.',
      actionUrl: '/dashboard',
    }
  }

  const title = payload.title || 'Rivora'
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      actionUrl: payload.actionUrl || '/dashboard',
    },
    tag: payload.tag || 'rivora-notification',
    renotify: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const actionUrl = event.notification?.data?.actionUrl || '/dashboard'
  event.notification.close()

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

    for (const client of clientList) {
      if ('focus' in client && client.url.includes(self.location.origin)) {
        await client.navigate(actionUrl)
        await client.focus()
        return
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(actionUrl)
    }
  })())
})
