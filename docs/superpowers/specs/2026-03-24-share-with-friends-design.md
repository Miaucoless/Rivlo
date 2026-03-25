# Share with Friends — Design Spec

## Goal

Allow users to share their saved workouts (custom workout templates), saved meal templates, and custom recipes with friends — either via a shareable link or directly to specific friends within the app.

## Architecture

Supabase-native. Three new database tables handle all sharing state. All mutations go through Next.js API routes (server-side) using the Supabase **service role key** — the client never writes directly to sharing tables. All `GET /api/share/[token]` reads also use the **service role key** (bypassing RLS) so the public page never requires a client credential.

Item data is **snapshotted** at share time into a `jsonb` column — the recipient always sees what was shared, not a live reference. Importing gives the recipient their own independent copy.

## Tech Stack

- Next.js 14 App Router (existing)
- Supabase (existing) — new tables + RLS policies
- Zustand store (existing) — extended for friends list + share inbox
- shadcn/ui (existing) — Dialog, Tabs, Badge, Input, Button

---

## Data Model

### `shared_items`

```sql
id            uuid primary key default gen_random_uuid()
owner_id      uuid not null references auth.users(id) on delete cascade
item_type     text not null
              -- 'workout' = workout_templates (reusable custom workouts only)
              -- 'saved_meal' = saved_meals
              -- 'recipe' = custom recipes
              -- workout_logs (completed sessions) are NOT shareable in v1
item_name     text not null
item_data     jsonb not null  -- full snapshot at share time
share_token   text not null unique default substr(gen_random_uuid()::text, 1, 12)
              -- 12 hex chars; API retries up to 3× on unique constraint violation
message       text
created_at    timestamptz not null default now()

create index on shared_items (owner_id);
```

RLS: All reads and writes go through server-side API routes using the service role key. No client-facing RLS policies are required for this table.

### `friendships`

```sql
id             uuid primary key default gen_random_uuid()
requester_id   uuid not null references auth.users(id) on delete cascade
addressee_id   uuid references auth.users(id) on delete cascade
               -- null when addressee hasn't signed up yet
invited_email  text
               -- set when addressee_id is null; cleared on invite promotion
status         text not null default 'pending'
               -- 'pending' | 'accepted' | 'declined' | 'invited'
               -- 'invited' = non-user invite sent; promoted to 'pending' on sign-up
created_at     timestamptz not null default now()
updated_at     timestamptz not null default now()

-- For existing users: prevent duplicate requests
create unique index on friendships (requester_id, addressee_id)
  where addressee_id is not null;

-- For non-user invites: prevent duplicate invites to same email
create unique index on friendships (requester_id, invited_email)
  where invited_email is not null;

create index on friendships (requester_id);
create index on friendships (addressee_id);
create index on friendships (invited_email);
```

`updated_at` must be kept current via a `BEFORE UPDATE` trigger:
```sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger friendships_updated_at
before update on friendships
for each row execute function set_updated_at();
```

**Invite promotion:** When a non-user signs up, the sign-up completion handler (see Sign-up Flow below) queries `friendships WHERE invited_email = new_user.email`, then updates each row: `addressee_id = new_user.id`, `invited_email = NULL`, `status = 'pending'`. The new user then sees pending friend requests in their notifications.

RLS: All reads and writes go through server-side API routes using the service role key.

### `friend_shares`

```sql
id            uuid primary key default gen_random_uuid()
share_id      uuid not null references shared_items(id) on delete cascade
recipient_id  uuid not null references auth.users(id) on delete cascade
viewed_at     timestamptz
imported_at   timestamptz
created_at    timestamptz not null default now()
unique (share_id, recipient_id)

create index on friend_shares (recipient_id);
create index on friend_shares (share_id);  -- for owner delivery-status queries
```

RLS (used only for direct client reads — not the primary path):
- Recipient select: `recipient_id = auth.uid()`
- Owner select for delivery status: `EXISTS (SELECT 1 FROM shared_items si WHERE si.id = friend_shares.share_id AND si.owner_id = auth.uid())`
- All inserts use the service role key via `/api/share/send`.

