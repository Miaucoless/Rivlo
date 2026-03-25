# Share with Friends — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to share custom workout templates, completed workout sessions, saved meal templates, and custom recipes — via shareable link or directly to in-app friends.

**Architecture:** Supabase-native with 5 new tables (`shared_items`, `friendships`, `friend_shares`, `imported_items`, `username` column on `user_profiles`). All mutations go through Next.js API routes using the Supabase service role key. Item data is snapshotted as JSONB at share time so recipients see exactly what was shared.

**Tech Stack:** Next.js 14 App Router, Supabase (service role key for all share/friend mutations), Zustand store, shadcn/ui (Dialog, Tabs, Badge, Input, Button)

---

## File Map

**New files:**
- `supabase/migrations/20260324000001_sharing.sql` — all 5 DB objects
- `lib/supabase-server.ts` — service role client + Bearer token auth helper
- `app/api/share/create/route.ts`
- `app/api/share/send/route.ts`
- `app/api/share/[token]/route.ts`
- `app/api/share/[token]/import/route.ts`
- `app/api/share/inbox/route.ts`
- `app/api/friends/route.ts`
- `app/api/friends/search/route.ts`
- `app/api/friends/request/route.ts`
- `app/api/friends/respond/route.ts`
- `app/api/friends/[friendId]/route.ts`
- `app/api/profile/route.ts`
- `app/share/[token]/page.tsx`
- `components/sharing/ShareModal.tsx`
- `components/sharing/SharedInbox.tsx`

**Modified files:**
- `types/index.ts` — `UserProfile.username`, `Notification.type` union
- `app/dashboard/settings/page.tsx` — Friends tab (5th tab)
- `components/dashboard/TopBar.tsx` — `share_received` notification rendering + inbox
- `app/dashboard/workouts/page.tsx` — Share button on custom workout template cards
- `app/dashboard/meals/page.tsx` — Share button on saved meal + recipe cards

---

## Task 1: DB Migration + Types

**Files:**
- Create: `supabase/migrations/20260324000001_sharing.sql`
- Modify: `types/index.ts`

- [ ] **Step 1: Create the SQL migration**

```sql
-- supabase/migrations/20260324000001_sharing.sql

-- 1. username on user_profiles
alter table user_profiles
  add column if not exists username text unique
  check (username ~ '^[a-z0-9_]{3,20}$');

create index if not exists user_profiles_username_idx on user_profiles (username);

-- 2. shared_items
create table if not exists shared_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  item_type   text not null
                check (item_type in ('workout','workout_log','saved_meal','recipe')),
  item_name   text not null,
  item_data   jsonb not null,
  share_token text not null unique default substr(gen_random_uuid()::text, 1, 12),
  message     text,
  created_at  timestamptz not null default now()
);

create index if not exists shared_items_owner_idx on shared_items (owner_id);

-- 3. friendships
create table if not exists friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid references auth.users(id) on delete cascade,
  invited_email text,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','declined','invited')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- prevent duplicate requests between existing users
create unique index if not exists friendships_users_uniq
  on friendships (requester_id, addressee_id)
  where addressee_id is not null;

-- prevent duplicate email invites
create unique index if not exists friendships_email_uniq
  on friendships (requester_id, invited_email)
  where invited_email is not null;

create index if not exists friendships_requester_idx on friendships (requester_id);
create index if not exists friendships_addressee_idx on friendships (addressee_id);
create index if not exists friendships_email_idx     on friendships (invited_email);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists friendships_updated_at on friendships;
create trigger friendships_updated_at
  before update on friendships
  for each row execute function set_updated_at();

-- 4. friend_shares (inbox)
create table if not exists friend_shares (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references shared_items(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  viewed_at    timestamptz,
  imported_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (share_id, recipient_id)
);

create index if not exists friend_shares_recipient_idx on friend_shares (recipient_id);
create index if not exists friend_shares_share_idx     on friend_shares (share_id);

-- RLS for direct client reads
alter table friend_shares enable row level security;
create policy "recipient can view own shares"
  on friend_shares for select
  using (recipient_id = auth.uid());
create policy "owner can view delivery status"
  on friend_shares for select
  using (
    exists (
      select 1 from shared_items si
      where si.id = friend_shares.share_id and si.owner_id = auth.uid()
    )
  );

-- 5. imported_items (idempotency)
create table if not exists imported_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  share_id   uuid not null references shared_items(id) on delete cascade,
  result_id  text not null,
  created_at timestamptz not null default now(),
  unique (user_id, share_id)
);

create index if not exists imported_items_user_idx on imported_items (user_id);
```

- [ ] **Step 2: Apply migration to Supabase**

Run in the Supabase SQL editor or via CLI:
```bash
# via Supabase CLI (if linked)
supabase db push
# OR paste the SQL directly into Supabase Dashboard > SQL editor
```

- [ ] **Step 3: Update types/index.ts**

In `types/index.ts`, change `UserProfile` to add `username`:
```ts
// After: avatar_url?: string
username?: string
```

Change `Notification.type` union:
```ts
// Before
type: 'info' | 'success' | 'warning' | 'error'
// After
type: 'info' | 'success' | 'warning' | 'error' | 'share_received'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260324000001_sharing.sql types/index.ts
git commit -m "feat: add sharing DB migration and extend types"
```

---

## Task 2: Server Supabase Helper

**Files:**
- Create: `lib/supabase-server.ts`

