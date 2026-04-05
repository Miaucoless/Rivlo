'use client'

import { useState } from 'react'
import { Inbox, MessageSquareText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SharedInbox } from '@/components/sharing/SharedInbox'
import { SharedMessagesCenter } from '@/components/sharing/SharedMessagesCenter'

export function SharedHub({
  defaultTab = 'inbox',
  compact = false,
}: {
  defaultTab?: 'inbox' | 'messages'
  compact?: boolean
}) {
  const [tab, setTab] = useState<'inbox' | 'messages'>(defaultTab)

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as 'inbox' | 'messages')} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/40 p-1">
        <TabsTrigger value="inbox" className="gap-2 rounded-xl text-sm">
          <Inbox className="h-4 w-4" />
          Inbox
        </TabsTrigger>
        <TabsTrigger value="messages" className="gap-2 rounded-xl text-sm">
          <MessageSquareText className="h-4 w-4" />
          Messages
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inbox" className="mt-0">
        <SharedInbox />
      </TabsContent>

      <TabsContent value="messages" className="mt-0">
        <SharedMessagesCenter compact={compact} />
      </TabsContent>
    </Tabs>
  )
}