### `user_profiles` — username addition

```sql
alter table user_profiles
  add column username text unique
  check (username ~ '^[a-z0-9_]{3,20}$');
```

- Always stored lowercase. Search queries must call `lower(q)` before exact-match lookup.
- Nullable — existing users without a username can still be found by email.
- Set/updated via `PATCH /api/profile` (see API routes below).

### `types/index.ts` changes

```ts
// Notification.type — add share_received
type: 'info' | 'success' | 'warning' | 'error' | 'share_received'

// UserProfile — add username
username?: string
```

`share_received` notifications use the existing `action_url` field (points to `/share/[token]`) and the existing `message` field (item name + sender name). No new fields needed.

---

## API Routes

All routes use the Supabase **service role key** server-side. Endpoints that mutate data require authentication; the public share read does not.

### Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/share/create` | Required | Snapshot item + generate 12-char token. Body: `{ item_type, item_data, item_name, message? }`. Retries up to 3× on token collision (returns 500 if all fail). Returns `{ share_id, token, url }`. |
| POST | `/api/share/send` | Required | Send share to friends. Body: `{ share_id, recipient_ids[] }`. Validates that each `recipient_id` appears in an `accepted` friendship with the current user — checks both directions: `(requester_id = current_user AND addressee_id = recipient) OR (addressee_id = current_user AND requester_id = recipient)`. Returns 422 for any invalid recipient. Creates `friend_shares` rows + `share_received` notifications. |
| GET | `/api/share/[token]` | None | Fetch shared item by token using service role key. Returns `{ item_type, item_name, item_data, owner_name, message, created_at }`. Returns 404 with `{ error: "This link is invalid or has expired." }` for missing token. |
| POST | `/api/share/[token]/import` | Required | Clone item into user's account. Writes to `recipes`, `workout_templates`, or `saved_meals`. Body: `{ friend_share_id? }`. **Idempotency:** looks up `imported_items` (see below) by `(user_id, share_id)` — returns existing item ID if found without re-inserting. Updates `friend_shares.imported_at` if `friend_share_id` is provided. |
| GET | `/api/share/inbox` | Required | List all `friend_shares` rows for current user, joined with `shared_items`. Supports `?type=workout\|saved_meal\|recipe`. Returns newest-first. |

**Import idempotency — `imported_items` table:**

```sql
create table imported_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  share_id    uuid not null references shared_items(id) on delete cascade,
  result_id   text not null,  -- ID of the cloned item in its destination table
  created_at  timestamptz not null default now(),
  unique (user_id, share_id)
);
create index on imported_items (user_id);
```

The import route inserts into `imported_items` after creating the clone. On duplicate `(user_id, share_id)`, it returns the existing `result_id`.