- [ ] **Step 1: Create the helper**

```ts
// lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Service role client — bypasses RLS, use server-side only */
export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Extract user from Bearer token. Returns null user on failure. */
export async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user } } = await authClient.auth.getUser(token)
  return user ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase-server.ts
git commit -m "feat: add server-side Supabase helper"
```

---

## Task 3: Share API Routes

**Files:**
- Create: `app/api/share/create/route.ts`
- Create: `app/api/share/send/route.ts`
- Create: `app/api/share/[token]/route.ts`
- Create: `app/api/share/[token]/import/route.ts`
- Create: `app/api/share/inbox/route.ts`

- [ ] **Step 1: Create `app/api/share/create/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_type, item_data, item_name, message } = await req.json()
  if (!item_type || !item_data || !item_name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = getServiceClient()

  // Retry up to 3x on token collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('shared_items')
      .insert({ owner_id: user.id, item_type, item_name, item_data, message })
      .select('id, share_token')
      .single()

    if (!error && data) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/share/${data.share_token}`
      return NextResponse.json({ share_id: data.id, token: data.share_token, url })
    }
    // only retry on unique constraint violation
    if (!error?.message?.includes('unique')) {
      return NextResponse.json({ error: error?.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not generate share token' }, { status: 500 })
}
```

- [ ] **Step 2: Create `app/api/share/send/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { share_id, recipient_ids } = await req.json()
  if (!share_id || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const db = getServiceClient()

  // Validate each recipient is an accepted friend (bidirectional check)
  for (const recipientId of recipient_ids) {
    const { data } = await db
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${recipientId}),` +
        `and(addressee_id.eq.${user.id},requester_id.eq.${recipientId})`
      )
      .maybeSingle()

    if (!data) {
      return NextResponse.json(
        { error: `Recipient ${recipientId} is not an accepted friend` },
        { status: 422 }
      )
    }
  }

  // Get share item name for notification
  const { data: shareItem } = await db
    .from('shared_items')
    .select('item_name, share_token')
    .eq('id', share_id)
    .eq('owner_id', user.id)
    .single()

  if (!shareItem) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  // Get sender display name
  const { data: senderProfile } = await db
    .from('user_profiles')
    .select('name')
    .eq('id', user.id)
    .single()
  const senderName = senderProfile?.name ?? 'Someone'

  // Insert friend_shares rows
  const shares = recipient_ids.map((id: string) => ({
    share_id,
    recipient_id: id,
  }))
  await db.from('friend_shares').upsert(shares, { onConflict: 'share_id,recipient_id' })

  // Insert share_received notifications
  const notifications = recipient_ids.map((id: string) => ({
    user_id: id,
    type: 'share_received',
    title: `${senderName} shared something with you`,
    message: shareItem.item_name,
    read: false,
    action_url: `/share/${shareItem.share_token}`,
    created_at: new Date().toISOString(),
  }))
  await db.from('notifications').insert(notifications)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `app/api/share/[token]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const db = getServiceClient()

  const { data: item, error } = await db
    .from('shared_items')
    .select('id, item_type, item_name, item_data, message, created_at, owner_id')
    .eq('share_token', params.token)
    .single()

  if (error || !item) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired.' },
      { status: 404 }
    )
  }

  const { data: profile } = await db
    .from('user_profiles')
    .select('name')
    .eq('id', item.owner_id)
    .single()

  return NextResponse.json({
    share_id: item.id,
    item_type: item.item_type,
    item_name: item.item_name,
    item_data: item.item_data,
    owner_name: profile?.name ?? 'Someone',
    message: item.message,
    created_at: item.created_at,
  })
}
```

- [ ] **Step 4: Create `app/api/share/[token]/import/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friend_share_id } = await req.json().catch(() => ({}))
  const db = getServiceClient()

  // Fetch the shared item
  const { data: item } = await db
    .from('shared_items')
    .select('id, item_type, item_data, item_name')
    .eq('share_token', params.token)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  // Idempotency: check if already imported
  const { data: existing } = await db
    .from('imported_items')
    .select('result_id')
    .eq('user_id', user.id)
    .eq('share_id', item.id)
    .maybeSingle()

  if (existing) {
    if (friend_share_id) {
      await db
        .from('friend_shares')
        .update({ imported_at: new Date().toISOString() })
        .eq('id', friend_share_id)
        .eq('recipient_id', user.id)
    }
    return NextResponse.json({ result_id: existing.result_id, already_imported: true })
  }

  // Clone item into user's tables
  let resultId: string | null = null
  const data = item.item_data as Record<string, unknown>

  if (item.item_type === 'recipe') {
    const { data: inserted } = await db
      .from('recipes')
      .insert({ ...data, id: undefined, user_id: user.id, source: 'imported' })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'workout' || item.item_type === 'workout_log') {
    const table = item.item_type === 'workout' ? 'workout_templates' : 'workout_logs'
    const { data: inserted } = await db
      .from(table)
      .insert({ ...data, id: undefined, user_id: user.id })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  } else if (item.item_type === 'saved_meal') {
    const { data: inserted } = await db
      .from('saved_meals')
      .insert({ ...data, id: undefined, user_id: user.id })
      .select('id')
      .single()
    resultId = inserted?.id ?? null
  }

  if (!resultId) {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }

  // Record in imported_items
  await db.from('imported_items').insert({
    user_id: user.id,
    share_id: item.id,
    result_id: resultId,
  })

  // Update friend_shares imported_at if applicable
  if (friend_share_id) {
    await db
      .from('friend_shares')
      .update({ imported_at: new Date().toISOString() })
      .eq('id', friend_share_id)
      .eq('recipient_id', user.id)
  }

  return NextResponse.json({ result_id: resultId, already_imported: false })
}
```

- [ ] **Step 5: Create `app/api/share/inbox/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typeFilter = req.nextUrl.searchParams.get('type')
  const db = getServiceClient()

  let query = db
    .from('friend_shares')
    .select(`
      id,
      viewed_at,
      imported_at,
      created_at,
      shared_items (
        id,
        item_type,
        item_name,
        share_token,
        message,
        created_at,
        owner_id
      )
    `)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })

  if (typeFilter) {
    query = query.eq('shared_items.item_type', typeFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with sender names
  const ownerIds = [...new Set(data?.map((r: Record<string, unknown>) => (r.shared_items as Record<string, unknown>)?.owner_id as string).filter(Boolean))]
  const { data: profiles } = await db
    .from('user_profiles')
    .select('id, name')
    .in('id', ownerIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))

  const items = (data ?? [])
    .filter((r: Record<string, unknown>) => r.shared_items)
    .map((r: Record<string, unknown>) => {
      const si = r.shared_items as Record<string, unknown>
      return {
        friend_share_id: r.id,
        viewed_at: r.viewed_at,
        imported_at: r.imported_at,
        share_id: si.id,
        item_type: si.item_type,
        item_name: si.item_name,
        token: si.share_token,
        message: si.message,
        owner_name: profileMap[si.owner_id as string] ?? 'Someone',
        created_at: r.created_at,
      }
    })

  return NextResponse.json(items)
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/share/
git commit -m "feat: add share API routes (create, send, token, import, inbox)"
```

---

## Task 4: Friends API Routes

**Files:**
- Create: `app/api/friends/route.ts`
- Create: `app/api/friends/search/route.ts`
- Create: `app/api/friends/request/route.ts`
- Create: `app/api/friends/respond/route.ts`
- Create: `app/api/friends/[friendId]/route.ts`

- [ ] **Step 1: Create `app/api/friends/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const { data, error } = await db
    .from('friendships')
    .select('id, requester_id, addressee_id, invited_email, status, created_at, updated_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .neq('status', 'declined')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Collect all user IDs to resolve profiles
  const userIds = new Set<string>()
  for (const f of data ?? []) {
    if (f.requester_id) userIds.add(f.requester_id)
    if (f.addressee_id) userIds.add(f.addressee_id)
  }

  const { data: profiles } = await db
    .from('user_profiles')
    .select('id, name, username, avatar_url')
    .in('id', [...userIds])

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string; username?: string; avatar_url?: string }) => [p.id, p]))

  const enriched = (data ?? []).map((f: Record<string, unknown>) => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
    return {
      ...f,
      other_user: otherId ? profileMap[otherId as string] ?? null : null,
    }
  })

  return NextResponse.json(enriched)
}
```

- [ ] **Step 2: Create `app/api/friends/search/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const db = getServiceClient()

  // Try exact email match first, then exact username
  let results: { id: string; name: string; username?: string; avatar_url?: string }[] = []

  const isEmail = q.includes('@')

  if (isEmail) {
    const { data: byEmail } = await db
      .from('user_profiles')
      .select('id, name, username, avatar_url, email')
      .eq('email', q)
      .neq('id', user.id)
    results = byEmail ?? []
  } else {
    const { data: byUsername } = await db
      .from('user_profiles')
      .select('id, name, username, avatar_url')
      .eq('username', q.toLowerCase())
      .neq('id', user.id)
    results = byUsername ?? []
  }

  if (results.length === 0) return NextResponse.json([])

  // Exclude users already in a friendship with current user
  const { data: existing } = await db
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .neq('status', 'declined')

  const existingIds = new Set<string>()
  for (const f of existing ?? []) {
    existingIds.add(f.requester_id)
    existingIds.add(f.addressee_id)
  }

  const filtered = results.filter((r) => !existingIds.has(r.id))
  return NextResponse.json(filtered)
}
```

- [ ] **Step 3: Create `app/api/friends/request/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addressee_id, email } = await req.json()
  if (!addressee_id && !email) {
    return NextResponse.json({ error: 'Provide addressee_id or email' }, { status: 400 })
  }

  const db = getServiceClient()

  // If email provided, check if that email belongs to an existing user
  let targetId: string | null = addressee_id ?? null
  let targetEmail: string | null = null

  if (!targetId && email) {
    const { data: existingUser } = await db
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      targetId = existingUser.id
    } else {
      targetEmail = email
    }
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
  }

  // Check for existing relationship
  if (targetId) {
    const { data: existing } = await db
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),` +
        `and(addressee_id.eq.${user.id},requester_id.eq.${targetId})`
      )
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Request already exists', status: existing.status }, { status: 409 })
    }

    const { data, error } = await db
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: targetId, status: 'pending' })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the addressee
    await db.from('notifications').insert({
      user_id: targetId,
      type: 'info',
      title: 'New friend request',
      message: 'Someone wants to connect with you.',
      read: false,
      action_url: '/dashboard/settings?tab=friends',
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ friendship_id: data.id, type: 'request_sent' })
  }

  // Email invite to non-user
  if (targetEmail) {
    const { data: existingInvite } = await db
      .from('friendships')
      .select('id')
      .eq('requester_id', user.id)
      .eq('invited_email', targetEmail)
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json({ error: 'Invite already sent', status: 'invited' }, { status: 409 })
    }

    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(targetEmail)
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

    const { data } = await db
      .from('friendships')
      .insert({ requester_id: user.id, invited_email: targetEmail, status: 'invited' })
      .select('id')
      .single()

    return NextResponse.json({ friendship_id: data?.id, type: 'invite_sent' })
  }

  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

- [ ] **Step 4: Create `app/api/friends/respond/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendship_id, action } = await req.json()
  if (!friendship_id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const db = getServiceClient()

  // Ensure current user is the addressee
  const { data: friendship } = await db
    .from('friendships')
    .select('id, addressee_id, status')
    .eq('id', friendship_id)
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Friendship not found or not pending' }, { status: 404 })
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  await db.from('friendships').update({ status: newStatus }).eq('id', friendship_id)

  return NextResponse.json({ ok: true, status: newStatus })
}
```

- [ ] **Step 5: Create `app/api/friends/[friendId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { friendId: string } }
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const { data: friendship } = await db
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', params.friendId)
    .maybeSingle()

  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { requester_id, addressee_id, status } = friendship

  // For pending/invited: only requester may cancel
  if (['pending', 'invited'].includes(status)) {
    if (requester_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // For accepted: either party may remove
  if (status === 'accepted') {
    if (requester_id !== user.id && addressee_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.from('friendships').delete().eq('id', params.friendId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/friends/
git commit -m "feat: add friends API routes (list, search, request, respond, delete)"
```

---

## Task 5: Profile PATCH Route

**Files:**
- Create: `app/api/profile/route.ts`

- [ ] **Step 1: Create `app/api/profile/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, username, avatar_url } = await req.json()
  const db = getServiceClient()

  const updates: Record<string, string> = {}
  if (name !== undefined) updates.name = name
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (username !== undefined) updates.username = username.toLowerCase()

  const { data, error } = await db
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, name, username, avatar_url')
    .single()

  if (error) {
    if (error.message.includes('unique') || error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/profile/route.ts
git commit -m "feat: add profile PATCH route for username/name/avatar"
```

---

## Task 6: ShareModal Component

**Files:**
- Create: `components/sharing/ShareModal.tsx`

- [ ] **Step 1: Create `components/sharing/ShareModal.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Send, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import type { Workout, WorkoutLog, SavedMealTemplate, Recipe } from '@/types'

type ShareItemType = 'workout' | 'workout_log' | 'saved_meal' | 'recipe'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: ShareItemType
  itemName: string
  itemData: Workout | WorkoutLog | SavedMealTemplate | Recipe
}

interface Friend {
  id: string
  name: string
  username?: string
}

interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  other_user: Friend | null
}

export function ShareModal({ open, onOpenChange, itemType, itemName, itemData }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState(false)

  useEffect(() => {
    if (!open) return
    // Reset state each open
    setToken(null)
    setShareId(null)
    setShareUrl(null)
    setCopied(false)
    setSelected([])
    setMessage('')
    setSent(false)
    setSendError(null)

    // Load accepted friends
    void loadFriends()
  }, [open])

  async function getToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token ?? null
  }

  async function loadFriends() {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/friends', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data: FriendshipRow[] = await res.json()
    const accepted = data
      .filter((f) => f.status === 'accepted' && f.other_user)
      .map((f) => f.other_user!)
    setFriends(accepted)
  }

  async function ensureShareCreated(): Promise<{ shareId: string; token: string; url: string } | null> {
    if (shareId && token && shareUrl) return { shareId, token, url: shareUrl }

    const authToken = await getToken()
    if (!authToken) return null

    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ item_type: itemType, item_name: itemName, item_data: itemData, message }),
    })

    if (!res.ok) return null
    const data = await res.json()
    setShareId(data.share_id)
    setToken(data.token)
    setShareUrl(data.url)
    return { shareId: data.share_id, token: data.token, url: data.url }
  }

  async function handleCopyLink() {
    setLoadingLink(true)
    try {
      const result = await ensureShareCreated()
      if (!result) return
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } finally {
      setLoadingLink(false)
    }
  }

  async function handleSend() {
    if (selected.length === 0) return
    setSending(true)
    setSendError(null)
    try {
      const authToken = await getToken()
      if (!authToken) return

      const result = await ensureShareCreated()
      if (!result) { setSendError('Could not create share link'); return }

      const res = await fetch('/api/share/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ share_id: result.shareId, recipient_ids: selected }),
      })

      if (res.ok) {
        setSent(true)
      } else {
        const err = await res.json()
        setSendError(err.error ?? 'Failed to send')
      }
    } finally {
      setSending(false)
    }
  }

  function toggleFriend(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{itemName}"</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Copy link</TabsTrigger>
            <TabsTrigger value="friends">Send to friends</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can preview and import this {itemType.replace('_', ' ')}.
            </p>
            {shareUrl ? (
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopyLink}>
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <Button onClick={handleCopyLink} disabled={loadingLink} className="w-full">
                {loadingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                Generate & Copy Link
              </Button>
            )}
          </TabsContent>

          <TabsContent value="friends" className="space-y-4 pt-2">
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No friends yet. Add friends in Settings → Friends.
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {friends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFriend(f.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selected.includes(f.id)
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {f.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{f.name}</p>
                        {f.username && <p className="text-xs text-muted-foreground">@{f.username}</p>}
                      </div>
                      {selected.includes(f.id) && (
                        <Check className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <Input
                  placeholder="Add a message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                {sendError && (
                  <p className="text-sm text-rose-500">{sendError}</p>
                )}

                {sent ? (
                  <div className="flex items-center gap-2 text-emerald-500 text-sm">
                    <Check className="w-4 h-4" />
                    Sent to {selected.length} friend{selected.length > 1 ? 's' : ''}!
                  </div>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={selected.length === 0 || sending}
                    className="w-full"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send to {selected.length > 0 ? `${selected.length} friend${selected.length > 1 ? 's' : ''}` : 'friends'}
                  </Button>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sharing/ShareModal.tsx
git commit -m "feat: add ShareModal component with link and friends tabs"
```

---

## Task 7: Share Buttons on Workout Cards

**Files:**
- Modify: `app/dashboard/workouts/page.tsx`

Find the section that renders custom workout template cards (look for `source === 'custom'` or the template cards list). Add a Share button to the action menu alongside the existing Edit/Delete buttons.

- [ ] **Step 1: Add `Share2` import to workouts page**

In `app/dashboard/workouts/page.tsx`, add `Share2` to the lucide-react import:
```ts
import { ..., Share2 } from 'lucide-react'
```

Also add the ShareModal import:
```ts
import { ShareModal } from '@/components/sharing/ShareModal'
```

- [ ] **Step 2: Add share state to workouts page**

Inside the component body, add:
```ts
const [shareTarget, setShareTarget] = useState<{ workout: Workout; type: 'workout' } | null>(null)
```

- [ ] **Step 3: Add Share button to custom workout template cards**

Find where custom workout cards render their action buttons (alongside Pencil/Trash2 icons for edit/delete). Add:
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="text-muted-foreground hover:text-emerald-400"
  onClick={(e) => { e.stopPropagation(); setShareTarget({ workout, type: 'workout' }) }}
  aria-label="Share workout"
>
  <Share2 className="w-4 h-4" />
</Button>
```

- [ ] **Step 4: Add share button to completed workout log cards**

Find where workout log history cards render (look for `workoutLogs.map`). Add a Share button alongside existing actions:
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="text-muted-foreground hover:text-emerald-400"
  onClick={() => setShareWorkoutLog(log)}
  aria-label="Share workout log"
>
  <Share2 className="w-4 h-4" />
</Button>
```

Add a second state for workout logs:
```ts
const [shareWorkoutLog, setShareWorkoutLog] = useState<WorkoutLog | null>(null)
```

- [ ] **Step 5: Add ShareModal instances**

At the bottom of the JSX (before the last closing tag):
```tsx
{shareTarget && (
  <ShareModal
    open={!!shareTarget}
    onOpenChange={(open) => { if (!open) setShareTarget(null) }}
    itemType="workout"
    itemName={shareTarget.workout.name}
    itemData={shareTarget.workout}
  />
)}
{shareWorkoutLog && (
  <ShareModal
    open={!!shareWorkoutLog}
    onOpenChange={(open) => { if (!open) setShareWorkoutLog(null) }}
    itemType="workout_log"
    itemName={shareWorkoutLog.workout.name}
    itemData={shareWorkoutLog}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/workouts/page.tsx
git commit -m "feat: add share buttons to custom workout template and log cards"
```

---

## Task 8: Share Buttons on Meal/Recipe Cards

**Files:**
- Modify: `app/dashboard/meals/page.tsx`

- [ ] **Step 1: Add `Share2` import and ShareModal import**

```ts
import { ..., Share2 } from 'lucide-react'
import { ShareModal } from '@/components/sharing/ShareModal'
```

- [ ] **Step 2: Add share state**

```ts
const [shareMeal, setShareMeal] = useState<{ item: SavedMealTemplate | Recipe; type: 'saved_meal' | 'recipe' } | null>(null)
```

- [ ] **Step 3: Add Share button to saved meal template cards**

Find where `savedMeals.map(...)` renders cards (look for `SavedMealTemplate` or `savedMeals`). Add alongside the existing action buttons:
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="text-muted-foreground hover:text-emerald-400"
  onClick={(e) => { e.stopPropagation(); setShareMeal({ item: meal, type: 'saved_meal' }) }}
  aria-label="Share meal"
>
  <Share2 className="w-4 h-4" />
</Button>
```

- [ ] **Step 4: Add Share button to custom recipe cards**

Find where `customRecipes.map(...)` or the recipe section renders. Add:
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="text-muted-foreground hover:text-emerald-400"
  onClick={(e) => { e.stopPropagation(); setShareMeal({ item: recipe, type: 'recipe' }) }}
  aria-label="Share recipe"
>
  <Share2 className="w-4 h-4" />
</Button>
```

- [ ] **Step 5: Add ShareModal**

```tsx
{shareMeal && (
  <ShareModal
    open={!!shareMeal}
    onOpenChange={(open) => { if (!open) setShareMeal(null) }}
    itemType={shareMeal.type}
    itemName={shareMeal.item.name}
    itemData={shareMeal.item}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/meals/page.tsx
git commit -m "feat: add share buttons to saved meal and recipe cards"
```

---

## Task 9: Public `/share/[token]` Page

**Files:**
- Create: `app/share/[token]/page.tsx`

- [ ] **Step 1: Create `app/share/[token]/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Download, LogIn, UserPlus, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'

interface ShareData {
  share_id: string
  item_type: string
  item_name: string
  item_data: Record<string, unknown>
  owner_name: string
  message?: string
  created_at: string
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)

  useEffect(() => {
    void init()
  }, [token])

  async function init() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    setIsAuthenticated(!!session)
    setAuthToken(session?.access_token ?? null)

    const res = await fetch(`/api/share/${token}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data: ShareData = await res.json()
    setShareData(data)
    setLoading(false)

    // If authenticated, auto-import if came from post-auth redirect
    if (session) {
      const searchParams = new URLSearchParams(window.location.search)
      if (searchParams.get('auto_import') === '1') {
        void handleImport(session.access_token)
      }
    }
  }

  async function handleImport(token?: string) {
    const t = token ?? authToken
    if (!t) return
    setImporting(true)
    try {
      const res = await fetch(`/api/share/${params.token}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({}),
      })
      if (res.ok) setImported(true)
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Link Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const typeLabel: Record<string, string> = {
    workout: 'Workout Template',
    workout_log: 'Completed Session',
    saved_meal: 'Meal Template',
    recipe: 'Recipe',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{typeLabel[shareData!.item_type] ?? shareData!.item_type}</Badge>
          </div>
          <CardTitle className="text-2xl">{shareData!.item_name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shared by <span className="font-medium text-foreground">{shareData!.owner_name}</span>
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {shareData!.message && (
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4">
              <p className="text-sm italic">"{shareData!.message}"</p>
            </div>
          )}

          {imported ? (
            <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
              <CheckCircle className="w-5 h-5" />
              Added to your account!
            </div>
          ) : isAuthenticated ? (
            <Button
              onClick={() => handleImport()}
              disabled={importing}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Import to my account
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">Sign in to import this item.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/signup?redirect=/share/${token}`)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign up
                </Button>
                <Button
                  onClick={() => router.push(`/login?redirect=/share/${token}`)}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Log in
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/share/
git commit -m "feat: add public /share/[token] page with import/auth flow"
```

---

## Task 10: SharedInbox Component

**Files:**
- Create: `components/sharing/SharedInbox.tsx`

- [ ] **Step 1: Create `components/sharing/SharedInbox.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface InboxItem {
  friend_share_id: string
  viewed_at: string | null
  imported_at: string | null
  share_id: string
  item_type: string
  item_name: string
  token: string
  message?: string
  owner_name: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  workout: 'Workout',
  workout_log: 'Session',
  saved_meal: 'Meal',
  recipe: 'Recipe',
}

export function SharedInbox() {
  const router = useRouter()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())

  useEffect(() => {
    void load()
  }, [])

  async function getToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token ?? null
  }

  async function load() {
    const token = await getToken()
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/share/inbox', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  async function handleImport(item: InboxItem) {
    const token = await getToken()
    if (!token) return
    setImporting(item.friend_share_id)
    try {
      const res = await fetch(`/api/share/${item.token}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friend_share_id: item.friend_share_id }),
      })
      if (res.ok) {
        setImported((prev) => new Set([...prev, item.friend_share_id]))
      }
    } finally {
      setImporting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nothing shared with you yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isImported = imported.has(item.friend_share_id) || !!item.imported_at
        return (
          <div
            key={item.friend_share_id}
            className="rounded-2xl border border-border/60 bg-background/70 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {TYPE_LABELS[item.item_type] ?? item.item_type}
                  </Badge>
                  <span className="font-medium text-sm truncate">{item.item_name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From <span className="font-medium text-foreground">{item.owner_name}</span>
                  {' · '}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
                {item.message && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{item.message}"</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/share/${item.token}`)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View
              </Button>

              {isImported ? (
                <div className="flex items-center gap-1.5 text-emerald-500 text-xs px-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Imported
                </div>
              ) : (
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={importing === item.friend_share_id}
                  onClick={() => handleImport(item)}
                >
                  {importing === item.friend_share_id ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Import
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sharing/SharedInbox.tsx
git commit -m "feat: add SharedInbox component"
```

---

## Task 11: Friends Tab in Settings

**Files:**
- Modify: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add new imports to settings/page.tsx**

Add to the existing imports:
```ts
import { Users, UserPlus, UserCheck, UserX, Mail } from 'lucide-react'
```

- [ ] **Step 2: Add friends state to settings component**

Add below existing state declarations:
```ts
const [friendsLoaded, setFriendsLoaded] = useState(false)
const [friendships, setFriendships] = useState<FriendshipRow[]>([])
const [friendSearch, setFriendSearch] = useState('')
const [searchResults, setSearchResults] = useState<SearchResult[]>([])
const [friendSearching, setFriendSearching] = useState(false)
const [addingFriend, setAddingFriend] = useState<string | null>(null)
const [friendActionMsg, setFriendActionMsg] = useState<string | null>(null)
const [username, setUsername] = useState(user?.username ?? '')
const [savingUsername, setSavingUsername] = useState(false)
const [usernameError, setUsernameError] = useState<string | null>(null)

interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string | null
  invited_email: string | null
  status: string
  other_user: { id: string; name: string; username?: string } | null
}

interface SearchResult {
  id: string
  name: string
  username?: string
}

async function getToken() {
  const { createClient } = await import('@/lib/supabase')
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

async function loadFriendships() {
  const token = await getToken()
  if (!token) return
  const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } })
  if (res.ok) setFriendships(await res.json())
  setFriendsLoaded(true)
}

async function handleFriendSearch(q: string) {
  setFriendSearch(q)
  if (!q.trim()) { setSearchResults([]); return }
  setFriendSearching(true)
  const token = await getToken()
  if (!token) { setFriendSearching(false); return }
  const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  setSearchResults(res.ok ? await res.json() : [])
  setFriendSearching(false)
}

async function handleAddFriend(addresseeId?: string, email?: string) {
  const token = await getToken()
  if (!token) return
  setAddingFriend(addresseeId ?? email ?? '')
  setFriendActionMsg(null)
  const body = addresseeId ? { addressee_id: addresseeId } : { email }
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (res.ok) {
    setFriendActionMsg(data.type === 'invite_sent' ? `Invite sent to ${email}` : 'Request sent!')
    setSearchResults([])
    setFriendSearch('')
    await loadFriendships()
  } else {
    setFriendActionMsg(data.error ?? 'Error')
  }
  setAddingFriend(null)
}

async function handleFriendRespond(friendshipId: string, action: 'accept' | 'decline') {
  const token = await getToken()
  if (!token) return
  await fetch('/api/friends/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ friendship_id: friendshipId, action }),
  })
  await loadFriendships()
}

async function handleRemoveFriend(friendshipId: string) {
  const token = await getToken()
  if (!token) return
  await fetch(`/api/friends/${friendshipId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  await loadFriendships()
}

async function handleSaveUsername() {
  if (!username.trim()) return
  setSavingUsername(true)
  setUsernameError(null)
  const token = await getToken()
  if (!token) { setSavingUsername(false); return }
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username }),
  })
  if (res.ok) {
    toast.success('Username saved!')
  } else {
    const err = await res.json()
    setUsernameError(err.error ?? 'Error saving username')
  }
  setSavingUsername(false)
}
```

- [ ] **Step 3: Change grid-cols-4 to grid-cols-5 and add Friends tab trigger**

Find line: `<TabsList className="grid w-full grid-cols-4">`
Change to: `<TabsList className="grid w-full grid-cols-5">`

After the last `<TabsTrigger value="data">` block, add:
```tsx
<TabsTrigger value="friends" className="gap-1.5" onClick={() => { if (!friendsLoaded) void loadFriendships() }}>
  <Users className="w-3.5 h-3.5" />
  <span className="hidden sm:inline">Friends</span>
</TabsTrigger>
```

- [ ] **Step 4: Add the Friends TabsContent**

After the last `</TabsContent>` (the data tab), add:
```tsx
<TabsContent value="friends" className="space-y-6 mt-6">
  {/* Username */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Your Username</CardTitle>
      <CardDescription>Friends can find you by username.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            className="pl-7"
            placeholder="e.g. fitnessfan_99"
            maxLength={20}
          />
        </div>
        <Button onClick={handleSaveUsername} disabled={savingUsername}>
          {savingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </Button>
      </div>
      {usernameError && <p className="text-xs text-rose-500">{usernameError}</p>}
      <p className="text-xs text-muted-foreground">3–20 characters, lowercase letters, numbers, underscores only.</p>
    </CardContent>
  </Card>

  {/* Add friend */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Add a Friend</CardTitle>
      <CardDescription>Search by username or email address.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="@username or email@example.com"
          value={friendSearch}
          onChange={(e) => handleFriendSearch(e.target.value)}
        />
        {friendSearch.includes('@') && !friendSearch.startsWith('@') && (
          <Button
            variant="outline"
            disabled={!!addingFriend}
            onClick={() => handleAddFriend(undefined, friendSearch)}
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Invite
          </Button>
        )}
      </div>
      {friendActionMsg && (
        <p className="text-xs text-emerald-500">{friendActionMsg}</p>
      )}
      {searchResults.length > 0 && (
        <div className="space-y-1 rounded-xl border border-border/60 overflow-hidden">
          {searchResults.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{r.name}</p>
                {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
              </div>
              <Button
                size="sm"
                disabled={addingFriend === r.id}
                onClick={() => handleAddFriend(r.id)}
              >
                {addingFriend === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>

  {/* Pending incoming */}
  {friendships.filter((f) => f.status === 'pending' && f.addressee_id === user?.id).length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {friendships
          .filter((f) => f.status === 'pending' && f.addressee_id === user?.id)
          .map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {f.other_user?.name?.charAt(0) ?? '?'}
              </div>
              <p className="flex-1 text-sm font-medium">{f.other_user?.name ?? 'Unknown'}</p>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleFriendRespond(f.id, 'accept')}>
                <UserCheck className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleFriendRespond(f.id, 'decline')}>
                <UserX className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  )}

  {/* Accepted friends */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Friends ({friendships.filter((f) => f.status === 'accepted').length})</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {friendships.filter((f) => f.status === 'accepted').length === 0 ? (
        <p className="text-sm text-muted-foreground">No friends yet.</p>
      ) : (
        friendships.filter((f) => f.status === 'accepted').map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {f.other_user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{f.other_user?.name ?? 'Unknown'}</p>
              {f.other_user?.username && <p className="text-xs text-muted-foreground">@{f.other_user.username}</p>}
            </div>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-400" onClick={() => handleRemoveFriend(f.id)}>
              Remove
            </Button>
          </div>
        ))
      )}
    </CardContent>
  </Card>

  {/* Outgoing pending + invited */}
  {friendships.filter((f) => ['pending', 'invited'].includes(f.status) && f.requester_id === user?.id).length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sent Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {friendships
          .filter((f) => ['pending', 'invited'].includes(f.status) && f.requester_id === user?.id)
          .map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                {f.other_user?.name?.charAt(0) ?? f.invited_email?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{f.other_user?.name ?? f.invited_email ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{f.status === 'invited' ? 'Invite sent' : 'Pending'}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-400" onClick={() => handleRemoveFriend(f.id)}>
                Cancel
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  )}
</TabsContent>
```

- [ ] **Step 5: Add missing imports (Loader2, CardDescription)**

Ensure `Loader2` is in the lucide-react import and `CardDescription` is in the `@/components/ui/card` import.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/settings/page.tsx
git commit -m "feat: add Friends tab to Settings with friend management and username"
```

---

## Task 12: Notification Bell — share_received Type

**Files:**
- Modify: `components/dashboard/TopBar.tsx`

- [ ] **Step 1: Update TopBar notification rendering for share_received**

In `TopBar.tsx`, find the color dot rendering block (around line 331–338):
```tsx
<span className={`h-2 w-2 rounded-full ${
  item.type === 'success'
    ? 'bg-emerald-400'
    : item.type === 'warning'
      ? 'bg-amber-400'
      : item.type === 'error'
        ? 'bg-rose-400'
        : 'bg-sky-400'
}`} />
```

Update to handle `share_received`:
```tsx
<span className={`h-2 w-2 rounded-full ${
  item.type === 'success'
    ? 'bg-emerald-400'
    : item.type === 'warning'
      ? 'bg-amber-400'
      : item.type === 'error'
        ? 'bg-rose-400'
        : item.type === 'share_received'
          ? 'bg-purple-400'
          : 'bg-sky-400'
}`} />
```

- [ ] **Step 2: Update the action link text for share_received**

Find the action link rendering (around line 346–350):
```tsx
{item.action_url && (
  <div className="mt-3 flex items-center text-xs text-muted-foreground">
    Open {PAGE_TITLES[item.action_url] || 'page'}
  </div>
)}
```

Update to show better text for share links:
```tsx
{item.action_url && (
  <div className="mt-3 flex items-center text-xs text-muted-foreground">
    {item.type === 'share_received' ? 'View shared item →' : `Open ${PAGE_TITLES[item.action_url] || 'page'}`}
  </div>
)}
```

- [ ] **Step 3: Add inbox link in notifications dialog**

Import `SharedInbox` at the top of the file:
```ts
import { SharedInbox } from '@/components/sharing/SharedInbox'
```

Add a "Shared with me" toggle button inside the notifications dialog (after the "Mark all read" button):
```tsx
const [showInbox, setShowInbox] = useState(false)

// In the dialog header right section:
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={() => setShowInbox((v) => !v)}
  className="h-8 rounded-lg gap-1.5"
>
  <Share2 className="w-3.5 h-3.5" />
  {showInbox ? 'Notifications' : 'Shared with me'}
</Button>
```

Add `Share2` to the lucide-react imports.

In the dialog content, show either notifications or inbox:
```tsx
<div className="max-h-[420px] overflow-y-auto p-5">
  {showInbox ? (
    <SharedInbox />
  ) : (
    <div className="space-y-3">
      {notifications.map((item) => (
        // ... existing notification items
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/TopBar.tsx
git commit -m "feat: handle share_received notifications + shared inbox in bell"
```

---

## Task 13: Final Wiring — Notifications Table Check

**Note:** The `POST /api/share/send` route inserts into a `notifications` table (`user_id`, `type`, `title`, `message`, `read`, `action_url`, `created_at`). Verify this table exists in Supabase and matches these columns. If the app uses a different table or mechanism for notifications, adjust the route accordingly.

- [ ] **Step 1: Verify notifications table structure in Supabase**

In the Supabase dashboard, confirm that the `notifications` table (or equivalent) has columns: `id`, `user_id`, `type`, `title`, `message`, `read`, `action_url`, `created_at`.

If notifications are stored differently (e.g., only in Zustand local state, not a DB table), update `POST /api/share/send` to skip the DB insert and only send the `friend_shares` rows. The recipient will see the share in their inbox regardless.

- [ ] **Step 2: Test end-to-end flow**

1. Create a custom workout and click the Share button
2. On the Link tab: click "Generate & Copy Link" — verify URL is copied
3. Visit the URL in an incognito window — verify preview page loads
4. Click "Log in" — verify redirect back to share page after auth
5. Click "Import to my account" — verify success message
6. Go to Settings → Friends — set a username
7. Search for another user by username — send a friend request
8. Accept the request from the other account
9. Share a workout to the friend — verify notification appears in their bell
10. Open the notification → verify "View shared item" link works
11. Open "Shared with me" in the bell → verify inbox shows the item
12. Click Import from inbox → verify imported checkmark

- [ ] **Step 3: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: sharing end-to-end wiring adjustments"
```

---

## Task 14: Deploy to Vercel Production

- [ ] **Step 1: Verify build passes**

```bash
npm run build
```

- [ ] **Step 2: Set `NEXT_PUBLIC_APP_URL` env var on Vercel**

In Vercel dashboard → Settings → Environment Variables, add:
```
NEXT_PUBLIC_APP_URL=https://your-production-domain.vercel.app
```

This is needed by `POST /api/share/create` to generate the full share URL.

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```
