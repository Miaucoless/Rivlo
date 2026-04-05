'use client'

import { MessageSquareText } from 'lucide-react'
import { SharedConversations } from '@/components/sharing/SharedConversations'

export default function SharedWithMePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquareText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Shared Comments</h2>
          <p className="text-sm text-muted-foreground">Open a shared item thread to see comments and every meal, workout, grocery list, or post attached to it.</p>
        </div>
      </div>

      <SharedConversations />
    </div>
  )
}