### Friends

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/friends` | Required | List accepted friends + pending incoming/outgoing + `invited` rows for current user. |
| GET | `/api/friends/search?q=` | Required | Search users by email (exact) or username (exact, after `lower(q)`). Returns `{ id, name, username, avatar_url }[]`. Excludes current user and users already in a friendship or pending request. |
| POST | `/api/friends/request` | Required | Body: `{ addressee_id }` OR `{ email }`. **If `email` provided:** first checks whether that email belongs to an existing user — if yes, treats as `{ addressee_id }` flow. If no existing user, sends Supabase auth invite email + inserts `friendships` row with `status = 'invited'`. Returns 409 if a relationship already exists. |
| POST | `/api/friends/respond` | Required | Body: `{ friendship_id, action: 'accept' \| 'decline' }`. Updates `friendships.status`. |
| DELETE | `/api/friends/[friendId]` | Required | Removes accepted friendship or cancels pending/invited request. **Authorization:** for `invited`/`pending` rows, only `requester_id = current_user` may delete (prevents addressee from cancelling someone else's outgoing request). For `accepted` rows, either party may delete: `requester_id = current_user OR addressee_id = current_user`. Returns 403 if neither condition is met. |
| PATCH | `/api/profile` | Required | Update display name, avatar, or username. Body: `{ name?, username?, avatar_url? }`. Returns 409 `{ error: "Username already taken." }` when username conflicts with existing row. |

---

## Sign-up Flow (post-sign-up actions)

After a new user completes sign-up, the existing auth handler must perform two additional steps:

1. **Invite promotion:** Query `friendships WHERE invited_email = new_user.email`. For each row: set `addressee_id = new_user.id`, `invited_email = NULL`, `status = 'pending'`. Insert one `'info'` notification for the new user (type = `'info'`, message = "You have N pending friend request(s)", `action_url = '/dashboard/settings?tab=friends'`). No new notification type is needed — the existing `'info'` type is sufficient.

2. **Auto-import from share link:** If the sign-up URL contained `?redirect=/share/[token]`, after sign-up completion redirect to that URL. The `/share/[token]` page detects the authenticated session and immediately calls `POST /api/share/[token]/import` (no `friend_share_id`). The import result page shows a success message before the user reaches the main dashboard.

---

## UI Components

### Share Button

Added to the action menu on:
- Custom workout template cards (Workouts page)
- Saved meal template cards (Meals page)
- Custom recipe cards (Meals page)

### `ShareModal` (`components/sharing/ShareModal.tsx`)

Dialog with two tabs:

**Link tab:** "Copy link" → calls `POST /api/share/create` on first click → copies URL to clipboard → shows URL in read-only input.

**Friends tab:** Debounced search of friends list (local filter) or `GET /api/friends/search`. Multi-select friend chips. Optional message. "Send" → `POST /api/share/create` (if not yet created) then `POST /api/share/send`. Confirmation with per-friend sent status. 422 errors shown inline ("Could not send to [name]").

### `/share/[token]` page (`app/share/[token]/page.tsx`)

Public. Renders item preview. Authenticated: "Import to my account" → `POST /api/share/[token]/import`. Unauthenticated: shows **two buttons** — "Sign up to import" (→ `/signup?redirect=/share/[token]`) and "Log in to import" (→ `/login?redirect=/share/[token]`) — so both new and existing logged-out users have a clear path. Invalid token: 404 message page.

### Notification bell

New `share_received` notifications increment the badge. Dropdown item shows sender + item name with "View" (→ `/share/[token]`) and "Import" (→ `POST /api/share/[token]/import { friend_share_id }`) buttons.

### "Shared with me" inbox (`components/sharing/SharedInbox.tsx`)

Accessible from notifications dropdown. Lists `GET /api/share/inbox` results. Filter by type. Each card: sender, item, timestamp, message, View + Import buttons. Imported items show a checkmark.

### Friends tab in Settings

New tab in `app/dashboard/settings/page.tsx`:
- Add friend search + email invite input.
- Accepted friends list with Remove button.
- Pending sent (including `invited`) with Cancel button.
- Pending received with Accept / Decline buttons.

---

## Error Handling Summary

| Scenario | Behaviour |
|----------|-----------|
| Invalid share token | 404 `{ error: "This link is invalid or has expired." }` |
| Import while unauthenticated | Two buttons shown: "Sign up" (→ `/signup?redirect=/share/[token]`) and "Log in" (→ `/login?redirect=/share/[token]`); auto-import after auth |
| Import already done | Idempotent — returns existing item ID via `imported_items` table |
| Token collision (create) | Retry up to 3×; 500 if all fail |
| Duplicate friend request | 409; UI shows "Request already sent." |
| Non-user email invite | Invite email sent; UI shows "Invite sent to [email]." |
| Email belongs to existing user | Promote to normal friend request silently |
| Send share to non-friend | 422; UI shows "Could not send to [name]." |
| Username taken (profile update) | 409 `{ error: "Username already taken." }`; inline error in Settings |
