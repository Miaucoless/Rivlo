'use client'

import Link from 'next/link'
import { Lock, Search, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { buildSocialProfileHref } from '@/lib/social-connections'
import { cn } from '@/lib/utils'
import type { SocialPostUser } from '@/types'

type Person = SocialPostUser & {
  profile_visibility?: 'public' | 'private'
}

export function PeopleDialog({
  open,
  onOpenChange,
  title,
  description,
  people,
  emptyTitle,
  emptyDetail,
  searchValue,
  onSearchValueChange,
  renderActions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  people: Person[]
  emptyTitle: string
  emptyDetail: string
  searchValue?: string
  onSearchValueChange?: (value: string) => void
  renderActions?: (person: Person) => React.ReactNode
}) {
  const isSearchable = typeof searchValue === 'string' && !!onSearchValueChange

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/70 p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {isSearchable ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Search by name or username"
                className="h-11 rounded-full border-border/70 pl-10"
              />
            </div>
          ) : null}

          {people.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="font-medium text-foreground">{emptyTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyDetail}</p>
            </div>
          ) : (
            <div className="max-h-[60dvh] space-y-3 overflow-y-auto pr-1">
              {people.map((person) => {
                const href = buildSocialProfileHref(person)
                return (
                  <div key={person.id} className="flex items-center gap-3 rounded-3xl border border-border/70 bg-background/80 px-4 py-3">
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground',
                          person.avatar_url ? 'bg-cover bg-center bg-no-repeat' : ''
                        )}
                        style={person.avatar_url ? { backgroundImage: `url(${person.avatar_url})` } : undefined}
                      >
                        {!person.avatar_url ? person.name.charAt(0).toUpperCase() : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>@{person.username}</span>
                          {person.profile_visibility === 'private' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                              <Lock className="h-3 w-3" />
                              Private
                            </span>
                          ) : null}
                        </div>
                        {person.bio ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{person.bio}</p> : null}
                      </div>
                    </Link>
                    <div className="shrink-0">
                      {renderActions ? (
                        renderActions(person)
                      ) : (
                        <Button asChild variant="outline" className="rounded-full">
                          <Link href={href}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
