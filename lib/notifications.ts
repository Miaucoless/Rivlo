import type { Notification } from '@/types'

export function isConversationNotification(notification: Notification) {
  return notification.action_url?.startsWith('/dashboard/shared?conversation=') ?? false
}
