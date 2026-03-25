# Share with Friends — Design Spec

## Goal

Allow users to share their saved workouts, saved meal templates, and custom recipes with friends — either via a shareable link or directly to specific friends within the app.

## Architecture

Supabase-native. Three new database tables handle all sharing state. All mutations go through Next.js API routes (server-side) to keep the Supabase service role key off the client. Reads of public share pages also go through an API route so no credentials are needed in the browser.

Item data is **snapshotted** at share time into a `jsonb` column — the recipient always sees what was shared, not a live reference. Importing gives the recipient their own independent copy.

## Tech Stack

- Next.js 14 App Router (existing)
- Supabase (existing) — new tables + RLS policies
- Zustand store (existing) — extended for friends list + share inbox
- shadcn/ui (existing) — Dialog, Tabs, Badge, Input, Button

---

## Data Model

### `shared_items`

Stores one row per shareable item. The share token is used for link sharing.

```sql
id            uuid primary key default gen_random_uuid()
owner_id      uuid not null references auth.users(id) on delete cascade
item_type     text not null  -- 'workout' | 'saved_meal' | 'recipe'
item_name     text not null  -- denormalised for display without parsing jsonb
item_data     jsonb not null -- full snapshot of the item at share time
share_token   text not null unique default substr(gen_random_uuid()::text, 1, 8)
message       text           -- optional note from the sharer
created_at    timestamptz not null default now()
```

RLS:
- Owner can insert, update, delete their own rows.
- Anyone (including unauthenticated) can select by `share_token`.
- Authenticated users can select rows where they appear in `friend_shares`.

### `friendships`

Tracks friend relationships. One row per directed pair (requester → addressee).

```sql
id             uuid primary key default gen_random_uuid()
requester_id   uuid not null references auth.users(id) on delete cascade
addressee_id   uuid not null references auth.users(id) on delete cascade
status         text not null default 'pending'  -- 'pending' | 'accepted' | 'declined'
created_at     timestamptz not null default now()
updated_at     timestamptz not null default now()
unique (requester_id, addressee_id)
```

RLS:
- A user can see all rows where they are requester or addressee.
- A user can insert rows where they are requester.
- A user can update `status` on rows where they are addressee.
- A user can delete rows where they are requester or addressee.

### `friend_shares`

The recipient inbox. Created when a share is sent to specific friends.

```sql
id            uuid primary key default gen_random_uuid()
share_id      uuid not null references shared_items(id) on delete cascade
recipient_id  uuid not null references auth.users(id) on delete cascade
viewed_at     timestamptz
imported_at   timestamptz
created_at    timestamptz not null default now()
unique (share_id, recipient_id)
```

RLS:
- Recipient can select and update their own rows.
- Owner of the parent `shared_items` row can select (to see delivery status).

### `user_profiles` — username addition

Add a `username` column (unique, nullable initially, set during onboarding or Settings):

```sql
alter table user_profiles add column username text unique;
```

---

## API Routes

All routes live under `app/api/`.

### Sharing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/share/create` | Snapshot item + generate token. Body: `{ item_type, item_data, item_name, message? }`. Returns `{ token, url }`. |
| POST | `/api/share/send` | Send an existing share to friends. Body: `{ share_id, recipient_ids[] }`. Creates `friend_shares` rows and in-app notifications. |
| GET | `/api/share/[token]` | Fetch shared item by token. Public — no auth required. Returns `{ item_type, item_name, item_data, owner_name, message, created_at }`. |
| POST | `/api/share/[token]/import` | Clone item into the authenticated user's account. Writes to the appropriate table (`recipes`, `workout_templates`, or `saved_meals`). Updates `friend_shares.imported_at` if applicable. |

