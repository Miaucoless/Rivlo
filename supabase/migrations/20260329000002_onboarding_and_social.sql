alter table profiles
  add column if not exists preferred_workout_days text[] default '{}',
  add column if not exists training_experience text
    check (training_experience in ('beginner','intermediate','advanced')),
  add column if not exists dietary_style text
    check (dietary_style in ('balanced','high_protein','vegetarian','vegan','pescatarian','low_carb')),
  add column if not exists biggest_challenge text,
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists share_reactions (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references shared_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('fire','love','try_this','inspired')),
  created_at timestamptz not null default now(),
  unique (share_id, user_id)
);

create index if not exists share_reactions_share_idx on share_reactions (share_id, created_at desc);
create index if not exists share_reactions_user_idx on share_reactions (user_id, created_at desc);

alter table share_reactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_reactions' and policyname = 'share reactions readable'
  ) then
    create policy "share reactions readable"
      on share_reactions for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_reactions' and policyname = 'users manage own reactions'
  ) then
    create policy "users manage own reactions"
      on share_reactions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists share_comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references shared_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists share_comments_share_idx on share_comments (share_id, created_at desc);
create index if not exists share_comments_user_idx on share_comments (user_id, created_at desc);

alter table share_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_comments' and policyname = 'share comments readable'
  ) then
    create policy "share comments readable"
      on share_comments for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_comments' and policyname = 'users create own comments'
  ) then
    create policy "users create own comments"
      on share_comments for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
