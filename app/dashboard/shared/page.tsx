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
          <h2 className="text-xl font-semibold">Shared Messages</h2>
          <p className="text-sm text-muted-foreground">Open a conversation to see replies and every meal, workout, grocery list, or post shared in that thread.</p>
        </div>
      </div>

      <SharedConversations />
    </div>
  )
}