### Friends

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/friends` | List accepted friends + pending incoming/outgoing requests. |
| GET | `/api/friends/search?q=` | Search existing users by email or username. Returns `{ id, name, username, avatar_url }[]`. Excludes current user and existing friends. |
| POST | `/api/friends/request` | Send a friend request. Body: `{ addressee_id? }` for existing users, or `{ email }` to invite a non-user (sends invite email via Supabase auth). |
| POST | `/api/friends/respond` | Accept or decline a request. Body: `{ friendship_id, action: 'accept' | 'decline' }`. |
| DELETE | `/api/friends/[friendId]` | Remove a friend or cancel a pending request. |

---

## UI Components

### Share Button

Added to the action menu (3-dot or explicit icon) on:
- Custom workout cards — Workouts page
- Saved meal template cards — Meals page
- Custom recipe cards — Meals page

### `ShareModal` (`components/sharing/ShareModal.tsx`)

A Dialog with two tabs:

**Link tab**
- "Copy link" button — calls `POST /api/share/create` on first click, then copies the returned URL to clipboard.
- Shows the generated URL in a read-only input after creation.

**Friends tab**
- Search input — queries `GET /api/friends/search` debounced, or filters the existing friends list locally.
- Selectable friend chips (checkboxes).
- Optional message textarea.
- "Send" button — calls `POST /api/share/send` with selected friend IDs.
- Sent confirmation with per-friend status (sent / already shared).

### `/share/[token]` page (`app/share/[token]/page.tsx`)

Public page — no auth required to view.

- Renders item details (exercise list for workouts, ingredients/macros for meals).
- "Import to my account" button — if unauthenticated, redirects to `/signup?redirect=/share/[token]`; if authenticated, calls `POST /api/share/[token]/import`.
- Shows sharer's display name and optional message.
- Graceful 404 if token is invalid.

### Notification bell — share alerts

Existing notification system extended:
- New notification type `'share_received'`.
- Bell badge increments for unread share notifications.
- Dropdown item shows sharer name + item name with inline "View" and "Import" buttons.

### "Shared with me" inbox (`components/sharing/SharedInbox.tsx`)

A panel/tab accessible from the notifications dropdown or a dedicated route:
- Lists all `friend_shares` rows for the current user, newest first.
- Filter by type: All / Workouts / Meals.
- Each card: sharer avatar + name, item name, timestamp, optional message, "View" and "Import" buttons.
- "Import" button calls `POST /api/share/[token]/import` and marks the card as imported.

### Friends tab in Settings (`app/dashboard/settings/page.tsx`)

New "Friends" tab added to existing settings tabs:
- **Add friend** — search input (`GET /api/friends/search`), shows user result with "Add" button; or enter any email to invite.
- **Friends list** — accepted friends with avatar, name, username, "Remove" button.
- **Pending sent** — outgoing requests with "Cancel" option.
- **Pending received** — incoming requests with "Accept" / "Decline" buttons.

---

## Data Flow

### Sharing via link

```
User clicks Share → ShareModal (Link tab)
  → POST /api/share/create → shared_items row inserted → token returned
  → URL copied to clipboard
Recipient visits /share/[token]
  → GET /api/share/[token] → item preview rendered
  → clicks Import → POST /api/share/[token]/import
    → item cloned into user's account table
```

### Sharing to friends

```
User clicks Share → ShareModal (Friends tab) → selects friends → Send
  → POST /api/share/create (if not yet created)
  → POST /api/share/send → friend_shares rows inserted
    → notification rows inserted for each recipient
Recipient sees badge on bell → opens dropdown → View / Import
  → same import flow as link sharing
```

### Adding a friend

```
User searches email/username → result shown → clicks Add
  → POST /api/friends/request
    → existing user: friendships row (pending) inserted
    → non-user: Supabase auth invite email sent + pending_invite tracked
Addressee sees incoming request in notifications + Settings → Accept
  → POST /api/friends/respond { action: 'accept' }
    → friendships.status updated to 'accepted'
```

---

## Error Handling

- Invalid / expired share token → `/share/[token]` returns 404 with a clear message.
- Import while not logged in → redirect to `/signup?redirect=/share/[token]`, auto-import after sign-up.
- Duplicate friend request → API returns 409, UI shows "Request already sent."
- Sharing to a non-friend (email not found) → invite email sent, UI shows "Invite sent to [email]."
- Import of already-imported item → API is idempotent; returns the existing item ID.

---

## Username Addition

`UserProfile` type gains:
```ts
username?: string
```

- Set on the Settings page (Profile tab) — unique, lowercase, alphanumeric + underscores, 3–20 chars.
- Displayed on the `/share/[token]` page and friend search results.
- Existing users without a username can still be found by email.
