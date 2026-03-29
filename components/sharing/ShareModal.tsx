'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Check, Copy, Link, Users, X, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

type Friend = {
  id: string
  name: string
  username?: string
  avatar_url?: string
}

type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  other_user: Friend | null
}

type ShareModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: 'workout' | 'saved_meal' | 'recipe' | 'grocery_list'
  itemName: string
  itemData: Record<string, unknown>
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function ShareModal({ open, onOpenChange, itemType, itemName, itemData }: ShareModalProps) {
  const [tab, setTab] = useState<'link' | 'friends'>('friends')

  // Link tab state
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Friends tab state
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const [friendsLoaded, setFriendsLoaded] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setShareUrl(null)
      setShareId(null)
      setCopied(false)
      setSelectedIds(new Set())
      setMessage('')
      setSentTo(new Set())
      setFriendSearch('')
      setFriends([])
      setFriendsLoaded(false)
    }
  }, [open])

  // Load accepted friends when friends tab is active
  useEffect(() => {
    if (!open || tab !== 'friends' || friendsLoaded || friendsLoading) return
    setFriendsLoading(true)
    getToken().then((token) => {
      if (!token) { setFriendsLoading(false); return }
      fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((rows: FriendshipRow[]) => {
          const accepted = rows
            .filter((r) => r.status === 'accepted' && r.other_user)
            .map((r) => r.other_user!)
          setFriends(accepted)
          setFriendsLoaded(true)
        })
        .catch(() => {})
        .finally(() => setFriendsLoading(false))
    })
  }, [open, tab, friendsLoaded, friendsLoading])

  const createShare = useCallback(async (): Promise<{ share_id: string; url: string } | null> => {
    if (shareId && shareUrl) return { share_id: shareId, url: shareUrl }
    const token = await getToken()
    if (!token) return null
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_type: itemType, item_name: itemName, item_data: itemData, message: message || undefined }),
    })
    if (!res.ok) return null
    const data = await res.json()
    setShareId(data.share_id)
    setShareUrl(data.url)
    return data
  }, [shareId, shareUrl, itemType, itemName, itemData, message])

  async function handleCopyLink() {
    setLinkLoading(true)
    try {
      const result = await createShare()
      if (!result) { toast.error('Could not create share link.'); return }
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy link.')
    } finally {
      setLinkLoading(false)
    }
  }

  async function handleSendToFriends() {
    if (selectedIds.size === 0) return
    setSending(true)
    try {
      const result = await createShare()
      if (!result) { toast.error('Could not create share.'); return }
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/share/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ share_id: result.share_id, recipient_ids: [...selectedIds] }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Could not send to some friends.')
        return
      }
      setSentTo(new Set([...sentTo, ...selectedIds]))
      setSelectedIds(new Set())
      toast.success(`Sent to ${selectedIds.size} friend${selectedIds.size !== 1 ? 's' : ''}!`)
    } catch {
      toast.error('Send failed. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const filteredFriends = friends.filter((f) => {
    const q = friendSearch.toLowerCase()
    return !q || f.name.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q)
  })

  function toggleFriend(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Share &ldquo;{itemName}&rdquo;</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'link' | 'friends')}>
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1 gap-1.5"><Link className="w-3.5 h-3.5" />Link</TabsTrigger>
            <TabsTrigger value="friends" className="flex-1 gap-1.5"><Users className="w-3.5 h-3.5" />Friends</TabsTrigger>
          </TabsList>

          {/* ── Link tab ── */}
          <TabsContent value="link" className="mt-4 space-y-3">
            {shareUrl && (
              <Input value={shareUrl} readOnly className="text-xs font-mono bg-muted/40" />
            )}
            <Button onClick={handleCopyLink} disabled={linkLoading} className="w-full gap-2">
              {linkLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : copied ? (
                <><Check className="w-4 h-4" />Copied!</>
              ) : (
                <><Copy className="w-4 h-4" />Copy link</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Anyone with the link can view and import this {itemType === 'grocery_list' ? 'grocery list' : itemType.replace('_', ' ')}.</p>
          </TabsContent>

          {/* ── Friends tab ── */}
          <TabsContent value="friends" className="mt-4 space-y-3">
            {friendsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : friends.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p>No friends yet.</p>
                <p className="text-xs mt-1">Add friends in Settings → Friends.</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search friends…"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredFriends.map((f) => {
                    const selected = selectedIds.has(f.id)
                    const sent = sentTo.has(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={sent}
                        onClick={() => !sent && toggleFriend(f.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors text-sm ${
                          sent
                            ? 'opacity-50 cursor-default'
                            : selected
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${selected || sent ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                          {(selected || sent) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </span>
                        <span className="truncate font-medium">{f.name}</span>
                        {f.username && <span className="text-muted-foreground text-xs shrink-0">@{f.username}</span>}
                        {sent && <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">Sent</Badge>}
                      </button>
                    )
                  })}
                </div>

                {selectedIds.size > 0 && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Message (optional)</Label>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Add a note…"
                        rows={2}
                        className="mt-1 text-sm resize-none"
                        maxLength={200}
                      />
                    </div>
                    <Button onClick={handleSendToFriends} disabled={sending} className="w-full gap-2">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Send to {selectedIds.size} friend{selectedIds.size !== 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
