'use client'

import { SharedInbox } from '@/components/sharing/SharedInbox'

export default function SharedWithMePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <p className="text-sm text-muted-foreground">Workouts, meals, recipes, and grocery lists your friends have shared with you.</p>

      <SharedInbox />
    </div>
  )
}
