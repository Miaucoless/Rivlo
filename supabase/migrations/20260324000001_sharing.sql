-- supabase/migrations/20260324000001_sharing.sql

-- 1. username on profiles
alter table profiles
  add column if not exists username text unique
  check (username ~ '^[a-z0-9_]{3,20}$');

create index if not exists profiles_username_idx on profiles (username);

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

-- 6. DB notifications (for server-pushed notifications like share_received)
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null default 'info',
  title        text not null,
  message      text not null,
  read         boolean not null default false,
  action_url   text,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;
create policy "notifications_own"
  on notifications for all
  using (user_id = auth.uid());
