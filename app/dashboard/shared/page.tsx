'use client'

import { SharedInbox } from '@/components/sharing/SharedInbox'
import { Inbox } from 'lucide-react'

export default function SharedWithMePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Inbox className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Shared With Me</h2>
          <p className="text-sm text-muted-foreground">Workouts, meals, recipes, and grocery lists your friends have shared with you.</p>
        </div>
      </div>

      <SharedInbox />
    </div>
  )
}
